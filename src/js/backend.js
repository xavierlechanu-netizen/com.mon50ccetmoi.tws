/**
 * Branchement de l'interrupteur CONFIG.BACKEND_MODE (logique et mode d'emploi : backend-mode.js).
 * backendMode("comptes") → "FIREBASE" ou "SOVEREIGN".
 */
import { CONFIG } from './config.js';
import { backendModeFor, readBackendTrial } from './backend-mode.js';

function localStore() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const trial = typeof window !== 'undefined' ? readBackendTrial(localStore(), window.location.search) : null;
if (trial) console.info('[Backend] Essai du serveur souverain sur ce téléphone :', Object.keys(trial).join(', '));

/** Serveur qui sert ce domaine ("comptes", "dangers", "points", "paiements"). */
export function backendMode(domaine) {
  return backendModeFor(domaine, { setting: CONFIG.BACKEND_MODE, trial });
}

if (typeof window !== 'undefined') window.backendMode = backendMode;
