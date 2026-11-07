/**
 * Budget de poids au démarrage (étape 2 du plan de dette technique).
 *
 * Mesure, pour chaque page suivie, le JavaScript et le CSS téléchargés au chargement
 * (scripts et modulepreload de dist/<page>, compressés gzip) et échoue si une page dépasse
 * son budget (bundle-budget.json). Le budget est fixé à la taille mesurée + 5 %.
 *
 * Usage (après npm run build) :
 *   node scripts/check-bundle-size.js           → vérifie
 *   node scripts/check-bundle-size.js --update  → recalcule le budget (après une baisse voulue)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const DIST = path.resolve(__dirname, "../dist");
const BUDGET_FILE = path.resolve(__dirname, "../bundle-budget.json");
const PAGES = ["app.html", "index.html", "login.html", "marketplace.html", "assureur.html"];
const MARGIN = 1.05;

function startupBytes(page) {
  const html = fs.readFileSync(path.join(DIST, page), "utf8");
  const refs = new Set();
  for (const m of html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*rel="(?:modulepreload|stylesheet)"[^>]*\shref)="(\/[^"]+\.(?:js|css))"/g)) {
    refs.add(m[1]);
  }
  let total = 0;
  for (const ref of refs) {
    const file = path.join(DIST, ref);
    if (fs.existsSync(file)) total += zlib.gzipSync(fs.readFileSync(file)).length;
  }
  return { total, files: refs.size };
}

const measured = Object.fromEntries(PAGES.map((p) => [p, startupBytes(p)]));
const kb = (b) => (b / 1024).toFixed(1) + " Ko";

if (process.argv.includes("--update") || !fs.existsSync(BUDGET_FILE)) {
  const budget = Object.fromEntries(PAGES.map((p) => [p, Math.ceil(measured[p].total * MARGIN)]));
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(budget, null, 2) + "\n");
  for (const p of PAGES) console.log(`${p.padEnd(18)} ${kb(measured[p].total)} → budget ${kb(budget[p])}`);
  process.exit(0);
}

const budget = JSON.parse(fs.readFileSync(BUDGET_FILE, "utf8"));
let failed = false;
for (const p of PAGES) {
  const { total, files } = measured[p];
  const limit = budget[p];
  const ok = !limit || total <= limit;
  if (!ok) failed = true;
  console.log(`${ok ? "OK " : "TROP LOURD"} ${p.padEnd(18)} ${kb(total)} (${files} fichiers) / budget ${limit ? kb(limit) : "—"}`);
}
if (failed) {
  console.error("\nUne page dépasse son budget de poids au démarrage. Allégez-la, ou mettez le budget à jour");
  console.error("volontairement : node scripts/check-bundle-size.js --update");
  process.exit(1);
}
