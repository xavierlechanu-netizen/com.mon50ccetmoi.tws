/**
 * Fabrique src/public/data/zfe.geojson (périmètres des zones à faibles émissions, allégés) à
 * partir de la Base nationale consolidée des ZFE publiée par l'État :
 *   https://transport.data.gouv.fr/datasets/base-nationale-consolidee-des-zones-a-faibles-emissions
 *   - aires.geojson (schéma etalab/schema-zfe) : https://transport.data.gouv.fr/resources/79567/download
 *   - identifiants des ZFE (CSV)              : https://transport.data.gouv.fr/resources/79760/download
 *   Licence : ODbL (attribution : « Base nationale des ZFE, transport.data.gouv.fr »).
 *
 * L'appli lit ce fichier hébergé chez nous : aucun appel à un tiers pendant les trajets.
 * Seuls les périmètres et leurs dates sont gardés : les règles par classe Crit'Air de la base
 * sont incomplètes ou en retard sur les arrêtés locaux, l'appli ne s'en sert donc pas.
 *
 * Usage (à relancer quand la base nationale change) :
 *   node scripts/build-zfe-geojson.js <aires.geojson> <identifiants.csv> [AAAA-MM-JJ]
 */
"use strict";

const fs = require("fs");
const path = require("path");

const [airesPath, idsPath, buildDateArg] = process.argv.slice(2);
if (!airesPath || !idsPath) {
  console.error("Usage : node scripts/build-zfe-geojson.js <aires.geojson> <identifiants.csv> [AAAA-MM-JJ]");
  process.exit(1);
}
const BUILD_DATE = buildDateArg || new Date().toISOString().slice(0, 10);
const OUT = path.resolve(__dirname, "../src/public/data/zfe.geojson");
const TOLERANCE_DEG = 0.0003; // ≈ 30 m : assez précis pour annoncer une entrée de zone
const DECIMALS = 5; // ≈ 1 m

// SIREN de la collectivité → son nom (colonne « epci_principal » du CSV officiel)
const names = new Map();
for (const line of fs.readFileSync(idsPath, "utf8").split(/\r?\n/).slice(1)) {
  const [siren, , epci, autres] = line.split(";");
  if (!siren || !epci) continue;
  names.set(siren.trim(), epci.trim());
  for (const s of (autres || "").split(",")) if (s.trim()) names.set(s.trim(), epci.trim());
}
// Quelques zones de la base ont un identifiant hors CSV (code commune, faute de frappe) :
// on reconnaît alors la collectivité par le site d'information qu'elles citent.
const BY_HOST = [
  [/grandannecy\.fr/, "Grand Annecy"],
  [/rouen/, "Métropole Rouen Normandie"],
  [/strasbourg/, "Eurométropole de Strasbourg"],
  [/grenoble|mobilites-m\.fr/, "Grenoble Alpes métropole"],
];

function zoneName(p) {
  const siren = String(p.id || "").split("-")[0];
  if (names.has(siren)) return names.get(siren);
  const url = `${p.url_site_information || ""} ${p.url_site || ""} ${p.url_arrete || ""}`;
  for (const [re, name] of BY_HOST) if (re.test(url)) return name;
  return null;
}

// Douglas-Peucker (anneau fermé : premier = dernier point)
function simplify(points, tol) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0;
    let idx = -1;
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out = points.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : points; // un anneau trop simplifié garde sa forme d'origine
}

const round = (n) => Number(n.toFixed(DECIMALS));
const ringOut = (ring) => simplify(ring, TOLERANCE_DEG).map(([x, y]) => [round(x), round(y)]);
const polygonsOf = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);

const src = JSON.parse(fs.readFileSync(airesPath, "utf8"));
// Une entrée par périmètre (nom + géométrie) : une même collectivité peut avoir des périmètres
// qui n'entrent pas en vigueur à la même date (Strasbourg : communes voisines en 2028).
const zones = new Map(); // clé → { nom, coordinates, periodes }
const skipped = [];

for (const f of src.features) {
  const p = f.properties || {};
  const name = zoneName(p);
  if (!name || !f.geometry) {
    skipped.push(p.id || "?");
    continue;
  }
  const fin = p.date_fin || p.date_fin_init || null;
  if (fin && fin < BUILD_DATE) continue; // période terminée
  const polys = polygonsOf(f.geometry);
  const key = name + "|" + JSON.stringify(polys.map((poly) => [poly[0].length, poly[0][0]]));
  const z = zones.get(key) || { nom: name, coordinates: polys.map((poly) => poly.map(ringOut)), periodes: [] };
  z.periodes.push({ debut: p.date_debut || null, fin: fin === "2999-12-31" ? null : fin });
  zones.set(key, z);
}

const features = [...zones.values()]
  .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
  .map((z) => {
    const debuts = z.periodes.map((x) => x.debut).filter(Boolean).sort();
    const fins = z.periodes.map((x) => x.fin);
    return {
      type: "Feature",
      properties: {
        nom: z.nom,
        debut: debuts[0] || null,
        fin: fins.includes(null) ? null : fins.sort().at(-1),
      },
      geometry: { type: "MultiPolygon", coordinates: z.coordinates },
    };
  });

const out = {
  type: "FeatureCollection",
  source: "Base nationale consolidée des ZFE, transport.data.gouv.fr (licence ODbL), simplifiée le " + BUILD_DATE,
  features,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out) + "\n");
console.log(`${features.length} périmètres → ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} Ko)`);
for (const f of features) {
  const { nom, debut, fin } = f.properties;
  console.log(`  ${nom.padEnd(42)} ${debut} → ${fin || "…"}  (${f.geometry.coordinates.length} polygone(s))`);
}
if (skipped.length) console.log("Ignorées (collectivité introuvable) :", skipped.join(", "));
