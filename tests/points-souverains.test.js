/**
 * @jest-environment node
 *
 * Points, classement et preuve des signalements par le serveur du VPS (19/11/2026) :
 * src/js/points-core.js contre un VRAI serveur souverain (stockage en mémoire), route GET /api/v1/points,
 * et reprise des points de Firebase (export sur le PC, import sur le VPS).
 */
const fs = require("fs");
const path = require("path");

const { createSovereignApp } = require("../sovereign-core/server/index");
const { createMemoryStore } = require("../sovereign-core/server/store-memory");
const { hashPassword } = require("../sovereign-core/server/crypto-auth");
const { buildPointsExport } = require("../functions/scripts/export-points-firestore");
const { planPointsImport, MARKER } = require("../sovereign-core/scripts/import-firebase-points");

function loadModule(file, names) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8")
    .replace(/^export default .*$/gm, "")
    .replace(/^export /gm, "");
  // Même méthode que les autres tests du projet pour charger un module ES sans transpilation
  // eslint-disable-next-line no-new-func
  return new Function(`${code}; return { ${names.join(", ")} };`)();
}

const { SovereignClient } = loadModule("sovereign-core/client/sovereign-sdk.js", ["SovereignClient"]);
const S = loadModule("src/js/sovereign-session.js", ["createSovereignSession"]);
const P = loadModule("src/js/points-core.js",
  ["createPointsSouverains", "typeDangerServeur", "messagePoints", "TYPES_DANGER_SERVEUR"]);

const MDP = "MotDePasse-2026";
const PILOTES = [
  { uid: "00000000-0000-4000-8000-0000000000a1", email: "alice@mon50cc.internal", username: "Alice" },
  { uid: "00000000-0000-4000-8000-0000000000a2", email: "bruno@mon50cc.internal", username: "Bruno" },
  { uid: "00000000-0000-4000-8000-0000000000a3", email: "chloe@mon50cc.internal", username: "Chloe" },
];

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

let app;
let baseUrl;
let store;

