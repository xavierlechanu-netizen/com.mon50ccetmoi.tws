import { registerAction } from './actionRegistry.js';
import { escapeHtml, safeId } from './html-escape.js';
import { sovereignRequest } from './sovereign.js';

/**
 * 🏍️ GARAGE VIRTUEL
 * Suivi d'entretien et état des pièces en fonction du kilométrage.
 */

window.VirtualGarage = {
  data: {
    model: "Mon 50cc",
    initialKm: 0,
    parts: {
      belt: { name: "Courroie", maxLife: 10000, color: "#00e676" },
      rollers: { name: "Galets", maxLife: 5000, color: "#00d2ff" },
      tires: { name: "Pneus", maxLife: 12000, color: "#ffb703" },
      brakes: { name: "Plaquettes", maxLife: 8000, color: "#ff4d4d" },
    },
  },

  init: function () {
    this.loadData();
  },

  loadData: function () {
    const saved = localStorage.getItem("virtual_garage");
    if (saved) {
      try {
        this.data = JSON.parse(saved);
      } catch (e) {}
    }
  },

  saveData: function () {
    localStorage.setItem("virtual_garage", JSON.stringify(this.data));
  },

  getAppDistance: function () {
    return parseFloat(localStorage.getItem("total_distance") || "0");
  },

  getTotalKm: function () {
    return this.data.initialKm + this.getAppDistance();
  },

  updateVehicle: function (model, initialKm) {
    this.data.model = model;
    this.data.initialKm = parseFloat(initialKm) || 0;
    this.saveData();
    this.renderUI();
  },

  resetPart: function (partKey) {
    if (!this.data.partsOffsets) this.data.partsOffsets = {};
    this.data.partsOffsets[partKey] = this.getTotalKm();
    this.saveData();
    this.renderUI();
    if (typeof speak === "function")
      speak(`Entretien enregistré pour : ${this.data.parts[partKey].name}.`);
  },

  getPartWear: function (partKey) {
    const part = this.data.parts[partKey];
    if (!this.data.partsOffsets) this.data.partsOffsets = {};
    const offset = this.data.partsOffsets[partKey] || 0;
    const currentKm = this.getTotalKm();

    let distanceSinceChange = currentKm - offset;
    if (distanceSinceChange < 0) distanceSinceChange = 0;

    let percentage = (distanceSinceChange / part.maxLife) * 100;
    if (percentage > 100) percentage = 100;

    return {
      distance: distanceSinceChange,
      percentage: percentage,
      isCritical: percentage >= 90,
    };
  },

  openUI: function () {
    let overlay = document.getElementById("garage-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "garage-overlay";
      overlay.style = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(10, 15, 25, 0.95); z-index: 50000;
                display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
                padding-top: 40px; overflow-y: auto; color: #fff; font-family: 'Inter', sans-serif;
                backdrop-filter: blur(15px);
            `;
      document.body.appendChild(overlay);
    } else {
      overlay.style.display = "flex";
    }
    this.renderUI();
    if (window.GarageClient) {
      window.GarageClient.loadMaintenanceLogs();
    }
  },

  closeUI: function () {
    const overlay = document.getElementById("garage-overlay");
    if (overlay) overlay.style.display = "none";
  },

  renderUI: function () {
    const overlay = document.getElementById("garage-overlay");
    if (!overlay) return;

    const currentKm = Math.floor(this.getTotalKm());

    let partsHTML = "";
    for (const key in this.data.parts) {
      const part = this.data.parts[key];
      const wear = this.getPartWear(key);

      partsHTML += `
                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 15px; margin-bottom: 15px; border-left: 4px solid ${part.color};">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong style="color: #fff;"><i class="fa-solid fa-wrench" style="color: #777; margin-right: 5px;"></i> ${escapeHtml(part.name)}</strong>
                        <span style="color: ${wear.isCritical ? "#ff4d4d" : "#ccc"};">${Math.floor(wear.distance)} / ${part.maxLife} km</span>
                    </div>
                    <div style="width: 100%; background: #333; height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 10px;">
                        <div style="width: ${wear.percentage}%; height: 100%; background: ${wear.isCritical ? "#ff4d4d" : part.color}; transition: width 0.5s;"></div>
                    </div>
                    <button data-action="VirtualGarage.resetPart('${key}')" style="background: transparent; border: 1px solid ${part.color}; color: ${part.color}; padding: 5px 15px; border-radius: 15px; font-size: 0.8rem; cursor: pointer;">
                        <i class="fa-solid fa-rotate"></i> Remplacé
                    </button>
                    ${wear.isCritical ? '<p style="color: #ff4d4d; font-size: 0.8rem; margin: 10px 0 0 0;"><i class="fa-solid fa-triangle-exclamation"></i> Remplacement urgent !</p>' : ""}
                </div>
            `;
    }

    // eslint-disable-next-line no-restricted-syntax
overlay.innerHTML = `
            <button data-action="VirtualGarage.closeUI(" style="position: absolute); top: 20px; right: 20px; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
            <i class="fa-solid fa-motorcycle" style="font-size: 3rem; color: #00d2ff; filter: drop-shadow(0 0 10px #00d2ff); margin-bottom: 10px;"></i>
            <h1 style="font-size: 1.5rem; margin: 0; text-transform: uppercase; color: #00d2ff;">Mon Garage</h1>
            <p style="color: #aaa; margin-bottom: 20px; text-align: center;">Suivi d'entretien kilométrique</p>
            
            <div style="width: 90%; max-width: 500px; background: rgba(0,0,0,0.4); border-radius: 20px; padding: 20px; margin-bottom: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);">
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <label for="garage-model" style="font-size: 0.8rem; color: #777;">Modèle du scooter</label>
                        <input type="text" id="garage-model" value="${this.data.model}" style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 10px; border-radius: 10px; box-sizing: border-box; margin-top: 5px; outline: none;">
                    </div>
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <label for="garage-initial-km" style="font-size: 0.8rem; color: #777;">Kilométrage initial (compteur)</label>
                        <input type="number" id="garage-initial-km" value="${this.data.initialKm}" style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 10px; border-radius: 10px; box-sizing: border-box; margin-top: 5px; outline: none;">
                    </div>
                </div>
                <button data-action="VirtualGarage.updateVehicle(document.getElementById('garage-model').value, document.getElementById('garage-initial-km').value)" style="width: 100%; background: #00d2ff; color: #000; font-weight: bold; padding: 12px; border: none; border-radius: 10px; cursor: pointer;">
                    <i class="fa-solid fa-floppy-disk"></i> Enregistrer
                </button>
            </div>
            
            <div style="width: 90%; max-width: 500px; padding-bottom: 30px;">
                <h3 style="color: #fff; margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px; display: flex; justify-content: space-between;">
                    <span>Pièces d'usure</span>
                    <span style="color: #00d2ff;">${currentKm} km</span>
                </h3>
                ${partsHTML}
            </div>
        `;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  VirtualGarage.init();
});

/**
 * Carnet d'entretien du pilote (serveur souverain, sovereign-core/server/garages.js, 25/11/2026).
 * Le pilote donne accès à son garage en lui montrant un code à 6 chiffres (15 minutes) et peut
 * retirer cet accès ; les interventions scellées par le garage restent dans son carnet.
 */
const card = (inner, color = "#333") =>
  `<div style="text-align:center; padding:20px; color:#aaa; border:1px dashed ${color}; border-radius:10px; font-size:0.9rem;">${inner}</div>`;

window.GarageClient = {
  loadMaintenanceLogs: async function () {
    const container = document.getElementById('maintenance-logs-container');
    if (!container) return;
    let data;
    try {
      data = await sovereignRequest('/maintenance', { method: 'GET' });
    } catch (e) {
      // eslint-disable-next-line no-restricted-syntax
      container.innerHTML = card(e && e.status === 401
        ? '<i class="fa-solid fa-triangle-exclamation"></i> Connectez-vous pour consulter votre carnet d\'entretien.'
        : '<i class="fa-solid fa-triangle-exclamation"></i> Carnet indisponible pour le moment.', '#ff3333');
      return;
    }

    let html = `<button data-action="GarageClient.giveAccess()" style="background:#00ff88; color:#000; font-weight:bold; border:none; border-radius:8px; padding:10px; cursor:pointer;">
        <i class="fa-solid fa-key"></i> Donner accès à mon garage</button>
      <div id="garage-access-code" role="status" aria-live="polite"></div>`;

    for (const g of data.garages) {
      const id = safeId(g.garageId);
      if (!id) continue;
      html += `<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:0.85rem; color:#ccc;">
          <span><i class="fa-solid fa-wrench"></i> ${escapeHtml(g.name)} a accès à votre carnet</span>
          <button data-action="GarageClient.revoke('${id}')" style="background:transparent; border:1px solid #ff4d4d; color:#ff4d4d; border-radius:5px; padding:4px 8px; cursor:pointer;">Retirer</button>
        </div>`;
    }

    if (data.logs.length === 0) {
      html += card("Aucun entretien noté pour l'instant.");
    }
    for (const log of data.logs) {
      html += `
          <div style="background: rgba(255,255,255,0.05); border: 1px solid ${log.certified ? '#00ff88' : '#333'}; border-radius: 10px; padding: 15px; position:relative;">
            ${log.certified ? `<div style="position:absolute; top:-10px; right:10px; background:#00ff88; color:#000; font-weight:bold; font-size:0.6rem; padding:3px 8px; border-radius:10px; text-transform:uppercase;"><i class="fa-solid fa-check-circle"></i> ${escapeHtml(log.garageName)}</div>` : ''}
            <div style="color: #aaa; font-size: 0.8rem; margin-bottom: 5px;">
              <i class="fa-regular fa-calendar"></i> ${escapeHtml(new Date(log.createdAt).toLocaleDateString('fr-FR'))}
              ${log.km === null ? '' : `&nbsp;|&nbsp; <i class="fa-solid fa-gauge-high"></i> ${escapeHtml(log.km.toLocaleString('fr-FR'))} km`}
            </div>
            <strong style="color: #fff; font-size: 1rem; display:block; margin-bottom: 5px;">${escapeHtml(log.category)}</strong>
            <p style="color: #ccc; font-size: 0.85rem; line-height: 1.4; margin: 0;">${escapeHtml(log.description)}</p>
          </div>`;
    }
    // eslint-disable-next-line no-restricted-syntax
    container.innerHTML = html;
  },

  /** Code à montrer au garage ; le kilométrage au compteur sert à ses rappels d'entretien. */
  giveAccess: async function () {
    const answer = prompt("Votre garage pourra noter ses interventions dans votre carnet. Chacune est gardée 5 ans comme preuve : elle ne pourra plus être modifiée ni effacée, même si vous supprimez votre compte.\n\nKilométrage au compteur (facultatif, pour les rappels d'entretien) :", "");
    if (answer === null) return;
    const km = answer.replace(/\s/g, "");
    try {
      const res = await sovereignRequest('/maintenance/code', { method: 'POST', body: { km: km === "" ? null : Number(km) } });
      const box = document.getElementById('garage-access-code');
      if (box) {
        box.textContent = `Code pour votre garage : ${res.code} (valable 15 minutes, une seule fois). Il pourra noter ses interventions dans votre carnet.`;
      }
    } catch (e) {
      alert(e?.message || "Code indisponible pour le moment.");
    }
  },

  revoke: async function (garageId) {
    if (!confirm("Retirer l'accès de ce garage à votre carnet ? Les interventions déjà notées restent dans votre carnet.")) return;
    try {
      await sovereignRequest(`/maintenance/garages?garage=${encodeURIComponent(garageId)}`, { method: 'DELETE' });
    } catch (e) {
      alert(e?.message || "Accès non retiré.");
    }
    await this.loadMaintenanceLogs();
  },
};

registerAction('GarageClient.giveAccess', () => window.GarageClient.giveAccess());
registerAction('GarageClient.revoke', (id) => window.GarageClient.revoke(id));
