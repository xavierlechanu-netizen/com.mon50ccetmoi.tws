/**
 * @jest-environment node
 *
 * Cerveau mixte de Nexus Atlas (19/11/2026) : Nexus Atlas d'abord, Mistral 7B (sur le VPS) seulement
 * s'il n'a pas la réponse. Règle absolue de l'utilisateur : JAMAIS Mistral pour une urgence.
 * Mistral est simulé ici.
 */
const fs = require("fs");
const path = require("path");

const B = require("../sovereign-core/server/nexus-brain");
const V = require("../sovereign-core/server/nexus-verifier");
const { createSovereignApp } = require("../sovereign-core/server/index");
const { createMemoryStore } = require("../sovereign-core/server/store-memory");
const { signSovereignJwt } = require("../sovereign-core/server/crypto-auth");

const localCode = fs.readFileSync(path.join(__dirname, "..", "src", "js", "nexus-brain-local.js"), "utf8").replace(/^export /gm, "");
// eslint-disable-next-line no-new-func
const L = new Function(`${localCode}; return { createNexusBrainLocal, isEmergency, legalAnswer, EMERGENCY_PATTERNS, REPLY_LATER, REPLY_EMERGENCY };`)();

const URGENCES = [
  "Je suis tombé, j'ai mal à la jambe",
  "je suis tombé",
  "Accident avec une voiture au rond-point",
  "Au secours !",
  "aidez-moi",
  "Appelle les pompiers",
  "je saigne beaucoup",
  "SOS",
  "J'ai très mal au bras après la chute",
  "Mon ami est inconscient",
  "il faut prévenir le samu",
];
const PAS_URGENCES = [
  "Je suis tombé en panne sur la route",
  "Mon scooter est en panne",
  "Il y a la police au rond-point",
  "Quelle pression pour mes pneus ?",
  "Raconte-moi une blague",
];

function fakeLlm(reply = "Vérifiez la bougie et le filtre à air. ⚠️ Je suis une intelligence artificielle d'assistance. Faites valider ces informations par un garagiste.") {
  return { model: "mistral:7b", chat: jest.fn(async () => reply) };
}

describe("Urgences : jamais Mistral", () => {
  test("mêmes règles dans l'appli et sur le serveur", () => {
    expect(L.EMERGENCY_PATTERNS.map(String)).toEqual(B.EMERGENCY_PATTERNS.map(String));
  });

  test.each(URGENCES)("urgence reconnue : %s", (t) => {
    expect(B.isEmergency(t)).toBe(true);
    expect(L.isEmergency(t)).toBe(true);
  });

  test.each(PAS_URGENCES)("pas une urgence : %s", (t) => {
    expect(B.isEmergency(t)).toBe(false);
    expect(L.isEmergency(t)).toBe(false);
  });

  test("serveur : aucune urgence n'atteint Mistral ni le carnet", async () => {
    const store = createMemoryStore();
    const llm = fakeLlm();
    const brain = B.createNexusBrain({ store, llm });
    for (const t of URGENCES) {
      const r = await brain.ask({ question: t });
      expect(r).toMatchObject({ source: "urgence", action: "SOS" });
      expect(r.reply).toMatch(/112/);
    }
    expect(llm.chat).not.toHaveBeenCalled();
    expect(await store.listNexusNotebook({})).toEqual([]);
  });

  test("appli : urgence → SOS sans demander ni aux commandes, ni à la loi, ni au serveur", async () => {
    const localEngine = { processQuery: jest.fn(), executeAction: jest.fn() };
    const askServer = jest.fn();
    const loadLegal = jest.fn();
    const brain = L.createNexusBrainLocal({ localEngine, loadLegal, askServer });
    for (const t of URGENCES) expect(await brain.ask(t)).toMatchObject({ action: "SOS", source: "urgence" });
    expect(localEngine.processQuery).not.toHaveBeenCalled();
    expect(loadLegal).not.toHaveBeenCalled();
    expect(askServer).not.toHaveBeenCalled();
  });
});

