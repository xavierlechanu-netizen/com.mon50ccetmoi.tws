/**
 * @jest-environment node
 *
 * Connexion par clé d'accès (FIDO2 / passkeys) : functions/api/auth.js, de bout en bout, avec la
 * vraie bibliothèque SimpleWebAuthn du serveur et une clé d'accès simulée (vraie signature P-256).
 * Seuls Firestore et Firebase Auth sont simulés.
 *
 * Le 8/11/2026, auth.js utilisait encore l'interface de SimpleWebAuthn v10 alors que la v13 était
 * installée : enregistrer une clé d'accès plantait et la connexion par clé d'accès échouait toujours.
 */
const crypto = require("crypto");
const path = require("path");

const FUNCTIONS = path.resolve(__dirname, "../functions");
const fromFunctions = (m) => require(require.resolve(m, { paths: [FUNCTIONS] }));
const { isoCBOR } = fromFunctions("@simplewebauthn/server/helpers");

const RP_ID = "mon50ccetmoi.com";
const ORIGIN = "https://mon50ccetmoi.com";
const UID = "pilote1";

// ── Firestore et Firebase Auth simulés ─────────────────────────────────────
function fakeDb() {
  const store = new Map();
  const docRef = (p) => ({
    get: async () => ({ exists: store.has(p), data: () => store.get(p), ref: docRef(p) }),
    set: async (d) => { store.set(p, { ...d }); },
    update: async (d) => { store.set(p, { ...store.get(p), ...d }); },
    delete: async () => { store.delete(p); },
    collection: (name) => collRef(`${p}/${name}`),
  });
  const collRef = (p) => ({
    doc: (id) => {
      // Comme Firestore : un « / » dans l'identifiant désigne un autre chemin, refusé ici
      if (String(id).includes("/")) throw new Error(`Invalid document reference: ${p}/${id}`);
      return docRef(`${p}/${id}`);
    },
    get: async () => {
      const docs = [...store.keys()]
        .filter((k) => k.startsWith(`${p}/`) && !k.slice(p.length + 1).includes("/"))
        .map((k) => ({ id: k.split("/").pop(), data: () => store.get(k) }));
      return { empty: docs.length === 0, docs };
    },
  });
  return { store, collection: (name) => collRef(name) };
}

const mockDb = fakeDb(); // préfixe « mock » : seul nom autorisé dans la fabrique de jest.mock
jest.mock("../functions/api/shared", () => ({
  onCall: (_opts, handler) => handler,
  onRequest: (_opts, handler) => handler,
  HttpsError: class extends Error { constructor(code, message) { super(message); this.code = code; } },
  admin: {
    firestore: { FieldValue: { serverTimestamp: () => "maintenant" } },
    auth: () => ({
      getUser: async (uid) => { if (uid !== "pilote1") throw new Error("inconnu"); return { uid }; },
      createCustomToken: async (uid) => `jeton-${uid}`,
    }),
  },
  get db() { return mockDb; },
  setCorsHeaders: () => {},
  verifyAuthToken: async () => null,
}));

const auth = require("../functions/api/auth");
const {
  credentialDocIdsToTry, storedCredentialFromRegistration, credentialForVerification,
} = require("../functions/api/fido-credentials");

// ── Clé d'accès simulée (comme l'empreinte digitale d'un téléphone) ─────────
const b64url = (buf) => Buffer.from(buf).toString("base64url");
const sha256 = (data) => crypto.createHash("sha256").update(data).digest();
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };

