/**
 * Garages certifiés sur la carte des pilotes (25/11/2026) : la liste publique du serveur souverain
 * (GET /api/v1/garages, sovereign-core/server/garages.js), un marqueur 🔧 par garage ayant payé
 * le droit d'entrée et rempli sa fiche. Panneau en texte seul (textContent), jamais de HTML.
 */
import { CONFIG } from './config.js';

/** Contenu de la fenêtre du marqueur. */
export function buildGaragePopup(g, doc = document) {
  const box = doc.createElement("div");
  const title = doc.createElement("strong");
  title.textContent = `🔧 ${g.name}`;
  const badge = doc.createElement("div");
  badge.textContent = "Garage certifié mon50ccetmoi";
  const address = doc.createElement("div");
  address.textContent = g.address;
  box.append(title, badge, address);
  const tel = String(g.phone || "").replace(/[^0-9+]/g, "");
  if (tel) {
    const a = doc.createElement("a");
    a.href = `tel:${tel}`;
    a.textContent = g.phone;
    box.append(a);
  }
  return box;
}

/** Pose un marqueur par garage ; renvoie leur nombre. `map` et `L` : Leaflet. */
export function showCertifiedGarages({ map, L, garages, doc = document }) {
  const icon = L.divIcon({
    html: '<div style="font-size:20px; line-height:30px; text-align:center;">🔧</div>',
    className: "certified-garage-marker",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
  let n = 0;
  for (const g of garages) {
    if (!Number.isFinite(g.lat) || !Number.isFinite(g.lng)) continue;
    L.marker([g.lat, g.lng], { icon, title: `Garage certifié : ${g.name}` })
      .addTo(map)
      .bindPopup(buildGaragePopup(g, doc), { maxWidth: 280 });
    n++;
  }
  return n;
}

// La carte se crée un peu après le chargement de la page : on l'attend (30 s au plus).
if (typeof window !== "undefined" && typeof fetch === "function") {
  const list = fetch(`${CONFIG.SOVEREIGN.API_URL}/garages`).then((r) => (r.ok ? r.json() : { garages: [] })).catch(() => ({ garages: [] }));
  let tries = 0;
  const wait = setInterval(async () => {
    if (window.map && window.L) {
      clearInterval(wait);
      showCertifiedGarages({ map: window.map, L: window.L, garages: (await list).garages || [] });
    } else if (++tries >= 30) clearInterval(wait);
  }, 1000);
}
