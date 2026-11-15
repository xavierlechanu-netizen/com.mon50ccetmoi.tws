/**
 * Interrupteur des services serveur (15/11/2026).
 *
 * La facturation Google du projet Firebase est coupée : toutes les Cloud Functions répondent
 * « 500 » (paiements, météo, copilote, points, notes des garages…), en attendant le serveur
 * souverain OVHcloud. Plutôt que d'attendre une erreur technique (« internal », délai dépassé),
 * chaque appel échoue tout de suite avec un message clair, que les écrans affichent déjà
 * (ils montrent err.message).
 *
 * Remettre CONFIG.SERVICES_SERVEUR_ACTIFS à true (config.js) quand les services répondent à nouveau.
 */

export const MESSAGE_SERVICE_INDISPONIBLE =
  "Ce service est momentanément indisponible : nous déménageons nos serveurs en France. Réessayez dans quelques jours.";

export class ServiceIndisponibleError extends Error {
  constructor(message = MESSAGE_SERVICE_INDISPONIBLE) {
    super(message);
    this.name = "ServiceIndisponibleError";
    this.indisponible = true;
  }
}

/** Adresses des Cloud Functions (appel direct ou via Cloud Run). */
export const SERVEUR_FIREBASE = /\.cloudfunctions\.net\/|\.a\.run\.app/;

/**
 * Installe l'interrupteur. Sans effet si `actif` est vrai.
 * @param {{ win: Window, firebaseNs: object, actif: boolean }} cible
 */
export function installServiceGuard({ win, firebaseNs, actif }) {
  if (actif) return false;
  const refus = () => Promise.reject(new ServiceIndisponibleError());
  // firebase.functions("europe-west1").httpsCallable("…")(données)
  if (firebaseNs) {
    firebaseNs.functions = () => ({ httpsCallable: () => refus, useEmulator() {} });
  }
  // fetch direct vers les Cloud Functions (api-client.js, météo, copilote, Légifrance…)
  if (win && typeof win.fetch === "function") {
    const fetchOrigine = win.fetch.bind(win);
    win.fetch = (input, init) => {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      return SERVEUR_FIREBASE.test(url) ? refus() : fetchOrigine(input, init);
    };
  }
  return true;
}