function createAuthenticator(credId = crypto.randomBytes(32)) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" });
  let counter = 0;
  const cosePublicKey = isoCBOR.encode(new Map([
    [1, 2], // kty : EC2
    [3, -7], // alg : ES256
    [-1, 1], // crv : P-256
    [-2, Buffer.from(jwk.x, "base64url")],
    [-3, Buffer.from(jwk.y, "base64url")],
  ]));

  return {
    credId,
    /** navigator.credentials.create(), au format envoyé par src/js/auth.js */
    register(options, origin = ORIGIN) {
      const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.create", challenge: options.challenge, origin, crossOrigin: false }));
      const authData = Buffer.concat([
        sha256(options.rp.id), Buffer.from([0x45]), u32(counter), // présence + vérification + clé jointe
        Buffer.alloc(16), Buffer.from([0, credId.length]), credId, Buffer.from(cosePublicKey),
      ]);
      const attestationObject = isoCBOR.encode(new Map([["fmt", "none"], ["attStmt", new Map()], ["authData", authData]]));
      return {
        id: b64url(credId), rawId: b64url(credId), type: "public-key", clientExtensionResults: {},
        response: { attestationObject: b64url(attestationObject), clientDataJSON: b64url(clientDataJSON) },
      };
    },
    /** navigator.credentials.get(), au format envoyé par src/js/auth.js */
    sign(options, origin = ORIGIN) {
      counter += 1;
      const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge: options.challenge, origin, crossOrigin: false }));
      const authData = Buffer.concat([sha256(options.rpId), Buffer.from([0x05]), u32(counter)]);
      const signature = crypto.sign("sha256", Buffer.concat([authData, sha256(clientDataJSON)]), privateKey);
      return {
        id: b64url(credId), rawId: b64url(credId), type: "public-key", clientExtensionResults: {},
        response: {
          authenticatorData: b64url(authData), clientDataJSON: b64url(clientDataJSON),
          signature: b64url(signature), userHandle: null,
        },
      };
    },
  };
}

const call = (fn, data, uid) => fn({ data, auth: uid ? { uid } : undefined });
const credentialPath = (key) => `users/${UID}/fido_credentials/${key.credId.toString("base64url")}`;

async function registerKey(key) {
  const options = await call(auth.fidoGenerateRegistration, { rpId: RP_ID }, UID);
  return call(auth.fidoVerifyRegistration, { response: key.register(options) }, UID);
}

async function signIn(key, { origin, tamper } = {}) {
  const options = await call(auth.fidoGenerateAuthentication, { uid: UID, rpId: RP_ID });
  const assertion = key.sign(options, origin);
  if (tamper) assertion.response.signature = b64url(Buffer.from(assertion.response.signature, "base64url").reverse());
  return { options, assertion, result: () => call(auth.fidoVerifyAuthentication, { uid: UID, response: assertion }) };
}

beforeEach(() => mockDb.store.clear());

describe("Enregistrement d'une clé d'accès", () => {
  test("la clé est enregistrée (champs au format historique)", async () => {
    const key = createAuthenticator();
    await expect(registerKey(key)).resolves.toEqual({ success: true });
    const saved = mockDb.store.get(credentialPath(key));
    expect(saved).toMatchObject({ credentialID: key.credId.toString("base64"), counter: 0, timestamp: "maintenant" });
    expect(Buffer.from(saved.credentialPublicKey, "base64").length).toBeGreaterThan(60);
    expect(mockDb.store.has(`fido_challenges/${UID}`)).toBe(false); // défi à usage unique
  });

  test("identifiant dont le base64 contient « / » : enregistrée et utilisable (bug corrigé)", async () => {
    const key = createAuthenticator(Buffer.alloc(32, 0xff)); // base64 : « //////… »
    expect(key.credId.toString("base64")).toContain("/");
    await expect(registerKey(key)).resolves.toEqual({ success: true });
    const { result } = await signIn(key);
    await expect(result()).resolves.toMatchObject({ success: true });
  });

  test("refusée si elle vient d'un autre site (hameçonnage)", async () => {
    const key = createAuthenticator();
    const options = await call(auth.fidoGenerateRegistration, { rpId: RP_ID }, UID);
    await expect(call(auth.fidoVerifyRegistration, { response: key.register(options, "https://mon50cc-et-moi.fr") }, UID))
      .rejects.toMatchObject({ code: "invalid-argument" });
    expect(mockDb.store.has(credentialPath(key))).toBe(false);
  });

  test("réservée à un membre connecté", async () => {
    await expect(call(auth.fidoGenerateRegistration, {})).rejects.toMatchObject({ code: "unauthenticated" });
  });
});

