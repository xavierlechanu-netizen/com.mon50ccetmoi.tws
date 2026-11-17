/**
 * @jest-environment node
 *
 * Certificat batterie retiré le 16/11/2026 (docs/ETAT_REEL_APPLICATION_2026-11-16.md) : l'état de santé
 * était estimé à partir des seules déclarations du pilote, avec des valeurs inventées par défaut
 * (« 92 % », « 12 450 km ») et une « clé blockchain » tirée au hasard, le tout vendu comme
 * « document officiel pour la revente ». Ce test empêche de le remettre en vente sans le refaire.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const { CATALOG } = require("../functions/api/payments-catalog");

describe("Certificat batterie retiré de la vente", () => {
  test("le catalogue de paiement ne propose plus aucun certificat batterie", () => {
    expect(Object.keys(CATALOG).filter((k) => /BATTERY/.test(k))).toEqual([]);
  });

  test("plus d'écran, de bouton ni de fonction d'achat dans l'appli", () => {
    const screens = fs.readdirSync(path.join(ROOT, "src/public/screens"));
    expect(screens.filter((f) => /battery/.test(f))).toEqual([]);
    expect(fs.readFileSync(path.join(ROOT, "src/js/dock.js"), "utf8")).not.toMatch(/Santé Batterie/);
    const cert = fs.readFileSync(path.join(ROOT, "src/js/certificate.js"), "utf8");
    expect(cert).not.toMatch(/purchaseBatteryCert|generateBattery|soh: "92%"/);
  });

  test("ni la page d'accueil ni les CGV ne le proposent", () => {
    expect(fs.readFileSync(path.join(ROOT, "src/index.html"), "utf8")).not.toMatch(/Certificats? Batterie/i);
    expect(fs.readFileSync(path.join(ROOT, "src/cgv.html"), "utf8")).not.toMatch(/Certificat de santé de batterie :/);
  });
});
