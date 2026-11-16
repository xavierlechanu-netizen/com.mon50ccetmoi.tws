import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

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
  rootObserver: null,

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
    // eslint-disable-next-line no-restricted-syntax
container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#fff;">' +
      '<i class="fa-solid fa-circle-notch fa-spin" style="font-size:2rem;margin-right:10px;"></i> Chargement...</div>';

    try {
      if (!this.cache[screenId]) {
        const resp = await fetch(`/screens/${screenId}.html`);
        if (!resp.ok) throw new Error(`Screen "${screenId}" not found (${resp.status})`);
        this.cache[screenId] = await resp.text();
      }

      // Sécurité XSS & Event Delegation (ASVS v5.0.0-1.3.1 / v5.0.0-3.2.2)
      if (typeof DOMPurify === 'undefined') {
        console.error('[ScreenManager] DOMPurify non chargé — injection HTML refusée (ASVS v5.0.0-1.3.1)');
        container.textContent = 'Erreur de sécurité : module de sanitization manquant.';
        return;
      }

      // Convertir les onclick inline en data-action pour compatibilité Event Delegator
      let rawContent = this.cache[screenId] || '';
      rawContent = rawContent.replace(/\bonclick\s*=\s*(['"])(.*?)\1/gi, (match, quote, code) => {
        return `data-action="${code.replace(/"/g, '&quot;')}"`;
      });

      const safeHtml = DOMPurify.sanitize(rawContent, {
        ADD_TAGS: ['input', 'select', 'textarea', 'button', 'form', 'canvas', 'video'],
        ADD_ATTR: ['aria-label', 'role', 'placeholder', 'type', 'id', 'for', 'data-action', 'data-id', 'data-value', 'data-screen-close'],
        ALLOW_DATA_ATTR: true,
      });

      // eslint-disable-next-line no-restricted-syntax
container.innerHTML = safeHtml;

      // Injecter un bouton de fermeture si absent
      if (!container.querySelector('[data-screen-close]')) {
        const closeBtn = document.createElement('button');
        closeBtn.setAttribute('data-screen-close', 'true');
        closeBtn.setAttribute('aria-label', 'Fermer');
        closeBtn.style.cssText =
          'position:fixed;top:20px;right:20px;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;z-index:99999;';
        // eslint-disable-next-line no-restricted-syntax
closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.onclick = () => this.close();
        container.prepend(closeBtn);
      }

      this.revealRoot(container, screenId);
    } catch (err) {
      console.error('[ScreenManager]', err);
      // eslint-disable-next-line no-restricted-syntax
container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#ff4d4d;flex-direction:column;">' +
        '<i class="fa-solid fa-triangle-exclamation" style="font-size:3rem;margin-bottom:15px;"></i>' +
        '<p>Erreur de chargement de l\'écran.</p>' +
        '<button data-action="ScreenManager.close()" style="margin-top:15px;padding:10px 20px;background:#333;color:#fff;border:none;border-radius:10px;cursor:pointer;">Fermer</button></div>';
    }
  },

  /**
   * Rendre visible la racine de l'écran chargé.
   * Chaque fichier de /screens/ commence par <div id="<screenId>" class="hidden ...">,
   * héritage de l'époque où ces blocs dormaient cachés dans app.html. Sans ce geste,
   * le conteneur s'affiche mais l'écran reste invisible (constaté le 16/11/2026).
   * Exception : une racine marquée data-screen-show="manual" reste cachée ; son propre
   * code l'affichera au bon moment (ex. écran de choc, montré seulement après une chute).
   * @returns {HTMLElement|null} la racine, ou null si le fichier n'en a pas
   */
  revealRoot(container, screenId) {
    const root = Array.prototype.find.call(container.children, (el) => el.id === screenId) || null;
    if (!root) return null;
    if (root.getAttribute('data-screen-show') !== 'manual') {
      root.classList.remove('hidden');
    }
    this.watchRoot(root, screenId);
    return root;
  },

  /**
   * Si l'écran se cache lui-même (bouton « Fermer » qui ajoute `hidden` ou met display:none
   * sur sa racine), fermer aussi le conteneur : sinon il reste un fond noir plein écran.
   */
  watchRoot(root, screenId) {
    this.stopWatchingRoot();
    if (typeof MutationObserver === 'undefined') return;
    const isVisible = () => !root.classList.contains('hidden') && root.style.display !== 'none';
    let wasVisible = isVisible();
    this.rootObserver = new MutationObserver(() => {
      if (this.activeScreenId !== screenId) return;
      const visible = isVisible();
      if (wasVisible && !visible) this.close();
      wasVisible = visible;
    });
    this.rootObserver.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
  },

  stopWatchingRoot() {
    if (this.rootObserver) {
      this.rootObserver.disconnect();
      this.rootObserver = null;
    }
  },

  /**
   * Fermer l'écran actif
   */
  close() {
    const container = this.getContainer();
    this.stopWatchingRoot();
    
    // Garbage Collector : Purger les écouteurs d'événements liés à cet écran
    if (this.activeScreenId && typeof window.Mon50ccEventManager !== 'undefined') {
      window.Mon50ccEventManager.gc(this.activeScreenId);
    }

    this.activeScreenId = null;
    container.classList.add('hidden');
    // eslint-disable-next-line no-restricted-syntax
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

registerAction('ScreenManager.open', (screenId) => ScreenManager.open(screenId));
registerAction('ScreenManager.close', () => ScreenManager.close());
registerAction('openScreen', (screenId) => ScreenManager.open(screenId));
registerAction('closeScreen', () => ScreenManager.close());
