/**
 * Session de l'appli sur le serveur souverain (OVHcloud) — 16/11/2026, comptes le 18/11/2026.
 *
 * Deux usages :
 * - Interrupteur des comptes sur "FIREBASE" (aujourd'hui) : à la connexion par mot de passe, l'appli se
 *   connecte AUSSI au serveur souverain, en parallèle, pour garder un « jeton SOS » (30 jours) qui
 *   n'ouvre QUE l'alerte SOS. Il est renouvelé une fois par jour d'utilisation. Serveur injoignable ou
 *   compte absent : rien ne change, l'alerte SOS dit honnêtement que l'envoi automatique n'est pas en
 *   service et propose le 112 (sos-alert.js).
 * - Interrupteur sur "SOVEREIGN" : le serveur souverain EST la connexion (comptes-core.js). La session
 *   (jeton d'une heure + jeton de renouvellement de 30 jours) est gardée ici pour les pages suivantes.
 *
 * Dans les deux cas, la session souveraine est gardée : à la bascule, les pilotes déjà connectés n'ont
 * rien à retaper. Le mot de passe n'est jamais gardé.
 *
 * Aucun import : testé directement (tests/sovereign-session.test.js). Branchement : sovereign.js.
 */

export const SOS_TOKEN_KEY = "sovereign_sos_token";
export const SESSION_KEY = "sovereign_session";
const RENEW_AFTER_MS = 24 * 3600 * 1000;
const CONNECT_TIMEOUT_MS = 4000;

/**
 * Dates d'émission et d'expiration d'un jeton (en ms), ou null s'il est illisible.
 * Aucune vérification de signature ici : c'est le serveur qui juge le jeton.
 */
export function tokenTimes(token) {
  try {
    const part = String(token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(part + "=".repeat((4 - (part.length % 4)) % 4)));
    if (!Number.isFinite(claims.exp)) return null;
    return { iat: (Number(claims.iat) || 0) * 1000, exp: claims.exp * 1000 };
  } catch {
    return null;
  }
}

const sameEmail = (a, b) => Boolean(a && b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/**
 * @param {{client: object, storage: Storage|null, now?: () => number, connectTimeoutMs?: number}} deps
 *   client : un SovereignClient (sovereign-core/client/sovereign-sdk.js)
 */
export function createSovereignSession({ client, storage, now = () => Date.now(), connectTimeoutMs = CONNECT_TIMEOUT_MS }) {
  function write(key, value) {
    try {
      if (value) storage.setItem(key, value);
      else storage.removeItem(key);
    } catch {
      /* stockage indisponible : la session reste en mémoire pour cette page */
    }
  }

  function save(token) {
    write(SOS_TOKEN_KEY, token);
  }

  /** Garde la session du compte (et le jeton SOS qu'elle vient de recevoir). */
  function persist() {
    const snapshot = typeof client.sessionSnapshot === "function" ? client.sessionSnapshot() : null;
    write(SESSION_KEY, snapshot ? JSON.stringify(snapshot) : null);
    if (client.sosToken) save(client.sosToken);
  }

  // Chaque changement (renouvellement d'une session expirée, déconnexion par le serveur) est gardé
  let watching = false;
  function watch() {
    if (watching || typeof client.onAuthStateChanged !== "function") return;
    watching = true;
    client.onAuthStateChanged(() => persist());
  }

  function storedSession() {
    try {
      return JSON.parse(storage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function clear() {
    client.signOut();
    write(SESSION_KEY, null);
    save(null);
  }

  return {
    client,

    /**
     * Au chargement d'une page : reprend la session du compte et le jeton SOS gardés s'ils sont encore
     * valables. Renvoie vrai si l'alerte SOS automatique est prête.
     */
    restore() {
      const snapshot = storedSession();
      if (snapshot && typeof client.restoreSession === "function" && !client.restoreSession(snapshot, now())) {
        write(SESSION_KEY, null); // session expirée : il faudra se reconnecter
      }
      watch();
      let token = null;
      try {
        token = storage.getItem(SOS_TOKEN_KEY);
      } catch {
        return false;
      }
      const times = token ? tokenTimes(token) : null;
      if (!times || times.exp <= now()) {
        if (token) save(null);
        return false;
      }
      client.sosToken = token;
      return true;
    },

    /** Renouvelle le jeton SOS s'il a plus d'un jour. Réseau en panne : on garde l'ancien. */
    async renewIfDue() {
      const times = client.sosToken ? tokenTimes(client.sosToken) : null;
      if (!times || now() - times.iat < RENEW_AFTER_MS) return false;
      try {
        save(await client.renewSosToken());
        return true;
      } catch (e) {
        if (e && e.status === 401) {
          // Compte supprimé ou jeton refusé : il faudra se reconnecter
          client.sosToken = null;
          save(null);
        }
        return false;
      }
    },

    /**
     * Comptes sur "FIREBASE" : connexion au serveur souverain juste après celle de Firebase, avec le
     * même mot de passe. Ne bloque jamais la connexion à l'appli : abandon au bout de quelques secondes.
     */
    async connect(email, password) {
      // Autre compte que celui gardé : on oublie l'ancien AVANT d'essayer. Sinon, serveur injoignable,
      // une alerte SOS partirait au nom du pilote précédent.
      const previous = storedSession();
      if (!previous || !sameEmail(previous.user && previous.user.email, email)) clear();
      watch();
      let timer;
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), connectTimeoutMs);
      });
      const attempt = client.signInWithEmailAndPassword(email, password).then(() => {
        persist();
        return Boolean(client.sosToken);
      });
      try {
        return await Promise.race([attempt, timeout]);
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    },

    /** Comptes sur "SOVEREIGN" : la connexion elle-même. Les erreurs (401, 429, réseau) remontent. */
    async signIn(email, password) {
      clear();
      watch();
      const user = await client.signInWithEmailAndPassword(email, password);
      persist();
      return user;
    },

    /** Comptes sur "SOVEREIGN" : création du compte. Les erreurs (409 pseudo pris…) remontent. */
    async register(email, username, password) {
      clear();
      watch();
      const user = await client.register(email, username, password);
      persist();
      return user;
    },

    /** Vrai si un compte est connecté au serveur souverain sur ce téléphone. */
    hasAccount() {
      return typeof client.hasSession === "function" && client.hasSession(now());
    },

    /** Déconnexion : plus de session ni de jeton SOS sur ce téléphone. */
    forget() {
      clear();
    },

    /** Vrai si l'alerte SOS automatique peut partir depuis ce téléphone. */
    isReady() {
      const times = client.sosToken ? tokenTimes(client.sosToken) : null;
      return Boolean(times && times.exp > now());
    },
  };
}
