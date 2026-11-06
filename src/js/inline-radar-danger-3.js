import { registerAction } from './actionRegistry.js';
import { installSovereignMaps } from './gmaps-compat.js';

// Carte souveraine (Leaflet + IGN) : aucun script Google, aucun consentement cookie requis.
function loadSovereignMap() {
  try {
    installSovereignMaps();
    if (typeof window.initMap === 'function') window.initMap();
  } catch (e) {
    console.error('Radar : carte indisponible', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadSovereignMap);
} else {
  loadSovereignMap();
}

// --- Action Registry (ESM) ---
registerAction('loadGoogleMaps', loadSovereignMap);
registerAction('loadSovereignMap', loadSovereignMap);