describe("Serveur : réponses apprises, loi, Mistral, « réessayez plus tard »", () => {
  test("la loi ne va jamais à Mistral", async () => {
    const llm = fakeLlm();
    const brain = B.createNexusBrain({ store: createMemoryStore(), llm });
    for (const t of ["Je peux rouler sur l'autoroute ?", "Quelle amende pour un débridage ?", "À quel âge on peut conduire un 50 ?",
      "Le casque est obligatoire ?", "Mon assureur refuse de payer"]) {
      expect(await brain.ask({ question: t })).toMatchObject({ source: "loi" });
    }
    expect(llm.chat).not.toHaveBeenCalled();
  });

  test("question nouvelle : Mistral répond avec la personnalité du serveur, gardée « à vérifier »", async () => {
    const store = createMemoryStore();
    const llm = fakeLlm();
    const verifier = { enqueue: jest.fn() };
    const brain = B.createNexusBrain({ store, llm, verifier });
    const r = await brain.ask({ question: "Mon scooter cale quand il fait froid, une idée ? Écrivez-moi à moi@exemple.fr" });
    expect(r.source).toBe("mistral");
    const [messages] = llm.chat.mock.calls[0];
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toMatch(/Nexus Atlas/);
    expect(messages[0].content).toMatch(/JAMAIS une urgence/);
    const [entry] = await store.listNexusNotebook({});
    expect(entry.status).toBe("a_verifier");
    expect(entry.question).not.toContain("moi@exemple.fr"); // donnée personnelle retirée
    expect(verifier.enqueue).toHaveBeenCalledWith(entry.id);
  });

  test("en roulant : réponse courte demandée à Mistral", async () => {
    const llm = fakeLlm();
    await B.createNexusBrain({ store: createMemoryStore(), llm }).ask({ question: "Une astuce pour la pluie ?", driving: true });
    expect(llm.chat.mock.calls[0][0][0].content).toMatch(/UNE ou DEUX phrases/);
    expect(llm.chat.mock.calls[0][1]).toEqual({ maxTokens: 120 });
  });

  test("Mistral absent, en erreur ou occupé : « Réessayez un peu plus tard », jamais d'invention", async () => {
    const store = createMemoryStore();
    expect((await B.createNexusBrain({ store, llm: null }).ask({ question: "Une astuce ?" })).reply).toBe(B.REPLY_LATER);
    const broken = { chat: jest.fn(async () => { throw new Error("timeout"); }) };
    const quiet = { warn: () => {} };
    expect((await B.createNexusBrain({ store, llm: broken, log: quiet }).ask({ question: "Une astuce ?" })).reply).toBe(B.REPLY_LATER);

    let release;
    const slow = { chat: jest.fn(() => new Promise((r) => { release = () => r("ok"); })) };
    const brain = B.createNexusBrain({ store, llm: slow });
    const first = brain.ask({ question: "Première question longue ?" });
    await new Promise((r) => setImmediate(r));
    expect(await brain.ask({ question: "Seconde question ?" })).toMatchObject({ source: "indisponible", reply: B.REPLY_LATER });
    release();
    expect((await first).source).toBe("mistral");
  });

  test("réponse validée : Nexus Atlas la redit lui-même, sans Mistral, même formulée un peu autrement", async () => {
    const store = createMemoryStore();
    const { id } = await store.recordNexusAnswer({ questionNorm: B.normalizeQuestion("Comment bien entretenir la chaîne de mon scooter ?"),
      question: "Comment bien entretenir la chaîne de mon scooter ?", answer: "Nettoyez-la puis graissez-la tous les 500 km." });
    const llm = fakeLlm();
    const brain = B.createNexusBrain({ store, llm });
    expect((await brain.ask({ question: "Comment bien entretenir la chaîne de mon scooter ?" })).source).toBe("mistral"); // pas encore validée
    await store.updateNexusEntry(id, { status: "valide", reviewedBy: "admin" });
    llm.chat.mockClear();
    expect(await brain.ask({ question: "comment bien entretenir la chaine de mon scooter" })).toMatchObject({ source: "appris" });
    expect(await brain.ask({ question: "Comment entretenir la chaîne de mon scooter ?" })).toMatchObject({ source: "appris" });
    expect(llm.chat).not.toHaveBeenCalled();
  });
});

