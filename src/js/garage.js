import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

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
                        <strong style="color: #fff;"><i class="fa-solid fa-wrench" style="color: #777; margin-right: 5px;"></i> ${part.name}</strong>
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

window.GarageClient = {
  loadMaintenanceLogs: async function() {
    const container = document.getElementById('maintenance-logs-container');
    if (!container) return;

    if (typeof firebase === 'undefined' || !firebase.auth().currentUser || typeof db === 'undefined') {
      // eslint-disable-next-line no-restricted-syntax
container.innerHTML = `
        <div style="text-align:center; padding:20px; color:#ff3333; border:1px dashed #333; border-radius:10px; font-size:0.9rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> Connexion requise pour consulter votre carnet d'entretien.
        </div>
      `;
      return;
    }

    try {
      const uid = firebase.auth().currentUser.uid;
      const snapshot = await db.collection('maintenance_logs')
                               .where('vehicleOwnerUid', '==', uid)
                               .orderBy('timestamp', 'desc')
                               .get();

      if (snapshot.empty) {
        // eslint-disable-next-line no-restricted-syntax
container.innerHTML = `
          <div style="text-align:center; padding:20px; color:#888; border:1px dashed #333; border-radius:10px; font-size:0.9rem;">
            Aucun entretien certifié n'a encore été scellé pour votre véhicule.
          </div>
        `;
        return;
      }

      let html = '';
      snapshot.forEach(doc => {
        const data = doc.data();
        const dateStr = data.timestamp ? data.timestamp.toDate().toLocaleDateString('fr-FR') : 'Date inconnue';
        
        html += `
          <div style="background: rgba(255,255,255,0.05); border: 1px solid ${data.certified ? '#00ff88' : '#333'}; border-radius: 10px; padding: 15px; position:relative;">
            ${data.certified ? '<div style="position:absolute; top:-10px; right:10px; background:#00ff88; color:#000; font-weight:bold; font-size:0.6rem; padding:3px 8px; border-radius:10px; text-transform:uppercase;"><i class="fa-solid fa-check-circle"></i> Certifié</div>' : ''}
            <div style="color: #aaa; font-size: 0.8rem; margin-bottom: 5px;">
              <i class="fa-regular fa-calendar"></i> ${dateStr} &nbsp;&nbsp;|&nbsp;&nbsp; 
              <i class="fa-solid fa-gauge-high"></i> ${data.mileage} km
            </div>
            <strong style="color: #fff; font-size: 1rem; display:block; margin-bottom: 5px;">${data.category}</strong>
            <p style="color: #ccc; font-size: 0.85rem; line-height: 1.4; margin: 0;">${data.description}</p>
          </div>
        `;
      });
      // eslint-disable-next-line no-restricted-syntax
container.innerHTML = html;

    } catch (e) {
      console.error("Erreur de récupération du carnet", e);
      // eslint-disable-next-line no-restricted-syntax
container.innerHTML = `
        <div style="text-align:center; padding:20px; color:#ff3333; border:1px dashed #333; border-radius:10px; font-size:0.9rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> Impossible de synchroniser avec la base de données.
        </div>
      `;
    }
  },

  generatePDF: function() {
    alert("🖨️ Génération du PDF en cours...\n(Fonctionnalité simulée : ce bouton compilera prochainement vos certificats d'entretien sous forme d'un document officiel pour la revente).");
  }
};