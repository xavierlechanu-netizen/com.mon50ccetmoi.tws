/**
 * @jest-environment node
 *
 * Réponses de Nexus Atlas écrites à l'avance (24/11/2026) et rapprochement des questions : une question
 * reformulée retrouve la bonne réponse, et une question voisine mais différente ne retrouve rien (elle passe
 * alors à Mistral). L'entretien du véhicule reste en brouillon jusqu'à validation par un garage partenaire.
 */
const { bestLearnedMatch, normalizeQuestion, isEmergency } = require("../sovereign-core/server/nexus-brain");
const faq = require("../sovereign-core/scripts/nexus-faq.json");

const servies = faq.filter((e) => e.statut === "valide").map((e, id) => ({ id, questionNorm: normalizeQuestion(e.q), q: e.q }));
const retrouve = (question) => bestLearnedMatch(normalizeQuestion(question), servies);

describe("Les 47 réponses", () => {
  test("47 questions distinctes ; 35 validées ; les 12 d'entretien attendent un garage partenaire", () => {
    expect(faq).toHaveLength(47);
    expect(new Set(faq.map((e) => normalizeQuestion(e.q))).size).toBe(47);
    expect(servies).toHaveLength(35);
    const brouillons = faq.filter((e) => e.statut === "a_verifier");
    expect(brouillons).toHaveLength(12);
    for (const e of brouillons) expect(e.note).toMatch(/garage partenaire/);
    expect(brouillons.map((e) => e.q).join(" ")).toMatch(/pneus.*pneus.*plaquettes.*vidange/);
  });

  test("chaque question validée retrouve sa propre réponse, jamais une autre", () => {
    for (const e of servies) expect(retrouve(e.q).q).toBe(e.q);
  });

  test("aucune question que Nexus traiterait comme une urgence (elle ne serait jamais servie) ; réponses courtes", () => {
    for (const e of faq) {
      expect(isEmergency(e.q)).toBe(false);
      expect(e.a.length).toBeGreaterThan(20);
      expect(e.a.length).toBeLessThan(700);
    }
  });
});

describe("Rapprochement des questions", () => {
  test.each([
    ["comment je gagne des points", "Comment gagner des points ?"],
    ["mes points vont ils disparaitre", "Mes points peuvent-ils disparaître ?"],
    ["j ai oublie mon mot de passe", "J'ai oublié mon mot de passe, comment faire ?"],
    ["mot de passe oublie", "J'ai oublié mon mot de passe, comment faire ?"],
    ["comment rejoindre une balade en groupe", "Comment rejoindre un cortège (une balade en groupe) ?"],
    ["comment confirmer un danger signale", "Comment confirmer ou retirer un danger signalé ?"],
    ["pourquoi pas d autoroute dans mon itineraire", "Pourquoi mon itinéraire évite-t-il les autoroutes ?"],
    ["c est quoi une zfe", "C'est quoi une ZFE ?"],
    ["l appli est elle gratuite", "L'appli est-elle gratuite ?"],
    ["comment rouler la nuit", "Comment rouler de nuit ?"],
  ])("« %s » retrouve « %s »", (question, attendue) => {
    expect(retrouve(question).q).toBe(attendue);
  });

  test.each([
    "quelle est la capitale de la france",
    "comment exporter mes donnees", // voisine de « où sont mes données ? », mais pas la même question
    "comment creer mon compte",
    "comment changer mon mot de passe",
    "comment signaler un abus",
    "je veux supprimer un danger",
    "comment gagner de l argent",
    "combien de points par jour", // à 50 % seulement des mots du sujet : mieux vaut passer à Mistral qu'une réponse approximative
    "comment rouler sans casque",
    "comment faire une vidange", // entretien : brouillon, pas servi
    "quand changer mes pneus",
    "quelle est la vitesse maximale d un 50cc",
    "combien coute le permis am",
  ])("« %s » ne retrouve aucune réponse (elle va à Mistral ou à la base Légifrance)", (question) => {
    expect(retrouve(question)).toBeNull();
  });
});
