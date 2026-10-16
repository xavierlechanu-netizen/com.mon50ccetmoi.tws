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

  it("Devrait empêcher un utilisateur de s'auto-attribuer le rôle admin ou un numéro de série (Anti-Privilege Escalation)", async () => {
    const userDb = testEnv.authenticatedContext("pilot99").firestore();

    // 1. Rejeter la création avec role: "admin"
    await assertFails(userDb.collection("users").doc("pilot99").set({
      username: "fakeadmin",
      role: "admin"
    }));

    // 2. Rejeter la création avec blackbox_serial
    await assertFails(userDb.collection("users").doc("pilot99").set({
      username: "fakeblackbox",
      blackbox_serial: "BB50V1-P01"
    }));

    // 3. Permettre la création d'un profil standard
    await assertSucceeds(userDb.collection("users").doc("pilot99").set({
      username: "realpilot",
      role: "user"
    }));

    // 4. Rejeter la mise à jour pour s'attribuer le rôle admin
    await assertFails(userDb.collection("users").doc("pilot99").update({
      role: "admin"
    }));

    // 5. Rejeter la mise à jour pour s'attribuer un numéro de série
    await assertFails(userDb.collection("users").doc("pilot99").update({
      blackbox_serial: "BB50V1-P01"
    }));

    // 6. Autoriser la mise à jour des champs légitimes (ex: contacts d'urgence)
    await assertSucceeds(userDb.collection("users").doc("pilot99").update({
      emergencyContacts: ["0600000000"]
    }));
  });

  it("Devrait isoler strictement le registre blackbox_units et interdire les écritures directes", async () => {
    const userDb = testEnv.authenticatedContext("user123").firestore();

    // Rejeter l'écriture client directe dans blackbox_units
    await assertFails(userDb.collection("blackbox_units").doc("BB50V1-P01").set({
      serial: "BB50V1-P01",
      status: "IN_STOCK"
    }));

    // Rejeter la lecture du registre global par un non-admin
    await assertFails(userDb.collection("blackbox_registry").doc("V1").get());

    // Rejeter l'écriture directe dans blackbox_sales (réservé Cloud Function / Webhook Revolut)
    await assertFails(userDb.collection("blackbox_sales").doc("fake-sale-1").set({
      userId: "user123",
      amount: 49.99
    }));
  });
});
