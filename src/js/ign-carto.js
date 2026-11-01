/**
 * IGN API Carto v2.10.5 — Client Complet (OpenAPI 3.1 / Géoplateforme)
 * ─────────────────────────────────────────────────────────────────────────────
 * Couvre l'intégralité des modules officiels de l'API Carto de l'IGN :
 * 1. Module Cadastre (PCI Express par défaut / BD Parcellaire)
 * 2. Module Limites Administratives (commune, departement, region)
 * 3. Module Codes Postaux (Base Adresse Nationale v4.1.2)
 * 4. Module Urbanisme — GpU (municipality, document, zone-urba, prescriptions, SUP)
 * 5. Module RPG (v1 2010-2014, v2 2015-2024)
 * 6. Module WFS-Géoportail (intersection générique avec les flux WFS Géoplateforme, ex: BDTOPO_V3)
 * 7. Module Nature (Natura 2000, Réserves Naturelles RNN/RNC/RNCF, ZNIEFF 1&2, Parcs PN/PNR — MNHN)
 *
 * Référentiel : WGS84 (EPSG:4326 — coordonnées [longitude, latitude])
 * Format de retour : GeoJSON (FeatureCollection) / JSON
 *
 * Conformité sécurité (Nexus Atlas) :
 * - OWASP ASVS v5.0.0-2.2.1 : Validation stricte par allowlist/plages des coordonnées et paramètres
 * - OWASP ASVS v5.0.0-1.2.1 : Échappement HTML systématique pour l'affichage DOM
 * - OWASP ASVS v5.0.0-16.x  : Logs structurés [IGN-Carto] sans exposition de PII
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { registerAction } from './actionRegistry.js';

const IGN_APICARTO_BASE_URL = 'https://apicarto.ign.fr/api';
const DEFAULT_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_GEOMETRY_POINTS_GPU = 250; // Limite de sécurité GpU ("nombre de points raisonnable")

// Cache mémoire léger (clé : coordonnées arrondies à 5 décimales ~ 1.1m)
const _locationCache = new Map();

/**
 * Échappe les caractères HTML spéciaux pour prévenir toute injection XSS (ASVS v5.0.0-1.2.1)
 * @param {unknown} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Valide un couple de coordonnées WGS84 (EPSG:4326) (ASVS v5.0.0-2.2.1)
 * @param {number} lat Latitude [-90, 90]
 * @param {number} lng Longitude [-180, 180]
 * @returns {{ valid: boolean, lat: number, lng: number }}
 */
export function validateCoordinates(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);
  const valid =
    Number.isFinite(numLat) &&
    Number.isFinite(numLng) &&
    numLat >= -90 &&
    numLat <= 90 &&
    numLng >= -180 &&
    numLng <= 180;
  return { valid, lat: numLat, lng: numLng };
}

/**
 * Construit un objet géométrique GeoJSON Point en WGS84 (longitude, latitude)
 * @param {number} lat
 * @param {number} lng
 * @returns {{ type: 'Point', coordinates: [number, number] }}
 */
export function buildGeoJSONPoint(lat, lng) {
  const check = validateCoordinates(lat, lng);
  if (!check.valid) {
    throw new Error('[IGN-Carto] Coordonnées WGS84 invalides.');
  }
  return {
    type: 'Point',
    coordinates: [Number(check.lng.toFixed(6)), Number(check.lat.toFixed(6))],
  };
}

/**
 * Construit un polygone tampon approximatif (carré en degrés WGS84) autour d'un point
 * Utile pour intersecter les objets linéaires WFS (ex: BDTOPO_V3:troncon_de_route)
 * @param {number} lat
 * @param {number} lng
 * @param {number} [radiusMeters=12] Rayon approximatif en mètres
 * @returns {{ type: 'Polygon', coordinates: number[][][] }}
 */
export function buildGeoJSONBBoxPolygon(lat, lng, radiusMeters = 12) {
  const check = validateCoordinates(lat, lng);
  if (!check.valid) {
    throw new Error('[IGN-Carto] Coordonnées WGS84 invalides.');
  }
  const dLat = radiusMeters / 111320;
  const cosLat = Math.max(Math.cos((check.lat * Math.PI) / 180), 0.01);
  const dLng = radiusMeters / (111320 * cosLat);

  const minLng = Number((check.lng - dLng).toFixed(6));
  const maxLng = Number((check.lng + dLng).toFixed(6));
  const minLat = Number((check.lat - dLat).toFixed(6));
  const maxLat = Number((check.lat + dLat).toFixed(6));

  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ],
  };
}

/**
 * Calcul géométrique côté client : Distance Haversine (en mètres) entre deux points WGS84
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance en mètres
 */
