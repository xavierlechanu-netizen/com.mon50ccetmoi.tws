import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { forgetSovereign } from './sovereign.js';

function logout() {
        forgetSovereign(); // plus de jeton de l'alerte SOS automatique sur ce téléphone
        if (window.auth) {
          window.auth.signOut().then(() => {
            window.location.href = "login.html";
          });
        }
      }

      // Host toggle visibility
      document.getElementById('host-toggle').addEventListener('change', function() {
        document.getElementById('host-settings').style.display = this.checked ? 'flex' : 'none';
      });
// --- Action Registry (ESM) ---
registerAction('logout', logout);
