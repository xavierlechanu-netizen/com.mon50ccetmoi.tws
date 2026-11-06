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
    // La création est réservée au serveur (Admin SDK) : même le propriétaire ne peut pas créer
    await assertFails(userDb.collection("blackbox_reports").doc("report-0").set({ userId: "pilot1", speed: 45 }));
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("blackbox_reports").doc("report-1").set({
        userId: "pilot1",
        timestamp: Date.now(),
        speed: 45
      });
    });
    // Le propriétaire peut lire son rapport
    await assertSucceeds(userDb.collection("blackbox_reports").doc("report-1").get());
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

  it("Devrait empêcher l usurpation d identité à la création (audit 2026-11, E2)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("users").doc("pilot1").set({ username: "Pilote1", role: "user" });
    });
    const db = testEnv.authenticatedContext("pilot1").firestore();

    // Création légitime : identifiants et pseudo du vrai auteur, ou champs absents
    await assertSucceeds(db.collection("hazards").add({ type: "trou", uid: "pilot1", author: "Pilote1" }));
    await assertSucceeds(db.collection("hazards").add({ type: "trou", reporter: "Membre" }));
    await assertSucceeds(db.collection("community_roadbooks").add({ title: "Balade", userId: "pilot1" }));
    await assertSucceeds(db.collection("crash_reports").add({ message: "bug" }));

    // Usurpation : identifiant ou pseudo d un autre utilisateur
    await assertFails(db.collection("hazards").add({ type: "trou", authorUid: "victim" }));
    await assertFails(db.collection("hazards").add({ type: "trou", author: "Victime" }));
    await assertFails(db.collection("hazards").add({ type: "trou", reporter: "Victime" }));
    await assertFails(db.collection("community_roadbooks").add({ title: "x", userId: "victim" }));
    await assertFails(db.collection("garage_evaluations").doc("g1").set({ userId: "victim", count: 1 }));
    await assertFails(db.collection("crews").add({ name: "x", leaderUid: "victim" }));
  });

  it("Assureurs et factures : seul le serveur écrit, chacun ne lit que le sien", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("insurer_profiles").doc("insurer9").set({ name: "AXA FRANCE IARD", verified: true });
      await ctx.firestore().collection("invoices_to_issue").doc("ord_1").set({ status: "A_EMETTRE" });
    });
    const insurer = testEnv.authenticatedContext("insurer9").firestore();
    const other = testEnv.authenticatedContext("curious7").firestore();
    await assertSucceeds(insurer.collection("insurer_profiles").doc("insurer9").get());
    await assertFails(other.collection("insurer_profiles").doc("insurer9").get());
    // Impossible de se déclarer assureur vérifié soi-même
    await assertFails(other.collection("insurer_profiles").doc("curious7").set({ name: "Faux", verified: true }));
    await assertFails(insurer.collection("invoices_to_issue").doc("ord_1").get());
    await assertFails(insurer.collection("invoices_to_issue").doc("ord_2").set({ status: "A_EMETTRE" }));
  });

  it("Classement public : lisible par les pilotes, jamais modifiable par eux", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("leaderboard").doc("pilot1").set({ username: "Pilote1", points: 120 });
      await ctx.firestore().collection("users").doc("pilot1").set({ username: "Pilote1", email: "prive@example.com" });
    });
    const other = testEnv.authenticatedContext("pilot2").firestore();
    await assertSucceeds(other.collection("leaderboard").orderBy("points", "desc").limit(10).get());
    await assertFails(other.collection("users").doc("pilot1").get()); // le profil privé reste privé
    const cheater = testEnv.authenticatedContext("pilot1").firestore();
    await assertFails(cheater.collection("leaderboard").doc("pilot1").set({ username: "Pilote1", points: 999999 }));
    await assertFails(testEnv.unauthenticatedContext().firestore().collection("leaderboard").get());
  });

  it("Rapports de sinistre : données complètes réservées au payeur (audit 2026-11)", async () => {
    const code = "LITIGE-ABCD-EFGH-JKLM-NPQR";
    const pilot = testEnv.authenticatedContext("pilot1").firestore();
    const insurer = testEnv.authenticatedContext("insurer9").firestore();
    const curious = testEnv.authenticatedContext("curious7").firestore();

    // Le pilote crée son dossier et son aperçu, mais ne peut pas se déclarer payé
    await assertSucceeds(pilot.collection("litigation_proposals").doc(code).set({ caseCode: code, userId: "pilot1", telemetry: { maxG_force: 4.8 } }));
    await assertFails(pilot.collection("litigation_proposals").doc("LITIGE-FAKE").set({ caseCode: "LITIGE-FAKE", userId: "pilot1", report_unlocked: true, unlocked_for: ["pilot1"] }));
    await assertSucceeds(pilot.collection("litigation_previews").doc(code).set({ caseCode: code, userId: "pilot1", expiresAt: Date.now() + 1000, recommendedReport: "EXPERT", severityLabel: "Choc important" }));
    // L'aperçu ne peut pas contenir de données de conduite
    await assertFails(pilot.collection("litigation_previews").doc("LITIGE-X").set({ caseCode: "LITIGE-X", userId: "pilot1", telemetry: { maxG_force: 4.8 } }));

    // Avant paiement : l'assureur voit l'aperçu, pas les données
    await assertSucceeds(insurer.collection("litigation_previews").doc(code).get());
    await assertFails(insurer.collection("litigation_proposals").doc(code).get());
    await assertSucceeds(pilot.collection("litigation_proposals").doc(code).get());

    // Paiement confirmé par le serveur (webhook Revolut) : seul le payeur obtient l'accès
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("litigation_proposals").doc(code).update({ report_unlocked: true, unlocked_for: ["insurer9"] });
    });
    await assertSucceeds(insurer.collection("litigation_proposals").doc(code).get());
    await assertFails(curious.collection("litigation_proposals").doc(code).get());

    // Personne ne peut se débloquer soi-même
    await assertFails(curious.collection("litigation_proposals").doc(code).update({ unlocked_for: ["insurer9", "curious7"] }));

    // Accident à deux véhicules : le second assureur achète à son tour, chacun garde son accès
    const insurer2 = testEnv.authenticatedContext("insurer2").firestore();
    await assertFails(insurer2.collection("litigation_proposals").doc(code).get());
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("litigation_proposals").doc(code).update({ unlocked_for: ["insurer9", "insurer2"] });
    });
    await assertSucceeds(insurer2.collection("litigation_proposals").doc(code).get());
    await assertSucceeds(insurer.collection("litigation_proposals").doc(code).get());
    await assertFails(curious.collection("litigation_proposals").doc(code).get());
  });
});
