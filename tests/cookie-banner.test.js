/**
 * @jest-environment node
 *
 * Un seul bandeau cookies : Axeptio (16/11/2026).
 *
 * Avant : config.js affichait son propre bandeau « J'ai compris » (pas de bouton pour refuser,
 * « en continuant votre navigation, vous acceptez » : pas un consentement pour la CNIL) en même
 * temps qu'Axeptio, et injectait ses propres réglages Axeptio (version française) alors
 * qu'axeptio-config.js imposait la version anglaise : le visiteur voyait l'une ou l'autre.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const FR_VERSION = "356689da-708f-406a-a78f-f026435aa81f";
const EN_VERSION = "73984ab7-6f43-4eef-9577-94f735eedc51";

describe("Bandeau cookies : Axeptio seul, en français", () => {
  test("config.js n'affiche plus de second bandeau et charge Axeptio par axeptio-config.js", () => {
    // Le code seul : les commentaires racontent l'ancien bandeau
    const config = read("src/js/config.js").replace(/^\s*\/\/.*$/gm, "");
    expect(config).toMatch(/^import '\.\/axeptio-config\.js';\r?$/m);
    expect(config).not.toMatch(/cookie-consent-banner|btn-accept-cookies|J'ai compris/);
    expect(config).not.toMatch(/en continuant/i);
    // Plus de copie des réglages ni d'injection du SDK ailleurs que dans axeptio-config.js
    expect(config).not.toMatch(/axeptioSettings|static\.axept\.io/);
  });

  test("une seule version des réglages : la française", () => {
    const axeptio = read("src/js/axeptio-config.js");
    expect(axeptio).toContain(FR_VERSION);
    expect(axeptio).not.toContain(EN_VERSION);
    for (const f of fs.readdirSync(path.join(ROOT, "src/js")).filter((x) => x.endsWith(".js") && x !== "axeptio-config.js")) {
      expect({ f, réglages: /axeptioSettings\s*=/.test(read(`src/js/${f}`)) }).toEqual({ f, réglages: false });
    }
  });

  test("la page Cookies permet de changer d'avis et ne dit plus que naviguer vaut accord", () => {
    const html = read("src/cookies.html");
    expect(html).toMatch(/data-action="openAxeptioCookies\(\)"/);
    expect(html).toMatch(/\/js\/axeptio-config\.js/);
    expect(html).not.toMatch(/vaut\s+acceptation/);
  });

  test("la CSP autorise le script Axeptio (sinon : aucun bandeau du tout)", () => {
    const scriptSrc = read("vite.config.js").match(/'script-src':\s*\[([\s\S]*?)\]/)[1];
    expect(scriptSrc).toContain("https://static.axept.io");
    expect(read("firebase.json").match(/script-src([^;"]*)/)[1]).toContain("https://static.axept.io");
  });
});
