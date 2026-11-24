/**
 * Branchement des points sur l'interrupteur CONFIG.BACKEND_MODE.points (logique : points-core.js).
 * "FIREBASE" : comme avant (Cloud Functions, coupées depuis le 14/11/2026 : plus aucun point ne bouge).
 * "SOVEREIGN" : points, historique, classement et preuve des signalements par le serveur du VPS.
 * Essai sur un seul téléphone : ?essai-souverain=comptes,points (il faut une session sur le serveur).
 */
import { backendMode } from './backend.js';
import { sovereignSession } from './sovereign.js';
import { createPointsSouverains, messagePoints } from './points-core.js';

export const pointsSouverains = backendMode('points') === 'SOVEREIGN' && sovereignSession
  ? createPointsSouverains({ sovereign: sovereignSession })
  : null;

/**
 * Nouveau signalement : envoyé AUSSI au serveur du VPS quand les points y sont (preuve des 25 points).
 * Renvoie l'identifiant du danger sur le serveur, ou null (points sur Firebase, pas de session, refus).
 * Ne lève jamais d'erreur : le signalement Firestore, lui, est déjà fait.
 */
export async function signalerAuServeur({ type, lat, lng, description }) {
  if (!pointsSouverains || !pointsSouverains.possible()) return null;
  try {
    const { hazardId } = await pointsSouverains.signalerDanger({ type, lat, lng, description });
    return hazardId || null;
  } catch (e) {
    console.warn('[Points] Signalement non transmis au serveur :', e && e.message);
    return null;
  }
}

/**
 * Dangers autour d'un point, lus sur le serveur du VPS. null si les points ne sont pas sur le VPS
 * (l'appelant lit alors Firestore) ; undefined si pas de session ou serveur muet : l'appelant garde
 * alors ce qu'il a déjà (alertes de conduite hors réseau).
 */
export async function dangersAutour(lat, lng, radiusKm) {
  if (!pointsSouverains) return null;
  if (!pointsSouverains.possible() || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return undefined;
  try {
    return await pointsSouverains.dangersAutour({ lat, lng, radiusKm });
  } catch (e) {
    console.warn('[Dangers] Lecture sur le serveur impossible :', e && e.message);
    return undefined;
  }
}

export { messagePoints };

if (typeof window !== 'undefined') {
  window.pointsSouverains = pointsSouverains;
  window.signalerAuServeur = signalerAuServeur;
}