beforeAll(async () => {
  store = createMemoryStore({ users: PILOTES.map((p) => ({ ...p, passwordHash: hashPassword(MDP) })) });
  app = createSovereignApp({ store, smsClient: null, authMaxAttempts: 1000 });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}/api/v1`;
});

afterAll(() => new Promise((resolve) => app.server.close(resolve)));

async function telephone(email) {
  const session = S.createSovereignSession({ client: new SovereignClient({ apiBaseUrl: baseUrl }), storage: memoryStorage() });
  if (email) await session.signIn(email, MDP);
  return P.createPointsSouverains({ sovereign: session });
}

describe("Points par le serveur du VPS", () => {
  test("gain d'un trajet : montant fixé par le serveur, solde et historique relus", async () => {
    const alice = await telephone("alice@mon50cc.internal");
    // L'appli annonce 999 : le serveur donne le barème (12 pour un trajet)
    const r = await alice.mouvement({ action: "AWARD", reason: "RIDE_COMPLETED", amount: 999 });
    expect(r).toEqual({ balance: 12, delta: 12, idempotent: false });

    const { balance, history } = await alice.soldeEtHistorique();
    expect(balance).toBe(12);
    expect(history[0]).toEqual(expect.objectContaining({
      action: "AWARD", reason: "RIDE_COMPLETED", description: "Trajet terminé", delta: 12, balanceAfter: 12,
      createdAt: expect.any(String),
    }));
  });

  test("plafond du jour : refus 429 avec le message du serveur", async () => {
    const alice = await telephone("alice@mon50cc.internal");
    await alice.mouvement({ action: "AWARD", reason: "RIDE_COMPLETED", amount: 12 });
    await alice.mouvement({ action: "AWARD", reason: "RIDE_COMPLETED", amount: 12 }); // 36 = plafond
    const refus = await alice.mouvement({ action: "AWARD", reason: "RIDE_COMPLETED", amount: 12 }).catch((e) => e);
    expect(refus.status).toBe(429);
    expect(P.messagePoints(refus)).toMatch(/Plafond journalier/);
    expect((await alice.soldeEtHistorique()).balance).toBe(36);
  });

  test("signalement : envoyé au serveur, puis 25 points sur SA preuve ; la preuve d'un autre est refusée", async () => {
    const bruno = await telephone("bruno@mon50cc.internal");
    const { hazardId } = await bruno.signalerDanger({ type: "POTHOLE", lat: 45.76, lng: 4.83, description: "Gros trou" });
    expect(hazardId).toMatch(/^[0-9a-f-]{36}$/);
    const r = await bruno.mouvement({ action: "AWARD", reason: "RADAR_HAZARD_REPORTED", amount: 25, metadata: { hazardId } });
    expect(r.balance).toBe(25);

    // Chloé ne peut pas toucher les points du signalement de Bruno
    const chloe = await telephone("chloe@mon50cc.internal");
    const vol = await chloe.mouvement({ action: "AWARD", reason: "RADAR_HAZARD_REPORTED", amount: 25, metadata: { hazardId } })
      .catch((e) => e);
    expect(vol.status).toBe(422);
    // Un identifiant Firestore (avant la bascule des signalements) n'est pas une preuve
    const firestoreId = await chloe.mouvement({ action: "AWARD", reason: "RADAR_HAZARD_REPORTED", amount: 25,
      metadata: { hazardId: "AbCdEf123456firestore" } }).catch((e) => e);
    expect(firestoreId.status).toBe(422);
  });

  test("dépense : solde insuffisant refusé (402), sinon débitée", async () => {
    const chloe = await telephone("chloe@mon50cc.internal");
    const refus = await chloe.mouvement({ action: "DEDUCT", reason: "GENERIC_SPEND", amount: 10 }).catch((e) => e);
    expect(refus.status).toBe(402);
    expect(P.messagePoints(refus)).toMatch(/Solde insuffisant/);

    const bruno = await telephone("bruno@mon50cc.internal");
    expect((await bruno.mouvement({ action: "DEDUCT", reason: "EXCHANGE_PURCHASE", amount: 5 })).balance).toBe(20);
  });

  test("classement : pseudos et points GAGNÉS (une dépense ne fait pas reculer)", async () => {
    const chloe = await telephone("chloe@mon50cc.internal");
    const top = await chloe.classement();
    expect(top).toEqual([{ username: "Alice", points: 36 }, { username: "Bruno", points: 25 }]);
    expect(Object.keys(top[0]).sort()).toEqual(["points", "username"]); // jamais l'identifiant des autres
  });

  test("sans session : rien n'est envoyé, message « reconnectez-vous »", async () => {
    const visiteur = await telephone(null);
    expect(visiteur.possible()).toBe(false);
    const e = await visiteur.mouvement({ action: "AWARD", reason: "RIDE_COMPLETED", amount: 12 }).catch((x) => x);
    expect(e.code).toBe("points/sans-session");
    expect(P.messagePoints(e)).toMatch(/Reconnectez-vous/);
    const r = await fetch(`${baseUrl}/points`);
    expect(r.status).toBe(401);
  });

  test("types de danger de l'appli → types du serveur", () => {
    const cas = {
      POTHOLE: "pothole", "Route Dégradée": "pothole", ACCIDENT: "accident", POLICE: "police", Police: "police",
      radar: "police", ROADWORKS: "roadwork", SLIPPERY: "weather", FLOOD: "weather", GRAVEL: "obstacle",
      ANIMAL: "obstacle", animal: "obstacle", BLIND_SPOT: "obstacle", danger_immediat: "obstacle", truc: "other",
      weather: "weather", "": "other",
    };
    for (const [appli, serveur] of Object.entries(cas)) expect([appli, P.typeDangerServeur(appli)]).toEqual([appli, serveur]);
    for (const t of Object.values(cas)) expect(P.TYPES_DANGER_SERVEUR).toContain(t);
  });
});

describe("Reprise des points de Firebase", () => {
  test("export : seulement des nombres, rangés par identifiant Firebase", () => {
    const out = buildPointsExport({
      users: [
        { id: "fbA", data: { braveCoins: 120 } },
        { id: "fbB", data: { bvc_points: "40" } },
        { id: "fbC", data: { points: 0 } },
        { id: "fbD", data: {} },
      ],
      leaderboard: [{ id: "fbA", data: { points: 150, username: "Alice" } }, { id: "fbE", data: { points: 10 } }],
    }, new Date("2026-11-19T10:00:00Z"));
    expect(out).toEqual({ format: "mon50cc-points-firebase-v1", generatedAt: "2026-11-19T10:00:00.000Z", users: [
      { firebaseUid: "fbA", balance: 120, earned: 150 },
      { firebaseUid: "fbB", balance: 40, earned: 0 },
      { firebaseUid: "fbE", balance: 0, earned: 10 },
    ] });
    expect(JSON.stringify(out)).not.toContain("Alice"); // aucun pseudo ne sort de Firestore
  });

  test("import : solde identique, classement identique, rien de compté deux fois", () => {
    const exportData = { format: "mon50cc-points-firebase-v1", users: [
      { firebaseUid: "fbA", balance: 120, earned: 150 }, // a dépensé 30
      { firebaseUid: "fbB", balance: 40, earned: 0 },    // points achetés ou donnés : hors classement
      { firebaseUid: "fbC", balance: 60, earned: 50 },   // 10 hors classement
      { firebaseUid: "fbX", balance: 10, earned: 10 },   // compte pas importé (ou effacé)
      { firebaseUid: "fbD", balance: 5, earned: 5 },     // déjà repris
    ] };
    const { plans, report } = planPointsImport(exportData, [
      { uid: "u-a", firebaseUid: "fbA", braveCoins: 0, imported: false },
      { uid: "u-b", firebaseUid: "fbB", braveCoins: 0, imported: false },
      { uid: "u-c", firebaseUid: "fbC", braveCoins: 7, imported: false }, // 7 Pts déjà sur le serveur
      { uid: "u-d", firebaseUid: "fbD", braveCoins: 5, imported: true },
    ]);
    expect(report).toMatchObject({ total: 5, toImport: 3, alreadyImported: 1, unknown: ["fbX"] });
    const a = plans.find((p) => p.uid === "u-a");
    expect(a.finalBalance).toBe(120);
    expect(a.entries.map((e) => [e.action, e.delta, e.before, e.after, e.key])).toEqual([
      ["AWARD", 150, 0, 150, MARKER], ["DEDUCT", -30, 150, 120, `${MARKER}:depenses`],
    ]);
    const b = plans.find((p) => p.uid === "u-b");
    expect(b.entries.map((e) => [e.action, e.delta, e.key])).toEqual([["PURCHASE", 40, MARKER]]);
    const c = plans.find((p) => p.uid === "u-c");
    expect(c.finalBalance).toBe(67);
    expect(c.entries.map((e) => [e.action, e.delta, e.before, e.after])).toEqual([["AWARD", 50, 7, 57], ["PURCHASE", 10, 57, 67]]);
    for (const p of plans) for (const e of p.entries) {
      expect(e.amount).toBeGreaterThan(0);
      expect(e.after).toBeGreaterThanOrEqual(0);
    }
  });

  test("un fichier qui n'est pas l'export des points est refusé", () => {
    expect(() => planPointsImport({ users: [] })).toThrow(/points\.json/);
    expect(() => planPointsImport({ format: "mon50cc-points-firebase-v1" })).toThrow(/points\.json/);
  });
});

describe("Branchement dans l'appli", () => {
  const src = (f) => fs.readFileSync(path.join(__dirname, "../src/js", f), "utf8");

  test("gestionnaire de points, classement et signalements passent par points.js quand l'interrupteur le dit", () => {
    expect(src("bvc-manager.js")).toMatch(/import \{ pointsSouverains, messagePoints \} from '\.\/points\.js'/);
    expect(src("leaderboard.js")).toMatch(/pointsSouverains\.classement\(\)/);
    for (const f of ["database.js", "danger-zones.js"]) {
      // Avec les points sur le VPS, la preuve est l'identifiant du danger SUR LE SERVEUR
      expect(src(f)).toMatch(/signalerAuServeur\(/);
      expect(src(f)).toMatch(/if \(pointsSouverains\) \{/);
    }
    expect(src("radar-danger.js")).toMatch(/signalerAuServeur\(/);
    expect(src("points.js")).toMatch(/backendMode\('points'\) === 'SOVEREIGN'/);
  });

  test("l'interrupteur reste sur Firebase tant que la bascule n'est pas faite", () => {
    expect(src("config.js")).toMatch(/points: "FIREBASE"/);
  });
});
