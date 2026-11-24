import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { escapeHtml, safeNumber } from './html-escape.js';
import { distanceMeters } from './geo-math.js';
import { createFuelTracker, RANGE_MIN_KM, RANGE_MAX_KM } from './fuel-tracker.js';

function localStore() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const fuelTracker = createFuelTracker({ storage: localStore(), distance: distanceMeters });

// --- PIT STOPS INTELLIGENCE ---
window.PitStopSystem = {
  markers: {},

  init: function () {
    if (!window.session || !window.session.uid) return;

    this.listenToPitStops();

    // Km depuis le dernier plein déclaré (fuel-tracker.js)
    setInterval(() => this.trackFuel(), 30000);
  },

  listenToPitStops: function () {
    if (typeof firebase === "undefined") return;

    firebase
      .firestore()
      .collection("pit_stops")
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const id = change.doc.id;

          if (change.type === "added" || change.type === "modified") {
            this.drawPitStop(id, data);
          } else if (change.type === "removed") {
            this.removePitStop(id);
          }
        });
      });
  },

  drawPitStop: function (id, data) {
    if (!map) return;
    this.removePitStop(id);

    const isGas = data.type === "gas";

    const pitIcon = document.createElement("div");
    pitIcon.style.width = "12px";
    pitIcon.style.height = "12px";
    pitIcon.style.backgroundColor = isGas ? "#ff0055" : "#00d2ff";
    pitIcon.style.border = "2px solid #fff";
    pitIcon.style.borderRadius = "50%";

    const m = new window.googleLibraries.AdvancedMarkerElement({
      position: { lat: data.lat, lng: data.lng },
      map: map,
      title: data.name,
      content: pitIcon,
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="color:black; font-family:'Outfit';">
                        <h3 style="margin:0;">${isGas ? "⛽" : "🔧"} ${escapeHtml(data.name)}</h3>
                        <p style="margin:5px 0;">${escapeHtml(data.desc)}</p>
                        <small>Ajouté par: ${escapeHtml(data.author)}</small><br>
                        <button data-action="window.calculateRoute(new google.maps.LatLng(${safeNumber(data.lat)}, ${safeNumber(data.lng)}))" style="margin-top:5px; background:#111; color:white; padding:5px 10px; border:none; border-radius:5px; cursor:pointer;">Y aller</button>
                      </div>`,
    });

    m.addListener("click", () => info.open(map, m));
    this.markers[id] = m;
  },

  removePitStop: function (id) {
    if (this.markers[id]) {
      this.markers[id].map = null;
      delete this.markers[id];
    }
  },

  showModal: function () {
    let modal = document.getElementById("pitstop-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "pitstop-modal";
      modal.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
      document.body.appendChild(modal);
    }

    // eslint-disable-next-line no-restricted-syntax
modal.innerHTML = `
            <div style="background:#111; border:1px solid #ff0055; border-radius:15px; padding:20px; max-height:90vh; overflow-y:auto; width:90%; max-width:400px; text-align:center;">
                <h2 style="color:#ffb703; margin:0 0 8px; font-family:'Outfit', sans-serif;">⛽ Pit Stop</h2>
                <p id="pitstop-fuel-status" style="color:#ccc; margin:0 0 10px; font-size:0.9rem;"></p>
                <label for="pitstop-range" style="display:block; color:#fff; margin-bottom:5px; font-size:0.9rem;">Autonomie de votre plein (km)</label>
                <input type="number" id="pitstop-range" inputmode="numeric" min="${RANGE_MIN_KM}" max="${RANGE_MAX_KM}" value="${safeNumber(fuelTracker.rangeKm())}" style="width:100%; box-sizing:border-box; padding:10px; margin-bottom:10px; background:#222; color:white; border:1px solid #444; border-radius:5px;">
                <button data-action="window.PitStopSystem.declareFill()" style="width:100%; background:#ffb703; color:#000; border:none; padding:12px; border-radius:8px; font-weight:bold; margin-bottom:8px; cursor:pointer;">J'ai fait le plein (+1 point)</button>
                <button data-action="window.PitStopSystem.findPump()" style="width:100%; background:transparent; color:#ffb703; border:1px solid #ffb703; padding:12px; border-radius:8px; font-weight:bold; margin-bottom:18px; cursor:pointer;">Trouver une pompe (30 km)</button>
                <h2 style="color:#ff0055; margin-bottom:20px; font-family:'Outfit', sans-serif;">Ajouter un Point d'Intérêt</h2>
                
                <select id="pitstop-type" style="width:100%; padding:10px; margin-bottom:10px; background:#222; color:white; border:1px solid #333; border-radius:5px;">
                    <option value="gas">⛽ Station Service (Friendly 50cc)</option>
                    <option value="garage">🔧 Garage 2-Roues de confiance</option>
                </select>
                
                <input type="text" id="pitstop-name" placeholder="Nom du lieu (ex: Total Access)" style="width:100%; padding:10px; margin-bottom:10px; background:#222; color:white; border:1px solid #333; border-radius:5px;">
                <textarea id="pitstop-desc" placeholder="Détails (ex: SP98 pas cher, compresseur gratuit...)" style="width:100%; padding:10px; margin-bottom:20px; background:#222; color:white; border:1px solid #333; border-radius:5px; height:60px;"></textarea>
                
                <button disabled style="width:100%; background:#333; border:none; color:#777; padding:12px; border-radius:20px; font-weight:bold; cursor:not-allowed; margin-bottom:10px;">Partager ce lieu : bientôt disponible</button>
                <button data-action="document.getElementById('pitstop-modal').style.display='none'" style="width:100%; background:transparent; border:1px solid #aaa; color:#fff; padding:10px; border-radius:20px; cursor:pointer;">Annuler</button>
            </div>
        `;
    document.getElementById("pitstop-fuel-status").textContent = this.fuelStatusText();
    modal.style.display = "flex";
  },

  addPitStop: async function () {
    if (!window.session || !window.currentPosition)
      return alert("Position GPS requise.");
    const type = document.getElementById("pitstop-type").value;
    const name = document.getElementById("pitstop-name").value;
    const desc = document.getElementById("pitstop-desc").value;

    if (!name) return alert("Nom obligatoire.");

    try {
      await firebase.firestore().collection("pit_stops").add({
        type: type,
        name: name,
        desc: desc,
        author: window.session.username,
        authorUid: window.session.uid,
        lat: window.currentPosition.lat,
        lng: window.currentPosition.lng,
        createdAt: Date.now(),
      });
      alert("Pit Stop ajouté sur la carte globale !");
      document.getElementById("pitstop-modal").style.display = "none";
    } catch (e) {
      console.error(e);
      alert("Erreur réseau.");
    }
  },

  trackFuel: function () {
    if (!window.isRiding) return;
    fuelTracker.track(window.currentPosition);
    const fuel = fuelTracker.status();
    if (!fuel.shouldWarn) return;
    fuelTracker.markWarned();
    const message = `Environ ${fuel.kmSince} kilomètres depuis votre dernier plein déclaré. Pensez à vous arrêter à une pompe.`;
    if (typeof speak === "function") speak(message);

    document.getElementById("fuel-alert")?.remove();
    const banner = document.createElement("div");
    banner.id = "fuel-alert";
    banner.setAttribute("role", "status");
    banner.style.cssText = "position:fixed;top:290px;left:50%;transform:translateX(-50%);width:min(90vw,380px);background:#111;border:2px solid #ffb703;color:#fff;padding:12px;border-radius:12px;z-index:9500;text-align:center;";
    const text = document.createElement("div");
    text.textContent = `⛽ ${fuel.kmSince} km depuis votre plein (estimation)`;
    const find = document.createElement("button");
    find.textContent = "Trouver une pompe";
    find.style.cssText = "margin:8px 6px 0;padding:8px 12px;background:#ffb703;color:#000;border:none;border-radius:8px;font-weight:bold;";
    find.addEventListener("click", () => {
      banner.remove();
      this.findPump();
    });
    const close = document.createElement("button");
    close.textContent = "Fermer";
    close.style.cssText = "margin:8px 6px 0;padding:8px 12px;background:#333;color:#fff;border:none;border-radius:8px;";
    close.addEventListener("click", () => banner.remove());
    banner.append(text, find, close);
    document.body.appendChild(banner);
  },

  fuelStatusText: function () {
    const fuel = fuelTracker.status();
    if (!fuel.known) return "Aucun plein déclaré pour l'instant.";
    return `${fuel.kmSince} km depuis votre dernier plein, encore environ ${fuel.remainingKm} km (estimation).`;
  },

  declareFill: async function () {
    if (window.isRiding) return alert("Déclarez votre plein à l'arrêt, pas en roulant.");
    const range = document.getElementById("pitstop-range").value;
    if (!fuelTracker.declareFill(range)) {
      return alert(`Indiquez une autonomie entre ${RANGE_MIN_KM} et ${RANGE_MAX_KM} km.`);
    }
    document.getElementById("fuel-alert")?.remove();
    document.getElementById("pitstop-modal").style.display = "none";
    const gained = window.BVCManager ? await window.BVCManager.add(1, "FUEL_DECLARED") : false;
    alert(gained ? "⛽ Plein enregistré : +1 point mon50cc !" : "⛽ Plein enregistré. Le point n'a pas été ajouté cette fois.");
  },

  findPump: function () {
    const modal = document.getElementById("pitstop-modal");
    if (modal) modal.style.display = "none";
    if (window.CommunityGas) window.CommunityGas.compareAndShow();
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.PitStopSystem.init();
  }, 4000);
});
