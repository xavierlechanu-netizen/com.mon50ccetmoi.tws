/**
 * @jest-environment node
 *
 * Derniers usages de Firebase avant de couper le pont (24/11/2026) : liste d'attente de la Boîte
 * Noire sur le serveur souverain, points du quiz du Code et du Contrat de route par le VPS.
 */
const fs = require("fs");
const path = require("path");
const { createSovereignApp } = require("../sovereign-core/server/index");
const { createMemoryStore } = require("../sovereign-core/server/store-memory");

let app, baseUrl, store;
const inscrire = (body) => fetch(`${baseUrl}/waitlist`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

beforeAll(async () => {
  store = createMemoryStore();
  app = createSovereignApp({ store, smsClient: null });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}/api/v1`;
});
afterAll(() => new Promise((resolve) => app.server.close(resolve)));

describe("Liste d'attente sur le serveur", () => {
  test("adresse + consentement : enregistrée une seule fois, même réponse la 2e fois", async () => {
    expect((await inscrire({ email: " Bob@Exemple.fr ", consent: true })).status).toBe(200);
    expect((await inscrire({ email: "bob@exemple.fr", consent: true })).status).toBe(200);
    expect(await store.addToWaitlist("bob@exemple.fr")).toBe(false); // déjà là, en minuscules
  });

  test("sans consentement ou adresse invalide : refusé", async () => {
    expect((await inscrire({ email: "alice@exemple.fr" })).status).toBe(400);
    expect((await inscrire({ email: "pas-une-adresse", consent: true })).status).toBe(400);
    expect(await store.addToWaitlist("alice@exemple.fr")).toBe(true); // rien n'avait été écrit
  });

  test("anti-arrosage : 5 essais par heure et par adresse IP", async () => {
    // 4 essais faits plus haut : le 5e passe, le 6e est refusé
    expect((await inscrire({ email: "spam@exemple.fr", consent: true })).status).toBe(200);
    expect((await inscrire({ email: "spam2@exemple.fr", consent: true })).status).toBe(429);
  });

  test("l'appli envoie au serveur et signale un refus", async () => {
    const src = fs.readFileSync(path.join(__dirname, "../src/js/blackbox-waitlist.js"), "utf8")
      .replace(/^export /gm, "").replace(/^if \(typeof document[\s\S]*$/m, "");
    // eslint-disable-next-line no-new-func
    const { saveToServer } = new Function(`const window = {}; ${src}; return { saveToServer };`)();
    const appels = [];
    const ok = async (url, opts) => { appels.push([url, JSON.parse(opts.body)]); return { ok: true }; };
    await saveToServer({ email: "a@b.fr", consent: true, source: "marketplace" }, ok, "https://api.test/api/v1");
    expect(appels).toEqual([["https://api.test/api/v1/waitlist", { email: "a@b.fr", consent: true }]]);
    await expect(saveToServer({ email: "a@b.fr", consent: true }, async () => ({ ok: false, status: 429 }), "x")).rejects.toThrow("429");
  });
});

describe("Quiz du Code et Contrat de route", () => {
  const src = (f) => fs.readFileSync(path.join(__dirname, "../src/js", f), "utf8");

  test("plus aucune écriture Firestore : les points passent par le serveur du VPS", () => {
    for (const f of ["code-de-la-route.js", "contrat-de-route.js"]) {
      expect(src(f)).not.toMatch(/collection\("users"\)|FieldValue\.increment/);
      expect(src(f)).toMatch(/pointsSouverains\.mouvement\(/);
    }
    expect(src("code-de-la-route.js")).toMatch(/reason: "CODE_QUIZ_COMPLETED"/);
    expect(src("contrat-de-route.js")).toMatch(/reason: "ROUTER_CONTRAT_SIGNED"/);
  });

  test("ces motifs existent sur le serveur (montant fixé par lui ; contrat payé une seule fois)", () => {
    const rules = require("../functions/api/points-rules");
    const r = rules.planTransaction({ action: "AWARD", reason: "ROUTER_CONTRAT_SIGNED", amount: 9999 }, { isAdmin: false });
    expect(r.amount).toBe(50);
    expect(r.forcedIdempotencyKey).toBeTruthy();
    expect(rules.planTransaction({ action: "AWARD", reason: "CODE_QUIZ_COMPLETED", amount: 9999 }, { isAdmin: false }).amount).toBe(20);
  });
});
