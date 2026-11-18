import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { comptes } from './comptes.js';

function logout() {
        // Firebase et serveur souverain : plus de session ni de jeton SOS sur ce téléphone
        comptes.seDeconnecter().then(() => {
          window.location.href = "login.html";
        });
      }

      // Host toggle visibility
      document.getElementById('host-toggle').addEventListener('change', function() {
        document.getElementById('host-settings').style.display = this.checked ? 'flex' : 'none';
      });
// --- Action Registry (ESM) ---
registerAction('logout', logout);
