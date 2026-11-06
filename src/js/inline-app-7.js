import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

// Binding UI pour la Boîte Noire
      document.addEventListener('DOMContentLoaded', () => {
        if (!window.BlackBox) return;

        window.BlackBox.onConnectionChange = (connected) => {
          const btn = document.getElementById('bb-connect-btn');
          const exportBtn = document.getElementById('bb-export-btn');
          if (connected) {
            // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = '<i class="fa-solid fa-unlink"></i> Déconnecter';
            btn.style.background = 'linear-gradient(135deg, #555, #333)';
            btn.onclick = () => window.BlackBox.disconnect();
            exportBtn.style.display = 'block';
          } else {
            // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = '<i class="fa-brands fa-bluetooth"></i> Connecter';
            btn.style.background = 'linear-gradient(135deg, #ff3333, #aa0000)';
            btn.onclick = () => window.BlackBox.connect();
            exportBtn.style.display = 'none';
            document.getElementById('bb-batt').innerText = '-- mV';
            document.getElementById('bb-tamper').innerText = 'Intact';
            document.getElementById('bb-tamper').style.color = '#fff';
          }
        };

        window.BlackBox.onDiagnosticUpdate = (diag) => {
          document.getElementById('bb-batt').innerText = diag.battery_mv + ' mV';
          const tamperEl = document.getElementById('bb-tamper');
          if (diag.tamper_state === 1) {
            tamperEl.innerText = 'EFFRACTION!';
            tamperEl.style.color = '#ff0055';
          } else {
            tamperEl.innerText = 'Intact';
            tamperEl.style.color = '#fff';
          }
        };

        window.BlackBox.onTelemetryData = (data) => {
          // Flash visuel pour indiquer la réception
          const panel = document.getElementById('blackbox-ui-panel');
          panel.style.boxShadow = '0 0 50px rgba(0, 255, 136, 0.5)';
          setTimeout(() => { panel.style.boxShadow = '0 0 30px rgba(255, 51, 51, 0.2)'; }, 200);
        };
      });