describe("Connexion par clé d'accès", () => {
  test("signature valide : jeton de connexion et compteur mis à jour", async () => {
    const key = createAuthenticator();
    await registerKey(key);
    const { options, result } = await signIn(key);
    expect(options.allowCredentials.map((c) => c.id)).toEqual([b64url(key.credId)]);
    await expect(result()).resolves.toEqual({ success: true, customToken: `jeton-${UID}` });
    expect(mockDb.store.get(credentialPath(key)).counter).toBe(1);

    const second = await signIn(key);
    await expect(second.result()).resolves.toMatchObject({ success: true });
    expect(mockDb.store.get(credentialPath(key)).counter).toBe(2);
  });

  test("rejouer une signature déjà utilisée est refusé", async () => {
    const key = createAuthenticator();
    await registerKey(key);
    const { result } = await signIn(key);
    await result();
    await expect(result()).rejects.toMatchObject({ code: "failed-precondition" });
  });

  test("signature falsifiée refusée", async () => {
    const key = createAuthenticator();
    await registerKey(key);
    const { result } = await signIn(key, { tamper: true });
    await expect(result()).rejects.toMatchObject({ code: "invalid-argument" });
    expect(mockDb.store.get(credentialPath(key)).counter).toBe(0);
  });

  test("signature faite pour un autre site refusée", async () => {
    const key = createAuthenticator();
    await registerKey(key);
    const { result } = await signIn(key, { origin: "https://mon50cc-et-moi.fr" });
    await expect(result()).rejects.toMatchObject({ code: "invalid-argument" });
  });

  test("clé enregistrée avant la correction (document au nom base64) : toujours acceptée", async () => {
    const key = createAuthenticator(Buffer.alloc(32, 1)); // base64 sans « / » : seul cas enregistrable avant
    await registerKey(key);
    const legacyPath = `users/${UID}/fido_credentials/${key.credId.toString("base64")}`;
    mockDb.store.set(legacyPath, mockDb.store.get(credentialPath(key)));
    mockDb.store.delete(credentialPath(key));
    const { result } = await signIn(key);
    await expect(result()).resolves.toMatchObject({ success: true });
    expect(mockDb.store.get(legacyPath).counter).toBe(1);
  });

  test("clé d'un autre appareil, jamais enregistrée : refusée", async () => {
    const key = createAuthenticator();
    await registerKey(key);
    const intruder = createAuthenticator();
    const options = await call(auth.fidoGenerateAuthentication, { uid: UID, rpId: RP_ID });
    await expect(call(auth.fidoVerifyAuthentication, { uid: UID, response: intruder.sign(options) }))
      .rejects.toMatchObject({ code: "not-found" });
  });
});

describe("Conversion du format stocké", () => {
  test("aller-retour sans perte", () => {
    const publicKey = new Uint8Array([1, 2, 3, 250]);
    const stored = storedCredentialFromRegistration({ credential: { id: "AQID-_8", publicKey, counter: 7 } });
    expect(stored).toEqual({
      docId: "AQID-_8",
      data: { credentialID: "AQID+/8=", credentialPublicKey: "AQID+g==", counter: 7 },
    });
    const back = credentialForVerification(stored.data);
    expect(back.id).toBe("AQID-_8");
    expect([...back.publicKey]).toEqual([...publicKey]);
    expect(back.counter).toBe(7);
  });

  test("identifiants à essayer : actuel, puis ancien s'il était enregistrable", () => {
    expect(credentialDocIdsToTry("AQIDBA")).toEqual(["AQIDBA", "AQIDBA=="]);
    expect(credentialDocIdsToTry("AQID-_8")).toEqual(["AQID-_8"]); // ancien « AQID+/8= » : impossible
  });

  test("réponse incomplète : erreur claire", () => {
    expect(() => storedCredentialFromRegistration({ credentialID: "ancien format" })).toThrow("incomplète");
  });
});
