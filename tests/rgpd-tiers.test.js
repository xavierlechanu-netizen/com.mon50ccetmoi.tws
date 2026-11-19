/**
 * @jest-environment node
 *
 * RGPD : aucun appel à un tiers avant le consentement (17/11/2026).
 * Charger une ressource chez un tiers lui envoie l'adresse IP du visiteur. Avant ce correctif,
 * chaque page chargeait les icônes chez Cloudflare (cdnjs, États-Unis), la page de connexion une
 * photo chez Unsplash, et un bannissement envoyait l'adresse IP du pilote à ipify (États-Unis).
 * Les icônes sont maintenant servies par le site (src/public/vendor/fontawesome).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

function walk(dir, exts) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "vendor" ? [] : walk(p, exts);
    return exts.some((x) => p.endsWith(x)) ? [p] : [];
  });
}
const files = walk(SRC, [".html", ".js", ".css"]);

describe("Aucun appel à un tiers non nécessaire", () => {
  test.each([
    ["cdnjs.cloudflare.com", "icônes servies par le site (/vendor/fontawesome)"],
    ["images.unsplash.com", "images servies par le site"],
    ["api.ipify.org", "jamais l'adresse IP d'un pilote à un tiers"],
  ])("%s n'apparaît plus (%s)", (domain) => {
    const found = files.filter((f) => fs.readFileSync(f, "utf8").includes(domain)).map(rel);
    expect(found).toEqual([]);
  });

  test("les icônes Font Awesome viennent du site et leurs polices existent", () => {
    const pages = walk(SRC, [".html"]).filter((f) => /font-?awesome/i.test(fs.readFileSync(f, "utf8")));
    expect(pages.length).toBeGreaterThan(10);
    for (const f of pages) {
      const hrefs = fs.readFileSync(f, "utf8").match(/href="[^"]*fontawesome[^"]*"/g) || [];
      for (const h of hrefs) expect(`${rel(f)} ${h}`).toMatch(/href="\/vendor\/fontawesome\/css\/all\.min\.css"/);
    }
    const css = fs.readFileSync(path.join(SRC, "public/vendor/fontawesome/css/all.min.css"), "utf8");
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u).toMatch(/^\.\.\/webfonts\/[a-z0-9-]+\.woff2$/);
      expect(fs.existsSync(path.join(SRC, "public/vendor/fontawesome/css", u))).toBe(true);
    }
    expect(fs.existsSync(path.join(SRC, "public/vendor/fontawesome/LICENSE.txt"))).toBe(true);
  });

  test("CSP : Cloudflare retiré, et chaque source est bien séparée", () => {
    const vite = fs.readFileSync(path.join(ROOT, "vite.config.js"), "utf8");
    const directives = vite.slice(vite.indexOf("const CSP_DIRECTIVES"), vite.indexOf("const CSP_META_CONTENT"));
    expect(directives).not.toContain("cdnjs");
    for (const source of directives.match(/'[^']+'/g) || []) {
      // Deux adresses collées (« …/gsi/https://… ») rendaient la seconde inopérante
      expect(source.slice(1, -1)).not.toMatch(/.+https?:\/\//);
    }
  });

  test("hébergement Firebase éteint (19/11/2026) : plus de section « hosting » dans firebase.json", () => {
    const firebase = JSON.parse(fs.readFileSync(path.join(ROOT, "firebase.json"), "utf8"));
    expect(firebase.hosting).toBeUndefined();
  });

  test("météo et région : position arrondie à ~1 km avant l'envoi (minimisation)", () => {
    const features = fs.readFileSync(path.join(SRC, "js/app-features.js"), "utf8");
    const safeRide = fs.readFileSync(path.join(SRC, "js/safe-ride.js"), "utf8");
    for (const [name, text] of [["app-features.js", features], ["safe-ride.js", safeRide]]) {
      const calls = text.match(/https:\/\/(api\.open-meteo\.com|nominatim\.openstreetmap\.org)[^`]*`/g) || [];
      expect(calls.length).toBeGreaterThan(0);
      for (const c of calls) expect(`${name} ${c}`).toMatch(/toFixed\(2\)[\s\S]*toFixed\(2\)/);
    }
    expect(safeRide.includes("\ufeff")).toBe(false);
  });
});
