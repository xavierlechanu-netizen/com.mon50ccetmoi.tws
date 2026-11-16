/**
 * zfe-zones.js — Alerte à l'entrée d'une zone à faibles émissions (ZFE) pendant la conduite.
 *
 * Les périmètres viennent de la Base nationale consolidée des ZFE (transport.data.gouv.fr,
 * licence ODbL), allégés par scripts/build-zfe-geojson.js et hébergés chez nous
 * (/data/zfe.geojson) : aucun appel à un tiers pendant les trajets, rien n'est envoyé.
 *
 * Les ZFE restent en vigueur : le Conseil constitutionnel a censuré leur suppression
 * (décision n° 2026-903 DC du 21 mai 2026). Mais les règles par classe Crit'Air publiées dans
 * la base sont incomplètes ou en retard sur les arrêtés locaux : l'appli n'affirme donc jamais
 * qu'un véhicule est autorisé ou interdit, elle prévient et renvoie aux règles locales.
 *
 * Les fonctions de détection sont pures et testées (tests/zfe-zones.test.js).
 */
import { speak, vibrate } from "./voice-engine.js";
import { critAirBadge, NON_CLASSE } from "./crit-air.js";

export const ZFE_DATA_URL = "/data/zfe.geojson";

/** Le point [lng, lat] est-il dans l'anneau ? (règle pair-impair, coordonnées GeoJSON) */
export function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Dans le polygone : dans le contour extérieur et hors de ses trous */
export function pointInPolygon(lng, lat, polygon) {
  if (!Array.isArray(polygon) || !polygon.length || !pointInRing(lng, lat, polygon[0])) return false;
  for (let k = 1; k < polygon.length; k++) if (pointInRing(lng, lat, polygon[k])) return false;
  return true;
}

/** Dans une géométrie GeoJSON Polygon ou MultiPolygon */
export function pointInGeometry(lng, lat, geometry) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") return pointInPolygon(lng, lat, geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some((p) => pointInPolygon(lng, lat, p));
  return false;
}

/** La ZFE est-elle en vigueur ce jour-là (« AAAA-MM-JJ ») ? */
export function isZoneActive(properties, todayIso) {
  const { debut, fin } = properties || {};
  if (debut && todayIso < debut) return false;
  if (fin && todayIso > fin) return false;
  return true;
}

/** Nom de la ZFE en vigueur qui contient la position, ou null */
export function findZfe(features, lat, lng, todayIso) {
  if (!Array.isArray(features) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const f of features) {
    if (!isZoneActive(f.properties, todayIso)) continue;
    const box = f.bbox || bboxOf(f.geometry);
    if (box && (lng < box[0] || lat < box[1] || lng > box[2] || lat > box[3])) continue;
    if (pointInGeometry(lng, lat, f.geometry)) return (f.properties && f.properties.nom) || "zone à faibles émissions";
  }
  return null;
}

/** [ouest, sud, est, nord] d'une géométrie (pour écarter vite les zones lointaines) */
export function bboxOf(geometry) {
  if (!geometry) return null;
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates || [];
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of polys) {
    for (const [x, y] of p[0] || []) {
      if (x < box[0]) box[0] = x;
      if (y < box[1]) box[1] = y;
      if (x > box[2]) box[2] = x;
      if (y > box[3]) box[3] = y;
    }
  }
  return box[0] === Infinity ? null : box;
}

/** Message d'alerte selon la vignette enregistrée dans « Mon Véhicule » (ou son absence) */
export function zfeAlertMessage(nom, classe) {
  const entree = `Vous entrez dans la zone à faibles émissions : ${nom}.`;
  if (classe === NON_CLASSE) {
    return `${entree} Votre véhicule est non classé : il peut y être interdit. Vérifiez les règles locales.`;
  }
  if (Number.isInteger(classe)) {
    return `${entree} Votre vignette : ${critAirBadge(classe).label}. Vérifiez qu'elle y est autorisée et bien collée.`;
  }
  return `${entree} Une vignette Crit'Air peut y être exigée. Renseignez votre véhicule dans Mon Véhicule.`;
}

// --- Branchement pendant la conduite (app-core.js, à chaque position GPS) ---

let zones = null; // chargées au premier besoin
let loading = null;
let currentZone = null;

function loadZones() {
  if (zones || loading) return loading;
  loading = fetch(ZFE_DATA_URL)
    .then((r) => (r.ok ? r.json() : { features: [] }))
    .then((data) => {
      zones = (data.features || []).map((f) => ({ ...f, bbox: bboxOf(f.geometry) }));
    })
    .catch(() => {
      zones = []; // hors ligne et pas en cache : pas d'alerte ZFE plutôt qu'une erreur en route
    });
  return loading;
}

function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function savedCritAirClass() {
  const c = window.session && window.session.critAir && window.session.critAir.classe;
  return c === undefined ? null : c;
}

function showZfeToast(message) {
  const toast = document.createElement("div");
  toast.className = "hazard-toast glassmorphism";
  toast.setAttribute("role", "status");
  const p = document.createElement("p");
  p.textContent = message; // jamais de HTML : le nom vient d'un fichier de données
  toast.append(p);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 10000);
}

/** Appelée à chaque position GPS : alerte une fois à l'entrée, se réarme à la sortie */
export function checkZfeEntry(lat, lng) {
  if (!zones) {
    loadZones();
    return;
  }
  const zone = findZfe(zones, lat, lng, todayIso());
  if (zone && zone !== currentZone) {
    const message = zfeAlertMessage(zone, savedCritAirClass());
    speak(message);
    showZfeToast(message);
    vibrate(60);
  }
  currentZone = zone;
}
