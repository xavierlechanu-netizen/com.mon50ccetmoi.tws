/**
 * screen-manager.js — Chargeur lazy d'écrans HTML partiels
 * Remplace les 17+ <div> cachés dans app.html par un chargement à la demande.
 * 
 * Usage : ScreenManager.open('insurer-portal')
 *         ScreenManager.close()
 * 
 * Sécurité (OWASP ASVS v5.0.0-1.3.1) : le HTML chargé est sanitisé via DOMPurify.
 */

const ScreenManager = {
  cache: {},
  containerEl: null,
  activeScreenId: null,

  /**
   * Obtenir ou créer le conteneur d'écrans
   */
  getContainer() {
    if (!this.containerEl) {
      this.containerEl = document.getElementById('screen-container');
      if (!this.containerEl) {
        this.containerEl = document.createElement('div');
        this.containerEl.id = 'screen-container';
        this.containerEl.className = 'hidden fullscreen-overlay';
        this.containerEl.style.cssText =
          'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:35000;overflow-y:auto;background:#000;';
        document.body.appendChild(this.containerEl);
      }
    }
    return this.containerEl;
  },

  /**
   * Ouvrir un écran par son identifiant
   * @param {string} screenId — Correspond au nom du fichier dans /screens/ (sans .html)
   */
  async open(screenId) {
    // Si un autre écran est déjà ouvert, on le ferme d'abord proprement
    if (this.activeScreenId && this.activeScreenId !== screenId) {
      this.close();
    }
    
    this.activeScreenId = screenId;
    const container = this.getContainer();

    // Afficher un loader
    container.classList.remove('hidden');
    container.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#fff;">' +
      '<i class="fa-solid fa-circle-notch fa-spin" style="font-size:2rem;margin-right:10px;"></i> Chargement...</div>';

    try {
      if (!this.cache[screenId]) {
        const resp = await fetch(`/screens/${screenId}.html`);
        if (!resp.ok) throw new Error(`Screen "${screenId}" not found (${resp.status})`);
        this.cache[screenId] = await resp.text();
      }

      // Sécurité XSS : Sanitizer le HTML chargé (ASVS v5.0.0-1.3.1)
      const safeHtml =
        typeof DOMPurify !== 'undefined'
          ? DOMPurify.sanitize(this.cache[screenId], {
              ADD_TAGS: ['input', 'select', 'textarea', 'button', 'form', 'canvas', 'video'],
              ADD_ATTR: ['onclick', 'onchange', 'onkeypress', 'onsubmit', 'oninput', 'aria-label', 'role', 'placeholder', 'type', 'id', 'for'],
              ALLOW_DATA_ATTR: true,
            })
          : this.cache[screenId];

      container.innerHTML = safeHtml;

      // Injecter un bouton de fermeture si absent
      if (!container.querySelector('[data-screen-close]')) {
        const closeBtn = document.createElement('button');
        closeBtn.setAttribute('data-screen-close', 'true');
        closeBtn.setAttribute('aria-label', 'Fermer');
        closeBtn.style.cssText =
          'position:fixed;top:20px;right:20px;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;z-index:99999;';
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.onclick = () => this.close();
        container.prepend(closeBtn);
      }
    } catch (err) {
      console.error('[ScreenManager]', err);
      container.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#ff4d4d;flex-direction:column;">' +
        '<i class="fa-solid fa-triangle-exclamation" style="font-size:3rem;margin-bottom:15px;"></i>' +
        '<p>Erreur de chargement de l\'écran.</p>' +
        '<button onclick="ScreenManager.close()" style="margin-top:15px;padding:10px 20px;background:#333;color:#fff;border:none;border-radius:10px;cursor:pointer;">Fermer</button></div>';
    }
  },

  /**
   * Fermer l'écran actif
   */
  close() {
    const container = this.getContainer();
    
    // Garbage Collector : Purger les écouteurs d'événements liés à cet écran
    if (this.activeScreenId && typeof window.Mon50ccEventManager !== 'undefined') {
      window.Mon50ccEventManager.gc(this.activeScreenId);
    }

    this.activeScreenId = null;
    container.classList.add('hidden');
    container.innerHTML = '';
  },

  /**
   * Précharger un écran en arrière-plan (optionnel)
   * @param {string} screenId
   */
  async preload(screenId) {
    if (this.cache[screenId]) return;
    try {
      const resp = await fetch(`/screens/${screenId}.html`);
      if (resp.ok) this.cache[screenId] = await resp.text();
    } catch (e) {
      /* Silencieux — le chargement réel réessaiera */
    }
  },
};

// Exposer globalement pour les onclick des boutons du dock
window.ScreenManager = ScreenManager;
