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

/**
 * Collections Firestore en pause (24/11/2026) : les fonctions dont les collections sont vides
 * (équipes, territoires, troc, roadbooks, parrainage, carnet d'entretien…) passent en
 * « Bientôt disponible » au lieu d'être portées sur le serveur souverain. Liste : CONFIG
 * (config.js). Pour ces collections, aucune requête ne part vers Firestore :
 * les lectures rendent « rien », les écritures échouent avec le message ci-dessous.
 */
export const MESSAGE_BIENTOT_DISPONIBLE =
  "Bientôt disponible : cette fonction revient dès qu'elle sera installée sur nos serveurs en France.";

function resultatVide() {
  // Sert à la fois de document absent et de liste vide
  return { empty: true, size: 0, docs: [], exists: false, id: "", data: () => undefined, forEach() {}, docChanges: () => [] };
}

function referenceEnPause() {
  const refus = () => Promise.reject(new ServiceIndisponibleError(MESSAGE_BIENTOT_DISPONIBLE));
  const ref = {
    id: "",
    path: "",
    get: () => Promise.resolve(resultatVide()),
    onSnapshot(...args) {
      const suite = args.find((a) => typeof a === "function") || args.map((a) => a && a.next).find(Boolean);
      if (suite) Promise.resolve().then(() => suite(resultatVide()));
      return () => {};
    },
    add: refus,
    set: refus,
    update: refus,
    delete: refus,
  };
  for (const m of ["doc", "collection", "where", "orderBy", "limit", "limitToLast", "startAt", "startAfter", "endAt", "endBefore", "withConverter"]) {
    ref[m] = () => ref;
  }
  return ref;
}

/**
 * Met en pause des collections (et sous-collections, par leur nom) pour tout le SDK Firestore compat.
 * @param {object} firestoreNs  firebase.firestore (les classes Firestore et DocumentReference)
 * @param {string[]} collections
 */
export function installFirestorePause(firestoreNs, collections) {
  const enPause = new Set(collections || []);
  if (!firestoreNs || !enPause.size) return false;
  const filtrer = (proto, methode) => {
    if (!proto || typeof proto[methode] !== "function") return;
    const origine = proto[methode];
    proto[methode] = function (chemin, ...reste) {
      return enPause.has(String(chemin).split("/")[0]) ? referenceEnPause() : origine.call(this, chemin, ...reste);
    };
  };
  filtrer(firestoreNs.Firestore && firestoreNs.Firestore.prototype, "collection");
  filtrer(firestoreNs.Firestore && firestoreNs.Firestore.prototype, "collectionGroup");
  filtrer(firestoreNs.DocumentReference && firestoreNs.DocumentReference.prototype, "collection");
  return true;
}
