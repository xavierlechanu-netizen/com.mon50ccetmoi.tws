/**
 * @jest-environment node
 *
 * Phase A du déménagement : les comptes de l'appli passent par le serveur souverain derrière
 * l'interrupteur CONFIG.BACKEND_MODE.comptes (18/11/2026).
 *
 * - serveur (sovereign-core/server/index.js) : jeton de renouvellement de 30 jours, POST /auth/refresh ;
 * - SDK (sovereign-core/client/sovereign-sdk.js) : session gardée, renouvelée toute seule ;
 * - appli : interrupteur (src/js/backend-mode.js), session gardée (src/js/sovereign-session.js) et
 *   comptes (src/js/comptes-core.js), contre un VRAI serveur souverain (stockage en mémoire), avec un
 *   Firebase simulé pour le « pont » vers les données encore dans Firestore.
 */
const fs = require("fs");
const path = require("path");

const { createSovereignApp } = require("../sovereign-core/server/index");
const { createMemoryStore } = require("../sovereign-core/server/store-memory");
const { hashPassword, signSovereignJwt } = require("../sovereign-core/server/crypto-auth");

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
const C = loadModule("src/js/comptes-core.js", ["createComptes", "comptesErrorMessage", "SOVEREIGN_PASSWORD_MIN"]);
const B = loadModule("src/js/backend-mode.js",
  ["backendModeFor", "readBackendTrial", "normalizeBackendMode", "BACKEND_TRIAL_KEY", "BACKEND_DOMAINS"]);

const MDP = "MotDePasse-2026";

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

/** Firebase Auth simulé (version compat) : comptes email + mot de passe, écouteurs. */
function fakeFirebaseAuth(accounts = {}) {
  const listeners = new Set();
  const auth = {
    currentUser: null,
    accounts: { ...accounts },
    calls: [],
    _set(u) {
      auth.currentUser = u;
      for (const cb of listeners) cb(u);
    },
    onAuthStateChanged(cb) {
      listeners.add(cb);
      Promise.resolve().then(() => cb(auth.currentUser)); // comme Firebase : une fois au démarrage
      return () => listeners.delete(cb);
    },
    async signInWithEmailAndPassword(email, password) {
      auth.calls.push(["signIn", email]);
      const a = auth.accounts[email];
      if (!a || a.password !== password) throw Object.assign(new Error("bad"), { code: "auth/invalid-credential" });
      const user = { uid: a.uid, email, delete: jest.fn(async () => { delete auth.accounts[email]; }) };
      auth._set(user);
      return { user };
    },
    async createUserWithEmailAndPassword(email, password) {
      auth.calls.push(["create", email]);
      if (auth.accounts[email]) throw Object.assign(new Error("pris"), { code: "auth/email-already-in-use" });
      auth.accounts[email] = { uid: `fb-${Object.keys(auth.accounts).length + 1}`, password };
      return auth.signInWithEmailAndPassword(email, password);
    },
    async signOut() {
      auth.calls.push(["signOut"]);
      auth._set(null);
    },
  };
  return auth;
}

let app;
let baseUrl;
let store;

