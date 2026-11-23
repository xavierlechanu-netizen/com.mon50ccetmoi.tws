/**
 * Points, classement et signalements par le serveur du VPS (interrupteur CONFIG.BACKEND_MODE.points),
 * 19/11/2026. Remplace les Cloud Functions transactPoints et getPointsHistory, coupées depuis le
 * 14/11/2026 : depuis, aucun point n'était plus gagné ni dépensé.
 *
 * Même barème, mêmes preuves et mêmes plafonds qu'avant (functions/api/points-rules.js, partagé avec le
 * serveur). Les 25 points d'un signalement demandent une preuve : le danger doit exister SUR LE SERVEUR.
 * Tant que la carte lit encore les dangers dans Firestore, chaque nouveau signalement est donc AUSSI
 * envoyé au serveur (signalerDanger) ; les points sont accordés sur l'identifiant rendu par le serveur.
 *
 * Aucun import : testé directement (tests/points-souverains.test.js). Branchement : bvc-manager.js,
 * leaderboard.js, database.js, danger-zones.js, radar-danger.js.
 */

// Types de danger du serveur (sovereign-core/server/index.js, HAZARD_TYPES)
export const TYPES_DANGER_SERVEUR = ["pothole", "accident", "police", "roadwork", "obstacle", "weather", "other"];

const CORRESPONDANCE_DANGERS = [
  [/pothole|nid|route.?d[ée]grad|d[ée]grad/i, "pothole"],
  [/accident|crash|chute/i, "accident"],
  [/police|radar|contr[ôo]le|gendarm/i, "police"],
  [/roadwork|travaux|chantier/i, "roadwork"],
  [/slippery|verglas|glissant|flood|inond|pluie|neige|weather|m[ée]t[ée]o|brouillard/i, "weather"],
  [/gravel|gravillon|obstacle|animal|animaux|blind.?spot|angle.?mort|objet|danger.?immediat/i, "obstacle"],
];

/** Type de danger de l'appli (POTHOLE, « Route Dégradée », animal…) → type du serveur. */
export function typeDangerServeur(type) {
  const t = String(type || "").trim();
  if (TYPES_DANGER_SERVEUR.includes(t)) return t;
  for (const [motif, cible] of CORRESPONDANCE_DANGERS) if (motif.test(t)) return cible;
  return "other";
}

function pointsError(code, message, status) {
  const err = new Error(message);
  err.code = code;
  if (status) err.status = status;
  return err;
}

/** Message à montrer au pilote pour un refus du serveur (plafond, solde, session…). */
export function messagePoints(error) {
  const status = error && error.status;
  if (error && error.code === "points/sans-session") return error.message;
  if (status === 401) return "Reconnectez-vous pour gagner ou utiliser vos points.";
  if (status === 402 || status === 429 || status === 403 || status === 400 || status === 422) {
    return (error && error.message) || "Opération refusée.";
  }
  return "Serveur des points injoignable pour le moment. Réessayez dans un instant.";
}

/**
 * @param {{ sovereign: object|null }} deps  createSovereignSession(...) (sovereign-session.js), ou null
 */
export function createPointsSouverains({ sovereign }) {
  const possible = () => Boolean(sovereign && sovereign.hasAccount());

  async function appel(endpoint, options) {
    if (!possible()) {
      throw pointsError("points/sans-session", "Reconnectez-vous pour gagner ou utiliser vos points.", 401);
    }
    return sovereign.client.request(endpoint, options);
  }

  return {
    /** Vrai si ce téléphone a une session sur le serveur du VPS. */
    possible,

    /** Solde et historique (du plus récent au plus ancien). */
    async soldeEtHistorique(limit = 30) {
      const res = await appel(`/points?limit=${encodeURIComponent(Math.floor(Number(limit)) || 30)}`, { method: "GET" });
      return { balance: Number(res.balance) || 0, history: Array.isArray(res.history) ? res.history : [] };
    },

    /**
     * Gain (AWARD) ou dépense (DEDUCT). Le montant d'un gain est fixé par le serveur.
     * @returns {Promise<{balance: number, delta: number, idempotent: boolean}>}
     */
    async mouvement({ action, reason, amount, metadata }) {
      const body = { action, reason, amount: Math.floor(Number(amount) || 0) };
      if (metadata && typeof metadata === "object") body.metadata = metadata;
      const res = await appel("/points/transact", { method: "POST", body });
      return { balance: Number(res.balance) || 0, delta: Number(res.delta) || 0, idempotent: Boolean(res.idempotent) };
    },

    /** Classement : les 10 meilleurs pilotes (pseudo et points gagnés). */
    async classement() {
      const res = await appel("/leaderboard", { method: "GET" });
      return Array.isArray(res.top) ? res.top : [];
    },

    /**
     * Signalement d'un danger sur le serveur (preuve des 25 points).
     * @returns {Promise<{hazardId: string}>}
     */
    async signalerDanger({ type, lat, lng, description }) {
      const body = { type: typeDangerServeur(type), lat: Number(lat), lng: Number(lng) };
      if (description) body.description = String(description).slice(0, 500);
      const res = await appel("/hazards", { method: "POST", body });
      return { hazardId: res.hazardId };
    },
  };
}
