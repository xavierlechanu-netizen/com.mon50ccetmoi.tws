/**
 * Appli branchée sur le serveur souverain pour l'alerte SOS (src/js/sovereign-session.js)
 * et SDK client (sovereign-core/client/sovereign-sdk.js) : jeton SOS de 30 jours, renouvelé,
 * jamais de mot de passe gardé, et une connexion à l'appli qui ne dépend jamais du serveur.
 */
const fs = require("fs");
const path = require("path");

function loadModule(file, names) {
  const code = fs.readFileSync(path.join(__dirname, "..", file), "utf8")
    .replace(/^export default .*$/gm, "")
    .replace(/^export /gm, "");
  // Même méthode que les autres tests du projet pour charger un module ES sans transpilation
  // eslint-disable-next-line no-new-func
  return new Function(`${code}; return { ${names.join(", ")} };`)();
}

const S = loadModule("src/js/sovereign-session.js", ["tokenTimes", "createSovereignSession", "SOS_TOKEN_KEY", "withSovereignProfile"]);
const { SovereignClient } = loadModule("sovereign-core/client/sovereign-sdk.js", ["SovereignClient"]);

const NOW = 1_800_000_000_000;
const DAY = 24 * 3600 * 1000;
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const jwt = (iatMs, expMs) => `${b64url({ alg: "ES256" })}.${b64url({ iat: iatMs / 1000, exp: expMs / 1000, purpose: "sos" })}.sig`;

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

function fakeClient(over = {}) {
  return {
    sosToken: null,
    signInWithEmailAndPassword: jest.fn(async function () { this.sosToken = jwt(NOW, NOW + 30 * DAY); }),
    renewSosToken: jest.fn(async function () { this.sosToken = jwt(NOW, NOW + 30 * DAY); return this.sosToken; }),
    signOut: jest.fn(function () { this.sosToken = null; }),
    ...over,
  };
}

const session = (client, storage, extra = {}) => S.createSovereignSession({ client, storage, now: () => NOW, ...extra });

describe("Lecture du jeton", () => {
  test("dates d'émission et d'expiration en millisecondes", () => {
    expect(S.tokenTimes(jwt(NOW, NOW + DAY))).toEqual({ iat: NOW, exp: NOW + DAY });
  });

  test("jeton illisible : null", () => {
    for (const t of [null, "", "abc", "a.b.c", `${b64url({})}.${b64url({ iat: 1 })}.x`]) expect(S.tokenTimes(t)).toBeNull();
  });
});

describe("Au chargement d'une page", () => {
  test("jeton gardé et valable : l'alerte SOS automatique est prête", () => {
    const token = jwt(NOW - DAY, NOW + DAY);
    const client = fakeClient();
    const s = session(client, memoryStorage({ [S.SOS_TOKEN_KEY]: token }));
    expect(s.restore()).toBe(true);
    expect(client.sosToken).toBe(token);
    expect(s.isReady()).toBe(true);
  });

  test("jeton expiré : effacé, pas prêt", () => {
    const storage = memoryStorage({ [S.SOS_TOKEN_KEY]: jwt(NOW - 31 * DAY, NOW - DAY) });
    const s = session(fakeClient(), storage);
    expect(s.restore()).toBe(false);
    expect(storage.m.has(S.SOS_TOKEN_KEY)).toBe(false);
    expect(s.isReady()).toBe(false);
  });

  test("stockage inaccessible (navigation privée…) : pas d'erreur", () => {
    const broken = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); } };
    expect(session(fakeClient(), broken).restore()).toBe(false);
  });
});

describe("Renouvellement (une fois par jour d'utilisation)", () => {
  test("jeton de moins d'un jour : pas de requête", async () => {
    const client = fakeClient({ sosToken: jwt(NOW - 3600_000, NOW + DAY) });
    expect(await session(client, memoryStorage()).renewIfDue()).toBe(false);
    expect(client.renewSosToken).not.toHaveBeenCalled();
  });

  test("jeton de plus d'un jour : renouvelé et gardé", async () => {
    const storage = memoryStorage();
    const client = fakeClient({ sosToken: jwt(NOW - 2 * DAY, NOW + DAY) });
    expect(await session(client, storage).renewIfDue()).toBe(true);
    expect(storage.getItem(S.SOS_TOKEN_KEY)).toBe(client.sosToken);
    expect(S.tokenTimes(client.sosToken).exp).toBe(NOW + 30 * DAY);
  });

  test("serveur injoignable : l'ancien jeton (encore valable) est gardé", async () => {
    const old = jwt(NOW - 2 * DAY, NOW + DAY);
    const storage = memoryStorage({ [S.SOS_TOKEN_KEY]: old });
    const client = fakeClient({ sosToken: old, renewSosToken: jest.fn(async () => { throw new Error("Failed to fetch"); }) });
    expect(await session(client, storage).renewIfDue()).toBe(false);
    expect(client.sosToken).toBe(old);
    expect(storage.getItem(S.SOS_TOKEN_KEY)).toBe(old);
  });

  test("refusé par le serveur (compte supprimé) : jeton effacé", async () => {
    const old = jwt(NOW - 2 * DAY, NOW + DAY);
    const storage = memoryStorage({ [S.SOS_TOKEN_KEY]: old });
    const refus = Object.assign(new Error("Reconnectez-vous"), { status: 401 });
    const client = fakeClient({ sosToken: old, renewSosToken: jest.fn(async () => { throw refus; }) });
    await session(client, storage).renewIfDue();
    expect(client.sosToken).toBeNull();
    expect(storage.m.has(S.SOS_TOKEN_KEY)).toBe(false);
  });
});

