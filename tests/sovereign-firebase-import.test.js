/**
 * @jest-environment node
 *
 * Jour J : comptes importés de Firebase Authentication.
 * Vecteur de test : celui publié par Firebase avec son outil de hachage (github.com/firebase/scrypt).
 */
const FIREBASE_VECTOR = {
  signerKey: "jxspr8Ki0RYycVU8zykbdLGjFQ3McFUH0uiiTvC8pVMXAn210wjLNmdZJzxUECKbm0QsEmYUSDzZvpjeJ9WmXA==",
  saltSeparator: "Bw==",
  rounds: "8",
  memCost: "14",
  salt: "42xEC+ixf3L2lw==",
  hash: "lSrfV15cpx95/sZS2W9c9Kp6i/LVgQNDNC/qzrCnh1SAyZvqmZqAjTdn3aoItz+VHjoZilo78198JAdRuid5lQ==",
  password: "user1password",
};

// Les paramètres sont lus au chargement du module, comme sur le serveur (.env)
process.env.FIREBASE_SCRYPT_SIGNER_KEY = FIREBASE_VECTOR.signerKey;
process.env.FIREBASE_SCRYPT_SALT_SEPARATOR = FIREBASE_VECTOR.saltSeparator;
process.env.FIREBASE_SCRYPT_ROUNDS = FIREBASE_VECTOR.rounds;
process.env.FIREBASE_SCRYPT_MEM_COST = FIREBASE_VECTOR.memCost;

const {
  verifyPassword, firebaseStoredHash, isFirebaseHash, firebaseHashParamsFromEnv, hashPassword, rehashVerifiedPassword,
} = require("../sovereign-core/server/crypto-auth");
const { createSovereignApp } = require("../sovereign-core/server/index");
const { createMemoryStore } = require("../sovereign-core/server/store-memory");
const { planImport } = require("../sovereign-core/scripts/import-firebase-users");

const STORED = firebaseStoredHash(FIREBASE_VECTOR.salt, FIREBASE_VECTOR.hash);

function call(app, method, url, body) {
  return new Promise((resolve, reject) => {
    const req = { method, url, headers: {}, socket: { remoteAddress: "10.2.2.2" } };
    const res = { statusCode: 200, setHeader() {}, end(p) { resolve({ status: this.statusCode, body: p ? JSON.parse(p) : null }); } };
    app.handleRequest(req, res, Buffer.from(JSON.stringify(body))).catch(reject);
  });
}

describe("Mots de passe au format Firebase", () => {
  test("le vecteur officiel de Firebase est reconnu, un autre mot de passe non", () => {
    expect(isFirebaseHash(STORED)).toBe(true);
    expect(verifyPassword(FIREBASE_VECTOR.password, STORED)).toBe(true);
    expect(verifyPassword("user1passwore", STORED)).toBe(false);
    expect(verifyPassword("", STORED)).toBe(false);
  });

  test("sans les paramètres du projet Firebase, aucun compte importé ne peut se connecter", () => {
    expect(verifyPassword(FIREBASE_VECTOR.password, STORED, { firebaseParams: null })).toBe(false);
    expect(firebaseHashParamsFromEnv({})).toBeNull();
    expect(() => firebaseHashParamsFromEnv({ FIREBASE_SCRYPT_SIGNER_KEY: "a", FIREBASE_SCRYPT_SALT_SEPARATOR: "b", FIREBASE_SCRYPT_MEM_COST: "40" }))
      .toThrow(/MEM_COST/);
  });

  test("empreintes abîmées ou d'un autre format : refusées sans planter", () => {
    expect(verifyPassword(FIREBASE_VECTOR.password, "firebase-scrypt$")).toBe(false);
    expect(verifyPassword(FIREBASE_VECTOR.password, "firebase-scrypt$abc$def")).toBe(false);
    expect(verifyPassword(FIREBASE_VECTOR.password, "!")).toBe(false);
    expect(() => firebaseStoredHash("", FIREBASE_VECTOR.hash)).toThrow();
    // Les empreintes du serveur fonctionnent toujours
    expect(verifyPassword("MotDePasse2026!", hashPassword("MotDePasse2026!"))).toBe(true);
  });

  test("re-hachage : accepte les mots de passe courts de Firebase (6 car.), pas l'inscription", () => {
    expect(() => hashPassword("abc123")).toThrow();
    expect(verifyPassword("abc123", rehashVerifiedPassword("abc123"))).toBe(true);
  });

  test("connexion d'un compte importé : réussit, puis l'empreinte passe au format du serveur", async () => {
    const store = createMemoryStore();
    const app = createSovereignApp({ store });
    const user = await store.createUser({ uid: "11111111-1111-4111-8111-111111111111", email: "pilote@example.com",
      username: "Pilote", passwordHash: STORED });

    expect((await call(app, "POST", "/api/v1/auth/login", { email: "pilote@example.com", password: "faux-mot-de-passe" })).status).toBe(401);
    expect((await store.findUserById(user.uid)).passwordHash).toBe(STORED);

    const ok = await call(app, "POST", "/api/v1/auth/login", { email: "pilote@example.com", password: FIREBASE_VECTOR.password });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    const converted = (await store.findUserById(user.uid)).passwordHash;
    expect(converted.startsWith("scrypt$")).toBe(true);

    // Même mot de passe, nouvelle empreinte : la connexion continue de marcher
    expect((await call(app, "POST", "/api/v1/auth/login", { email: "pilote@example.com", password: FIREBASE_VECTOR.password })).status).toBe(200);
  });
});

