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

    // 3. Permettre la création d'un profil standard (pseudo réservé dans le même lot)
    const batch = userDb.batch();
    batch.set(userDb.collection("usernames").doc("realpilot"), { uid: "pilot99", username: "realpilot" });
    batch.set(userDb.collection("users").doc("pilot99"), { username: "realpilot", role: "user" });
    await assertSucceeds(batch.commit());

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

  it("Inscription : profil + pseudo réservé acceptés, champ points refusé (bug du 1er novembre)", async () => {
    const db = testEnv.authenticatedContext("new1").firestore();
    // Ancien profil de l'inscription : refusé à cause de « points »
    const bad = db.batch();
    bad.set(db.collection("usernames").doc("bob"), { uid: "new1", username: "Bob" });
    bad.set(db.collection("users").doc("new1"), { uid: "new1", username: "Bob", role: "user", points: 10 });
    await assertFails(bad.commit());
    // Profil actuel : accepté
    const ok = db.batch();
    ok.set(db.collection("usernames").doc("bob"), { uid: "new1", username: "Bob" });
    ok.set(db.collection("users").doc("new1"), { uid: "new1", username: "Bob", role: "user", brand: "Peugeot", model: "Kisbee" });
    await assertSucceeds(ok.commit());
    // Profil sans réservation, ou pseudo invalide : refusé
    const db2 = testEnv.authenticatedContext("new2").firestore();
    await assertFails(db2.collection("users").doc("new2").set({ username: "Carole", role: "user" }));
    const spaces = db2.batch();
    spaces.set(db2.collection("usernames").doc("jean dupont"), { uid: "new2", username: "Jean Dupont" });
    spaces.set(db2.collection("users").doc("new2"), { username: "Jean Dupont", role: "user" });
    await assertFails(spaces.commit());
  });

  it("Pseudos : impossible de prendre celui d'un autre (lecture de ses messages privés)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const fs = ctx.firestore();
      await fs.collection("users").doc("bob").set({ uid: "bob", username: "Bob", role: "user" });
      await fs.collection("usernames").doc("bob").set({ uid: "bob", username: "Bob" });
      await fs.collection("users").doc("mallory").set({ uid: "mallory", username: "Mallory", role: "user" });
      await fs.collection("exchange_messages").doc("m1").set({ from: "Alice", to: "Bob", text: "privé" });
    });
    const mallory = testEnv.authenticatedContext("mallory").firestore();
    // Avant : changer son pseudo en « Bob » donnait accès aux messages de Bob
    await assertFails(mallory.collection("users").doc("mallory").update({ username: "Bob" }));
    await assertFails(mallory.collection("exchange_messages").doc("m1").get());
    // Réserver un pseudo qui n'est pas le sien : refusé ; le sien (ancien compte) : accepté
    await assertFails(mallory.collection("usernames").doc("carole").set({ uid: "mallory", username: "Carole" }));
    await assertSucceeds(mallory.collection("usernames").doc("mallory").set({ uid: "mallory", username: "Mallory" }));
    // Un pseudo déjà réservé ne peut pas être repris, même dans un lot avec un nouveau profil
    const thief = testEnv.authenticatedContext("thief").firestore();
    const steal = thief.batch();
    steal.set(thief.collection("usernames").doc("bob"), { uid: "thief", username: "Bob" });
    steal.set(thief.collection("users").doc("thief"), { uid: "thief", username: "Bob", role: "user" });
    await assertFails(steal.commit());
    // Les autres champs du profil restent modifiables
    await assertSucceeds(mallory.collection("users").doc("mallory").update({ brand: "MBK" }));
    // Impossible de s'offrir l'abonnement Boîte Noire+ (accordé seulement par le paiement)
    await assertFails(mallory.collection("users").doc("mallory").update({ blackboxCare: { status: "ACTIVE" } }));
  });

  it("Crews : un membre rejoint ou quitte, mais ne modifie rien d'autre", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("crews").doc("c1").set({ name: "Les Bleus", leaderUid: "lead", members: ["lead", "m1"], points: 10 });
    });
    const joiner = testEnv.authenticatedContext("j1").firestore();
    await assertSucceeds(joiner.collection("crews").doc("c1").update({ members: ["lead", "m1", "j1"] }));
    await assertFails(joiner.collection("crews").doc("c1").update({ members: ["lead", "j1"] })); // exclure m1
    await assertFails(joiner.collection("crews").doc("c1").update({ name: "Volé", members: ["lead", "m1", "j1"] }));
    await assertSucceeds(joiner.collection("crews").doc("c1").update({ members: ["lead", "m1"] })); // quitter
    const leader = testEnv.authenticatedContext("lead").firestore();
    await assertSucceeds(leader.collection("crews").doc("c1").update({ name: "Les Rouges", members: ["lead"] }));
  });

  it("Bourse d'échange : impossible de publier au nom d'un autre vendeur", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("users").doc("s1").set({ username: "Vendeur1", role: "user" });
    });
    const s1 = testEnv.authenticatedContext("s1").firestore();
    const listing = { title: "Pot Yasuni", price: 120 };
    await assertSucceeds(s1.collection("exchange_listings").add({ ...listing, seller: "Vendeur1", sellerUid: "s1" }));
    await assertFails(s1.collection("exchange_listings").add({ ...listing, seller: "Victime", sellerUid: "s1" }));
    await assertFails(s1.collection("exchange_listings").add({ ...listing, seller: "Vendeur1", sellerUid: "victim" }));
  });

  it("Conversations Nexus Atlas : chacun n'écrit que dans les siennes", async () => {
    const a = testEnv.authenticatedContext("ua").firestore();
    const b = testEnv.authenticatedContext("ub").firestore();
    await assertSucceeds(a.collection("nexus_conversations").doc("s1").set({ uid: "ua", summary: "salut" }));
    await assertFails(b.collection("nexus_conversations").doc("s1").set({ uid: "ub", summary: "écrasé" }, { merge: true }));
    await assertFails(b.collection("nexus_conversations").doc("s2").set({ uid: "ua", summary: "usurpé" }));
    await assertSucceeds(a.collection("nexus_conversations").doc("s1").set({ uid: "ua", summary: "suite" }, { merge: true }));
  });

  it("Notes des garages : lisibles par les membres, écrites seulement par le serveur", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection("garage_evaluations").doc("osm-node-1").set({ v: 2, count: 3, totalScore: 12, avgRating: 4 });
      await ctx.firestore().collection("garage_votes").doc("osm-node-1__pilot1").set({ uid: "pilot1", score: 4 });
    });
    const pilot = testEnv.authenticatedContext("pilot1").firestore();
    await assertSucceeds(pilot.collection("garage_evaluations").doc("osm-node-1").get());
    await assertFails(testEnv.unauthenticatedContext().firestore().collection("garage_evaluations").doc("osm-node-1").get());
    // Plus de moyenne inventée par le navigateur
    await assertFails(pilot.collection("garage_evaluations").doc("osm-node-2").set({ count: 1000, avgRating: 5 }));
    await assertFails(pilot.collection("garage_evaluations").doc("osm-node-1").update({ count: 1000 }));
    // Les votes individuels restent privés, même le sien
    await assertFails(pilot.collection("garage_votes").doc("osm-node-1__pilot1").get());
    await assertFails(pilot.collection("garage_votes").doc("osm-node-1__pilot1").set({ uid: "pilot1", score: 5 }));
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