describe("Agent vérificateur", () => {
  test("contrôles sans IA : les erreurs vues à l'essai du 19/11/2026 sont rejetées", () => {
    expect(V.ruleCheck("Il n'est pas recommandé de circuler sur une autoroute avec un 50 cc.").ok).toBe(false);
    expect(V.ruleCheck("Il faut le BSR (Brevet Spécialisé Régional).").ok).toBe(false);
    expect(V.ruleCheck("Pour une voiture sans permis il faut avoir 21 ans.").ok).toBe(false);
    expect(V.ruleCheck("Selon l'article R431-1, le casque…").ok).toBe(false);
    expect(V.ruleCheck("Appelez-moi au 06 12 34 56 78").ok).toBe(false);
    expect(V.ruleCheck("L'autoroute est interdite aux 50 cc.").ok).toBe(true);
    expect(V.ruleCheck("Le permis AM est possible dès 14 ans.").ok).toBe(true);
    expect(V.ruleCheck("Bonjour ! Bonne route.").ok).toBe(true);
  });

  test("tri : conversation sûre → validée seule ; mécanique → à vous ; erreur → rejetée ; Mistral occupé → plus tard", async () => {
    const store = createMemoryStore();
    let second = "NON\nRien à signaler.";
    const brain = { isIdle: () => true, withLlm: jest.fn(async (fn) => fn({ chat: async () => second })) };
    const verifier = V.createNexusVerifier({ store, brain });
    const add = async (q, a) => (await store.recordNexusAnswer({ questionNorm: B.normalizeQuestion(q), question: q, answer: a })).id;

    const blague = await add("Raconte une blague", "Pourquoi les motards sourient ? Parce qu'ils ont la tête dans le vent !");
    expect(await verifier.review(blague)).toBe("valide_auto");

    const meca = await add("Mon frein arrière grince", "Vérifiez les plaquettes. ⚠️ Faites valider par un garagiste.");
    expect(await verifier.review(meca)).toBe("a_verifier");
    expect((await store.getNexusEntry(meca)).reviewNote).toMatch(/relu par Mistral/);

    const faux = await add("Papiers pour une VSP ?", "Il faut le Brevet Spécialisé Régional.");
    expect(await verifier.review(faux)).toBe("rejete_auto");

    second = "OUI : conseil dangereux";
    const douteuse = await add("Raconte une blague", "x");
    await store.updateNexusEntry(douteuse, { status: "a_verifier" });
    const autre = await add("Salut, ça va ?", "Ça roule ! Prêt pour la route ?");
    expect(await verifier.review(autre)).toBe("a_verifier"); // le doute de Mistral vous laisse trancher

    const occupe = V.createNexusVerifier({ store, brain: { isIdle: () => false, withLlm: async () => null } });
    const enAttente = await add("Une astuce pour l'hiver ?", "Rangez le scooter à l'abri.");
    expect(await occupe.review(enAttente)).toBeNull();
  });
});

describe("Routes du serveur", () => {
  const ADMIN = "33333333-3333-4333-8333-333333333333";
  const PILOTE = "11111111-1111-4111-8111-111111111111";
  function call(app, method, url, { body, token } = {}) {
    return new Promise((resolve, reject) => {
      const req = { method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, socket: { remoteAddress: "10.3.3.3" } };
      const res = { statusCode: 200, setHeader() {}, end(p) { resolve({ status: this.statusCode, body: p ? JSON.parse(p) : null }); } };
      app.handleRequest(req, res, body ? Buffer.from(JSON.stringify(body)) : Buffer.alloc(0)).catch(reject);
    });
  }

  test("question : connexion obligatoire ; urgence → SOS ; carnet réservé à l'administrateur, décisions notées", async () => {
    const store = createMemoryStore({ users: [{ uid: PILOTE }, { uid: ADMIN, role: "admin" }] });
    const llm = fakeLlm("Gardez de l'élan avant la côte.");
    const app = createSovereignApp({ store, nexusLlm: llm, smsClient: null });
    const pilote = signSovereignJwt({ uid: PILOTE, role: "user" });
    const admin = signSovereignJwt({ uid: ADMIN, role: "admin" });

    expect((await call(app, "POST", "/api/v1/nexus/ask", { body: { question: "Bonjour" } })).status).toBe(401);
    expect((await call(app, "POST", "/api/v1/nexus/ask", { body: { question: "je suis tombé" }, token: pilote })).body)
      .toMatchObject({ source: "urgence", action: "SOS" });
    const ok = await call(app, "POST", "/api/v1/nexus/ask", { body: { question: "Comment monter une côte raide ?" }, token: pilote });
    expect(ok.body).toMatchObject({ source: "mistral", reply: "Gardez de l'élan avant la côte." });
    expect(llm.chat).toHaveBeenCalledTimes(1);

    expect((await call(app, "GET", "/api/v1/admin/nexus/carnet", { token: pilote })).status).toBe(403);
    const carnet = await call(app, "GET", "/api/v1/admin/nexus/carnet?status=a_verifier", { token: admin });
    expect(carnet.body.mistral).toBe(true);
    const id = carnet.body.entries[0].id;
    const corr = await call(app, "POST", `/api/v1/admin/nexus/carnet/${id}`, { token: admin,
      body: { decision: "corriger", answer: "Prenez de l'élan et rétrogradez avant la côte." } });
    expect(corr.body).toMatchObject({ status: "valide", answer: "Prenez de l'élan et rétrogradez avant la côte." });
    expect((await call(app, "POST", `/api/v1/admin/nexus/carnet/${id}`, { token: admin, body: { decision: "n'importe" } })).status).toBe(400);

    // Désormais Nexus Atlas répond lui-même, sans Mistral
    const appris = await call(app, "POST", "/api/v1/nexus/ask", { body: { question: "Comment monter une côte raide ?" }, token: pilote });
    expect(appris.body).toMatchObject({ source: "appris", reply: "Prenez de l'élan et rétrogradez avant la côte." });
    expect(llm.chat).toHaveBeenCalledTimes(1);

    const actions = (await store.listAudit({ limit: 50 })).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["admin.nexus_read", "admin.nexus_review"]));
  });
});

