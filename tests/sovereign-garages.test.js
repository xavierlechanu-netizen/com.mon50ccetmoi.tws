/**
 * @jest-environment node
 *
 * Espace garage et carnet d'entretien sur le serveur souverain (25/11/2026) :
 * sovereign-core/server/garages.js, routes de server/index.js, stockage en mémoire.
 * - seul un garage certifié (droit d'entrée payé) ouvre l'espace garage ;
 * - un garage n'écrit dans le carnet d'un pilote qu'avec son code (accord), que le pilote peut retirer ;
 * - la carte ne montre que les garages certifiés, sans identifiant interne ;
 * - une intervention d'un garage est une preuve : scellée dans le coffre AVANT d'être écrite,
 *   et gardée même quand le pilote supprime son compte ; le reste s'efface avec le compte.
 */
const { createSovereignApp } = require("../sovereign-core/server/index");
const { createMemoryStore } = require("../sovereign-core/server/store-memory");
const { signSovereignJwt } = require("../sovereign-core/server/crypto-auth");

const PILOTE = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";
const GARAGE = "44444444-4444-4444-8444-444444444444";
const PAS_CERTIFIE = "55555555-5555-4555-8555-555555555555";

const token = (uid) => signSovereignJwt({ uid, role: "user", username: uid.slice(0, 8) });

/** Coffre des preuves simulé (le vrai : Object Lock 5 ans, rien à effacer après un test). */
function fakeVault({ fail = false } = {}) {
  const sealed = [];
  return {
    sealed,
    async sealTelemetryEvidence(uid, payload) {
      if (fail) throw new Error("coffre indisponible");
      sealed.push({ uid, payload });
      return { storagePath: `worm://${uid}/${sealed.length}.json`, sha256Hex: String(sealed.length).padStart(64, "0") };
    },
  };
}

function setup({ vault = fakeVault() } = {}) {
  const store = createMemoryStore({
    users: [
      { uid: PILOTE, username: "Pilote" },
      { uid: AUTRE, username: "Autre" },
      { uid: GARAGE, username: "GaragePetitFontenay", isCertifiedGarage: true },
      { uid: PAS_CERTIFIE, username: "PasCertifie" },
    ],
  });
  return { app: createSovereignApp({ store, smsClient: null, wormVault: vault }), store, vault };
}

function call(app, method, url, { body, uid } = {}) {
  return new Promise((resolve, reject) => {
    const buf = body ? Buffer.from(JSON.stringify(body)) : Buffer.alloc(0);
    const headers = uid ? { authorization: `Bearer ${token(uid)}` } : {};
    const req = { method, url, headers, socket: { remoteAddress: "10.9.9.9" } };
    const res = {
      statusCode: 200,
      setHeader() {},
      end(p) { resolve({ status: this.statusCode, body: p ? JSON.parse(String(p)) : null }); },
    };
    app.handleRequest(req, res, buf).catch(reject);
  });
}

const FICHE = { name: "Garage du Petit Fontenay", address: "Rue du Petit Fontenay, 43110 Aurec-sur-Loire", phone: "04 77 00 00 00", lat: 45.37, lng: 4.2 };

async function lier(app) {
  const c = await call(app, "POST", "/api/v1/maintenance/code", { uid: PILOTE, body: { km: 9000 } });
  expect(c.body.code).toMatch(/^\d{6}$/);
  return call(app, "POST", "/api/v1/garage/clients", { uid: GARAGE, body: { code: c.body.code } });
}

