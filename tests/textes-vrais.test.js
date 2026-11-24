/**
 * @jest-environment node
 *
 * Pages de connexion et d'accueil : plus de promesse que l'appli ne tient pas (24/11/2026).
 * Retirés : la connexion biométrique FIDO2 (fonctions Google coupées, aucune clé enregistrée), « Firebase Auth »
 * (fermé), le jeton $MON50 miné au kilomètre, l'interphone Squad Link, « secours automatiques » (l'appli prévient
 * des proches par SMS, elle n'appelle pas les secours) et « hébergement en cours de migration » (c'est fait).
 */
const fs = require("fs");
const path = require("path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("page de connexion : rien de faux sur la sécurité ni sur les fonctions", () => {
  const login = read("src/login.html");
  for (const faux of ["Firebase Auth", "FIDO2", "loginBiometric", "$MON50", "Squad Link", "Sentinel OS", "secours automatiques", "Intercom"]) {
    expect(login).not.toContain(faux);
  }
  expect(login).toContain("Données hébergées en France (OVHcloud)");
  expect(login).toContain("tes proches sont prévenus par SMS");
});

test("page d'accueil : plus de clé d'accès ni de migration en cours", () => {
  const index = read("src/index.html");
  for (const faux of ["Squad Link", "clé d'accès", "en cours de migration"]) expect(index).not.toContain(faux);
  expect(index).toContain("hébergement en France chez OVHcloud");
});
