/**
 * Comptes de l'appli : connexion, inscription, déconnexion et « qui est connecté », selon
 * l'interrupteur CONFIG.BACKEND_MODE.comptes (backend-mode.js) — phase A, 18/11/2026.
 *
 * "FIREBASE" (par défaut) : exactement comme avant. Firebase Auth fait la connexion ; le serveur
 * souverain est joint en parallèle pour le jeton de l'alerte SOS (sovereign-session.js).
 *
 * "SOVEREIGN" : le serveur souverain (api.mon50ccetmoi.com) est SEUL juge du mot de passe et de la
 * session. Mais tant que les données (profil, points, dangers…) sont encore dans Firestore, il faut
 * aussi une session Firebase pour les lire : c'est le « pont Firebase », ouvert avec le même email et le
 * même mot de passe (les comptes importés ont le même mot de passe des deux côtés). Si le pont échoue,
 * le pilote reste connecté (session souveraine) avec un profil réduit. Le pont est coupé (pontFirebase
 * à false) quand plus rien ne lit Firestore.
 *
 * Qui est connecté (onAuthChange) en "SOVEREIGN" : personne sans session souveraine, même si Firebase
 * en a une. Avec une session souveraine : l'utilisateur Firebase du pont s'il s'agit du même email (le
 * code qui lit Firestore continue de marcher tel quel), sinon un utilisateur réduit (sovereignUser).
 *
 * Aucun import : testé directement (tests/comptes.test.js). Branchement : comptes.js.
 */

export const COMPTES_MODES = ["FIREBASE", "SOVEREIGN"];
// Mot de passe : 8 caractères au moins sur le serveur souverain (Firebase en acceptait 6)
export const SOVEREIGN_PASSWORD_MIN = 8;
const BRIDGE_TIMEOUT_MS = 8000;