beforeAll(async () => {
  store = createMemoryStore({
    users: [
      { uid: "00000000-0000-4000-8000-0000000000b1", email: "banni@mon50cc.internal", username: "banni",
        passwordHash: hashPassword(MDP), role: "user", isBanned: true },
    ],
  });
  // Toutes les connexions du test viennent de la même adresse : limite anti force brute relevée
  app = createSovereignApp({ store, smsClient: null, authMaxAttempts: 1000 });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}/api/v1`;
});

afterAll(() => new Promise((resolve) => app.server.close(resolve)));

const newClient = () => new SovereignClient({ apiBaseUrl: baseUrl });

async function post(endpoint, body, token) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

describe("Serveur souverain : session de 30 jours", () => {
  test("inscription et connexion rendent un jeton de session, de renouvellement et SOS", async () => {
    const reg = await post("/auth/register", { email: "alice@mon50cc.internal", username: "Alice", password: MDP });
    expect(reg.status).toBe(201);
    expect(reg.body).toEqual(expect.objectContaining({
      email: "alice@mon50cc.internal", username: "Alice", role: "user",
      token: expect.any(String), refreshToken: expect.any(String), sosToken: expect.any(String),
    }));
    expect(reg.body.createdAt).toBeTruthy();
    expect(SovereignClient.tokenExpiry(reg.body.refreshToken) - Date.now()).toBeGreaterThan(29 * 24 * 3600 * 1000);
    expect(SovereignClient.tokenExpiry(reg.body.token) - Date.now()).toBeLessThanOrEqual(3600 * 1000);

    const login = await post("/auth/login", { email: "alice@mon50cc.internal", password: MDP });
    expect(login.status).toBe(200);
    expect(login.body.refreshToken).toBeTruthy();
  });

  test("renouvellement : nouveau jeton de session ; seul le jeton de renouvellement est accepté", async () => {
    const login = await post("/auth/login", { email: "alice@mon50cc.internal", password: MDP });
    const ok = await post("/auth/refresh", null, login.body.refreshToken);
    expect(ok.status).toBe(200);
    expect(ok.body.uid).toBe(login.body.uid);
    expect(ok.body.token).toBeTruthy();

    // Jeton de session, jeton SOS, rien, ou jeton abîmé : refusés
    for (const t of [login.body.token, login.body.sosToken, null, "a.b.c"]) {
      expect((await post("/auth/refresh", null, t)).status).toBe(401);
    }
  });

  test("le jeton de renouvellement n'ouvre aucune autre route", async () => {
    const login = await post("/auth/login", { email: "alice@mon50cc.internal", password: MDP });
    const res = await fetch(`${baseUrl}/rgpd/account`, { headers: { Authorization: `Bearer ${login.body.refreshToken}` } });
    expect(res.status).toBe(401);
    expect((await post("/sos", { lat: 48.8, lng: 2.3, contacts: ["0612345678"] }, login.body.refreshToken)).status).toBe(401);
  });

  test("compte banni : ni connexion, ni renouvellement", async () => {
    const login = await post("/auth/login", { email: "banni@mon50cc.internal", password: MDP });
    expect(login.status).toBe(403);
    expect(login.body.token).toBeUndefined();
    const refresh = signSovereignJwt({ uid: "00000000-0000-4000-8000-0000000000b1", purpose: "refresh" });
    expect((await post("/auth/refresh", null, refresh)).status).toBe(401);
  });

  test("compte effacé (RGPD) : le renouvellement est refusé", async () => {
    const reg = await post("/auth/register", { email: "efface@mon50cc.internal", username: "efface", password: MDP });
    const del = await fetch(`${baseUrl}/rgpd/account`, { method: "DELETE", headers: { Authorization: `Bearer ${reg.body.token}` } });
    expect(del.status).toBe(200);
    expect((await post("/auth/refresh", null, reg.body.refreshToken)).status).toBe(401);
  });
});

describe("SDK : la session se garde et se renouvelle toute seule", () => {
  test("session gardée puis reprise sur une autre page, sans réseau", async () => {
    const c1 = newClient();
    await c1.signInWithEmailAndPassword("alice@mon50cc.internal", MDP);
    expect(c1.hasSession()).toBe(true);
    const snap = c1.sessionSnapshot();
    expect(JSON.stringify(snap)).not.toContain(MDP);

    const c2 = newClient();
    expect(c2.restoreSession(JSON.parse(JSON.stringify(snap)))).toBe(true);
    expect(c2.currentUser).toEqual(expect.objectContaining({ username: "Alice", email: "alice@mon50cc.internal" }));
    expect(newClient().restoreSession(snap, SovereignClient.tokenExpiry(snap.refreshToken) + 1)).toBe(false);
  });

  test("jeton de session expiré : renouvelé avant l'appel, comme Firebase", async () => {
    const c = newClient();
    await c.signInWithEmailAndPassword("alice@mon50cc.internal", MDP);
    c.token = signSovereignJwt({ uid: c.currentUser.uid }, { expiresInSec: 1 }); // presque expiré
    const old = c.token;
    const fresh = await c.getIdToken();
    expect(fresh).not.toBe(old);
    // Une route protégée passe avec un jeton expiré : le SDK renouvelle d'abord
    c.token = signSovereignJwt({ uid: c.currentUser.uid }, { expiresInSec: -10 });
    const data = await c.exportMyDataRgpd();
    expect(data.format).toBe("mon50ccetmoi-export-rgpd-v1");
  });

  test("deux demandes simultanées : un seul renouvellement", async () => {
    const c = newClient();
    await c.signInWithEmailAndPassword("alice@mon50cc.internal", MDP);
    c.token = null;
    const spy = jest.spyOn(c, "request");
    const [a, b] = await Promise.all([c.getIdToken(), c.getIdToken()]);
    expect(a).toBe(b);
    expect(spy.mock.calls.filter(([e]) => e === "/auth/refresh")).toHaveLength(1);
  });

  test("refus du serveur au renouvellement : déconnexion", async () => {
    const c = newClient();
    await c.signInWithEmailAndPassword("alice@mon50cc.internal", MDP);
    c.refreshToken = signSovereignJwt({ uid: c.currentUser.uid, purpose: "sos" }, { expiresInSec: 3600 });
    c.token = null;
    await expect(c.getIdToken()).rejects.toMatchObject({ status: 401 });
    expect(c.hasSession()).toBe(false);
    expect(c.currentUser).toBeNull();
  });
});

describe("Interrupteur CONFIG.BACKEND_MODE", () => {
  test("FIREBASE par défaut ; une valeur pour tous ou domaine par domaine", () => {
    expect(B.backendModeFor("comptes", {})).toBe("FIREBASE");
    expect(B.backendModeFor("comptes", { setting: { comptes: "FIREBASE" } })).toBe("FIREBASE");
    expect(B.backendModeFor("comptes", { setting: { comptes: "SOVEREIGN" } })).toBe("SOVEREIGN");
    expect(B.backendModeFor("dangers", { setting: { comptes: "SOVEREIGN" } })).toBe("FIREBASE");
    expect(B.backendModeFor("dangers", { setting: "SOVEREIGN" })).toBe("SOVEREIGN");
    expect(B.backendModeFor("comptes", { setting: "n'importe quoi" })).toBe("FIREBASE");
    expect(B.normalizeBackendMode("souverain")).toBe("SOVEREIGN");
  });

  test("essai sur un seul téléphone par l'adresse de la page, gardé, puis retiré", () => {
    const storage = memoryStorage();
    expect(B.readBackendTrial(storage, "")).toBeNull();
    expect(B.readBackendTrial(storage, "?essai-souverain=comptes,inconnu")).toEqual({ comptes: "SOVEREIGN" });
    // Page suivante sans paramètre : l'essai est gardé
    const trial = B.readBackendTrial(storage, "?x=1");
    expect(trial).toEqual({ comptes: "SOVEREIGN" });
    expect(B.backendModeFor("comptes", { setting: { comptes: "FIREBASE" }, trial })).toBe("SOVEREIGN");
    expect(B.backendModeFor("dangers", { setting: { comptes: "FIREBASE" }, trial })).toBe("FIREBASE");
    // Retour au réglage du site
    expect(B.readBackendTrial(storage, "?essai-souverain=non")).toBeNull();
    expect(storage.m.has(B.BACKEND_TRIAL_KEY)).toBe(false);
    // Valeur gardée abîmée : ignorée
    storage.setItem(B.BACKEND_TRIAL_KEY, "{pas du json");
    expect(B.readBackendTrial(storage, "")).toBeNull();
  });
});

function setupApp({ mode, firebaseAccounts = {}, storage = memoryStorage(), pontFirebase = true } = {}) {
  const firebaseAuth = fakeFirebaseAuth(firebaseAccounts);
  const sovereign = S.createSovereignSession({ client: newClient(), storage });
  sovereign.restore();
  const comptes = C.createComptes({ mode, firebaseAuth, sovereign, pontFirebase, log: { warn: () => {} } });
  return { firebaseAuth, sovereign, comptes, storage };
}

const nextTick = () => new Promise((r) => setTimeout(r, 0));

describe("Comptes sur FIREBASE (aujourd'hui) : rien ne change", () => {
  test("connexion par Firebase, serveur souverain en parallèle pour le jeton SOS", async () => {
    const { comptes, firebaseAuth, storage } = setupApp({
      mode: "FIREBASE", firebaseAccounts: { "alice@mon50cc.internal": { uid: "fb-alice", password: MDP } },
    });
    const r = await comptes.seConnecter("alice@mon50cc.internal", MDP);
    expect(r.firebaseUser.uid).toBe("fb-alice");
    expect(r.compte).toBeNull();
    expect(await r.sovereignReady).toBe(true);
    expect(firebaseAuth.calls[0]).toEqual(["signIn", "alice@mon50cc.internal"]);
    expect(storage.m.get(S.SOS_TOKEN_KEY)).toBeTruthy();
    // La session souveraine est gardée aussi : à la bascule, rien à retaper
    expect(JSON.parse(storage.m.get(S.SESSION_KEY)).user.email).toBe("alice@mon50cc.internal");

    // onAuthChange = firebase.auth().onAuthStateChanged
    const seen = [];
    comptes.onAuthChange((u) => seen.push(u && u.uid));
    await nextTick();
    expect(seen).toEqual(["fb-alice"]);
  });

  test("mauvais mot de passe : l'erreur Firebase remonte, rien côté souverain", async () => {
    const { comptes, storage } = setupApp({ mode: "FIREBASE" });
    await expect(comptes.seConnecter("alice@mon50cc.internal", "faux")).rejects.toMatchObject({ code: "auth/invalid-credential" });
    expect(storage.m.has(S.SESSION_KEY)).toBe(false);
  });

  test("connexion d'un autre pilote, serveur souverain muet : plus de jeton SOS au nom du précédent", async () => {
    const { comptes, storage, sovereign } = setupApp({
      mode: "FIREBASE",
      firebaseAccounts: {
        "alice@mon50cc.internal": { uid: "fb-alice", password: MDP },
        "inconnu@mon50cc.internal": { uid: "fb-x", password: MDP },
      },
    });
    await (await comptes.seConnecter("alice@mon50cc.internal", MDP)).sovereignReady;
    expect(sovereign.isReady()).toBe(true);
    // « inconnu » n'existe pas sur le serveur souverain : l'ancien jeton (Alice) doit disparaître
    expect(await (await comptes.seConnecter("inconnu@mon50cc.internal", MDP)).sovereignReady).toBe(false);
    expect(sovereign.isReady()).toBe(false);
    expect(storage.m.has(S.SOS_TOKEN_KEY)).toBe(false);
    expect(storage.m.has(S.SESSION_KEY)).toBe(false);
  });

  test("déconnexion : Firebase et serveur souverain oubliés", async () => {
    const { comptes, firebaseAuth, storage } = setupApp({
      mode: "FIREBASE", firebaseAccounts: { "alice@mon50cc.internal": { uid: "fb-alice", password: MDP } },
    });
    await (await comptes.seConnecter("alice@mon50cc.internal", MDP)).sovereignReady;
    await comptes.seDeconnecter();
    expect(firebaseAuth.currentUser).toBeNull();
    expect(storage.m.has(S.SOS_TOKEN_KEY)).toBe(false);
    expect(storage.m.has(S.SESSION_KEY)).toBe(false);
  });
});

describe("Comptes sur SOVEREIGN : le serveur souverain juge, Firebase sert de pont", () => {
  test("connexion : serveur souverain d'abord, puis pont Firebase avec les mêmes identifiants", async () => {
    const { comptes, firebaseAuth, storage } = setupApp({
      mode: "SOVEREIGN", firebaseAccounts: { "alice@mon50cc.internal": { uid: "fb-alice", password: MDP } },
    });
    const r = await comptes.seConnecter("alice@mon50cc.internal", MDP);
    expect(r.compte).toEqual(expect.objectContaining({ username: "Alice", email: "alice@mon50cc.internal" }));
    expect(r.firebaseUser.uid).toBe("fb-alice");
    expect(await r.sovereignReady).toBe(true);
    expect(firebaseAuth.calls).toEqual([["signIn", "alice@mon50cc.internal"]]);
    expect(storage.m.get(S.SESSION_KEY)).toBeTruthy();
    expect(storage.m.get(S.SESSION_KEY)).not.toContain(MDP);
    // Le code qui lit Firestore reçoit l'utilisateur Firebase (même email), comme avant
    expect(comptes.utilisateurActuel().uid).toBe("fb-alice");
  });

  test("mauvais mot de passe : refusé par le serveur souverain, Firebase n'est même pas essayé", async () => {
    const { comptes, firebaseAuth } = setupApp({
      mode: "SOVEREIGN", firebaseAccounts: { "alice@mon50cc.internal": { uid: "fb-alice", password: "ancien" } },
    });
    const err = await comptes.seConnecter("alice@mon50cc.internal", "ancien").catch((e) => e);
    expect(err.status).toBe(401);
    expect(C.comptesErrorMessage(err)).toBe("Pseudo, e-mail ou mot de passe incorrect.");
    expect(firebaseAuth.calls).toEqual([]);
    expect(comptes.utilisateurActuel()).toBeNull();
  });

  test("pont Firebase impossible : connecté quand même, avec un utilisateur réduit", async () => {
    const { comptes } = setupApp({ mode: "SOVEREIGN" }); // aucun compte Firebase
    const r = await comptes.seConnecter("alice@mon50cc.internal", MDP);
    expect(r.firebaseUser).toBeNull();
    const u = comptes.utilisateurActuel();
    expect(u).toEqual(expect.objectContaining({ isSovereign: true, uid: r.compte.uid, displayName: "Alice", email: "alice@mon50cc.internal" }));
    expect(await u.getIdToken()).toBeTruthy();
  });

  test("pont vers un AUTRE compte Firebase (autre email) : jamais utilisé", async () => {
    const { comptes, firebaseAuth } = setupApp({ mode: "SOVEREIGN" });
    await comptes.seConnecter("alice@mon50cc.internal", MDP);
    firebaseAuth._set({ uid: "fb-bob", email: "bob@mon50cc.internal" }); // session Firebase d'un autre
    expect(comptes.utilisateurActuel().isSovereign).toBe(true);
  });

  test("qui est connecté : personne sans session souveraine, même si Firebase en a une", async () => {
    const { comptes, firebaseAuth } = setupApp({
      mode: "SOVEREIGN", firebaseAccounts: { "alice@mon50cc.internal": { uid: "fb-alice", password: MDP } },
    });
    await firebaseAuth.signInWithEmailAndPassword("alice@mon50cc.internal", MDP); // ancienne session Firebase
    const seen = [];
    comptes.onAuthChange((u) => seen.push(u ? u.uid : null));
    await nextTick();
    expect(seen).toEqual([null]);

    await comptes.seConnecter("alice@mon50cc.internal", MDP);
    await nextTick();
    expect(seen[seen.length - 1]).toBe("fb-alice");

    await comptes.seDeconnecter();
    await nextTick();
    expect(seen[seen.length - 1]).toBeNull();
  });

  test("page suivante : la session est reprise sans retaper le mot de passe", async () => {
    const storage = memoryStorage();
    const first = setupApp({ mode: "SOVEREIGN", storage,
      firebaseAccounts: { "alice@mon50cc.internal": { uid: "fb-alice", password: MDP } } });
    await first.comptes.seConnecter("alice@mon50cc.internal", MDP);

    // Nouvelle page : nouveau client, même stockage. Firebase retrouve sa propre session.
    const next = setupApp({ mode: "SOVEREIGN", storage,
      firebaseAccounts: { "alice@mon50cc.internal": { uid: "fb-alice", password: MDP } } });
    next.firebaseAuth.currentUser = { uid: "fb-alice", email: "alice@mon50cc.internal" };
    const seen = [];
    next.comptes.onAuthChange((u) => seen.push(u ? u.uid : null));
    await nextTick();
    expect(seen).toEqual(["fb-alice"]);
    expect(next.comptes.compteSouverain().username).toBe("Alice");
    expect(next.sovereign.isReady()).toBe(true); // alerte SOS automatique prête aussi
  });

  test("inscription : compte souverain, puis compte Firebase du pont", async () => {
    const { comptes, firebaseAuth } = setupApp({ mode: "SOVEREIGN" });
    const r = await comptes.creerCompte({ email: "nouveau@mon50cc.internal", username: "Nouveau", password: MDP });
    expect(r.compte.username).toBe("Nouveau");
    expect(r.firebaseUser.email).toBe("nouveau@mon50cc.internal");
    expect(firebaseAuth.accounts["nouveau@mon50cc.internal"].password).toBe(MDP);
  });

  test("inscription : pseudo déjà pris sur le serveur souverain → 409, rien chez Firebase", async () => {
    const { comptes, firebaseAuth } = setupApp({ mode: "SOVEREIGN" });
    const err = await comptes.creerCompte({ email: "alice@mon50cc.internal", username: "Alice2", password: MDP }).catch((e) => e);
    expect(err.status).toBe(409);
    expect(C.comptesErrorMessage(err)).toBe("Ce pseudo est déjà utilisé. Choisissez-en un autre.");
    expect(firebaseAuth.calls.filter(([k]) => k === "create")).toEqual([]);
  });

  test("inscription : mot de passe de moins de 8 caractères refusé avant tout envoi", async () => {
    const { comptes, firebaseAuth } = setupApp({ mode: "SOVEREIGN" });
    const err = await comptes.creerCompte({ email: "court@mon50cc.internal", username: "court", password: "abc123" }).catch((e) => e);
    expect(err.code).toBe("comptes/mot-de-passe-court");
    expect(firebaseAuth.calls).toEqual([]);
  });

  test("inscription annulée (pseudo refusé par Firestore) : supprimée des deux côtés, pseudo libéré", async () => {
    const { comptes } = setupApp({ mode: "SOVEREIGN" });
    const r = await comptes.creerCompte({ email: "annule@mon50cc.internal", username: "Annule", password: MDP });
    await comptes.annulerInscription(r.firebaseUser);
    expect(r.firebaseUser.delete).toHaveBeenCalled();
    expect(comptes.utilisateurActuel()).toBeNull();
    // Email et pseudo à nouveau libres sur le serveur souverain
    const again = await post("/auth/register", { email: "annule@mon50cc.internal", username: "Annule", password: MDP });
    expect(again.status).toBe(201);
  });

  test("sans pont Firebase (données parties de Firestore) : Firebase n'est plus du tout appelé", async () => {
    const { comptes, firebaseAuth } = setupApp({ mode: "SOVEREIGN", pontFirebase: false,
      firebaseAccounts: { "alice@mon50cc.internal": { uid: "fb-alice", password: MDP } } });
    const r = await comptes.seConnecter("alice@mon50cc.internal", MDP);
    expect(r.firebaseUser).toBeNull();
    expect(firebaseAuth.calls.filter(([k]) => k !== "signOut")).toEqual([]);
    const seen = [];
    comptes.onAuthChange((u) => seen.push(u && u.isSovereign));
    expect(seen).toEqual([true]);
  });

  test("SOVEREIGN sans serveur souverain branché : erreur claire au démarrage", () => {
    expect(() => C.createComptes({ mode: "SOVEREIGN", firebaseAuth: fakeFirebaseAuth(), sovereign: null }))
      .toThrow(/serveur souverain/);
  });

  test("messages d'erreur : serveur injoignable, trop de tentatives", () => {
    expect(C.comptesErrorMessage(new TypeError("Failed to fetch"))).toMatch(/injoignable/);
    expect(C.comptesErrorMessage(Object.assign(new Error("x"), { status: 429 }))).toMatch(/Trop de tentatives/);
    expect(C.comptesErrorMessage(Object.assign(new Error("x"), { status: 403 }))).toMatch(/suspendu/);
  });
});

describe("Appli : chaque porte d'entrée passe par l'interrupteur", () => {
  const SRC = path.join(__dirname, "..", "src", "js");
  const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8");

  test("plus aucun onAuthStateChanged Firebase direct dans l'appli", () => {
    const offenders = fs.readdirSync(SRC).filter((f) => f.endsWith(".js") &&
      !["comptes-core.js", "sovereign-session.js"].includes(f) &&
      /\.onAuthStateChanged\(/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  test("connexions et inscriptions par mot de passe : par comptes.js", () => {
    for (const f of ["auth.js", "assureur.js", "insurer-portal.js", "inline-garage-2.js", "garage-pro.js"]) {
      const code = read(f);
      expect(code).not.toMatch(/(auth\(\)|auth)\s*\.\s*(signInWithEmailAndPassword|createUserWithEmailAndPassword)\(/);
      expect(code).toMatch(/comptes\.(seConnecter|creerCompte)\(/);
    }
  });

  test("interrupteur des comptes sur le VPS depuis la bascule du 23/11/2026", () => {
    const config = read("config.js");
    expect(config).toMatch(/BACKEND_MODE:\s*\{\s*comptes:\s*"SOVEREIGN"/);
  });
});
