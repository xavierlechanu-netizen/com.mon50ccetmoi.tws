/**
 * @jest-environment node
 *
 * Page partenaires (14/11/2026) : simple aiguillage vers les deux vrais espaces
 * professionnels. L'ancien « Partner Connect » était une simulation : tableau de bord
 * aux chiffres inventés, connexion ouverte à tout compte, faux envois d'emails, faux
 * paiement Stripe, campagnes publicitaires ciblées et message dénigrant une société réelle.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "../src");
const html = fs.readFileSync(path.join(SRC, "partenaires.html"), "utf8");
const links = [...html.matchAll(/href="([^"]+\.html)"/g)].map((m) => m[1]);

describe("Page partenaires : aiguillage vers les vrais espaces", () => {
  test("mène à l'espace garage et au portail assureur, qui existent", () => {
    expect(links).toEqual(expect.arrayContaining(["garage.html", "assureur.html"]));
    for (const page of links) expect(fs.existsSync(path.join(SRC, page))).toBe(true);
  });

  test("ne charge aucun script : plus de fausse connexion ni de faux tableau de bord", () => {
    expect(html).not.toMatch(/<script/i);
    expect(fs.existsSync(path.join(SRC, "js/inline-partenaires-1.js"))).toBe(false);
    expect(fs.existsSync(path.join(SRC, "js/inline-partenaires-2.js"))).toBe(false);
  });

  test("aucune trace de la simulation ni de publicité", () => {
    for (const ghost of [/euro\s*assurance/i, /Partner Connect/, /wallet/i, /sponsoring/i,
      /campagne/i, /stripe/i, /leads?\b/i, /SIRET/]) {
      expect(html).not.toMatch(ghost);
    }
  });
});
