/**
 * geo-math.js — Calculs de conduite purs (sans carte, sans DOM, sans réseau), testés dans
 * tests/geo-math.test.js.
 *
 * Étape 5 du plan de dette technique (7/11/2026) : la distance entre deux points GPS était
 * recopiée dans 6 fichiers (app-core, app-map, danger-zones, roadbooks, community-gas,
 * ign-carto), une fois en kilomètres et les autres en mètres. Tous passent maintenant par ici.
 */

/** Rayon terrestre moyen WGS84, en mètres */
export const EARTH_RADIUS_M = 6371008.8;

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Distance à vol d'oiseau entre deux points GPS (formule de Haversine), en mètres.
 * Renvoie NaN si une coordonnée n'est pas un nombre.
 */
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Lissage de la vitesse GPS : moyenne des `size` dernières mesures. Une mesure absente
 * (vitesse null, ex. position par Wi-Fi) n'est pas comptée comme un 0 : on garde la moyenne.
 * @returns {(rawSpeed: number, speedIsNull?: boolean) => number}
 */
export function createSpeedSmoother(size = 5) {
  const history = [];
  const average = () => history.reduce((a, b) => a + b, 0) / history.length;
  return function smooth(rawSpeed, speedIsNull = false) {
    if (speedIsNull && history.length > 0) return average();
    history.push(Number(rawSpeed) || 0);
    if (history.length > size) history.shift();
    return average();
  };
}

/** Heures du mode nuit : de 20 h à 7 h 59 */
export function isNightHour(hour) {
  return hour >= 20 || hour <= 7;
}

const VSP_BRANDS = ["citroën", "citroen", "ligier", "microcar", "aixam", "chatenet", "casalini", "ami"];

/** Icône Font Awesome du véhicule : voiture sans permis ou deux-roues */
export function vehicleIconFor(brand, model) {
  const b = (brand || "").toLowerCase();
  const m = (model || "").toLowerCase();
  const isVsp =
    VSP_BRANDS.some((name) => b.includes(name)) || m.includes("ami") || b.includes("voturette") || b.includes("vsp");
  return isVsp ? "fa-car" : "fa-motorcycle";
}
