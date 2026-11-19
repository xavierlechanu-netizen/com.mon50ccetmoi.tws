/**
 * @jest-environment node
 *
 * Effacement du compte à la demande du pilote (RGPD art. 17) par le serveur du VPS (19/11/2026) :
 * src/js/effacement-compte.js, contre un VRAI serveur souverain (stockage en mémoire).
 *
 * - le serveur anonymise le compte et note ce qui reste à effacer chez Firebase ;
 * - ce téléphone est déconnecté partout (serveur, jeton SOS, Firebase) ;
 * - sans session, ou serveur en panne : rien n'est effacé et l'appli le dit (demande par e-mail).
 */
const fs = require("fs");
const path = require("path");

const { createSovereignApp } = require("../sovereign-core/server/index");
const { createMemoryStore } = require("../sovereign-core/server/store-memory");
const { hashPassword } = require("../sovereign-core/server/crypto-auth");

function loadModule(file, names) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8")
    .replace(/^export default .*$/gm, "")
    .replace(/^export /gm, "");
  // Même méthode que les autres tests du projet pour charger un module ES sans transpilation
  // eslint-disable-next-line no-new-func
  return new Function(`${code}; return { ${names.join(", ")} };`)();
}

const { SovereignClient } = loadModule("sovereign-core/client/sovereign-sdk.js", ["SovereignClient"]);
const S = loadModule("src/js/sovereign-session.js", ["createSovereignSession", "SESSION_KEY", "SOS_TOKEN_KEY"]);
const E = loadModule("src/js/effacement-compte.js", ["createEffacementCompte", "EFFACEMENT_TEXTES", "EFFACEMENT_CONTACT"]);

const MDP = "MotDePasse-2026";
const UID_IMPORTE = "00000000-0000-4000-8000-0000000000e1";
const UID_DEUX_TEL = "00000000-0000-4000-8000-0000000000e2";
const UID_PANNE = "00000000-0000-4000-8000-0000000000e3";

