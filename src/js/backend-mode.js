/**
 * Interrupteur du déménagement Firebase → serveur souverain OVHcloud (phase A, 18/11/2026).
 *
 * CONFIG.BACKEND_MODE (config.js) dit, domaine par domaine, quel serveur sert l'appli :
 *   "FIREBASE"  : comme avant (Firebase Auth / Firestore) ;
 *   "SOVEREIGN" : serveur souverain (api.mon50ccetmoi.com, sovereign-core/).
 * Une seule valeur ("SOVEREIGN") vaut pour tous les domaines. Valeur absente ou inconnue : "FIREBASE".
 * Retour arrière : remettre "FIREBASE" dans config.js et republier le site.
 *
 * Essai sur un seul téléphone, avant de basculer tout le monde : ouvrir une page du site avec
 * « ?essai-souverain=comptes » (plusieurs domaines : « comptes,dangers »). Le choix est gardé sur ce
 * téléphone jusqu'à « ?essai-souverain=non ». Il ne change rien pour les autres pilotes.
 *
 * Aucun import : testé directement (tests/backend-mode.test.js). Branchement : backend.js.
 */

export const BACKEND_DOMAINS = ["comptes", "dangers", "points", "paiements"];
export const BACKEND_TRIAL_KEY = "backend_mode_essai";
export const BACKEND_TRIAL_PARAM = "essai-souverain";

/** "SOVEREIGN", "FIREBASE" ou null si la valeur n'est pas reconnue. */
export function normalizeBackendMode(value) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "SOVEREIGN" || v === "SOUVERAIN") return "SOVEREIGN";
  if (v === "FIREBASE") return "FIREBASE";
  return null;
}

/**
 * Mode d'un domaine.
 * @param {string} domaine un de BACKEND_DOMAINS
 * @param {{setting?: string|object, trial?: object|null}} sources réglage de config.js, essai du téléphone
 */
export function backendModeFor(domaine, { setting, trial } = {}) {
  const fromTrial = trial && typeof trial === "object" ? normalizeBackendMode(trial[domaine]) : null;
  if (fromTrial) return fromTrial;
  const value = setting && typeof setting === "object" ? setting[domaine] : setting;
  return normalizeBackendMode(value) || "FIREBASE";
}

/**
 * Lit l'essai gardé sur ce téléphone et le met à jour d'après l'adresse de la page.
 * @param {Storage|null} storage
 * @param {string} search location.search
 * @returns {object|null} ex. { comptes: "SOVEREIGN" }
 */
export function readBackendTrial(storage, search) {
  let param = null;
  try {
    param = new URLSearchParams(search || "").get(BACKEND_TRIAL_PARAM);
  } catch {
    param = null;
  }
  if (param !== null) {
    const asked = param.split(",").map((d) => d.trim().toLowerCase()).filter((d) => BACKEND_DOMAINS.includes(d));
    const trial = asked.length ? Object.fromEntries(asked.map((d) => [d, "SOVEREIGN"])) : null;
    try {
      if (trial) storage.setItem(BACKEND_TRIAL_KEY, JSON.stringify(trial));
      else storage.removeItem(BACKEND_TRIAL_KEY);
    } catch {
      /* stockage indisponible : l'essai vaut pour cette page seulement */
    }
    return trial;
  }
  try {
    const stored = JSON.parse(storage.getItem(BACKEND_TRIAL_KEY) || "null");
    if (!stored || typeof stored !== "object") return null;
    const trial = {};
    for (const d of BACKEND_DOMAINS) {
      if (normalizeBackendMode(stored[d]) === "SOVEREIGN") trial[d] = "SOVEREIGN";
    }
    return Object.keys(trial).length ? trial : null;
  } catch {
    return null;
  }
}
