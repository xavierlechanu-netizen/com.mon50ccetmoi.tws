/**
 * Branchement de l'appli sur le serveur souverain (OVHcloud), interrupteur CONFIG.SOVEREIGN.ACTIF.
 * Comptes sur "FIREBASE" : l'alerte SOS automatique (SMS aux anges gardiens).
 * Comptes sur "SOVEREIGN" (CONFIG.BACKEND_MODE) : la connexion elle-même (comptes.js).
 * Logique : sovereign-session.js.
 */
import { SovereignClient } from '../../sovereign-core/client/sovereign-sdk.js';
import { CONFIG } from './config.js';
import { backendMode } from './backend.js';
import { createSovereignSession, SOS_TOKEN_KEY, SESSION_KEY } from './sovereign-session.js';

function localStore() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const conf = CONFIG.SOVEREIGN || {};
const needed = conf.ACTIF || backendMode('comptes') === 'SOVEREIGN';

export const sovereignSession = needed && typeof window !== 'undefined'
  ? createSovereignSession({ client: new SovereignClient({ apiBaseUrl: conf.API_URL }), storage: localStore() })
  : null;

if (sovereignSession) {
  // Lu par sos-alert.js au moment de l'alerte
  window.sovereignClient = sovereignSession.client;
  if (sovereignSession.restore()) sovereignSession.renewIfDue();
}

/** Après la connexion Firebase réussie (comptes sur "FIREBASE"). Renvoie vrai si l'alerte SOS automatique est prête. */
export async function connectSovereign(email, password) {
  return sovereignSession ? sovereignSession.connect(email, password) : false;
}

/** À la déconnexion. */
export function forgetSovereign() {
  if (sovereignSession) sovereignSession.forget();
  try {
    window.localStorage.removeItem(SOS_TOKEN_KEY);
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* rien à effacer */
  }
}

/** Vrai si ce téléphone peut envoyer l'alerte SOS automatique. */
export function isSovereignSosReady() {
  return Boolean(sovereignSession && sovereignSession.isReady());
}
