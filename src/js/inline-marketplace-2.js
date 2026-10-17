import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

function setVoiceMode(mode) {
        localStorage.setItem("nexus-atlasVoiceMode", mode);
        alert(`Skin Vocal [${mode}] activé avec succès.`);
      }

      function buyVoiceMode(mode, cost) {
        let currentBVC = parseInt(localStorage.getItem("bvc_points")) || 0;
        if (currentBVC >= cost) {
          currentBVC -= cost;
          localStorage.setItem("bvc_points", currentBVC);
          const el = document.getElementById("user-bvc-balance");
          if (el) el.textContent = `${currentBVC.toLocaleString("fr-FR")} mon50cc`;
          setVoiceMode(mode);
        } else {
          alert(`Fonds insuffisants. Il vous manque ${cost - currentBVC} points mon50cc pour débloquer cette voix.`);
        }
      }
// --- Action Registry (ESM) ---
registerAction('setVoiceMode', setVoiceMode);
