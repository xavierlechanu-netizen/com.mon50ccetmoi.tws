/**
 * @jest-environment node
 *
 * Sortie de Google, étape 1 (15/11/2026) : les polices sont hébergées sur le site et
 * Firebase Analytics est retiré. Ce test échoue si l'un des deux revient.
 * Plan complet : docs/PLAN_DEMENAGEMENT_GOOGLE.md
 */
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "../src");
const fichiers = (dir, ext) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "vendor" ? [] : fichiers(p, ext);
    return ext.some((x) => p.endsWith(x)) ? [p] : [];
  });
const sources = fichiers(SRC, [".html", ".js", ".css"]).map((p) => ({ p, t: fs.readFileSync(p, "utf8") }));
const rel = (p) => path.relative(SRC, p).replace(/\\/g, "/");

describe("Sortie de Google, étape 1", () => {
  test("aucune page ne charge Google Fonts", () => {
    expect(sources.filter(({ t }) => /fonts\.(googleapis|gstatic)\.com/.test(t)).map(({ p }) => rel(p))).toEqual([]);
  });

  test("les polices du site existent et sont déclarées", () => {
    const css = fs.readFileSync(path.join(SRC, "public/fonts/fonts.css"), "utf8");
    for (const famille of ["Inter", "Outfit", "JetBrains Mono"]) expect(css).toContain(`font-family: "${famille}"`);
    for (const [, fichier] of css.matchAll(/url\("\/fonts\/([^"]+)"\)/g)) {
      expect(fs.existsSync(path.join(SRC, "public/fonts", fichier))).toBe(true);
    }
  });

  test("Firebase Analytics n'est ni chargé ni appelé", () => {
    const traces = sources.filter(({ t }) => /firebase\/compat\/analytics|firebase\.analytics\(|measurementId/.test(t));
    expect(traces.map(({ p }) => rel(p))).toEqual([]);
  });
});
