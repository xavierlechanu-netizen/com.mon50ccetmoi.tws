/**
 * Nexus lit un contrat d'assurance : src/js/contract-reader.js (25/11/2026).
 * Jamais « couvert » quand le contrat exclut ; toujours la phrase citée ; scan illisible signalé.
 */
const fs = require("fs");
const path = require("path");

const code = fs.readFileSync(path.resolve(__dirname, "../src/js/contract-reader.js"), "utf8")
  .replace(/^export (const|function|async function) /gm, "$1 ");
const C = new Function(`${code}\nreturn { analyseContract, contractSummary, findDeductibles, fold, findYesNo };`)();

// Cas réel du 25/11/2026 (attestation + mémo d'un courtier), anonymisé : ni nom, ni adresse, ni numéro
const ATTESTATION = `Attestation d'assurance. Assurance : SCOOTER. Certificat d'assurance.
La Carte internationale d'assurance est toujours obligatoire si vous circulez avec votre véhicule dans l'un de ces pays.
Validité territoriale : cette carte est valable pour les pays dont la case n'est pas rayée.
- Accident : GARANTIE - Panne : GARANTIE - Véhicule de remplacement : NON GARANTIE Mondial Assistance 24h/24 7j/7.
Mémo Véhicule Assuré. Ce document constitue une présomption d'assurance depuis la date de prise d'effet du contrat.
Les garanties de votre contrat : - Accident : OUI - Panne : OUI - Véhicule de remplacement : NON`;

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

test("attestation réelle : RC prouvée, cases oui/non lues, et conseil de demander le contrat", () => {
  const r = C.analyseContract(ATTESTATION);
  expect(r.attestation).toBe(true);
  expect(byKey(r).rc.status).toBe("trouve");
  expect(r.yesNo).toEqual([
    { label: "Accident", yes: true },
    { label: "Panne", yes: true },
    { label: "Véhicule de remplacement", yes: false },
  ]);
  const s = C.contractSummary(r);
  expect(s).toMatch(/attestation d'assurance, pas votre contrat/);
  expect(s).toMatch(/Conditions particulières/);
  expect(s).toMatch(/✅ Panne : oui/);
  expect(s).toMatch(/❌ Véhicule de remplacement : non/);
  expect(s).toMatch(/❓ Vol : pas trouvé/); // l'attestation ne dit rien du vol : on ne l'invente pas
});

test("liste de garanties de l'espace client (sans points) : une ligne citée par garantie, franchises", () => {
  const LISTE = `RESPONSABILITE CIVILE Consulter les Dispositions Particulières
DEFENSE RECOURS Consulter les Dispositions Particulières
VOL INCENDIE Franchise de 200€
CATASTROPHES NATURELLES Franchise de 380€
CATASTROPHES TECHNOLOGIQUES Consulter les Dispositions Particulières
Assistance Accident 2 roues Consulter les Dispositions Particulières
Protection Juridique Allianz Protexia Consulter les Dispositions Particulières
OPTIONS
Assistance Panne 2 roues Consulter les Dispositions Particulières`;
  const g = byKey(C.analyseContract(LISTE));
  expect(g.vol).toMatchObject({ status: "trouve", quote: "VOL INCENDIE Franchise de 200€" });
  expect(g.juridique.quote).toBe("Protection Juridique Allianz Protexia Consulter les Dispositions Particulières");
  expect(g.conducteur.status).toBe("absent");
  expect(g.dommages.status).toBe("absent");
  expect(C.analyseContract(LISTE).deductibles).toEqual(["200 €", "380 €"]);
});

test("citation trop longue : coupée entre deux mots, signalée par …", () => {
  const long = `${"mot ".repeat(80)}le vol est garanti ${"suite ".repeat(80)}`;
  const q = byKey(C.analyseContract(long)).vol.quote;
  expect(q).toMatch(/^… .* …$/);
  expect(q).toMatch(/le vol est garanti/);
  expect(q.length).toBeLessThan(240);
});

test("« Validité territoriale : » ou « Assurance : SCOOTER » ne deviennent pas des cases oui/non", () => {
  expect(C.findYesNo("Assurance : SCOOTER. Validité territoriale : cette carte. Vol : NON GARANTI")).toEqual([{ label: "Vol", yes: false }]);
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
