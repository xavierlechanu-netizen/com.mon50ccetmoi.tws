/**
 * @jest-environment node
 *
 * Essai sur iPhone du 23/11/2026 : données inventées, recherche juridique, question prise pour une idée.
 */
const fs = require("fs");
const path = require("path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const { realDashboardData } = new Function(`${read("src/js/dashboard-data.js").replace(/^export /gm, "")}; return { realDashboardData };`)();

describe("Tableau de bord", () => {
  test("les valeurs de démonstration déjà en base ne s'affichent pas", () => {
    const out = realDashboardData({
      userData: { bvc_score: 92, stats: { km: 1247, hours: 86, speed: 34, streak: 12 } },
      weekly: [8, 12, 5, 18, 24, 15, 4].map((km) => ({ km })),
      trips: [{ route: "Domicile → Lycée Victor Hugo" }, { route: "Vrai trajet" }],
    });
    expect(out).toEqual({ score: null, stats: { km: 0, hours: 0, speed: 0, streak: 0 }, weekly: [], trips: [{ route: "Vrai trajet" }] });
  });

  test("les vraies valeurs sont gardées, et le code n'écrit plus rien d'inventé", () => {
    const out = realDashboardData({ userData: { bvc_score: 70, stats: { km: 3, hours: 1, speed: 20, streak: 1 } } });
    expect(out.score).toBe(70);
    expect(out.stats.km).toBe(3);
    const page = read("src/js/inline-dashboard-2.js");
    expect(page).not.toMatch(/km: 1247|bvc_score: 92|Victor Hugo|\.set\(|\.add\(/);
    expect(read("src/dashboard.html")).not.toMatch(/Mathieu R\.|data-count="1247"|Conduite exemplaire/);
  });
});

describe("Recherche juridique", () => {
  const w = {};
  new Function("window", read("src/js/legal-database.js").replace(/^\s*import .*$/gm, ""))(w);
  const titles = (q) => w.LegalDatabase.search(q).map((r) => r.title);

  test("une plaque mal fixée renvoie le Code de la route français", () => {
    const [first] = w.LegalDatabase.search("J'ai un problème, j'aimerais savoir si ma plaque d'immatriculation est mal fixée est-ce que je risque une amende ?");
    expect(first.title).toMatch(/R317-8/);
    expect(first.content).toMatch(/quatrième classe/);
  });

  test("sans pays nommé, jamais de loi étrangère ; un pays nommé reste possible", () => {
    for (const q of ["Quelle amende sans casque ?", "Puis-je rouler sur autoroute ?", "assurance obligatoire pour un scooter"]) {
      for (const t of titles(q)) expect([q, /🇫🇷|🇪🇺/u.test(t)]).toEqual([q, true]);
    }
    expect(titles("Quelle amende sans casque ?")[0]).toMatch(/🇫🇷/u);
    expect(titles("immatriculation en indonésie").join()).toMatch(/STNK/);
  });
});

describe("Nexus : une question reste une question", () => {
  const { NexusSemanticAnalyzer } = new Function(
    `${read("src/js/nexus-semantic-analyzer.js").replace(/^\s*import .*$/gm, "").replace(/^export default .*$/gm, "").replace(/^export {.*$/gm, "")}; return { NexusSemanticAnalyzer };`)();
  const a = new NexusSemanticAnalyzer();

  test("question du pilote : pas une suggestion", () => {
    expect(a.analyze("J'ai un problème, j'aimerais savoir si ma plaque d'immatriculation est mal fixée est-ce que je risque une amende ?").isSuggestion).toBe(false);
    expect(a.analyze("J'aimerais savoir comment changer ma bougie").isSuggestion).toBe(false);
  });

  test("vraie idée : toujours captée, même avec un point d'interrogation", () => {
    expect(a.analyze("Ce serait bien d'ajouter un mode nuit").isSuggestion).toBe(true);
    expect(a.analyze("Serait-il possible de rajouter un bouton météo ?").isSuggestion).toBe(true);
  });
});