describe("Appli : Nexus Atlas d'abord", () => {
  test("commande connue : exécutée par Nexus Atlas, sans serveur", async () => {
    const localEngine = { processQuery: jest.fn(() => ({ action: "NAVIGATE_HOME", reply: "Calcul du trajet." })), executeAction: jest.fn() };
    const askServer = jest.fn();
    const r = await L.createNexusBrainLocal({ localEngine, loadLegal: async () => null, askServer }).ask("rentre à la maison");
    expect(r).toMatchObject({ source: "nexus", action: "NONE", executed: true });
    expect(localEngine.executeAction).toHaveBeenCalled();
    expect(askServer).not.toHaveBeenCalled();
  });

  test("loi : base Légifrance de l'appli (texte simple, source citée)", async () => {
    const legalDb = { search: () => [{ title: "Port du casque", content: "Obligatoire : <strong>135€</strong> d'amende.", source: "Légifrance" }] };
    const localEngine = { processQuery: () => ({ action: "UNKNOWN" }) };
    const askServer = jest.fn();
    const r = await L.createNexusBrainLocal({ localEngine, loadLegal: async () => legalDb, askServer }).ask("le casque");
    expect(r).toMatchObject({ source: "loi" });
    expect(r.reply).toContain("135€");
    expect(r.reply).not.toContain("<strong>");
    expect(askServer).not.toHaveBeenCalled();
  });

  test("texte de loi : jamais de balise HTML en sortie, même mal formée ou encodée", () => {
    const pt = new Function(`${localCode}; return plainText;`)(); // eslint-disable-line no-new-func
    for (const piege of ["<scr<script>ipt>alert(1)</script>", "&lt;script&gt;alert(1)&lt;/script&gt;", "<img src=x onerror=alert(1)",
      "&amp;lt;script&amp;gt;", "Casque <strong>obligatoire</strong> &amp; gants"]) {
      expect(pt(piege)).not.toMatch(/[<>]/);
    }
    expect(pt("Casque <strong>obligatoire</strong> &amp; gants")).toBe("Casque obligatoire & gants");
  });

  test("« police » seul n'est pas une urgence : la question continue son chemin", async () => {
    const localEngine = { processQuery: () => ({ action: "EMERGENCY_CALL", reply: "Mode urgence" }), executeAction: jest.fn() };
    const askServer = jest.fn(async () => ({ source: "mistral", reply: "Prudence au rond-point.", action: "CHAT" }));
    const r = await L.createNexusBrainLocal({ localEngine, loadLegal: async () => null, askServer }).ask("Il y a la police au rond-point");
    expect(r.source).toBe("mistral");
    expect(localEngine.executeAction).not.toHaveBeenCalled();
  });

  test("serveur injoignable ou pas connecté : « Réessayez un peu plus tard »", async () => {
    const brain = L.createNexusBrainLocal({ localEngine: null, loadLegal: async () => null,
      askServer: async () => { throw new Error("hors ligne"); }, log: { warn: () => {} } });
    expect(await brain.ask("Une astuce pour l'hiver ?")).toMatchObject({ source: "indisponible", reply: L.REPLY_LATER });
  });

  test("lecture d'un document (« accident » dans le texte) : jamais d'alerte SOS", async () => {
    const askServer = jest.fn();
    const r = await L.createNexusBrainLocal({ localEngine: null, loadLegal: async () => null, askServer })
      .ask("Contrat : Dommages tous accidents non couverts", { document: true });
    expect(r.action).not.toBe("SOS");
    expect(askServer).not.toHaveBeenCalled();
  });
});

describe("Branchements", () => {
  test("plus aucun appel à Gemini ni copie des conversations dans Firestore", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "src", "js", "nexus-atlas-gemini.js"), "utf8");
    expect(src).not.toMatch(/askNexusAtlasGemini|cloudfunctions|nexus_conversations|firestore/);
    expect(src).toMatch(/createNexusBrainLocal/);
  });

  test("VPS : Mistral borné (5 Go, 3 processeurs), aucun port publié", () => {
    const compose = fs.readFileSync(path.join(__dirname, "..", "sovereign-core", "docker-compose.vps.yml"), "utf8");
    const svc = compose.slice(compose.indexOf("  nexus-ia:"), compose.indexOf("  caddy:"));
    expect(svc).toMatch(/mem_limit: 5g/);
    expect(svc).toMatch(/cpus: 3/);
    expect(svc).toMatch(/OLLAMA_NUM_PARALLEL: "1"/);
    expect(svc).not.toMatch(/ports:/);
  });
});
