/**
 * Suivi du plein déclaré par le pilote (Pit Stop, 23/11/2026). Remplace une jauge simulée qui annonçait
 * « carburant critique » au bout de 43 minutes sans rien mesurer.
 *
 * Un 50 cc n'a pas de capteur lisible : le pilote déclare son plein et son autonomie, l'appli compte les
 * km parcourus depuis (GPS, à vol d'oiseau entre deux relevés, donc un peu moins que la réalité : le rappel
 * part à 80 % de l'autonomie). C'est une estimation, et les messages le disent.
 *
 * Aucun import : testé directement (tests/fuel-tracker.test.js). Branchement : pit-stops.js.
 */
export const FUEL_KEY = "pitstop_plein";
export const RANGE_MIN_KM = 20;
export const RANGE_MAX_KM = 600;
export const RANGE_DEFAULT_KM = 150;
export const WARN_RATIO = 0.8;

const MIN_STEP_M = 20; // en dessous : bruit du GPS à l'arrêt
const MAX_ACCURACY_M = 50;
const MAX_SPEED_KMH = 70; // au-delà : saut du GPS, ou scooter dans un véhicule

/**
 * @param {{storage: Storage|null, distance: (lat1, lon1, lat2, lon2) => number, now?: () => number}} deps
 *   distance en mètres (geo-math.js)
 */
export function createFuelTracker({ storage, distance, now = () => Date.now() }) {
  let state = null;
  try {
    state = JSON.parse(storage.getItem(FUEL_KEY) || "null");
  } catch {
    state = null; // navigation privée ou donnée abîmée : suivi en mémoire pour cette page
  }
  if (!state || !Number.isFinite(state.km) || !Number.isFinite(state.rangeKm)) state = null;

  const save = () => {
    try {
      storage.setItem(FUEL_KEY, JSON.stringify(state));
    } catch {
      /* stockage indisponible */
    }
  };

  return {
    /** Autonomie à proposer dans le formulaire. */
    rangeKm: () => (state ? state.rangeKm : RANGE_DEFAULT_KM),

    /** @returns {boolean} faux si l'autonomie n'est pas un nombre de km plausible */
    declareFill(rangeKm) {
      const range = Math.round(Number(rangeKm));
      if (!Number.isFinite(range) || range < RANGE_MIN_KM || range > RANGE_MAX_KM) return false;
      state = { fillAt: now(), rangeKm: range, km: 0, last: null, warned: false };
      save();
      return true;
    },

    /** Nouveau relevé GPS pendant la route. @param {{lat: number, lng: number, accuracy?: number}} pos */
    track(pos) {
      if (!state || !pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return;
      if (Number.isFinite(pos.accuracy) && pos.accuracy > MAX_ACCURACY_M) return;
      const t = now();
      if (!state.last) {
        state.last = { lat: pos.lat, lng: pos.lng, t };
        save();
        return;
      }
      const stepM = distance(state.last.lat, state.last.lng, pos.lat, pos.lng);
      if (!Number.isFinite(stepM) || stepM < MIN_STEP_M) return;
      const hours = (t - state.last.t) / 3600000;
      if (hours > 0 && stepM / 1000 / hours <= MAX_SPEED_KMH) state.km += stepM / 1000;
      state.last = { lat: pos.lat, lng: pos.lng, t };
      save();
    },

    /** @returns {{known: boolean, kmSince?: number, rangeKm?: number, remainingKm?: number, shouldWarn?: boolean}} */
    status() {
      if (!state) return { known: false };
      const kmSince = Math.round(state.km);
      return {
        known: true,
        kmSince,
        rangeKm: state.rangeKm,
        remainingKm: Math.max(0, state.rangeKm - kmSince),
        shouldWarn: !state.warned && state.km >= state.rangeKm * WARN_RATIO,
      };
    },

    /** Le rappel a été donné : une seule fois par plein. */
    markWarned() {
      if (!state) return;
      state.warned = true;
      save();
    },
  };
}
