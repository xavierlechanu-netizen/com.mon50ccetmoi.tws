/**
 * @jest-environment node
 *
 * Examen du Code et bilan pour les parents en pause (24/11/2026) : plus aucun appel à l'IA de Google
 * (fonction coupée depuis le 14/11) ; Mistral, sur le serveur, est trop lent et trop peu fiable pour eux.
 */
const fs = require("fs");
const path = require("path");

const src = (f) => fs.readFileSync(path.join(__dirname, "../src/js", f), "utf8");

test.each(["code-de-la-route.js", "ma-progression.js"])("%s : plus d'appel à askNexusAtlasGemini, message « bientôt disponible »", (f) => {
  expect(src(f)).not.toMatch(/askNexusAtlasGemini|cloudfunctions\.net/);
  expect(src(f)).toMatch(/bientôt disponible/i);
});

test("le bouton du bilan est grisé", () => {
  expect(src("ma-progression.js")).toMatch(/id="btn-bilan" disabled/);
});
