/**
 * Branchement des comptes sur l'interrupteur CONFIG.BACKEND_MODE.comptes (logique : comptes-core.js).
 *
 *   import { comptes, onAuthChange } from './comptes.js';
 *   onAuthChange((user) => { ... });   // au lieu de firebase.auth().onAuthStateChanged
 *   await comptes.seConnecter(email, motDePasse);
 *   await comptes.seDeconnecter();
 */
import { CONFIG, auth } from './config.js';
import { backendMode } from './backend.js';
import { sovereignSession } from './sovereign.js';
import { createComptes, comptesErrorMessage } from './comptes-core.js';

export const comptes = createComptes({
  mode: backendMode('comptes'),
  firebaseAuth: auth,
  sovereign: sovereignSession,
  pontFirebase: CONFIG.PONT_FIREBASE !== false,
});

if (comptes.mode === 'SOVEREIGN') {
  console.info(`[Comptes] Connexion par le serveur souverain${comptes.pontFirebase ? ' (pont Firebase pour les données)' : ''}.`);
}

// Pont coupé : firebase.auth().currentUser devient le pilote du serveur souverain (mêmes champs :
// uid, displayName, getIdToken…) pour les écrans qui le lisent encore directement.
if (comptes.mode === 'SOVEREIGN' && !comptes.pontFirebase && auth) {
  Object.defineProperty(auth, 'currentUser', { configurable: true, get: () => comptes.utilisateurActuel() });
}

export const onAuthChange = (callback) => comptes.onAuthChange(callback);
export { comptesErrorMessage };

if (typeof window !== 'undefined') {
  window.comptes = comptes;
  window.onAuthChange = onAuthChange;
}
