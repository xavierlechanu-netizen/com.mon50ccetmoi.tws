// Signalements de dangers : enregistrement par le pilote et affichage sur la carte de ceux de la
// communauté. Sorti de app-map.js (étape 5 du plan de dette technique, tranche 4, 8/11/2026).
// Les alertes pendant la conduite sont dans hazard-alerts.js.
import { db, secureGetItem, secureSetItem } from "./config.js";
import { registerAction } from "./actionRegistry.js";
import * as geofire from "geofire-common";
import { distanceMeters } from "./geo-math.js";

export const HAZARD_SEARCH_RADIUS_M = 25000;
export const ANIMAL_TTL_MIN = 30; // un animal sur la route n'y reste pas : signalement oublié après 30 min

const ANIMAL_TYPES = new Set(["animal", "chien"]);

const LABELS = {
  Police: "Police",
  "Route Dégradée": "Route dégradée",
  animal: "Animal sur la route",
  chien: "Animal sur la route",
  danger_immediat: "Danger immédiat",
  radar: "Radar",
};

export function isAnimalHazard(h) {
  return ANIMAL_TYPES.has(h?.type);
}

/** Libellé lisible d'un type de danger (les types inconnus sont affichés tels quels). */
export function hazardLabel(type) {
  return LABELS[type] || String(type || "Danger");
}

export function hazardColor(type) {
  if (type === "Police") return "#00d2ff";
  if (type === "Route Dégradée") return "#f1c40f";
  if (ANIMAL_TYPES.has(type)) return "#e67e22";
  return "#ff4d4d";
}

/** Position d'un danger quel que soit son format ({lat, lon}, {lat, lng} ou {pos}), sinon null. */
export function hazardPosition(h) {
  const lat = Number(h?.pos?.lat ?? h?.lat);
  const lng = Number(h?.pos?.lng ?? h?.lon ?? h?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

export function isHazardExpired(h, now = Date.now()) {
  if (!isAnimalHazard(h) || !h.date) return false;
  const t = new Date(h.date).getTime();
  return Number.isFinite(t) && (now - t) / 60000 > ANIMAL_TTL_MIN;
}

/**
 * Dangers à afficher autour du centre de la carte. Ignore les anciens documents chiffrés et ceux
 * sans position, garde ceux à moins de radiusM, retire les animaux expirés et les doublons
 * (les zones de recherche par geohash se chevauchent : un même document peut revenir deux fois).
 * Renvoie [{ hazard, position }].
 */
export function selectNearbyHazards(records, center, radiusM = HAZARD_SEARCH_RADIUS_M, now = Date.now()) {
  const seen = new Set();
  const out = [];
  for (const h of records || []) {
    if (!h || h.payload) continue;
    const position = hazardPosition(h);
    if (!position) continue;
    if (distanceMeters(center.lat, center.lng, position.lat, position.lng) > radiusM) continue;
    if (isHazardExpired(h, now)) continue;
    const key = h.id || `${h.date}|${h.author}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ hazard: h, position });
  }
  return out;
}

/** Contenu de la bulle d'un danger, en texte brut (le pseudo de l'auteur n'est jamais du HTML). */
export function hazardInfoContent(h) {
  const box = document.createElement("div");
  const title = document.createElement("b");
  title.textContent = `${isAnimalHazard(h) ? "🐾 " : ""}${hazardLabel(h.type)}`;
  const author = document.createElement("small");
  author.textContent = h.author || "Anonyme";
  box.append(title, document.createElement("br"), author);
  return box;
}

// ──────────────────────────────────────────────
// Menu, enregistrement et affichage
// ──────────────────────────────────────────────

export function toggleHazardMenu() {
  const opts = document.getElementById("hazard-options");
  const mainBtn = document.getElementById("btn-hazard-quick") || document.getElementById("btn-hazard-main");
  if (!opts) return;
  const opening = opts.classList.contains("hidden");
  opts.classList.toggle("hidden", !opening);
  if (mainBtn) mainBtn.style.transform = opening ? "rotate(45deg)" : "rotate(0deg)";
}

export function saveHazard(type, description = "") {
  const pos = window.currentPosition;
  if (!pos) return;

  if (typeof window.isUserBanned === "function" && window.isUserBanned()) {
    const remaining = Math.ceil((window.session.bannedUntil - Date.now()) / 60000);
    alert(`🚨 Action interdite : votre compte est suspendu pour faux signalements répétés. Fin de la sanction dans ${remaining} minutes.`);
    return;
  }

  const h = {
    lat: pos.lat,
    lon: pos.lng,
    type,
    description,
    author: window.session ? window.session.username : "Anonyme",
    date: new Date().toISOString(),
    geohash: geofire.geohashForLocation([pos.lat, pos.lng]),
  };

  // 1. Sauvegarde locale (alertes de hazard-alerts.js, et secours hors ligne)
  let local = [];
  try {
    local = JSON.parse(secureGetItem("hazards") || "[]");
  } catch (e) {
    local = [];
  }
  local.push(h);
  secureSetItem("hazards", JSON.stringify(local));

  // 2. Publication pour la communauté (les points sont accordés par le serveur, voir publishHazardCloud)
  if (typeof window.publishHazardCloud === "function") window.publishHazardCloud(h);

  alert(`Signalement « ${hazardLabel(type)} » enregistré. Merci à vous.`);

  toggleHazardMenu();
  loadHazards();
}

function centerOf(map) {
  const c = map.getCenter();
  if (!c) return null;
  return typeof c.lat === "function" ? { lat: c.lat(), lng: c.lng() } : { lat: c.lat, lng: c.lng };
}

export async function loadHazards() {
  const map = window.map;
  if (!map || typeof google === "undefined" || !google.maps || !window.googleLibraries?.AdvancedMarkerElement) return;
  const center = centerOf(map);
  if (!center) return;

  let records;
  try {
    const bounds = geofire.geohashQueryBounds([center.lat, center.lng], HAZARD_SEARCH_RADIUS_M);
    const snaps = await Promise.all(
      bounds.map(([start, end]) => db.collection("hazards").orderBy("geohash").startAt(start).endAt(end).get()),
    );
    records = snaps.flatMap((snap) => snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  } catch (err) {
    console.error("[hazard-reports] Lecture des dangers impossible :", err);
    return;
  }

  (window.hazardMarkers || []).forEach((m) => m.setMap(null));
  window.hazardMarkers = [];

  for (const { hazard, position } of selectNearbyHazards(records, center)) {
    const icon = document.createElement("div");
    icon.style.cssText = `width:18px; height:18px; background-color:${hazardColor(hazard.type)}; border:2px solid white; border-radius:50%;`;
    const marker = new window.googleLibraries.AdvancedMarkerElement({ position, map, content: icon });
    const info = new google.maps.InfoWindow({ content: hazardInfoContent(hazard) });
    marker.addListener("click", () => info.open(map, marker));
    window.hazardMarkers.push(marker);
  }
}

window.toggleHazardMenu = toggleHazardMenu;
window.saveHazard = saveHazard;
registerAction("loadHazards", loadHazards);
