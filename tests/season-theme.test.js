/**
 * @jest-environment node
 *
 * Thèmes de l'année (src/js/season-theme.js) : la bonne fête au bon jour.
 */
const fs = require("fs");
const path = require("path");

const code = fs.readFileSync(path.join(__dirname, "../src/js/season-theme.js"), "utf8").replace(/^export /gm, "");
// Même méthode que les autres tests du projet pour charger un module ES sans transpilation
// eslint-disable-next-line no-new-func
const M = new Function(`${code}; return { easterSunday, seasonOf, routeColor };`)();
const nameOn = (y, m, d) => M.seasonOf(new Date(y, m - 1, d))?.name ?? null;

describe("Thèmes de l'année", () => {
  test.each([[2026, 4, 5], [2027, 3, 28], [2028, 4, 16], [2030, 4, 21]])("Pâques %i", (y, m, d) => {
    const e = M.easterSunday(y);
    expect([e.getMonth() + 1, e.getDate()]).toEqual([m, d]);
  });

  test.each([
    [2027, 1, 1, "Nouvel An"], [2027, 1, 3, "Épiphanie"], [2027, 1, 8, "Épiphanie"], [2027, 1, 9, null],
    [2027, 3, 25, null], [2027, 3, 26, "Pâques"], [2027, 3, 29, "Pâques"], [2027, 3, 30, null],
    [2027, 7, 12, null], [2027, 7, 14, "14 Juillet"], [2027, 7, 15, null],
    [2027, 10, 30, "Octobre Rose"], [2027, 10, 31, "Halloween"],
    [2027, 12, 19, null], [2027, 12, 25, "Noël"], [2027, 12, 27, null],
    [2027, 2, 2, "Chandeleur"], [2027, 2, 14, "Saint-Valentin"], [2027, 2, 15, null],
    [2027, 5, 1, "1er Mai"], [2027, 5, 8, "8 Mai"], [2027, 11, 11, "11 Novembre"],
    // Fête des mères : dernier dimanche de mai, décalée au 6 juin 2004 (Pentecôte le 30 mai)
    [2026, 5, 31, "Fête des mères"], [2027, 5, 30, "Fête des mères"], [2004, 5, 30, null], [2004, 6, 6, "Fête des mères"],
    // Fête des pères : 3e dimanche de juin ; le 21 juin 2026 elle passe avant la Fête de la musique
    [2027, 6, 20, "Fête des pères"], [2027, 6, 21, "Fête de la musique"], [2026, 6, 21, "Fête des pères"],
  ])("%i-%i-%i : %s", (y, m, d, name) => {
    expect(nameOn(y, m, d)).toBe(name);
  });

  test("hors fête, sans stockage : le trajet garde sa couleur habituelle", () => {
    expect(M.routeColor("#00d2ff", new Date(2027, 5, 10))).toBe("#00d2ff");
    expect(M.routeColor("#00d2ff", new Date(2027, 11, 25))).toBe("#d6001c");
  });
});
