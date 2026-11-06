/**
 * map-engine.js — Services cartographiques souverains (sans Google).
 *
 *   Itinéraires   : IGN Géoplateforme (moteur bdtopo-pgr), autoroutes interdites
 *   Géocodage     : IGN Géoplateforme (adresses BAN + lieux)
 *   Autocomplétion: IGN Géoplateforme
 *   Lieux proches : OpenStreetMap via Overpass
 *
 * Aucune clé API. Ce module ne touche pas au DOM : il est testé dans tests/map-engine.test.js.
 */

export const IGN_BASE = "https://data.geopf.fr";
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
];

const EARTH_RADIUS_M = 6378137; // même rayon que Google Maps (computeDistanceBetween)

// Vitesse maximale par type de véhicule (m/s) : les durées IGN sont calculées pour une voiture.
export const SPEED_CAP_MS = {
  DRIVING: 45 / 3.6, // 50 cc et voitures sans permis : 45 km/h
  BICYCLING: 20 / 3.6, // vélo / trottinette
  WALKING: 5 / 3.6,
};

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/** Lit {lat,lng} depuis un objet Google (lat()), Leaflet/litéral (lat) ou un tableau [lat,lng]. */
export function readLatLng(p) {
  if (!p) return null;
  if (Array.isArray(p)) return { lat: Number(p[0]), lng: Number(p[1]) };
  const lat = typeof p.lat === "function" ? p.lat() : p.lat;
  const lng = typeof p.lng === "function" ? p.lng() : p.lng !== undefined ? p.lng : p.lon;
  if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

/** Distance orthodromique en mètres. */
export function distanceMeters(a, b) {
  const p = readLatLng(a);
  const q = readLatLng(b);
  if (!p || !q) return NaN;
  const dLat = toRad(q.lat - p.lat);
  const dLng = toRad(q.lng - p.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p.lat)) * Math.cos(toRad(q.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cap en degrés (0 = nord, 90 = est) de a vers b. */
export function bearingDeg(a, b) {
  const p = readLatLng(a);
  const q = readLatLng(b);
  const y = Math.sin(toRad(q.lng - p.lng)) * Math.cos(toRad(q.lat));
  const x = Math.cos(toRad(p.lat)) * Math.sin(toRad(q.lat)) -
    Math.sin(toRad(p.lat)) * Math.cos(toRad(q.lat)) * Math.cos(toRad(q.lng - p.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Décode une polyline encodée (format Google / OSRM, précision 5). */
export function decodePolyline(str, precision = 5) {
  const factor = 10 ** precision;
  const out = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte;
      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    out.push({ lat: lat / factor, lng: lng / factor });
  }
  return out;
}

/**
 * Équivalent de google.maps.geometry.poly.isLocationOnEdge :
 * vrai si le point est à moins de `toleranceDeg` degrés d'un segment du tracé.
 */
export function isNearPath(point, path, toleranceDeg = 1e-9) {
  const p = readLatLng(point);
  if (!p || !path || path.length === 0) return false;
  const pts = path.map(readLatLng).filter(Boolean);
  if (pts.length === 1) return Math.hypot(p.lat - pts[0].lat, p.lng - pts[0].lng) <= toleranceDeg;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / len2));
    const d = Math.hypot(p.lng - (a.lng + t * dx), p.lat - (a.lat + t * dy));
    if (d <= toleranceDeg) return true;
  }
  return false;
}

export function formatDistance(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(m)} m`;
}

export function formatDuration(sec) {
  const min = Math.max(1, Math.round(sec / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${String(rest).padStart(2, "0")}` : `${h} h`;
}

/** "R DE RIVOLI" → "Rue de Rivoli" (abréviations BD TOPO usuelles). */
export function prettyRoadName(raw) {
  if (!raw) return "";
  const abbr = { R: "Rue", AV: "Avenue", BD: "Boulevard", PL: "Place", QU: "Quai", RTE: "Route", CHE: "Chemin", IMP: "Impasse", ALL: "Allée", PONT: "Pont", CRS: "Cours", SQ: "Square", PAS: "Passage", RPT: "Rond-point" };
  const small = new Set(["DE", "DU", "DES", "LA", "LE", "LES", "D", "L", "AU", "AUX", "ET", "EN", "SUR", "SOUS"]);
  // Majuscule à chaque partie d'un mot composé : "SAINT-MARTIN" → "Saint-Martin", "L'HORLOGE" → "l'Horloge"
  const cap = (w) => w.split(/([-'’])/).map((part) => {
    if (part === "-" || part === "'" || part === "’") return part;
    if (small.has(part.toUpperCase()) && /['’]$/.test(w.slice(0, w.indexOf(part) + part.length + 1))) return part.toLowerCase();
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join("");
  const isUpper = raw === raw.toUpperCase();
  const words = raw.trim().split(/\s+/).map((w, i) => {
    const W = w.toUpperCase();
    if (i === 0 && abbr[W]) return abbr[W];
    if (!isUpper) return w;
    if (i > 0 && small.has(W)) return w.toLowerCase();
    return cap(w);
  });
  const out = words.join(" ").replace(/\b([dl]) (?=\S)/gi, (m, c) => `${c.toLowerCase()}'`);
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Manœuvre au format Google ("turn-left"…) selon l'écart de cap en degrés (-180..180, positif = droite). */
export function maneuverFromTurn(delta) {
  const a = Math.abs(delta);
  const side = delta > 0 ? "right" : "left";
  if (a < 20) return "straight";
  if (a < 45) return `turn-slight-${side}`;
  if (a < 135) return `turn-${side}`;
  if (a < 165) return `turn-sharp-${side}`;
  return `uturn-${side}`;
}

const MANEUVER_TEXT = {
  straight: "Continuez tout droit",
  "turn-slight-left": "Serrez à gauche",
  "turn-slight-right": "Serrez à droite",
  "turn-left": "Tournez à gauche",
  "turn-right": "Tournez à droite",
  "turn-sharp-left": "Tournez franchement à gauche",
  "turn-sharp-right": "Tournez franchement à droite",
  "uturn-left": "Faites demi-tour",
  "uturn-right": "Faites demi-tour",
};

/**
 * Transforme les tronçons IGN (sans consignes) en étapes de navigation :
 * fusionne les tronçons d'une même rue et calcule le sens du virage à chaque changement de rue.
 * Durées plafonnées à la vitesse du véhicule (45 km/h pour un 50 cc).
 */
export function buildSteps(ignSteps, speedCapMs = SPEED_CAP_MS.DRIVING) {
  const groups = [];
  for (const s of ignSteps || []) {
    const coords = (s.geometry && s.geometry.coordinates) || [];
    if (coords.length === 0) continue;
    const attrs = s.attributes || {};
    const name = attrs.nom_1_droite || attrs.nom_1_gauche || attrs.cpx_toponyme_route_nommee || attrs.cpx_numero || "";
    const dist = Number(s.distance) || 0;
    const dur = Math.max(Number(s.duration) || 0, speedCapMs > 0 ? dist / speedCapMs : 0);
    const pts = coords.map((c) => ({ lat: c[1], lng: c[0] }));
    const last = groups[groups.length - 1];
    if (last && last.name === name) {
      last.path.push(...pts.slice(last.path.length && samePoint(last.path[last.path.length - 1], pts[0]) ? 1 : 0));
      last.distance += dist;
      last.duration += dur;
    } else {
      groups.push({ name, path: pts, distance: dist, duration: dur });
    }
  }

  return groups.map((g, i) => {
    let maneuver = i === 0 ? "depart" : "straight";
    if (i > 0) {
      const prev = groups[i - 1].path;
      const inBearing = headingAtEnd(prev);
      const outBearing = headingAtStart(g.path);
      if (inBearing !== null && outBearing !== null) {
        maneuver = maneuverFromTurn(((outBearing - inBearing + 540) % 360) - 180);
      }
    }
    const road = prettyRoadName(g.name);
    let instructions;
    if (i === 0) instructions = road ? `Partez par ${road}` : "Partez";
    else instructions = `${MANEUVER_TEXT[maneuver] || "Continuez"}${road ? ` sur ${road}` : ""}`;
    return {
      instructions,
      maneuver: maneuver === "depart" ? "straight" : maneuver,
      road,
      distanceMeters: Math.round(g.distance),
      durationSec: Math.round(g.duration),
      start: g.path[0],
      end: g.path[g.path.length - 1],
      path: g.path,
    };
  });
}

function samePoint(a, b) {
  return a && b && Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;
}

// Cap sur les ~25 derniers / premiers mètres (évite le bruit des micro-segments)
function headingAtEnd(path) {
  if (path.length < 2) return null;
  const end = path[path.length - 1];
  for (let i = path.length - 2; i >= 0; i--) {
    if (distanceMeters(path[i], end) >= 25 || i === 0) return bearingDeg(path[i], end);
  }
  return null;
}

function headingAtStart(path) {
  if (path.length < 2) return null;
  const start = path[0];
  for (let i = 1; i < path.length; i++) {
    if (distanceMeters(start, path[i]) >= 25 || i === path.length - 1) return bearingDeg(start, path[i]);
  }
  return null;
}

async function getJson(fetchFn, url) {
  const resp = await fetchFn(url, { headers: { Accept: "application/json" } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} sur ${url.split("?")[0]}`);
  return resp.json();
}

/**
 * Itinéraire IGN. Les autoroutes sont interdites par défaut (Code de la route R421-2 pour les 50 cc).
 * @returns {Promise<{distanceMeters:number, durationSec:number, path:{lat,lng}[], steps:object[]}>}
 */
export async function computeRoute(origin, destination, opts = {}, fetchFn = globalThis.fetch) {
  const o = readLatLng(origin);
  const d = readLatLng(destination);
  if (!o || !d) throw new Error("Départ ou arrivée invalide");
  const mode = opts.mode || "DRIVING";
  const params = new URLSearchParams({
    resource: "bdtopo-pgr",
    start: `${o.lng},${o.lat}`,
    end: `${d.lng},${d.lat}`,
    profile: mode === "WALKING" ? "pedestrian" : "car",
    optimization: "fastest",
    getSteps: "true",
    geometryFormat: "geojson",
  });
  if (opts.avoidHighways !== false && mode !== "WALKING") {
    params.set("constraints", JSON.stringify({ constraintType: "banned", key: "waytype", operator: "=", value: "autoroute" }));
  }
  const data = await getJson(fetchFn, `${IGN_BASE}/navigation/itineraire?${params}`);
  if (!data || !data.geometry || !Array.isArray(data.geometry.coordinates)) throw new Error("Aucun itinéraire");

  const cap = SPEED_CAP_MS[mode] || SPEED_CAP_MS.DRIVING;
  const ignSteps = (data.portions || []).flatMap((p) => p.steps || []);
  const steps = buildSteps(ignSteps, cap);
  const path = data.geometry.coordinates.map((c) => ({ lat: c[1], lng: c[0] }));
  const distance = Number(data.distance) || steps.reduce((s, x) => s + x.distanceMeters, 0);
  const duration = steps.length
    ? steps.reduce((s, x) => s + x.durationSec, 0)
    : Math.max(Number(data.duration) || 0, distance / cap);
  return { distanceMeters: Math.round(distance), durationSec: Math.round(duration), path, steps };
}

function featureToPlace(f) {
  const [lng, lat] = f.geometry.coordinates;
  const p = f.properties || {};
  const ctx = String(p.context || "").split(",").map((s) => s.trim());
  const components = [];
  if (p.housenumber) components.push({ long_name: p.housenumber, short_name: p.housenumber, types: ["street_number"] });
  if (p.street || p.name) components.push({ long_name: p.street || p.name, short_name: p.street || p.name, types: ["route"] });
  if (p.city) components.push({ long_name: p.city, short_name: p.city, types: ["locality", "political"] });
  if (p.postcode) components.push({ long_name: p.postcode, short_name: p.postcode, types: ["postal_code"] });
  if (ctx[0]) components.push({ long_name: ctx[1] || ctx[0], short_name: ctx[0], types: ["administrative_area_level_2", "political"] });
  if (ctx[2]) components.push({ long_name: ctx[2], short_name: ctx[2], types: ["administrative_area_level_1", "political"] });
  components.push({ long_name: "France", short_name: "FR", types: ["country", "political"] });
  return {
    lat,
    lng,
    label: p.label || p.name || "",
    name: p.name || p.label || "",
    placeId: p.id || `${lat},${lng}`,
    type: p.type || "",
    addressComponents: components,
  };
}

/** Géocodage d'une adresse ou d'un lieu (France). */
export async function geocodeAddress(query, opts = {}, fetchFn = globalThis.fetch) {
  const q = String(query || "").trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ q, limit: String(opts.limit || 5) });
  const near = readLatLng(opts.near);
  if (near) {
    params.set("lat", String(near.lat));
    params.set("lon", String(near.lng));
  }
  const data = await getJson(fetchFn, `${IGN_BASE}/geocodage/search?${params}`);
  return (data.features || []).map(featureToPlace);
}

/** Adresse la plus proche d'un point. */
export async function reverseGeocode(point, fetchFn = globalThis.fetch) {
  const p = readLatLng(point);
  if (!p) return [];
  const params = new URLSearchParams({ lat: String(p.lat), lon: String(p.lng), limit: "1" });
  const data = await getJson(fetchFn, `${IGN_BASE}/geocodage/reverse?${params}`);
  return (data.features || []).map(featureToPlace);
}

/** Suggestions pendant la saisie (adresses et lieux). */
export async function completeAddress(text, opts = {}, fetchFn = globalThis.fetch) {
  const t = String(text || "").trim();
  if (t.length < 3) return [];
  const params = new URLSearchParams({
    text: t,
    type: "StreetAddress,PositionOfInterest",
    maximumResponses: String(opts.limit || 6),
  });
  const near = readLatLng(opts.near);
  if (near) params.set("lonlat", `${near.lng},${near.lat}`);
  const data = await getJson(fetchFn, `${IGN_BASE}/geocodage/completion?${params}`);
  return (data.results || [])
    .filter((r) => typeof r.x === "number" && typeof r.y === "number")
    .map((r) => ({ label: r.fulltext, lat: r.y, lng: r.x }));
}

/** Garages deux-roues autour d'un point (OpenStreetMap). */
export async function findNearbyGarages(point, radiusM = 5000, fetchFn = globalThis.fetch) {
  const p = readLatLng(point);
  if (!p) return [];
  const r = Math.min(Math.max(Math.round(radiusM), 100), 50000);
  const around = `(around:${r},${p.lat},${p.lng})`;
  const query = `[out:json][timeout:10];(nwr["shop"~"^(motorcycle|motorcycle_repair)$"]${around};nwr["craft"="motorcycle_repair"]${around};);out center tags 40;`;
  // Overpass est un service gratuit souvent saturé : délai court et second serveur officiel en secours.
  let data = null;
  let lastError = null;
  for (const url of OVERPASS_ENDPOINTS) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 12000) : null;
    try {
      const resp = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} sur Overpass`);
      data = await resp.json();
      break;
    } catch (e) {
      lastError = e.name === "AbortError" ? new Error("Overpass trop lent (12 s)") : e;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  if (!data) throw lastError || new Error("Overpass indisponible");
  return (data.elements || [])
    .map((el) => {
      const lat = el.lat !== undefined ? el.lat : el.center && el.center.lat;
      const lng = el.lon !== undefined ? el.lon : el.center && el.center.lon;
      const t = el.tags || {};
      if (typeof lat !== "number" || !t.name) return null;
      const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
      return {
        placeId: `osm-${el.type}-${el.id}`,
        name: t.name,
        vicinity: [street, t["addr:city"]].filter(Boolean).join(", "),
        phone: t.phone || t["contact:phone"] || "",
        website: t.website || t["contact:website"] || "",
        openingHours: t.opening_hours || "",
        lat,
        lng,
      };
    })
    .filter(Boolean);
}
