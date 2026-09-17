/**
 * event-manager.js - Garbage Collector pour Vanilla JS
 * Traque les écouteurs d'événements attachés à un écran donné pour pouvoir
 * les détruire proprement lors du démontage de l'écran (évite les memory leaks).
 */

const EventManager = (function () {
  // Registre des événements: { screenId: [{ element, type, handler, options }] }
  const registry = {};

  /**
   * Ajoute un écouteur d'événement et le trace dans le registre.
   * @param {string} screenId Identifiant de l'écran courant
   * @param {Element|Window|Document} element Élément DOM
   * @param {string} type Type d'événement ('click', 'input', etc.)
   * @param {Function} handler Callback
   * @param {boolean|Object} options Options addEventListener (optionnel)
   */
  function addListener(screenId, element, type, handler, options = false) {
    if (!element) {
      console.warn(`[EventManager] Impossible d'attacher l'événement '${type}' (élément null) sur l'écran '${screenId}'`);
      return;
    }

    if (!registry[screenId]) {
      registry[screenId] = [];
    }

    element.addEventListener(type, handler, options);
    
    registry[screenId].push({
      element,
      type,
      handler,
      options
    });
  }

  /**
   * Nettoie (Garbage Collect) tous les écouteurs attachés à un écran spécifique.
   * Doit être appelé lors de la fermeture de l'écran.
   * @param {string} screenId Identifiant de l'écran à nettoyer
   */
  function gc(screenId) {
    if (!registry[screenId]) {
      return; // Rien à nettoyer pour cet écran
    }

    const listeners = registry[screenId];
    let removedCount = 0;

    listeners.forEach(({ element, type, handler, options }) => {
      try {
        element.removeEventListener(type, handler, options);
        removedCount++;
      } catch (e) {
        console.warn(`[EventManager] Erreur lors de la suppression de l'événement '${type}'`, e);
      }
    });

    // Vider le registre pour cet écran
    delete registry[screenId];
    
    if (removedCount > 0) {
      console.log(`[EventManager] Garbage Collector: ${removedCount} événement(s) nettoyé(s) pour l'écran '${screenId}'`);
    }
  }

  return {
    addListener,
    gc
  };
})();

// Exposer globalement
window.Mon50ccEventManager = EventManager;
