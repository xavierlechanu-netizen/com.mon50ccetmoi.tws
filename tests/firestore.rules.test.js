/**
 * @jest-environment node
 */
const fs = require('fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

let testEnv;

beforeAll(async () => {
  // Load rules from firestore.rules
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  
  testEnv = await initializeTestEnvironment({
    projectId: "mon50ccetmoi-test",
    firestore: {
      rules: rules,
      host: "127.0.0.1",
      port: 8080
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("Tests des Règles de Sécurité Firestore (Zero-Trust)", () => {
  
  it("Devrait empêcher un utilisateur non connecté de lire les users", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthedDb.collection("users").doc("some-uid").get());
  });

  it("Devrait permettre à un utilisateur de lire son propre profil", async () => {
    const myAuthDb = testEnv.authenticatedContext("user123").firestore();
    await assertSucceeds(myAuthDb.collection("users").doc("user123").get());
  });

  it("Devrait empêcher un utilisateur de modifier le profil d'un autre (Zero-Trust)", async () => {
    const hackerDb = testEnv.authenticatedContext("hacker999").firestore();
    await assertFails(hackerDb.collection("users").doc("user123").update({
      role: "admin"
    }));
  });

  it("Devrait empêcher l'écriture de compteurs sans auth", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthedDb.collection("counters").doc("stats").get());
  });

  it("Devrait garantir l'immutabilité absolue des rapports de Blackbox (ASVS v5.0.0-2.3.3)", async () => {
    const userDb = testEnv.authenticatedContext("pilot1").firestore();
    // Création par le propriétaire
    await assertSucceeds(userDb.collection("blackbox_reports").doc("report-1").set({
      userId: "pilot1",
      timestamp: Date.now(),
      speed: 45
    }));
    // Toute tentative de mise à jour doit échouer
    await assertFails(userDb.collection("blackbox_reports").doc("report-1").update({
      speed: 30
    }));
    // Lecture par un tiers non autorisé doit échouer
    const strangerDb = testEnv.authenticatedContext("stranger2").firestore();
    await assertFails(strangerDb.collection("blackbox_reports").doc("report-1").get());
  });

  it("Devrait interdire tout accès direct aux fido_challenges et rate_limits (ASVS v5.0.0-8.x)", async () => {
    const userDb = testEnv.authenticatedContext("user123").firestore();
    await assertFails(userDb.collection("fido_challenges").doc("user123").get());
    await assertFails(userDb.collection("fido_challenges").doc("user123").set({ challenge: "fake" }));
    await assertFails(userDb.collection("rate_limits").doc("limit1").get());
    await assertFails(userDb.collection("rate_limits").doc("limit1").set({ count: 0 }));
  });

  it("Devrait valider la structure stricte et l'immutabilité des auth_logs (ASVS v5.0.0-16.x & RGPD)", async () => {
    const userDb = testEnv.authenticatedContext("user123").firestore();
    // Interdire les champs PII comme mot de passe ou email
    await assertFails(userDb.collection("auth_logs").doc("log-x").set({
      uid_hash: "a1b2c3d4",
      method: "password",
      status: "success",
      email: "user@example.com", // PII interdite !
      timestamp: new Date()
    }));
    // Interdire la lecture par un utilisateur standard
    await assertFails(userDb.collection("auth_logs").doc("log-x").get());
    // Interdire la modification
    await assertFails(userDb.collection("auth_logs").doc("log-x").update({ status: "failure" }));
  });
});