describe("Connexion en même temps que Firebase", () => {
  test("succès : jeton SOS gardé, jamais le mot de passe", async () => {
    const storage = memoryStorage();
    const client = fakeClient();
    expect(await session(client, storage).connect("pilote@mon50cc.internal", "secret-123")).toBe(true);
    expect(client.signInWithEmailAndPassword).toHaveBeenCalledWith("pilote@mon50cc.internal", "secret-123");
    expect([...storage.m.keys()]).toEqual([S.SOS_TOKEN_KEY]);
    expect([...storage.m.values()].join()).not.toContain("secret-123");
  });

  test("compte absent du serveur ou serveur en panne : false, sans erreur", async () => {
    const storage = memoryStorage();
    const client = fakeClient({ signInWithEmailAndPassword: jest.fn(async () => { throw new Error("Identifiants invalides."); }) });
    await expect(session(client, storage).connect("a@b.c", "x")).resolves.toBe(false);
    expect(storage.m.size).toBe(0);
  });

  test("serveur trop lent : abandon, la connexion à l'appli n'attend pas", async () => {
    const client = fakeClient({ signInWithEmailAndPassword: jest.fn(() => new Promise(() => {})) });
    const t0 = Date.now();
    await expect(session(client, memoryStorage(), { connectTimeoutMs: 30 }).connect("a@b.c", "x")).resolves.toBe(false);
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  test("déconnexion : plus de jeton SOS sur le téléphone", () => {
    const storage = memoryStorage({ [S.SOS_TOKEN_KEY]: jwt(NOW, NOW + DAY) });
    const client = fakeClient({ sosToken: jwt(NOW, NOW + DAY) });
    session(client, storage).forget();
    expect(client.signOut).toHaveBeenCalled();
    expect(storage.m.size).toBe(0);
  });
});

describe("SDK client : l'alerte SOS part avec le jeton SOS", () => {
  let calls;
  beforeEach(() => {
    calls = [];
    global.fetch = jest.fn(async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/auth/login")) return { ok: true, status: 200, json: async () => ({ uid: "u1", token: "SESSION", sosToken: "SOS1" }) };
      if (url.endsWith("/auth/sos-token")) return { ok: true, status: 200, json: async () => ({ sosToken: "SOS2" }) };
      if (url.endsWith("/sos")) return { ok: true, status: 200, json: async () => ({ sent: 1 }) };
      return { ok: false, status: 401, json: async () => ({ error: "Reconnectez-vous" }) };
    });
  });
  afterEach(() => { delete global.fetch; });

  test("connexion : jeton SOS reçu ; alerte et renouvellement avec ce jeton, même si une session existe", async () => {
    const c = new SovereignClient({ apiBaseUrl: "https://api.test/api/v1" });
    await c.signInWithEmailAndPassword("a@b.c", "x");
    expect(c.sosToken).toBe("SOS1");
    await c.sendSos({ lat: 1, lng: 2, contacts: ["0612345678"] });
    expect(calls[1].init.headers.Authorization).toBe("Bearer SOS1");
    await c.renewSosToken();
    expect(calls[2].init.headers.Authorization).toBe("Bearer SOS1");
    expect(c.sosToken).toBe("SOS2");
    c.signOut();
    expect(c.sosToken).toBeNull();
  });

  test("les autres requêtes gardent le jeton de session", async () => {
    const c = new SovereignClient({ apiBaseUrl: "https://api.test/api/v1" });
    await c.signInWithEmailAndPassword("a@b.c", "x");
    await c.uploadBlackboxTelemetry({}).catch(() => {});
    expect(calls[1].init.headers.Authorization).toBe("Bearer SESSION");
  });

  test("une erreur du serveur garde son code HTTP", async () => {
    const c = new SovereignClient({ apiBaseUrl: "https://api.test/api/v1" });
    await expect(c.uploadBlackboxTelemetry({})).rejects.toMatchObject({ status: 401, message: "Reconnectez-vous" });
  });
});

test("session : le serveur fait foi, la date d'inscription la plus ancienne gagne", () => {
  const { withSovereignProfile } = S;
  const p = { brand: "MBK", model: null, department: "43", ghostMode: true, registeredAt: "2026-01-02T00:00:00.000Z" };
  const s = withSovereignProfile({ model: "Booster", registrationDate: Date.parse("2026-11-18") }, p);
  expect(s).toEqual({ brand: "MBK", model: "Booster", department: "43", ghostMode: true, registrationDate: Date.parse("2026-01-02"),
    isGold: false, isFoundingMember: false, goldUntil: null });
  // GOLD : seul le serveur le dit
  expect(withSovereignProfile({}, { gold: true, founder: true, goldUntil: null })).toMatchObject({ isGold: true, isFoundingMember: true });
  expect(withSovereignProfile({ isGold: true }, { gold: false })).toMatchObject({ isGold: false });
  expect(withSovereignProfile({ registrationDate: 0 }, p).registrationDate).toBe(Date.parse("2026-01-02"));
  expect(withSovereignProfile({ registrationDate: Date.parse("2025-07-01") }, p).registrationDate).toBe(Date.parse("2025-07-01"));
  expect(withSovereignProfile({ a: 1 }, null)).toEqual({ a: 1 });
});