describe("Liste d'attente de la Boîte Noire", () => {
  // Les contextes de test renvoient l'API Firestore « compat » : mêmes horodatages qu'elle.
  const firebase = require("firebase/compat/app").default;
  require("firebase/compat/firestore");
  const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();
  const { Timestamp } = firebase.firestore;
  const entry = (over = {}) => ({
    email: "alice@exemple.fr", consent: true, source: "marketplace",
    createdAt: serverTimestamp(), ...over,
  });

  it("un visiteur sans compte peut s'inscrire, mais ne peut rien lire ni modifier", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(anon.collection("blackbox_waitlist").doc("e1").set(entry()));
    await assertFails(anon.collection("blackbox_waitlist").doc("e1").get());
    await assertFails(anon.collection("blackbox_waitlist").get());
    await assertFails(anon.collection("blackbox_waitlist").doc("e1").update({ email: "x@exemple.fr" }));
    await assertFails(anon.collection("blackbox_waitlist").doc("e1").delete());
  });

  it("refuse une adresse invalide, sans consentement, un champ en trop ou une date choisie par le client", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    const col = anon.collection("blackbox_waitlist");
    await assertFails(col.doc("a").set(entry({ email: "pas-une-adresse" })));
    await assertFails(col.doc("b").set(entry({ email: "Alice@Exemple.fr" }))); // pas en minuscules
    await assertFails(col.doc("c").set(entry({ email: "a".repeat(250) + "@x.fr" })));
    await assertFails(col.doc("d").set(entry({ consent: false })));
    await assertFails(col.doc("e").set(entry({ source: "ailleurs" })));
    await assertFails(col.doc("f").set(entry({ role: "admin" })));
    await assertFails(col.doc("g").set(entry({ createdAt: Timestamp.fromMillis(0) })));
  });
});