const sameEmail = (a, b) => Boolean(a && b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function comptesError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * Message à montrer au pilote pour une erreur de connexion ou d'inscription (Firebase ou souveraine).
 * @param {any} error
 */
export function comptesErrorMessage(error) {
  const code = error && error.code;
  const status = error && error.status;
  if (code === "comptes/mot-de-passe-court") return error.message;
  if (code === "comptes/connexion-google-indisponible") return error.message;
  if (status === 401 || code === "auth/invalid-credential" || code === "auth/wrong-password" ||
      code === "auth/user-not-found" || code === "auth/invalid-login-credentials") {
    return "Pseudo, e-mail ou mot de passe incorrect.";
  }
  if (status === 409 || code === "auth/email-already-in-use") return "Ce pseudo est déjà utilisé. Choisissez-en un autre.";
  if (status === 429 || code === "auth/too-many-requests") return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (status === 403 || code === "auth/user-disabled") return "Ce compte est suspendu. Écrivez à contact@mon50ccetmoi.com.";
  if (status === 400 && error.message) return error.message;
  if (code === "auth/network-request-failed" || (error instanceof TypeError) || (status >= 500)) {
    return "Serveur de connexion injoignable. Vérifiez votre réseau et réessayez dans un instant.";
  }
  return (error && error.message) || "Connexion impossible. Réessayez.";
}

/**
 * @param {{
 *   mode: "FIREBASE"|"SOVEREIGN",
 *   firebaseAuth: object,            // firebase.auth() (version compat)
 *   sovereign: object|null,          // createSovereignSession(...) (sovereign-session.js)
 *   pontFirebase?: boolean,          // session Firebase en plus, tant que les données sont dans Firestore
 *   bridgeTimeoutMs?: number,
 *   now?: () => number,
 *   log?: {warn: Function},
 * }} deps
 */
export function createComptes({ mode, firebaseAuth, sovereign, pontFirebase = true, bridgeTimeoutMs = BRIDGE_TIMEOUT_MS,
  now = () => Date.now(), log = console }) {
  const souverain = mode === "SOVEREIGN";
  if (souverain && !(sovereign && sovereign.client)) {
    throw new Error("Comptes sur SOVEREIGN : le serveur souverain n'est pas branché (CONFIG.SOVEREIGN).");
  }
  const client = sovereign ? sovereign.client : null;

  function withTimeout(promise) {
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), bridgeTimeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  /** Pont Firebase : connexion avec les mêmes identifiants. Jamais d'erreur : null si impossible. */
  async function bridgeSignIn(email, password) {
    if (!pontFirebase || !firebaseAuth) return null;
    try {
      const cred = await withTimeout(firebaseAuth.signInWithEmailAndPassword(email, password));
      return cred && cred.user ? cred.user : null;
    } catch (e) {
      log.warn("[Comptes] Pont Firebase indisponible (connexion) :", e && (e.code || e.message));
      return null;
    }
  }

  /** Pont Firebase à l'inscription : crée le compte Firebase, ou s'y connecte s'il existe déjà. */
  async function bridgeCreate(email, password) {
    if (!pontFirebase || !firebaseAuth) return null;
    try {
      const cred = await withTimeout(firebaseAuth.createUserWithEmailAndPassword(email, password));
      return cred && cred.user ? cred.user : null;
    } catch (e) {
      if (e && e.code === "auth/email-already-in-use") return bridgeSignIn(email, password);
      log.warn("[Comptes] Pont Firebase indisponible (inscription) :", e && (e.code || e.message));
      return null;
    }
  }

  // Utilisateur réduit (sans pont Firebase) : mêmes noms de champs qu'un utilisateur Firebase
  let shim = null;
  function sovereignUser(compte) {
    if (shim && shim.uid === compte.uid && shim.displayName === compte.username) return shim;
    shim = {
      uid: compte.uid,
      sovereignUid: compte.uid,
      isSovereign: true,
      email: compte.email || null,
      displayName: compte.username || null,
      photoURL: null,
      role: compte.role || "user",
      getIdToken: () => client.getIdToken(),
      getIdTokenResult: async () => ({ token: await client.getIdToken(), claims: { role: compte.role || "user" } }),
    };
    return shim;
  }

  /** En "SOVEREIGN" : l'utilisateur vu par l'appli, d'après la session souveraine et le pont. */
  function effectiveUser(firebaseUser) {
    if (!sovereign.hasAccount()) return null;
    const compte = client.currentUser;
    if (firebaseUser && sameEmail(firebaseUser.email, compte.email)) return firebaseUser;
    return sovereignUser(compte);
  }

  return {
    mode: souverain ? "SOVEREIGN" : "FIREBASE",
    pontFirebase: souverain ? Boolean(pontFirebase) : true,

    /**
     * Connexion par email et mot de passe.
     * @returns {Promise<{firebaseUser: object|null, compte: object|null, sovereignReady: Promise<boolean>}>}
     *   compte : le compte du serveur souverain (mode "SOVEREIGN") ;
     *   sovereignReady : vrai quand l'alerte SOS automatique est prête (à attendre avant de changer de page).
     */
    async seConnecter(email, password) {
      if (!souverain) {
        const cred = await firebaseAuth.signInWithEmailAndPassword(email, password);
        const sovereignReady = sovereign ? sovereign.connect(email, password) : Promise.resolve(false);
        return { firebaseUser: (cred && cred.user) || null, compte: null, sovereignReady };
      }
      const compte = await sovereign.signIn(email, password);
      const bridged = await bridgeSignIn(email, password);
      const firebaseUser = bridged && sameEmail(bridged.email, compte.email) ? bridged : null;
      return { firebaseUser, compte, sovereignReady: Promise.resolve(sovereign.isReady()) };
    },

    /**
     * Inscription. Le profil Firestore (pseudo réservé) reste créé par auth.js avec firebaseUser.
     * @param {{email: string, username: string, password: string}} infos
     */
    async creerCompte({ email, username, password }) {
      if (!souverain) {
        const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
        return { firebaseUser: (cred && cred.user) || null, compte: null };
      }
      if (String(password || "").length < SOVEREIGN_PASSWORD_MIN) {
        throw comptesError("comptes/mot-de-passe-court",
          `Mot de passe trop court : ${SOVEREIGN_PASSWORD_MIN} caractères au moins.`);
      }
      const compte = await sovereign.register(email, username, password);
      const bridged = await bridgeCreate(email, password);
      const firebaseUser = bridged && sameEmail(bridged.email, compte.email) ? bridged : null;
      return { firebaseUser, compte };
    },

    /**
     * Inscription à annuler (pseudo refusé par Firestore) : le compte tout juste créé est supprimé des
     * deux côtés, pour que la personne puisse réessayer avec un autre pseudo.
     */
    async annulerInscription(firebaseUser) {
      if (firebaseUser && typeof firebaseUser.delete === "function") await firebaseUser.delete().catch(() => {});
      if (souverain) {
        // Effacement RGPD : libère l'email et le pseudo (le compte est anonymisé sur le serveur)
        await client.deleteMyAccountRgpd().catch((e) => log.warn("[Comptes] Annulation souveraine :", e && e.message));
        sovereign.forget();
      }
    },

    /** Déconnexion de ce téléphone (Firebase, pont compris, et serveur souverain). */
    async seDeconnecter() {
      try {
        if (firebaseAuth) await firebaseAuth.signOut();
      } catch {
        /* déjà déconnecté */
      }
      if (sovereign) sovereign.forget();
    },

    /**
     * Remplace firebase.auth().onAuthStateChanged : même usage, mêmes appels (une fois au démarrage,
     * puis à chaque changement). Renvoie la fonction de désabonnement.
     */
    onAuthChange(callback) {
      if (!souverain) return firebaseAuth.onAuthStateChanged(callback);
      let firebaseUser = null;
      let firebaseKnown = !pontFirebase || !firebaseAuth;
      let last;
      const emit = () => {
        if (!firebaseKnown) return; // on attend que Firebase ait retrouvé sa session (pont)
        const user = effectiveUser(firebaseUser);
        if (user === last) return;
        last = user;
        callback(user);
      };
      const offFirebase = pontFirebase && firebaseAuth
        ? firebaseAuth.onAuthStateChanged((u) => { firebaseUser = u; firebaseKnown = true; emit(); })
        : () => {};
      const offSovereign = client.onAuthStateChanged(() => emit());
      emit();
      return () => {
        offFirebase();
        offSovereign();
      };
    },

    /** Utilisateur connecté maintenant (comme firebase.auth().currentUser), ou null. */
    utilisateurActuel() {
      if (!souverain) return firebaseAuth.currentUser;
      return effectiveUser(pontFirebase && firebaseAuth ? firebaseAuth.currentUser : null);
    },

    /** Compte du serveur souverain (uid, pseudo, rôle…), ou null. */
    compteSouverain() {
      return client && sovereign.hasAccount() ? { ...client.currentUser } : null;
    },

    /** Jeton de session du serveur souverain (renouvelé si besoin), pour ses routes (dangers, points…). */
    async jetonSouverain() {
      if (!client) throw comptesError("comptes/sans-serveur", "Serveur souverain non branché.");
      return client.getIdToken(now());
    },
  };
}
