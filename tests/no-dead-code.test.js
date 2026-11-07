/**
 * @jest-environment node
 *
 * Code mort : le 7/11/2026, 26 fichiers de src/js (~7 600 lignes) n'étaient chargés par
 * aucune page (archivés sur la branche archive/code-mort-2026-11). Ce test échoue si un
 * fichier de src/js n'est ni chargé par une page HTML (ou un écran), ni importé par un module.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "../src");
const JS = path.join(SRC, "js");

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

const pages = [
  ...fs.readdirSync(SRC).filter((f) => f.endsWith(".html")).map((f) => path.join(SRC, f)),
  ...fs.readdirSync(path.join(SRC, "public/screens")).filter((f) => f.endsWith(".html"))
    .map((f) => path.join(SRC, "public/screens", f)),
].map((f) => fs.readFileSync(f, "utf8")).join("\n");

// Exceptions assumées : modules prêts et testés, en attente d'activation
const KEPT_FOR_LATER = {
  "secure-vault.js": "coffre chiffré WebCrypto (Phase 2 de l'audit), testé, à brancher sur le portefeuille",
};

const jsFiles = fs.readdirSync(JS).filter((f) => f.endsWith(".js") && !KEPT_FOR_LATER[f]);
const allJs = jsFiles.map((f) => ({ f, text: fs.readFileSync(path.join(JS, f), "utf8") }));

describe("Aucun fichier JavaScript mort dans src/js", () => {
  test.each(jsFiles)("%s est chargé par une page ou importé", (file) => {
    const base = escape(file.replace(/\.js$/, ""));
    const inPage = new RegExp(`/js/${base}\\.js`).test(pages);
    const imported = allJs.some(({ f, text }) =>
      f !== file && new RegExp(`['"\`]\\./${base}(\\.js)?['"\`]`).test(text));
    expect({ file, chargé: inPage || imported }).toEqual({ file, chargé: true });
  });
});
