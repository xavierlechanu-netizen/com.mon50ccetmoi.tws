/**
 * @jest-environment node
 *
 * Les pages légales disent ce que fait vraiment le service (vérification du 24/11/2026) :
 * hébergé chez OVHcloud, pas de blocage par adresse IP ou MAC, recours gratuit par une personne.
 */
const fs = require("fs");
const path = require("path");

const PAGES = ["cgv", "terms", "privacy", "mentions-legales", "cookies", "moderation", "banned"];
const read = (p) => fs.readFileSync(path.join(__dirname, "../src", `${p}.html`), "utf8");

describe("Pages légales fidèles au service réel", () => {
  test.each(PAGES)("%s : plus de promesse fausse", (p) => {
    const html = read(p);
    expect(html).not.toMatch(/GitHub Pages/);
    expect(html).not.toMatch(/adresses? (IP )?(et )?MAC/i);
    expect(html).not.toMatch(/en utilisant (ses|vos) points mon50cc/);
    expect(html).not.toMatch(/sans intervention humaine/);
    expect(html).not.toMatch(/Sentinel Care|CCPA|PIPL|Indonésie|marque déposée/i);
    // Parrainage : personne n'est puni pour les actes d'un autre (clause abusive, C. conso. L. 212-1)
    expect(html).not.toMatch(/Responsabilité Solidaire|5e avertissement/i);
  });

  test("l'hébergeur indiqué dans les CGU et les mentions légales est OVHcloud", () => {
    expect(read("terms")).toMatch(/Hébergeur :<\/strong> OVH SAS/);
    expect(read("mentions-legales")).toMatch(/Hébergeur du site et de l'application/);
  });

  test("ORIAS en attente : aucun contrat d'assurance proposé, RC Pro pas encore annoncée comme acquise", () => {
    const m = read("mentions-legales");
    expect(m).toMatch(/ne présente, ne propose et ne conclut aucun contrat d'assurance/);
    expect(m).not.toMatch(/l'activité est couverte par une assurance/);
  });

  test("le recours contre une sanction est gratuit", () => {
    for (const p of ["cgv", "terms", "moderation"]) expect(read(p)).toMatch(/gratuitement/);
  });
});