export function distanceMetersWGS84(lat1, lng1, lat2, lng2) {
  const R = 6371008.8; // Rayon terrestre moyen WGS84 (mètres)
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calcul géométrique côté client : Boîte englobante (BBox [minLng, minLat, maxLng, maxLat]) d'une géométrie GeoJSON
 * @param {Object} geometry Objet géométrique GeoJSON
 * @returns {[number, number, number, number] | null}
 */
export function computeGeoJSONBBox(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  function visitCoords(coords) {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const lng = coords[0];
      const lat = coords[1];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else {
      for (const item of coords) visitCoords(item);
    }
  }

  visitCoords(geometry.coordinates);
  if (!Number.isFinite(minLng)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Calcul géométrique côté client : Surface géodésique approximative (en m²) d'un Polygon ou MultiPolygon WGS84
 * (Remplace l'ancien endpoint supprimé /cadastre/geometrie, conformément à la doc API Carto v2.10.5)
 * @param {Object} geometry Géométrie GeoJSON Polygon ou MultiPolygon
 * @returns {number} Surface en m² (arrondie à l'unité)
 */
export function computePolygonAreaSqm(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return 0;
  const R = 6378137; // Demi-grand axe WGS84
  const toRad = (deg) => (deg * Math.PI) / 180;

  function ringArea(ring) {
    if (!Array.isArray(ring) || ring.length < 4) return 0;
    let total = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [lng1, lat1] = ring[i];
      const [lng2, lat2] = ring[i + 1];
      total += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
    }
    return Math.abs((total * R * R) / 2.0);
  }

  function polygonArea(rings) {
    if (!Array.isArray(rings) || rings.length === 0) return 0;
    let area = ringArea(rings[0]);
    // Soustraire les anneaux intérieurs (polygones troués)
    for (let i = 1; i < rings.length; i++) {
      area -= ringArea(rings[i]);
    }
    return Math.max(0, area);
  }

  if (geometry.type === 'Polygon') {
    return Math.round(polygonArea(geometry.coordinates));
  }
  if (geometry.type === 'MultiPolygon') {
    let totalArea = 0;
    for (const poly of geometry.coordinates) {
      totalArea += polygonArea(poly);
    }
    return Math.round(totalArea);
  }
  return 0;
}

/**
 * Valide une géométrie GeoJSON (Point, LineString, Polygon, MultiPoint, MultiPolygon)
 * et vérifie que le nombre de sommets reste raisonnable (protection DoS / exigence GpU).
 * @param {object|string} geom
 * @returns {string} Chaîne JSON validée
 */
export function serializeAndValidateGeoJSON(geom) {
  const parsed = typeof geom === 'string' ? JSON.parse(geom) : geom;
  const allowedTypes = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'];
  if (!parsed || !allowedTypes.includes(parsed.type) || !Array.isArray(parsed.coordinates)) {
    throw new Error('[IGN-Carto] Géométrie GeoJSON invalide ou non supportée.');
  }
  // Comptage rapide des points pour respecter la limite GpU
  const flatCoords = JSON.stringify(parsed.coordinates).match(/\[[-0-9.,\s]+\]/g) || [];
  if (flatCoords.length > MAX_GEOMETRY_POINTS_GPU) {
    throw new Error(`[IGN-Carto] Géométrie trop complexe (${flatCoords.length} sommets > max ${MAX_GEOMETRY_POINTS_GPU}).`);
  }
  return JSON.stringify(parsed);
}

/**
 * Valide et normalise le paramètre source_ign ('PCI' par défaut, ou 'BDP')
 * @param {string} [source]
 * @returns {'PCI' | 'BDP'}
 */
function normalizeSourceIgn(source) {
  if (!source) return 'PCI';
  const upper = String(source).trim().toUpperCase();
  return upper === 'BDP' ? 'BDP' : 'PCI';
}

/**
 * Exécute une requête GET ou POST sécurisée vers l'API Carto IGN avec timeout
 * @param {string} endpoint Chemin relatif (ex: '/cadastre/parcelle')
 * @param {Record<string, any>} params Paramètres de requête ou corps JSON
 * @param {Object} [fetchOpts] Options ({ method: 'GET'|'POST', timeoutMs })
 * @returns {Promise<any>}
 */
async function fetchIgnApiCarto(endpoint, params = {}, fetchOpts = {}) {
  const method = (fetchOpts.method || 'GET').toUpperCase();
  const timeoutMs = fetchOpts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const url = new URL(`${IGN_APICARTO_BASE_URL}${endpoint}`);

  const headers = {
    Accept: 'application/json, application/geo+json',
  };

  let body;
  if (method === 'GET') {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.append(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
      }
    });
  } else {
    headers['Content-Type'] = 'application/json';
    const cleanBody = {};
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        cleanBody[key] = val;
      }
    });
    body = JSON.stringify(cleanBody);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      console.warn(`[IGN-Carto] Timeout (${timeoutMs}ms) sur ${endpoint}`);
    } else {
      console.warn(`[IGN-Carto] Erreur réseau sur ${endpoint}:`, err.message);
    }
    throw err;
  }
}

