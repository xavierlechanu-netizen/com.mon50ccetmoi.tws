/**
 * Nexus lit un contrat d'assurance : src/js/contract-reader.js (25/11/2026).
 * Jamais « couvert » quand le contrat exclut ; toujours la phrase citée ; scan illisible signalé.
 */
const fs = require("fs");
const path = require("path");

const code = fs.readFileSync(path.resolve(__dirname, "../src/js/contract-reader.js"), "utf8")
  .replace(/^export (const|function|async function) /gm, "$1 ");
const C = new Function(`${code}\nreturn { analyseContract, contractSummary, findDeductibles, fold };`)();

const CONTRAT = `CONDITIONS PARTICULIERES - Cyclomoteur 50 cm3.
Votre formule : Intermédiaire. Garanties souscrites : Responsabilité civile. Défense pénale et recours.
Vol et tentative de vol, avec une franchise de 150 € par sinistre. Incendie.
La garantie du conducteur n'est pas souscrite au présent contrat.
Assistance 0 km 24h/24 en cas de panne. Franchise dommages : 1 200,00 euros.
Les catastrophes naturelles sont couvertes conformément à la loi.`.repeat(2);

const byKey = (r) => Object.fromEntries(r.items.map((i) => [i.key, i]));

test("garanties trouvées avec la phrase exacte ; l'exclusion n'est jamais « trouvée »", () => {
  const r = C.analyseContract(CONTRAT);
  const g = byKey(r);
  expect(r.readable).toBe(true);
  expect(g.rc.status).toBe("trouve");
  expect(g.vol.status).toBe("trouve");
  expect(g.vol.quote).toMatch(/Vol et tentative de vol/);
  expect(g.incendie.status).toBe("trouve");
  expect(g.catnat.status).toBe("trouve");
  expect(g.conducteur.status).toBe("a_verifier"); // « n'est pas souscrite »
  expect(g.juridique.status).toBe("absent");
  expect(r.zeroKm).toBe(true);
  expect(r.deductibles).toEqual(["150 €", "1200,00 €"]);
});

test("résumé : prudent, cite le contrat, rappelle que l'assureur fait foi", () => {
  const s = C.contractSummary(C.analyseContract(CONTRAT));
  expect(s).toMatch(/✅ Vol\n {3}« Vol et tentative de vol/);
  expect(s).toMatch(/⚠️ Garantie du conducteur/);
  expect(s).toMatch(/❓ Protection juridique : pas trouvé/);
  expect(s).toMatch(/pas un avis juridique/);
  expect(s).not.toMatch(/vous êtes couvert/i);
});

test("PDF scanné (presque pas de texte) : on le dit, rien n'est inventé", () => {
  const r = C.analyseContract("   \n Page 1  ");
  expect(r.readable).toBe(false);
  expect(r.items.every((i) => i.status === "absent")).toBe(true);
  expect(C.contractSummary(r)).toMatch(/sans doute un scan/);
});

test("« volant » ou « envol » ne comptent pas pour le vol ; accents ignorés", () => {
  const r = C.analyseContract("Prêt de volant autorisé à tout conducteur désigné. ".repeat(10));
  expect(byKey(r).vol.status).toBe("absent");
  expect(byKey(r).pret.status).toBe("trouve");
  expect(C.fold("Défense Pénale")).toBe("defense penale");
});
