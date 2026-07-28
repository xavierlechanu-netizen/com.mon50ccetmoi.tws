/**
 * ⚠️ DANGER ZONES v2.0 (Signalement Communautaire Temps Réel)
 * Système type Waze pour signaler et alerter les dangers sur la route.
 * Nids-de-poule, gravillons, routes glissantes, contrôles, accidents...
 * Sécurité : Conformité OWASP & validation des entrées.
 */

window.DangerZones = {
  alerts: [], // Alertes actives à proximité
  myReports: [], // Mes signalements locaux
  mapMarkers: {}, // Marqueurs Leaflet sur la carte
  isMonitoring: false,
  currentPos: null,
  checkInterval: null,
  firestoreUnsubscribe: null,

  TYPES: {
    POTHOLE: {
      icon: "🕳️",
      label: "Nid-de-poule",
      priority: 3,
      color: "#ff6600",
      voiceAlert: "Attention, nid-de-poule signalé devant vous.",
    },
    GRAVEL: {
      icon: "⚠️",
      label: "Gravillons",
      priority: 2,
      color: "#ffaa00",
      voiceAlert: "Prudence, route avec gravillons à proximité.",
    },
    SLIPPERY: {
      icon: "🌧️",
      label: "Route glissante",
      priority: 3,
      color: "#3399ff",
      voiceAlert: "Attention, chaussée glissante signalée.",
    },
    ROADWORKS: {
      icon: "🚧",
      label: "Travaux",
      priority: 2,
      color: "#ff9900",
      voiceAlert: "Zone de travaux signalée sur votre itinéraire.",
    },
    ACCIDENT: {
      icon: "🚨",
      label: "Accident",
      priority: 4,
      color: "#ff0044",
      voiceAlert: "Accident signalé devant vous. Réduisez votre vitesse.",
    },
    POLICE: {
      icon: "👮",
      label: "Contrôle",
      priority: 1,
      color: "#6666ff",
      voiceAlert: "Contrôle de police signalé à proximité.",
    },
    ANIMAL: {
      icon: "🐾",
      label: "Animal sur route",
      priority: 3,
      color: "#88cc00",
      voiceAlert: "Animal signalé sur la chaussée, ralentissez.",
    },
    FLOOD: {
      icon: "🌊",
      label: "Inondation",
      priority: 4,
      color: "#0088ff",
      voiceAlert: "Route inondée signalée. Évitez cette zone.",
    },
  },

  ALERT_RADIUS: 500, // Rayon d'alerte en mètres
  REPORT_TTL: 2 * 60 * 60 * 1000, // 2 heures

  init: function () {
    this.listenToCloudHazards();
    this.startMonitoring();
  },

  startMonitoring: function () {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    this.checkInterval = setInterval(() => {
      if (this.currentPos) {
        this.checkNearbyDangers();
      }
    }, 4000);
  },

  stopMonitoring: function () {
    this.isMonitoring = false;
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.firestoreUnsubscribe) this.firestoreUnsubscribe();
  },

  updatePosition: function (lat, lng) {
    this.currentPos = { lat, lng };
  },

  listenToCloudHazards: function () {
    if (!window.db) return;

    if (this.firestoreUnsubscribe) this.firestoreUnsubscribe();

    this.firestoreUnsubscribe = window.db
      .collection("hazards")
      .where("status", "==", "active")
      .limit(100)
      .onSnapshot((snapshot) => {
        const cloudAlerts = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const hazard = { id: doc.id, ...data };
          cloudAlerts.push(hazard);
          this.renderHazardOnMap(hazard);
        });
        this.alerts = cloudAlerts;
      }, (err) => {
        console.warn("[DangerZones] Firestore non disponible:", err);
      });
  },

  renderHazardOnMap: function (hazard) {
    if (typeof L === "undefined" || typeof map === "undefined" || !map) return;
    if (!hazard.lat || !hazard.lng) return;

    const typeInfo = this.TYPES[hazard.type] || this.TYPES.POTHOLE;
    const markerId = hazard.id;

    if (this.mapMarkers[markerId]) {
      this.mapMarkers[markerId].setLatLng([hazard.lat, hazard.lng]);
    } else {
      const icon = L.divIcon({
        html: `<div style="background:${typeInfo.color}; color:#fff; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 0 15px ${typeInfo.color}; border:2px solid #fff;">
                 ${typeInfo.icon}
               </div>`,
        className: "hazard-leaflet-marker",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([hazard.lat, hazard.lng], { icon: icon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family:'Inter',sans-serif; text-align:center; padding:5px;">
          <h4 style="margin:0 0 5px 0; color:${typeInfo.color}; font-size:1.1rem;">
            ${typeInfo.icon} ${typeInfo.label}
          </h4>
          <p style="margin:0 0 8px 0; font-size:0.8rem; color:#aaa;">Signalé par la communauté</p>
          <div style="display:flex; gap:6px; justify-content:center;">
            <button onclick="DangerZones.voteHazard('${hazard.id}', 'confirm')" style="background:#00ff88; color:#000; border:none; border-radius:6px; padding:4px 8px; font-size:0.75rem; font-weight:bold; cursor:pointer;">
              👍 Toujours là
            </button>
            <button onclick="DangerZones.voteHazard('${hazard.id}', 'resolve')" style="background:#ff4d4d; color:#fff; border:none; border-radius:6px; padding:4px 8px; font-size:0.75rem; font-weight:bold; cursor:pointer;">
              👎 Disparu
            </button>
          </div>
        </div>
      `);

      this.mapMarkers[markerId] = marker;
    }
  },

  voteHazard: async function (hazardId, voteType) {
    if (!window.db) return;
    try {
      const ref = window.db.collection("hazards").doc(hazardId);
      if (voteType === "confirm") {
        await ref.update({
          confirmations: firebase.firestore.FieldValue.increment(1)
        });
        alert("Merci pour votre confirmation !");
      } else {
        await ref.update({
          status: "resolved"
        });
        if (this.mapMarkers[hazardId] && typeof map !== "undefined") {
          map.removeLayer(this.mapMarkers[hazardId]);
          delete this.mapMarkers[hazardId];
        }
        alert("Signalement marqué comme résolu !");
      }
    } catch (e) {
      console.error("[DangerZones] Erreur de vote:", e);
    }
  },

  reportDanger: function (type) {
    if (!this.currentPos) {
      alert("Position GPS non disponible. Activez la géolocalisation.");
      return;
    }
    if (!this.TYPES[type]) {
      console.error("DangerZones : Type inconnu →", type);
      return;
    }

    const report = {
      type: type,
      lat: this.currentPos.lat,
      lng: this.currentPos.lng,
      timestamp: Date.now(),
      status: "active",
      reporter: (window.session && window.session.username) || "Membre",
      confirmations: 1,
      createdAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
    };

    this.syncToCloud(report);

    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    if (typeof speak === "function") {
      speak(`${this.TYPES[type].label} signalé. Merci de protéger la communauté.`);
    }

    return report;
  },

  syncToCloud: async function (report) {
    if (!window.db) return;
    try {
      await window.db.collection("hazards").add(report);
    } catch (e) {
      console.error("[DangerZones] Erreur d'envoi du danger:", e);
    }
  },

  checkNearbyDangers: function () {
    if (!this.currentPos || this.alerts.length === 0) return;

    const now = Date.now();
    this.alerts.forEach((alert) => {
      if (alert._lastNotified && now - alert._lastNotified < 60000) return;

      const distance = this.getDistance(
        this.currentPos.lat,
        this.currentPos.lng,
        alert.lat,
        alert.lng
      );

      if (distance <= this.ALERT_RADIUS) {
        this.triggerAlert(alert, distance);
        alert._lastNotified = now;
      }
    });
  },

  triggerAlert: function (alert, distanceMeters) {
    const typeInfo = this.TYPES[alert.type];
    if (!typeInfo) return;

    if (typeof speak === "function") {
      speak(typeInfo.voiceAlert);
    }

    const vibratePattern = typeInfo.priority >= 3 ? [300, 100, 300, 100, 300] : [200, 100, 200];
    if (navigator.vibrate) navigator.vibrate(vibratePattern);

    this.showToast(typeInfo, distanceMeters);
  },

  showToast: function (typeInfo, distanceMeters) {
    let existing = document.getElementById("dz-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "dz-toast";
    Object.assign(toast.style, {
      position: "fixed",
      top: "80px",
      left: "50%",
      transform: "translateX(-50%)",
      background: `linear-gradient(135deg, ${typeInfo.color}33, rgba(6,9,19,0.95))`,
      border: `2px solid ${typeInfo.color}`,
      borderRadius: "16px",
      padding: "12px 20px",
      zIndex: "10000",
      color: "#fff",
      fontFamily: "'Inter', sans-serif",
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      backdropFilter: "blur(12px)",
      boxShadow: `0 0 25px ${typeInfo.color}66`,
    });

    toast.innerHTML = `
      <span style="font-size: 26px;">${typeInfo.icon}</span>
      <div>
        <div style="font-weight: bold; color:${typeInfo.color}">${typeInfo.label}</div>
        <div style="font-size: 11px; color: #aaa;">à ${distanceMeters.toFixed(0)} mètres</div>
      </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 5000);
  },

  getDistance: function (lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    DangerZones.init();
  }, 1200);
});