/**
 * Résout la géométrie à partir d'options ({ geom } ou { lat, lng })
 * @param {Object} options
 * @param {boolean} [requireGeom=false]
 * @returns {string|undefined}
 */
function resolveGeometryParam(options = {}, requireGeom = false) {
  if (options.geom) {
    return serializeAndValidateGeoJSON(options.geom);
  }
  if (options.lat !== undefined && options.lng !== undefined) {
    return JSON.stringify(buildGeoJSONPoint(options.lat, options.lng));
  }
  if (requireGeom) {
    throw new Error('[IGN-Carto] Le paramètre géométrique (geom ou lat/lng) est obligatoire.');
  }
  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 1 : CADASTRE v2.10.5 (PCI Express / BD Parcellaire)
// ═══════════════════════════════════════════════════════════════════════════

function buildCadastreQueryParams(options = {}) {
  const query = {};
  const geomStr = resolveGeometryParam(options, false);
  if (geomStr) query.geom = geomStr;

  if (options.code_insee && /^[0-9A-Z]{5}$/i.test(String(options.code_insee).trim())) {
    query.code_insee = String(options.code_insee).trim().toUpperCase();
  }
  if (options.code_dep && /^[0-9A-Z]{2,3}$/i.test(String(options.code_dep).trim())) {
    query.code_dep = String(options.code_dep).trim().toUpperCase();
  }
  if (options.code_arr && /^[0-9]{1,3}$/.test(String(options.code_arr).trim())) {
    query.code_arr = String(options.code_arr).trim();
  }
  if (options.section && /^[0-9A-Z]{1,2}$/i.test(String(options.section).trim())) {
    query.section = String(options.section).trim().toUpperCase().padStart(2, '0');
  }
  if (options.numero && /^[0-9]{1,4}$/.test(String(options.numero).trim())) {
    query.numero = String(options.numero).trim().padStart(4, '0');
  }
  if (options.source_ign) {
    query.source_ign = normalizeSourceIgn(options.source_ign);
  }
  if (options._limit && Number.isInteger(options._limit) && options._limit > 0 && options._limit <= 500) {
    query._limit = options._limit;
  }
  return query;
}

/** GET/POST /api/cadastre/commune — Limites d'une commune */
export async function getCommune(options = {}, fetchOpts = {}) {
  return await fetchIgnApiCarto('/cadastre/commune', buildCadastreQueryParams(options), fetchOpts);
}

/** GET/POST /api/cadastre/parcelle — Parcelles cadastrales (PCI Express par défaut) */
export async function getParcelle(options = {}, fetchOpts = {}) {
  return await fetchIgnApiCarto('/cadastre/parcelle', buildCadastreQueryParams({ source_ign: 'PCI', ...options }), fetchOpts);
}

/** GET/POST /api/cadastre/feuille — Feuilles parcellaires PCI EXPRESS */
export async function getFeuille(options = {}, fetchOpts = {}) {
  return await fetchIgnApiCarto('/cadastre/feuille', buildCadastreQueryParams({ source_ign: 'PCI', ...options }), fetchOpts);
}

/** GET/POST /api/cadastre/division — Divisions parcellaires BD Parcellaire */
export async function getDivision(options = {}, fetchOpts = {}) {
  return await fetchIgnApiCarto('/cadastre/division', buildCadastreQueryParams({ source_ign: 'BDP', ...options }), fetchOpts);
}

/** GET/POST /api/cadastre/localisant — Centroïde d'une parcelle / parcelles non vectorisées */
export async function getLocalisant(options = {}, fetchOpts = {}) {
  return await fetchIgnApiCarto('/cadastre/localisant', buildCadastreQueryParams({ source_ign: 'PCI', ...options }), fetchOpts);
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 2 : LIMITES ADMINISTRATIVES v2.10.5 (Régions, Départements, Communes)
// ═══════════════════════════════════════════════════════════════════════════

function buildAdminLimitsParams(options = {}) {
  const query = {};
  const geomStr = resolveGeometryParam(options, false);
  if (geomStr) query.geom = geomStr;

  if (options.insee_com && /^[0-9A-Z]{5}$/i.test(String(options.insee_com).trim())) {
    query.insee_com = String(options.insee_com).trim().toUpperCase();
  }
  if (options.insee_dep && /^[0-9A-Z]{2,3}$/i.test(String(options.insee_dep).trim())) {
    query.insee_dep = String(options.insee_dep).trim().toUpperCase();
  }
  if (options.insee_reg && /^[0-9]{2}$/.test(String(options.insee_reg).trim())) {
    query.insee_reg = String(options.insee_reg).trim();
  }
  if (options.siren_epci && /^[0-9]{9}$/.test(String(options.siren_epci).trim())) {
    query.siren_epci = String(options.siren_epci).trim();
  }
  return query;
}

/** GET/POST /api/limites-administratives/commune */
export async function getAdminCommune(options = {}, fetchOpts = {}) {
  return await fetchIgnApiCarto('/limites-administratives/commune', buildAdminLimitsParams(options), fetchOpts);
}

/** GET/POST /api/limites-administratives/departement */
export async function getAdminDepartement(options = {}, fetchOpts = {}) {
  return await fetchIgnApiCarto('/limites-administratives/departement', buildAdminLimitsParams(options), fetchOpts);
}

/** GET/POST /api/limites-administratives/region */
export async function getAdminRegion(options = {}, fetchOpts = {}) {
  return await fetchIgnApiCarto('/limites-administratives/region', buildAdminLimitsParams(options), fetchOpts);
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 3 : CODES POSTAUX (Base Adresse Nationale v4.1.2)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/codes-postaux/communes/{codePostal}
 * @param {string} codePostal Code postal à 5 chiffres
 */
export async function getCommunesByPostalCode(codePostal) {
  const cleanCp = String(codePostal || '').trim();
  if (!/^\d{5}$/.test(cleanCp)) {
    throw new Error('[IGN-Carto] Code postal invalide (5 chiffres requis).');
  }
  return await fetchIgnApiCarto(`/codes-postaux/communes/${cleanCp}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 4 : URBANISME — GpU v2.10.5 (PLU, POS, CC, PSMV, SUP)
// ═══════════════════════════════════════════════════════════════════════════

const ALLOWED_GPU_LAYERS = new Set([
  'municipality',
  'document',
  'zone-urba',
  'secteur-cc',
  'prescription-surf',
  'prescription-lin',
  'prescription-pct',
  'info-surf',
  'info-lin',
  'info-pct',
  'acte-sup',
  'assiette-sup-s',
  'assiette-sup-l',
  'assiette-sup-p',
  'generateur-sup-s',
  'generateur-sup-l',
  'generateur-sup-p',
]);

/**
 * Interroge n'importe quelle couche du Géoportail de l'Urbanisme (GpU v2.10.5)
 * @param {string} layer Nom de la ressource GpU (ex: 'zone-urba', 'municipality', 'document', 'assiette-sup-s')
 * @param {Object} options ({ geom, lat, lng, partition, insee, categorie })
 * @param {Object} [fetchOpts]
 */
export async function queryGpU(layer, options = {}, fetchOpts = {}) {
  const cleanLayer = String(layer || '').trim().toLowerCase();
  if (!ALLOWED_GPU_LAYERS.has(cleanLayer)) {
    throw new Error(`[IGN-Carto] Couche GpU non autorisée : ${cleanLayer}`);
  }
  const params = {};
  const geomStr = resolveGeometryParam(options, false);
  if (geomStr) params.geom = geomStr;
  if (options.insee && /^[0-9A-Z]{5}$/i.test(String(options.insee).trim())) {
    params.insee = String(options.insee).trim().toUpperCase();
  }
  if (options.partition && /^[0-9A-Z_-]{3,40}$/i.test(String(options.partition).trim())) {
    params.partition = String(options.partition).trim();
  }
  if (options.categorie && /^[0-9A-Z_-]{1,20}$/i.test(String(options.categorie).trim())) {
    params.categorie = String(options.categorie).trim();
  }
  return await fetchIgnApiCarto(`/gpu/${cleanLayer}`, params, fetchOpts);
}

/** Raccourci GpU : GET /api/gpu/zone-urba (Zonage PLU : U = Urbain, AU = À urbaniser, A = Agricole, N = Naturel) */
export async function getGpuZoneUrba(options = {}, fetchOpts = {}) {
  return await queryGpU('zone-urba', options, fetchOpts);
}

/** Raccourci GpU : GET /api/gpu/municipality (Informations urbanisme de la commune, RNU) */
export async function getGpuMunicipality(options = {}, fetchOpts = {}) {
  return await queryGpU('municipality', options, fetchOpts);
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 5 : RPG v2.10.5 (Registre Parcellaire Graphique V1 & V2)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Interroge le Registre Parcellaire Graphique (RPG v1 < 2015 ou v2 >= 2015)
 * Attention : la géométrie (geom ou lat/lng) est obligatoire pour les recherches RPG.
 * @param {Object} options ({ annee, geom, lat, lng, code_cultu })
 * @param {Object} [fetchOpts]
 */
export async function getRPG(options = {}, fetchOpts = {}) {
  const year = Number(options.annee || 2024);
  if (!Number.isInteger(year) || year < 2010 || year > 2024) {
    throw new Error('[IGN-Carto] Millésime RPG invalide (doit être compris entre 2010 et 2024).');
  }
  const geomStr = resolveGeometryParam(options, true);
  const version = year < 2015 ? 'v1' : 'v2';
  const params = {
    annee: year,
    geom: geomStr,
  };
  if (options.code_cultu && /^[0-9A-Z]{1,5}$/i.test(String(options.code_cultu).trim())) {
    params.code_cultu = String(options.code_cultu).trim().toUpperCase();
  }
  return await fetchIgnApiCarto(`/rpg/${version}`, params, fetchOpts);
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 6 : WFS-GÉOPORTAIL v2.10.5 (Flux WFS Géoplateforme — ex: BDTOPO_V3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET/POST /api/wfs-geoportail/search
 * Permet d'intersecter n'importe quelle couche WFS de la Géoplateforme IGN
 * Exemple : source = 'BDTOPO_V3:troncon_de_route' ou 'BDTOPO_V3:zone_de_vegetation'
 * @param {Object} options ({ source, geom, lat, lng, radiusMeters, _limit })
 * @param {Object} [fetchOpts]
 */
export async function searchWfsGeoportail(options = {}, fetchOpts = {}) {
  const source = String(options.source || '').trim();
  // Validation stricte du nom technique de la couche WFS (<ESPACE>:<COUCHE>)
  if (!/^[A-Z0-9_.-]+:[A-Z0-9_.-]+$/i.test(source)) {
    throw new Error('[IGN-Carto] Nom de couche WFS source invalide (ex attendu: BDTOPO_V3:troncon_de_route).');
  }

  let geomStr;
  if (options.geom) {
    geomStr = serializeAndValidateGeoJSON(options.geom);
  } else if (options.lat !== undefined && options.lng !== undefined) {
    // Pour intersecter des objets linéaires (routes), un léger tampon BBox est plus fiable qu'un point strict
    if (options.radiusMeters && Number(options.radiusMeters) > 0) {
      geomStr = JSON.stringify(buildGeoJSONBBoxPolygon(options.lat, options.lng, Number(options.radiusMeters)));
    } else {
      geomStr = JSON.stringify(buildGeoJSONPoint(options.lat, options.lng));
    }
  } else {
    throw new Error('[IGN-Carto] Géométrie requise pour WFS-Géoportail.');
  }

  const params = {
    source,
    geom: geomStr,
  };
  if (options._limit && Number.isInteger(options._limit) && options._limit > 0 && options._limit <= 500) {
    params._limit = options._limit;
  }

  return await fetchIgnApiCarto('/wfs-geoportail/search', params, fetchOpts);
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 7 : NATURE v2.10.5 (MNHN — Natura 2000, Réserves, ZNIEFF, Parcs PN/PNR)
// ═══════════════════════════════════════════════════════════════════════════

const ALLOWED_NATURE_LAYERS = new Set([
  'natura-habitat', // Natura 2000 directive habitat
  'natura-oiseaux', // Natura 2000 directive oiseaux
  'rnc',            // Réserves naturelles de Corse
  'rnn',            // Réserves naturelles nationales (hors Corse)
  'znieff1',        // Zones écologiques de nature remarquable (type 1)
  'znieff2',        // Zones écologiques de nature remarquable (type 2)
  'pn',             // Parcs nationaux
  'pnr',            // Parcs naturels régionaux
  'rncf',           // Réserves nationales de chasse et de faune sauvage
]);

/**
 * Interroge une couche du module Nature v2.10.5 (flux MNHN en WGS84 EPSG:4326)
 * @param {string} layer Nom de la couche ('natura-habitat', 'natura-oiseaux', 'rnc', 'rnn', 'znieff1', 'znieff2', 'pn', 'pnr', 'rncf')
 * @param {Object} options ({ geom, lat, lng })
 * @param {Object} [fetchOpts]
 */
export async function queryNature(layer, options = {}, fetchOpts = {}) {
  const cleanLayer = String(layer || '').trim().toLowerCase();
  if (!ALLOWED_NATURE_LAYERS.has(cleanLayer)) {
    throw new Error(`[IGN-Carto] Couche Nature non autorisée : ${cleanLayer}`);
  }
  const geomStr = resolveGeometryParam(options, true);
  return await fetchIgnApiCarto(`/nature/${cleanLayer}`, { geom: geomStr }, fetchOpts);
}

/**
 * Vérifie si un point GPS se trouve dans un Parc National (pn), Parc Naturel Régional (pnr),
 * Réserve Naturelle (rnn/rnc) ou Réserve de Chasse et Faune Sauvage (rncf).
 * Utile pour :
 * - Alerter sur la réglementation de circulation des véhicules à moteur (Art. L362-1 Code de l'environnement)
 * - Appuyer un dossier sinistre de collision avec la faune sauvage (gibier).
 * @param {number} lat
 * @param {number} lng
 */
export async function checkProtectedNatureZone(lat, lng) {
  const check = validateCoordinates(lat, lng);
  if (!check.valid) return null;

  const layersToCheck = [
    { key: 'pn', label: 'Parc National' },
    { key: 'pnr', label: 'Parc Naturel Régional' },
    { key: 'rnn', label: 'Réserve Naturelle Nationale' },
    { key: 'rncf', label: 'Réserve Nationale de Chasse et de Faune Sauvage' },
  ];

  const results = await Promise.allSettled(
    layersToCheck.map((l) => queryNature(l.key, { lat: check.lat, lng: check.lng }))
  );

  const detectedZones = [];
  results.forEach((res, idx) => {
    if (res.status === 'fulfilled' && Array.isArray(res.value?.features) && res.value.features.length > 0) {
      const props = res.value.features[0]?.properties || {};
      const name = props.nom || props.sitename || props.nom_site || layersToCheck[idx].label;
      detectedZones.push({
        type: layersToCheck[idx].key,
        typeLabel: layersToCheck[idx].label,
        name: String(name).trim(),
      });
    }
  });

  return detectedZones.length > 0 ? detectedZones : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTION MÉTIER INSURTECH : QUALIFICATION COMPLÈTE D'UN LIEU DE SINISTRE
// Croise : Cadastre PCI Express + Limites Administratives + Urbanisme GpU + BD TOPO V3
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Qualification cadastrale, administrative, urbanistique et routière d'un point GPS de sinistre.
 * Réalisée par appels parallèles tolérants aux pannes (Promise.allSettled) conformément aux
 * bonnes pratiques de l'API Carto ("croisements de données métiers réalisés côté client").
 *
 * @param {number} lat Latitude WGS84
 * @param {number} lng Longitude WGS84
 */
export async function qualifyIncidentLocation(lat, lng) {
  const check = validateCoordinates(lat, lng);
  if (!check.valid) {
    return {
      available: false,
      source: 'IGN API Carto v2.10.5 (PCI Express / GpU / BD TOPO)',
      crs: 'EPSG:4326',
      commune: null,
      codeInsee: null,
      codeDep: null,
      departement: null,
      region: null,
      isPublicRoadDomain: false,
      domainType: 'HORS_CADASTRE_OU_INDETERMINE',
      domainLabel: 'Coordonnées GPS invalides',
      urbanZone: null,
      roadInfo: null,
      legalNotice: 'Vérification manuelle du lieu requise.',
      parcelle: null,
    };
  }

  const cacheKey = `${check.lat.toFixed(5)},${check.lng.toFixed(5)}`;
  const cached = _locationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    // Croisement multi-modules IGN en parallèle :
    // 1. Cadastre PCI Express (parcelle)
    // 2. Limites Administratives (commune)
    // 3. Urbanisme GpU (zone-urba : Zone U = agglomération/urbain vs N/A = hors agglomération)
    // 4. WFS-Géoportail BD TOPO V3 (troncon_de_route dans un rayon de 12m)
    // 5. Module Nature MNHN (Parcs PN/PNR, Réserves RNN/RNCF — faune sauvage & Art. L362-1)
    const [parcelleRes, communeRes, gpuZoneRes, wfsRouteRes, natureZones] = await Promise.all([
      getParcelle({ lat: check.lat, lng: check.lng, source_ign: 'PCI' }).then(
        (v) => ({ status: 'fulfilled', value: v }),
        (e) => ({ status: 'rejected', reason: e })
      ),
      getAdminCommune({ lat: check.lat, lng: check.lng }).then(
        (v) => ({ status: 'fulfilled', value: v }),
        (e) => ({ status: 'rejected', reason: e })
      ),
      getGpuZoneUrba({ lat: check.lat, lng: check.lng }).then(
        (v) => ({ status: 'fulfilled', value: v }),
        (e) => ({ status: 'rejected', reason: e })
      ),
      searchWfsGeoportail({
        source: 'BDTOPO_V3:troncon_de_route',
        lat: check.lat,
        lng: check.lng,
        radiusMeters: 12,
        _limit: 3,
      }).then(
        (v) => ({ status: 'fulfilled', value: v }),
        (e) => ({ status: 'rejected', reason: e })
      ),
      checkProtectedNatureZone(check.lat, check.lng).catch(() => null),
    ]);

    const parcelleFeatures =
      parcelleRes.status === 'fulfilled' && Array.isArray(parcelleRes.value?.features)
        ? parcelleRes.value.features
        : [];
    const communeFeatures =
      communeRes.status === 'fulfilled' && Array.isArray(communeRes.value?.features)
        ? communeRes.value.features
        : [];
    const gpuZoneFeatures =
      gpuZoneRes.status === 'fulfilled' && Array.isArray(gpuZoneRes.value?.features)
        ? gpuZoneRes.value.features
        : [];
    const wfsRouteFeatures =
      wfsRouteRes.status === 'fulfilled' && Array.isArray(wfsRouteRes.value?.features)
        ? wfsRouteRes.value.features
        : [];

    if (
      parcelleRes.status === 'rejected' &&
      communeRes.status === 'rejected' &&
      gpuZoneRes.status === 'rejected'
    ) {
      throw new Error('Services IGN API Carto injoignables');
    }

    const firstParcelleFeature = parcelleFeatures[0] || null;
    const firstParcelle = firstParcelleFeature?.properties || null;
    const firstCommune = communeFeatures[0]?.properties || null;
    const firstGpuZone = gpuZoneFeatures[0]?.properties || null;
    const firstRoute = wfsRouteFeatures[0]?.properties || null;

    const communeName =
      firstCommune?.nom_officiel ||
      firstCommune?.nom_com ||
      firstParcelle?.nom_com ||
      null;
    const codeInsee =
      firstCommune?.insee_com ||
      firstCommune?.code_insee ||
      firstParcelle?.code_insee ||
      null;
    const codeDep =
      firstCommune?.insee_dep ||
      firstParcelle?.code_dep ||
      (codeInsee ? codeInsee.substring(0, 2) : null);
    const inseeReg = firstCommune?.insee_reg || null;

    // Qualification du zonage d'urbanisme (GpU PLU)
    let urbanZone = null;
    if (firstGpuZone) {
      const typezone = String(firstGpuZone.typezone || firstGpuZone.libelle || '').trim();
      const libelong = String(firstGpuZone.libelong || firstGpuZone.libelle || '').trim();
      urbanZone = {
        typezone: typezone || 'N/A',
        libelle: libelong || typezone || 'Zone PLU',
        isUrbanArea: /^U/i.test(typezone), // Zone U = Zone Urbaine (règles d'agglomération)
      };
    }

    // Qualification du tronçon routier BD TOPO V3 (WFS-Géoportail)
    let roadInfo = null;
    if (firstRoute) {
      const nature = firstRoute.nature || null;
      const nomVoie =
        firstRoute.nom_1_gauche ||
        firstRoute.nom_1_droite ||
        firstRoute.cpx_numero ||
        null;
      const importance = firstRoute.importance || null;
      const vitesseMoy = firstRoute.vitesse_moyenne_vl || null;
      const acces50ccInterdit =
        nature === 'Autoroute' ||
        nature === 'Quasi-autoroute' ||
        nature === 'Bretelle';

      roadInfo = {
        nature,
        nomVoie,
        importance,
        vitesseMoyenneVl: vitesseMoy,
        acces50ccInterdit,
      };
    }

    let result;

    if (firstParcelle && firstParcelle.numero) {
      const section = String(firstParcelle.section || '').trim();
      const numero = String(firstParcelle.numero || '').trim();
      const prefixe = String(firstParcelle.com_abs || firstParcelle.prefixe || '000').trim();
      const contenanceAttr =
        firstParcelle.contenance !== undefined && firstParcelle.contenance !== null
          ? Number(firstParcelle.contenance)
          : null;
      const computedAreaSqm = firstParcelleFeature?.geometry
        ? computePolygonAreaSqm(firstParcelleFeature.geometry)
        : 0;
      const contenance = Number.isFinite(contenanceAttr) && contenanceAttr > 0
        ? contenanceAttr
        : computedAreaSqm > 0
          ? computedAreaSqm
          : null;
      const idu =
        firstParcelle.idu ||
        `${codeInsee || ''}${prefixe}${section}${numero}`;

      result = {
        available: true,
        source: 'IGN API Carto v2.10.5 (PCI Express / GpU / BD TOPO)',
        crs: 'EPSG:4326',
        commune: communeName,
        codeInsee,
        codeDep,
        inseeReg,
        isPublicRoadDomain: false,
        domainType: 'PARCELLE_CADASTREE',
        domainLabel: `Parcelle cadastrée — Section ${section} N° ${numero}`,
        urbanZone,
        roadInfo,
        natureZones: natureZones || null,
        legalNotice:
          'Zone située sur une parcelle cadastrée (terrain privé, parking ou voie cadastrée). Vérifier si la voie est ouverte à la circulation publique (Art. R110-1 Code de la route).',
        parcelle: {
          id: idu,
          section,
          numero,
          prefixe,
          contenance: Number.isFinite(contenance) ? contenance : null,
          nomCom: communeName,
          codeInsee,
        },
      };
    } else if (communeName || codeInsee) {
      let legalNotice =
        'Zone située hors parcelle privée sur le domaine public communal/routier (PCI Express). Application de plein droit du Code de la route et de la Loi Badinter.';
      if (roadInfo?.acces50ccInterdit) {
        legalNotice +=
          ' ⚠️ ALERTE BD TOPO : Tronçon identifié comme Autoroute / Voie rapide (interdit aux 50cc/VSP selon Art. R421-2).';
      }

      result = {
        available: true,
        source: 'IGN API Carto v2.10.5 (PCI Express / GpU / BD TOPO)',
        crs: 'EPSG:4326',
        commune: communeName,
        codeInsee,
        codeDep,
        inseeReg,
        isPublicRoadDomain: true,
        domainType: 'VOIRIE_PUBLIQUE_NON_CADASTREE',
        domainLabel: 'Domaine Public Routier (Voirie non cadastrée)',
        urbanZone,
        roadInfo,
        natureZones: natureZones || null,
        legalNotice,
        parcelle: null,
      };
    } else {
      result = {
        available: false,
        source: 'IGN API Carto v2.10.5 (PCI Express / GpU / BD TOPO)',
        crs: 'EPSG:4326',
        commune: null,
        codeInsee: null,
        codeDep: null,
        inseeReg: null,
        isPublicRoadDomain: false,
        domainType: 'HORS_CADASTRE_OU_INDETERMINE',
        domainLabel: 'Zone hors couverture cadastrale PCI Express',
        urbanZone: null,
        roadInfo: null,
        natureZones: null,
        legalNotice: 'Position hors couverture cadastrale IGN ou territoire non couvert.',
        parcelle: null,
      };
    }

    _locationCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch (err) {
    console.warn('[IGN-Carto] Qualification cadastrale indisponible:', err.message);
    return {
      available: false,
      source: 'IGN API Carto v2.10.5 (PCI Express / GpU / BD TOPO)',
      crs: 'EPSG:4326',
      commune: null,
      codeInsee: null,
      codeDep: null,
      inseeReg: null,
      isPublicRoadDomain: false,
      domainType: 'HORS_CADASTRE_OU_INDETERMINE',
      domainLabel: 'Qualification IGN hors-ligne',
      urbanZone: null,
      roadInfo: null,
      natureZones: null,
      legalNotice: 'Données cadastrales IGN temporairement indisponibles.',
      parcelle: null,
    };
  }
}

export const IGNCarto = {
  // Module 1 : Cadastre
  getCommune,
  getParcelle,
  getFeuille,
  getDivision,
  getLocalisant,
  // Module 2 : Limites Administratives
  getAdminCommune,
  getAdminDepartement,
  getAdminRegion,
  // Module 3 : Codes Postaux
  getCommunesByPostalCode,
  // Module 4 : Urbanisme (GpU)
  queryGpU,
  getGpuZoneUrba,
  getGpuMunicipality,
  // Module 5 : RPG
  getRPG,
  // Module 6 : WFS-Géoportail
  searchWfsGeoportail,
  // Module 7 : Nature (MNHN)
  queryNature,
  checkProtectedNatureZone,
  // Métier InsurTech & Utilitaires Géométriques Côté Client
  qualifyIncidentLocation,
  buildGeoJSONPoint,
  buildGeoJSONBBoxPolygon,
  computeGeoJSONBBox,
  computePolygonAreaSqm,
  distanceMetersWGS84,
  serializeAndValidateGeoJSON,
  validateCoordinates,
  escapeHtml,
};

if (typeof window !== 'undefined') {
  window.IGNCarto = IGNCarto;
  registerAction('IGNCarto.qualifyIncidentLocation', (lat, lng) =>
    qualifyIncidentLocation(lat, lng)
  );
}
