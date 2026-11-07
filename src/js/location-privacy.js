/**
 * location-privacy.js — Positions partagées avec la communauté (présence, radar social).
 *
 * Audit 2026-11-07 : les positions étaient publiées au mètre près et chaque téléphone
 * écoutait celles de TOUS les membres, sans limite de date ni de nombre :
 *   - n'importe quel membre pouvait suivre un autre à la trace ;
 *   - la facture Firestore grandissait avec le carré du nombre d'utilisateurs.
 * Désormais : position arrondie à ~100 m, et on n'écoute que les positions récentes,
 * en nombre limité.
 */

// 3 décimales ≈ 110 m en latitude, ≈ 75 m en longitude en France
const PRECISION = 1000;

/** Fenêtre des positions considérées comme « en ligne ». */
export const RECENT_WINDOW_MS = 15 * 60 * 1000;

/** Nombre maximum de positions écoutées en même temps. */
export const MAX_SHARED_POSITIONS = 100;

export function coarseCoord(value) {
  // Number(null) et Number("") valent 0 : une position absente deviendrait (0, 0)
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * PRECISION) / PRECISION : null;
}

/** { lat, lng } arrondis, ou null si la position est invalide. */
export function coarsePosition(lat, lng) {
  const cLat = coarseCoord(lat);
  const cLng = coarseCoord(lng);
  if (cLat === null || cLng === null || Math.abs(cLat) > 90 || Math.abs(cLng) > 180) return null;
  return { lat: cLat, lng: cLng };
}

/** Date limite à passer à .where(champ, ">=", …) pour n'écouter que les positions récentes. */
export function recentCutoff(now = Date.now()) {
  return new Date(now - RECENT_WINDOW_MS);
}
