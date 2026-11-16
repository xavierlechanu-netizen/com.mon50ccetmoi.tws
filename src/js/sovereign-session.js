/**
 * Session de l'appli sur le serveur souverain (OVHcloud) — 16/11/2026.
 * Pour l'instant, elle ne sert qu'à l'alerte SOS automatique (SMS aux anges gardiens).
 *
 * À la connexion par mot de passe, l'appli se connecte aussi au serveur souverain et garde un
 * « jeton SOS » (30 jours) qui n'ouvre QUE l'alerte SOS. Il est renouvelé une fois par jour
 * d'utilisation. Le mot de passe n'est jamais gardé.
 * Serveur injoignable ou compte absent : rien ne change, l'alerte SOS dit honnêtement que l'envoi
 * automatique n'est pas en service et propose le 112 (sos-alert.js).
 *
 * Aucun import : testé directement (tests/sovereign-session.test.js). Branchement : sovereign.js.
 */

export const SOS_TOKEN_KEY = "sovereign_sos_token";
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

/**
 * @param {{client: object, storage: Storage|null, now?: () => number, connectTimeoutMs?: number}} deps
 *   client : un SovereignClient (sovereign-core/client/sovereign-sdk.js)
 */
export function createSovereignSession({ client, storage, now = () => Date.now(), connectTimeoutMs = CONNECT_TIMEOUT_MS }) {
  function save(token) {
    try {
      if (token) storage.setItem(SOS_TOKEN_KEY, token);
      else storage.removeItem(SOS_TOKEN_KEY);
    } catch {
      /* stockage indisponible : le jeton reste en mémoire pour cette page */
    }
  }

  return {
    client,

    /** Au chargement d'une page : reprend le jeton SOS gardé s'il est encore valable. */
    restore() {
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

    /** Renouvelle le jeton s'il a plus d'un jour. Réseau en panne : on garde l'ancien. */
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
     * Connexion au serveur souverain juste après celle de Firebase, avec le même mot de passe.
     * Ne bloque jamais la connexion à l'appli : abandon au bout de quelques secondes.
     */
    async connect(email, password) {
      let timer;
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), connectTimeoutMs);
      });
      const attempt = client.signInWithEmailAndPassword(email, password).then(() => {
        save(client.sosToken);
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

    /** Déconnexion : plus de jeton SOS sur ce téléphone. */
    forget() {
      client.signOut();
      save(null);
    },

    /** Vrai si l'alerte SOS automatique peut partir depuis ce téléphone. */
    isReady() {
      const times = client.sosToken ? tokenTimes(client.sosToken) : null;
      return Boolean(times && times.exp > now());
    },
  };
}
