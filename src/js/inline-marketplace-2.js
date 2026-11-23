import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

function setVoiceMode(mode) {
        localStorage.setItem("nexus-atlasVoiceMode", mode);
        alert(`Skin Vocal [${mode}] activé avec succès.`);
      }

// --- Action Registry (ESM) ---
registerAction('setVoiceMode', setVoiceMode);