function memoryStorage() {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

const silentLog = { warn: () => {} };

let app;
let baseUrl;
let store;

beforeAll(async () => {
  store = createMemoryStore({
    users: [
      // Compte importé de Firebase (identifiant Firebase connu du serveur)
      { uid: UID_IMPORTE, email: "importe@mon50cc.internal", username: "Importe", passwordHash: hashPassword(MDP),
        firebaseUid: "fbUidImporte0000000000000001" },
      { uid: UID_DEUX_TEL, email: "deuxtel@mon50cc.internal", username: "DeuxTel", passwordHash: hashPassword(MDP) },
      { uid: UID_PANNE, email: "panne@mon50cc.internal", username: "Panne", passwordHash: hashPassword(MDP) },
    ],
  });
  app = createSovereignApp({ store, smsClient: null, authMaxAttempts: 1000 });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}/api/v1`;
});

afterAll(() => new Promise((resolve) => app.server.close(resolve)));

/** Un téléphone : session sur le serveur souverain, Firebase simulé, module d'effacement. */
function telephone() {
  const storage = memoryStorage();
  const session = S.createSovereignSession({ client: new SovereignClient({ apiBaseUrl: baseUrl }), storage });
  const firebaseAuth = { signOut: jest.fn(async () => {}) };
  const effacement = E.createEffacementCompte({ sovereign: session, firebaseAuth, log: silentLog });
  return { storage, session, firebaseAuth, effacement };
}

async function login(email) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: MDP }),
  });
  return res.status;
}

describe("Effacement du compte par le serveur du VPS", () => {
  test("effacé : compte anonymisé, téléphone déconnecté partout, reste Firebase noté pour l'administrateur", async () => {
    const tel = telephone();
    await tel.session.signIn("importe@mon50cc.internal", MDP);
    expect(tel.effacement.possible()).toBe(true);
    expect(tel.storage.m.has(S.SESSION_KEY)).toBe(true);

    expect(await tel.effacement.effacer()).toEqual({ statut: "efface" });

    // Ce téléphone : plus de session, plus de jeton SOS, plus de session Firebase
    expect(tel.effacement.possible()).toBe(false);
    expect(tel.storage.m.has(S.SESSION_KEY)).toBe(false);
    expect(tel.storage.m.has(S.SOS_TOKEN_KEY)).toBe(false);
    expect(tel.firebaseAuth.signOut).toHaveBeenCalledTimes(1);

    // Le serveur : plus de connexion possible, plus rien qui mène à la personne
    expect(await login("importe@mon50cc.internal")).toBe(401);
    expect(await store.findUserById(UID_IMPORTE)).toBeNull();
    expect(await store.findUserByEmail("importe@mon50cc.internal")).toBeNull();

    // Ce qui reste chez Firebase est noté, avec de quoi le retrouver (adresse et identifiant Firebase)
    const reste = await store.listFirebaseErasures();
    expect(reste).toEqual([expect.objectContaining({
      id: expect.any(Number), email: "importe@mon50cc.internal", firebaseUid: "fbUidImporte0000000000000001",
      requestedAt: expect.any(String),
    })]);
  });

  test("sans session sur le serveur : rien n'est effacé, il faut se reconnecter (ou écrire)", async () => {
    const tel = telephone();
    const avant = (await store.listFirebaseErasures()).length;
    expect(tel.effacement.possible()).toBe(false);
    expect(await tel.effacement.effacer()).toEqual({ statut: "sans-session" });
    expect(tel.firebaseAuth.signOut).not.toHaveBeenCalled();
    expect((await store.listFirebaseErasures()).length).toBe(avant);
  });

  test("compte déjà effacé depuis un autre téléphone : session refusée, oubliée, pas d'erreur", async () => {
    const telA = telephone();
    const telB = telephone();
    await telA.session.signIn("deuxtel@mon50cc.internal", MDP);
    await telB.session.signIn("deuxtel@mon50cc.internal", MDP);

    expect(await telB.effacement.effacer()).toEqual({ statut: "efface" });
    expect(await telA.effacement.effacer()).toEqual({ statut: "sans-session" });
    expect(telA.effacement.possible()).toBe(false);
    expect(telA.storage.m.has(S.SESSION_KEY)).toBe(false);
    // Une seule demande notée, pas deux
    expect((await store.listFirebaseErasures()).filter((e) => e.email === "deuxtel@mon50cc.internal")).toHaveLength(1);
  });

  test("serveur injoignable : erreur, RIEN n'est effacé et la session est gardée pour réessayer", async () => {
    const tel = telephone();
    await tel.session.signIn("panne@mon50cc.internal", MDP);
    tel.session.client.apiBaseUrl = "http://127.0.0.1:9/api/v1"; // port fermé

    const r = await tel.effacement.effacer();
    expect(r.statut).toBe("erreur");
    expect(r.erreur).toBeTruthy();
    expect(tel.effacement.possible()).toBe(true);
    expect(tel.firebaseAuth.signOut).not.toHaveBeenCalled();
    expect(await store.findUserById(UID_PANNE)).not.toBeNull();
    expect(await login("panne@mon50cc.internal")).toBe(200);
  });

  test("une déconnexion Firebase qui échoue n'empêche pas de dire que le compte est effacé", async () => {
    const reg = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "fbcasse@mon50cc.internal", username: "FbCasse", password: MDP }),
    });
    expect(reg.status).toBe(201);
    const tel = telephone();
    await tel.session.signIn("fbcasse@mon50cc.internal", MDP);
    tel.firebaseAuth.signOut.mockRejectedValueOnce(Object.assign(new Error("réseau"), { code: "auth/network-request-failed" }));
    expect(await tel.effacement.effacer()).toEqual({ statut: "efface" });
    expect(await login("fbcasse@mon50cc.internal")).toBe(401);
  });

  test("sans serveur souverain branché (CONFIG.SOVEREIGN coupé) : sans-session, jamais d'erreur", async () => {
    const effacement = E.createEffacementCompte({ sovereign: null, firebaseAuth: null, log: silentLog });
    expect(effacement.possible()).toBe(false);
    expect(await effacement.effacer()).toEqual({ statut: "sans-session" });
  });
});

describe("Textes montrés au pilote", () => {
  test("honnêtes : 30 jours au plus pour Firebase (comme la politique de confidentialité), adresse de contact, rien n'est effacé en cas de panne", () => {
    expect(E.EFFACEMENT_TEXTES.efface).toMatch(/sous 30 jours au plus/);
    expect(E.EFFACEMENT_TEXTES.efface).toMatch(/Firebase/);
    expect(E.EFFACEMENT_TEXTES.sansSession).toContain(E.EFFACEMENT_CONTACT);
    expect(E.EFFACEMENT_TEXTES.erreur("délai dépassé")).toMatch(/Rien n'a été effacé/);
    expect(E.EFFACEMENT_TEXTES.erreur("délai dépassé")).toContain("délai dépassé");
  });
});

describe("Branchement dans l'appli", () => {
  const src = (f) => fs.readFileSync(path.join(__dirname, "../src/js", f), "utf8");

  test("le bouton « Supprimer mon compte » passe par le serveur du VPS, plus par la Cloud Function coupée", () => {
    const rgpd = src("rgpd-cnil.js");
    expect(rgpd).toMatch(/import \{ createEffacementCompte, EFFACEMENT_TEXTES \} from '\.\/effacement-compte\.js'/);
    expect(rgpd).toMatch(/createEffacementCompte\(\{ sovereign: sovereignSession/);
    expect(rgpd).not.toMatch(/authFetch\("deleteUserAccount"/);
    // Rien n'est effacé sur le téléphone tant que le serveur n'a pas confirmé
    const fn = rgpd.slice(rgpd.indexOf("window.revokeAndEraseData = "));
    expect(fn.indexOf('resultat.statut === "erreur"')).toBeGreaterThan(0);
    expect(fn.indexOf("localStorage.clear()")).toBeGreaterThan(fn.indexOf('resultat.statut === "erreur"'));
  });

  test("l'ancien window.requestAccountDeletion (qui n'effaçait rien) a disparu", () => {
    expect(src("app-ui.js")).not.toMatch(/window\.requestAccountDeletion\s*=/);
  });
});