describe("Espace garage", () => {
  test("réservé aux garages certifiés, et la carte n'affiche qu'eux", async () => {
    const { app } = setup();
    expect((await call(app, "GET", "/api/v1/garage/dashboard")).status).toBe(401);
    expect((await call(app, "GET", "/api/v1/garage/dashboard", { uid: PAS_CERTIFIE })).status).toBe(403);
    expect((await call(app, "PATCH", "/api/v1/garage/profile", { uid: PAS_CERTIFIE, body: FICHE })).status).toBe(403);

    expect((await call(app, "PATCH", "/api/v1/garage/profile", { uid: GARAGE, body: { ...FICHE, lat: "nord" } })).status).toBe(400);
    expect((await call(app, "PATCH", "/api/v1/garage/profile", { uid: GARAGE, body: { ...FICHE, name: "<script>" } })).status).toBe(400);
    expect((await call(app, "PATCH", "/api/v1/garage/profile", { uid: GARAGE, body: FICHE })).status).toBe(200);

    const carte = await call(app, "GET", "/api/v1/garages");
    expect(carte.status).toBe(200);
    expect(carte.body.garages).toEqual([FICHE]);
    expect(JSON.stringify(carte.body)).not.toContain(GARAGE);
  });

  test("le garage n'écrit dans le carnet qu'avec le code du pilote, à usage unique", async () => {
    const { app } = setup();
    const sansAccord = await call(app, "POST", "/api/v1/garage/maintenance",
      { uid: GARAGE, body: { pilotUid: PILOTE, category: "Courroie", km: 9000 } });
    expect(sansAccord.status).toBe(403);
    expect((await call(app, "POST", "/api/v1/garage/clients", { uid: GARAGE, body: { code: "123456" } })).status).toBe(404);

    const c = await call(app, "POST", "/api/v1/maintenance/code", { uid: PILOTE, body: { km: 9000 } });
    const lien = await call(app, "POST", "/api/v1/garage/clients", { uid: GARAGE, body: { code: c.body.code } });
    expect(lien.status).toBe(200);
    expect(lien.body.client).toMatchObject({ pilotUid: PILOTE, username: "Pilote", km: 9000 });
    // Un code ne sert qu'une fois
    expect((await call(app, "POST", "/api/v1/garage/clients", { uid: GARAGE, body: { code: c.body.code } })).status).toBe(404);

    const ok = await call(app, "POST", "/api/v1/garage/maintenance",
      { uid: GARAGE, body: { pilotUid: PILOTE, category: "Courroie & galets", description: "Remplacement", km: 9100 } });
    expect(ok.status).toBe(200);
    expect((await call(app, "POST", "/api/v1/garage/maintenance",
      { uid: GARAGE, body: { pilotUid: PILOTE, category: "Pneus", km: -5 } })).status).toBe(400);

    const tableau = await call(app, "GET", "/api/v1/garage/dashboard", { uid: GARAGE });
    expect(tableau.body.clients).toEqual([expect.objectContaining({ pilotUid: PILOTE, km: 9100 })]);
    expect(tableau.body.logs).toEqual([expect.objectContaining({ clientName: "Pilote", category: "Courroie & galets", km: 9100 })]);    // Le pilote voit l'intervention certifiée, avec le nom du garage
    await call(app, "PATCH", "/api/v1/garage/profile", { uid: GARAGE, body: FICHE });
    const carnet = await call(app, "GET", "/api/v1/maintenance", { uid: PILOTE });
    expect(carnet.body.logs).toEqual([
      expect.objectContaining({ category: "Courroie & galets", certified: true, garageName: FICHE.name, km: 9100 }),
    ]);
    expect(carnet.body.garages).toEqual([expect.objectContaining({ garageId: GARAGE, name: FICHE.name })]);
    // Un autre pilote ne voit rien
    expect((await call(app, "GET", "/api/v1/maintenance", { uid: AUTRE })).body.logs).toEqual([]);
  });

  test("le pilote retire son accord : le garage ne peut plus écrire, le carnet reste au pilote", async () => {
    const { app } = setup();
    await lier(app);
    await call(app, "POST", "/api/v1/garage/maintenance", { uid: GARAGE, body: { pilotUid: PILOTE, category: "Vidange", km: 9000 } });
    expect((await call(app, "DELETE", `/api/v1/maintenance/garages?garage=${GARAGE}`, { uid: PILOTE })).status).toBe(200);
    expect((await call(app, "DELETE", `/api/v1/maintenance/garages?garage=${GARAGE}`, { uid: PILOTE })).status).toBe(404);
    expect((await call(app, "POST", "/api/v1/garage/maintenance",
      { uid: GARAGE, body: { pilotUid: PILOTE, category: "Vidange", km: 9500 } })).status).toBe(403);
    expect((await call(app, "GET", "/api/v1/maintenance", { uid: PILOTE })).body.logs).toHaveLength(1);
  });

  test("code expiré refusé", async () => {
    const { app, store } = setup();
    const c = await call(app, "POST", "/api/v1/maintenance/code", { uid: PILOTE, body: {} });
    const { hashCode } = require("../sovereign-core/server/garages");
    await store.saveGarageCode({ pilotUid: PILOTE, codeHash: hashCode(c.body.code), km: null, expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect((await call(app, "POST", "/api/v1/garage/clients", { uid: GARAGE, body: { code: c.body.code } })).status).toBe(404);
  });

  test("charte, article 6 : 3 codes erronés → ajout de client verrouillé 7 minutes, même avec le bon code", async () => {
    const { createGaragesService, CODE_MAX_ERRORS, CODE_LOCK_MS } = require("../sovereign-core/server/garages");
    expect([CODE_MAX_ERRORS, CODE_LOCK_MS]).toEqual([3, 7 * 60 * 1000]);
    const { store, vault } = setup();
    let t = Date.now();
    const svc = createGaragesService({ store, wormVault: vault, now: () => t });
    const garage = { uid: GARAGE };
    const essai = (code) => svc.linkClient(garage, { code }).then(() => 200, (e) => e.status);

    expect(await essai("111111")).toBe(404);
    expect(await essai("pas un code")).toBe(404);
    expect(await essai("222222")).toBe(429); // 3e erreur : verrouillé
    const { code } = await svc.createCode({ uid: PILOTE }, {});
    expect(await essai(code)).toBe(429); // même le bon code attend la fin du verrou
    t += CODE_LOCK_MS - 1000;
    expect(await essai(code)).toBe(429);
    t += 2000;
    expect(await essai(code)).toBe(200); // 7 minutes passées : le bon code passe, le compteur repart à zéro
    expect(await essai("333333")).toBe(404);
    expect(await essai("444444")).toBe(404);
    expect(await essai("555555")).toBe(429);
  });

  test("intervention scellée dans le coffre avant d'être écrite ; coffre en panne : rien n'est écrit", async () => {
    const { app, vault } = setup();
    await lier(app);
    await call(app, "POST", "/api/v1/garage/maintenance", { uid: GARAGE, body: { pilotUid: PILOTE, category: "Vidange", km: 9000 } });
    expect(vault.sealed).toEqual([{ uid: PILOTE, payload: expect.objectContaining(
      { kind: "maintenance", pilotUid: PILOTE, garageUid: GARAGE, category: "Vidange", km: 9000 }) }]);
    const carnet = await call(app, "GET", "/api/v1/maintenance", { uid: PILOTE });
    expect(carnet.body.logs[0].proofSha256).toMatch(/^0+1$/);

    const panne = setup({ vault: fakeVault({ fail: true }) });
    await lier(panne.app);
    await expect(call(panne.app, "POST", "/api/v1/garage/maintenance",
      { uid: GARAGE, body: { pilotUid: PILOTE, category: "Vidange", km: 9000 } })).rejects.toThrow("coffre indisponible");
    expect((await call(panne.app, "GET", "/api/v1/maintenance", { uid: PILOTE })).body.logs).toEqual([]);
  });

  test("RGPD : export complet ; compte supprimé : accès et fiches effacés, interventions scellées gardées", async () => {
    const { app, store } = setup();
    await lier(app);
    await call(app, "POST", "/api/v1/garage/maintenance", { uid: GARAGE, body: { pilotUid: PILOTE, category: "Vidange", km: 9000 } });
    await store.addMaintenanceLog({ pilotUid: PILOTE, category: "Note perso", km: 9100 });
    const exp = await store.exportUserData(PILOTE);
    expect(exp.maintenance).toHaveLength(2);
    expect(exp.garagesAuthorized).toHaveLength(1);

    await store.anonymizeUser(PILOTE);
    const tableau = await call(app, "GET", "/api/v1/garage/dashboard", { uid: GARAGE });
    expect(tableau.body.clients).toEqual([]);
    expect(tableau.body.logs).toEqual([]);
    // La preuve reste, sous l'identifiant devenu anonyme ; la note du pilote est effacée
    expect((await store.listMaintenanceByPilot(PILOTE)).map((l) => [l.category, l.certified])).toEqual([["Vidange", true]]);
  });
});