describe("Préparation de l'import (export « firebase auth:export »)", () => {
  const exportData = {
    users: [
      { localId: "fbUidMotDePasse0000000000001", email: "Alice@Example.com ", displayName: "Alice", passwordHash: FIREBASE_VECTOR.hash,
        salt: FIREBASE_VECTOR.salt, createdAt: "1700000000000", providerUserInfo: [{ providerId: "password" }] },
      { localId: "fbUidGoogle00000000000000002", email: "bob@gmail.com", displayName: "Alice", createdAt: "1710000000000",
        providerUserInfo: [{ providerId: "google.com" }] },
      { localId: "fbUidDesactive00000000000003", email: "c@example.com", disabled: true, passwordHash: FIREBASE_VECTOR.hash, salt: FIREBASE_VECTOR.salt },
      { localId: "fbUidTelephone00000000000004", phoneNumber: "+33600000000" },
      { localId: "fbUidDoublon000000000000005", email: "alice@example.com" },
      { localId: "fbUidSansNom0000000000000006", email: "x@example.com" },
      { email: "sans-identifiant@example.com" },
    ],
  };

  test("chaque cas est rangé au bon endroit", () => {
    const { rows, report } = planImport(exportData);
    expect(report).toMatchObject({ total: 7, toImport: 3, withPassword: 1, withoutPassword: 2, alreadyImported: 0 });
    // Même adresse qu'un autre compte du fichier : ni importé, ni rattaché, à vérifier
    expect(report.conflicts).toEqual([{ firebaseUid: "fbUidDoublon000000000000005", reason: "autre compte Firebase" }]);
    expect(report.skippedDisabled).toEqual(["fbUidDesactive00000000000003"]);
    expect(report.skippedNoEmail).toEqual(["fbUidTelephone00000000000004"]);
    expect(report.skippedInvalid).toEqual(["(sans identifiant)"]);

    const [alice, bob, x] = rows;
    expect(alice).toMatchObject({ firebaseUid: "fbUidMotDePasse0000000000001", email: "alice@example.com", username: "Alice",
      passwordHash: STORED, createdAt: "2023-11-14T22:13:20.000Z" });
    // Connexion Google seule : pas de mot de passe, aucune connexion possible en l'état
    expect(bob).toMatchObject({ email: "bob@gmail.com", username: "Alice-2", passwordHash: "!" });
    // Pas de nom affiché : le début de l'email, allongé s'il est trop court
    expect(x.username).toBe("pilote");
  });

  test("relancer l'import ne crée pas de doublon, et les pseudos existants sont évités", () => {
    const { rows, report } = planImport(exportData, {
      emails: ["alice@example.com"], firebaseUids: ["fbUidGoogle00000000000000002"], usernames: ["pilote"],
    });
    expect(report.alreadyImported).toBe(3);
    expect(rows.map((r) => r.username)).toEqual(["pilote-2"]);
  });

  test("adresse déjà prise par un compte créé sur le serveur : pas importé, signalé, rien de rattaché", () => {
    const { rows, report } = planImport(exportData, {
      accounts: [
        // Créé directement sur le serveur avec l'adresse d'Alice (avant l'import) : peut-être un usurpateur
        { email: "alice@example.com", username: "Alice", firebaseUid: null },
        // Bob, déjà importé lors d'un passage précédent
        { email: "bob@gmail.com", username: "Alice-2", firebaseUid: "fbUidGoogle00000000000000002" },
      ],
    });
    expect(report.alreadyImported).toBe(1);
    expect(report.conflicts).toEqual([
      { firebaseUid: "fbUidMotDePasse0000000000001", reason: "compte créé sur le serveur" },
      { firebaseUid: "fbUidDoublon000000000000005", reason: "compte créé sur le serveur" },
    ]);
    expect(rows.map((r) => r.email)).toEqual(["x@example.com"]);
    expect(rows.find((r) => r.email === "alice@example.com")).toBeUndefined();
  });

  test("compte « Google seul » déjà importé qui a choisi un mot de passe : son empreinte est ajoutée", () => {
    const later = { users: [
      { localId: "fbUidGoogle00000000000000002", email: "bob@gmail.com", passwordHash: FIREBASE_VECTOR.hash, salt: FIREBASE_VECTOR.salt },
      { localId: "fbUidMotDePasse0000000000001", email: "alice@example.com", passwordHash: FIREBASE_VECTOR.hash, salt: FIREBASE_VECTOR.salt },
    ] };
    const { rows, report, passwordUpdates } = planImport(later, { accounts: [
      { email: "bob@gmail.com", username: "Bob", firebaseUid: "fbUidGoogle00000000000000002", hasPassword: false },
      // A déjà un mot de passe sur le serveur : jamais écrasé
      { email: "alice@example.com", username: "Alice", firebaseUid: "fbUidMotDePasse0000000000001", hasPassword: true },
    ] });
    expect(rows).toEqual([]);
    expect(report).toMatchObject({ alreadyImported: 2, passwordsAdded: 1 });
    expect(passwordUpdates).toEqual([{ firebaseUid: "fbUidGoogle00000000000000002", passwordHash: STORED }]);
  });

  test("un fichier qui n'est pas un export Firebase est refusé", () => {
    expect(() => planImport({})).toThrow(/auth:export/);
    expect(() => planImport(null)).toThrow(/auth:export/);
  });
});
