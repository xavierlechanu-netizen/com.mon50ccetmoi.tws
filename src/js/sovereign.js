/**
 * Branchement de l'appli sur le serveur souverain (OVHcloud), interrupteur CONFIG.SOVEREIGN.ACTIF.
 * Aujourd'hui : l'alerte SOS automatique (SMS aux anges gardiens). Logique : sovereign-session.js.
 */
import { SovereignClient } from '../../sovereign-core/client/sovereign-sdk.js';
import { CONFIG } from './config.js';
import { createSovereignSession, SOS_TOKEN_KEY } from './sovereign-session.js';

function localStore() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const conf = CONFIG.SOVEREIGN || {};

export const sovereignSession = conf.ACTIF && typeof window !== 'undefined'
  ? createSovereignSession({ client: new SovereignClient({ apiBaseUrl: conf.API_URL }), storage: localStore() })
  : null;

if (sovereignSession) {
  // Lu par sos-alert.js au moment de l'alerte
  window.sovereignClient = sovereignSession.client;
  if (sovereignSession.restore()) sovereignSession.renewIfDue();
}

/** Après la connexion Firebase réussie (auth.js). Renvoie vrai si l'alerte SOS automatique est prête. */
export async function connectSovereign(email, password) {
  return sovereignSession ? sovereignSession.connect(email, password) : false;
}

/** À la déconnexion (auth.js). */
export function forgetSovereign() {
  if (sovereignSession) sovereignSession.forget();
  try {
    window.localStorage.removeItem(SOS_TOKEN_KEY);
  } catch {
    /* rien à effacer */
  }
}

/** Vrai si ce téléphone peut envoyer l'alerte SOS automatique. */
export function isSovereignSosReady() {
  return Boolean(sovereignSession && sovereignSession.isReady());
}
