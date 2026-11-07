/**
 * @jest-environment node
 *
 * CSP stricte (étape 3 du plan de dette technique, 7/11/2026) : la politique de sécurité
 * n'autorise plus les scripts écrits dans les pages ('unsafe-inline' retiré de script-src).
 * Ce test échoue si on réintroduit :
 *  - un attribut onclick=, onchange=, onerror=… (pages, écrans ou gabarits JS) ;
 *  - un <script> écrit dans une page (seules les données JSON-LD sont permises) ;
 *  - 'unsafe-inline' dans script-src (vite.config.js ou firebase.json).
 * À la place : data-action, data-enter-action, data-change-action, data-input-filter,
 * data-fallback-icon (src/js/dom-security.js), ou un fichier .js.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

function walk(dir, exts) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "vendor" ? [] : walk(p, exts);
    return exts.some((x) => p.endsWith(x)) ? [p] : [];
  });
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, "/");
const files = walk(SRC, [".html", ".js"]).filter((f) => !f.endsWith("sw.js"));

describe("CSP stricte : aucun script écrit dans les pages", () => {
  test("aucun attribut on…= (onclick, onchange, onerror…)", () => {
    const found = [];
    for (const f of files) {
      fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (/\son[a-z]+\s*=\s*["']/i.test(line)) found.push(`${rel(f)}:${i + 1}`);
      });
    }
    expect(found).toEqual([]);
  });

  test("aucun <script> écrit dans une page (hors JSON-LD)", () => {
    const found = [];
    for (const f of files.filter((x) => x.endsWith(".html"))) {
      const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
      const text = fs.readFileSync(f, "utf8");
      let m;
      while ((m = re.exec(text))) {
        if (/\bsrc\s*=/.test(m[1]) || /application\/ld\+json/.test(m[1])) continue;
        if (m[2].trim()) found.push(`${rel(f)} : ${m[2].trim().slice(0, 60)}`);
      }
    }
    expect(found).toEqual([]);
  });

  test("script-src n'autorise pas 'unsafe-inline' (vite.config.js)", () => {
    const vite = fs.readFileSync(path.join(ROOT, "vite.config.js"), "utf8");
    const scriptSrc = vite.match(/'script-src':\s*\[([\s\S]*?)\]/);
    expect(scriptSrc).not.toBeNull();
    expect(scriptSrc[1]).not.toContain("unsafe-inline");
    expect(scriptSrc[1]).not.toContain("unsafe-eval");
  });

  test("script-src n'autorise pas 'unsafe-inline' (firebase.json)", () => {
    const fb = fs.readFileSync(path.join(ROOT, "firebase.json"), "utf8");
    const scriptSrc = fb.match(/script-src([^;"]*)/);
    expect(scriptSrc).not.toBeNull();
    expect(scriptSrc[1]).not.toContain("unsafe-inline");
  });
});
