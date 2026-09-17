/**
 * store.js - State Manager (Redux-lite)
 * Centralise l'état de l'application pour un flux de données unidirectionnel.
 */

const Store = (function () {
  // État initial
  let state = {
    xp: 0,
    bvcPoints: 0,
    ghostMode: false,
    bleConnected: false,
    gpsActive: false
  };

  // Liste des abonnés (listeners)
  const listeners = [];

  /**
   * Retourne une copie de l'état actuel pour garantir l'immuabilité
   */
  function getState() {
    return Object.freeze({ ...state });
  }

  /**
   * S'abonner aux changements d'état
   * @param {Function} listener Callback appelé à chaque mutation
   * @returns {Function} Fonction pour se désabonner
   */
  function subscribe(listener) {
    listeners.push(listener);
    return function unsubscribe() {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Déclenche une mutation de l'état
   * @param {string} actionType Type de l'action
   * @param {Object} payload Données associées
   */
  function dispatch(actionType, payload = {}) {
    console.log(`[Store] Action dispatched: ${actionType}`, payload);
    const prevState = { ...state };

    switch (actionType) {
      case 'SET_XP':
        state.xp = payload.xp;
        break;
      case 'SET_BVC_POINTS':
        state.bvcPoints = payload.points;
        break;
      case 'TOGGLE_GHOST_MODE':
        state.ghostMode = !state.ghostMode;
        break;
      case 'SET_BLE_CONNECTION':
        state.bleConnected = payload.connected;
        break;
      case 'SET_GPS_ACTIVE':
        state.gpsActive = payload.active;
        break;
      default:
        console.warn(`[Store] Unhandled action type: ${actionType}`);
        return; // Ne pas notifier si l'action n'existe pas
    }

    // Notifier tous les abonnés du changement
    listeners.forEach(listener => listener(getState(), prevState));
  }

  return {
    getState,
    subscribe,
    dispatch
  };
})();

// Exposer globalement
window.Mon50ccStore = Store;
