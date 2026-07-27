/**
 * DANGER ZONES v1.0 (Signalement Communautaire)
 * SystÃ¨me type Waze pour signaler et alerter les dangers sur la route.
 * Nids-de-poule, gravillons, routes glissantes, contrÃ´les...
 */

window.DangerZones = {
  alerts: [], // Alertes actives Ã  proximitÃ©
  myReports: [], // Mes signalements
  isMonitoring: false,
  currentPos: null,
  checkInterval: null,

  // Types de dangers avec icÃ´nes et prioritÃ©s
  TYPES: {
    POTHOLE: {
      icon: "ðŸ•³ï¸",
      label: "Nid-de-poule",
      priority: 3,
      color: "#ff6600",
      voiceAlert: "Attention, nid-de-poule signalÃ© devant vous.",
    },
    GRAVEL: {
      icon: "âš ï¸",
      label: "Gravillons",
      priority: 2,
      color: "#ffaa00",
      voiceAlert: "Prudence, route avec gravillons Ã  proximitÃ©.",
    },
    SLIPPERY: {
      icon: "ðŸŒ§ï¸",
      label: "Route glissante",
      priority: 3,
      color: "#3399ff",
      voiceAlert: "Attention, chaussÃ©e glissante signalÃ©e.",
    },
    ROADWORKS: {
      icon: "ðŸš§",
      label: "Travaux",
      priority: 2,
      color: "#ff9900",
      voiceAlert: "Zone de travaux signalÃ©e sur votre itinÃ©raire.",
    },
    ACCIDENT: {
      icon: "ðŸš¨",
      label: "Accident",
      priority: 4,
      color: "#ff0044",
      voiceAlert: "Accident signalÃ© devant vous. RÃ©duisez votre vitesse.",
    },
    POLICE: {
      icon: "ðŸ‘®",
      label: "ContrÃ´le",
      priority: 1,
      color: "#6666ff",
      voiceAlert: "ContrÃ´le de police signalÃ© Ã  proximitÃ©.",
    },
    ANIMAL: {
      icon: "ðŸ•",
      label: "Animal sur route",
      priority: 3,
      color: "#88cc00",
      voiceAlert: "Animal signalÃ© sur la chaussÃ©e, ralentissez.",
    },
    FLOOD: {
      icon: "ðŸŒŠ",
      label: "Inondation",
      priority: 4,
      color: "#0088ff",
      voiceAlert: "Route inondÃ©e signalÃ©e. Ã‰vitez cette zone.",
    },
  },

  // Rayon d'alerte en mÃ¨tres
  ALERT_RADIUS: 500,
  // DurÃ©e de vie d'un signalement (2 heures)
  REPORT_TTL: 2 * 60 * 60 * 1000,

  init: function () {
    this.loadLocalReports();
  },

  // DÃ©marrer la surveillance GPS
  startMonitoring: function () {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // VÃ©rifier les alertes Ã  proximitÃ© toutes les 5 secondes
    this.checkInterval = setInterval(() => {
      if (this.currentPos) {
        this.checkNearbyDangers();
      }
    }, 5000);
  },

  stopMonitoring: function () {
    this.isMonitoring = false;
    if (this.checkInterval) clearInterval(this.checkInterval);
  },

  // Mettre Ã  jour la position (appelÃ© par le GPS de app-map.js)
  updatePosition: function (lat, lng) {
    this.currentPos = { lat, lng };
  },

  // Signaler un danger (bouton dans l'UI)
  reportDanger: function (type) {
    if (!this.currentPos) {
      alert("Position GPS non disponible. Activez la localisation.");
      return;
    }
    if (!this.TYPES[type]) {
      console.error("DangerZones : Type inconnu â†’", type);
      return;
    }

    const report = {
      id: `dz_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: type,
      lat: this.currentPos.lat,
      lng: this.currentPos.lng,
      timestamp: Date.now(),
      reporter: (window.session && window.session.uid) || "anonymous",
      confirmations: 1, // Le crÃ©ateur compte comme 1
      active: true,
    };

    this.myReports.push(report);
    this.saveLocalReports();

    // Enregistrer dans Firebase pour la communautÃ©
    this.syncToCloud(report);

    // Feedback
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    if (typeof speak === "function") {
      speak(
        `${this.TYPES[type].label} signalÃ©. Merci de protÃ©ger la communautÃ©.`,
      );
    }

    return report;
  },

  // VÃ©rifier les dangers Ã  proximitÃ©
  checkNearbyDangers: function () {
    if (!this.currentPos || this.alerts.length === 0) return;

    const now = Date.now();
    this.alerts.forEach((alert) => {
      // Ignorer les alertes expirÃ©es
      if (now - alert.timestamp > this.REPORT_TTL) return;
      // Ignorer si dÃ©jÃ  notifiÃ© dans les 60 derniÃ¨res secondes
      if (alert._lastNotified && now - alert._lastNotified < 60000) return;

      const distance = this.getDistance(
        this.currentPos.lat,
        this.currentPos.lng,
        alert.lat,
        alert.lng,
      );

      if (distance <= this.ALERT_RADIUS) {
        this.triggerAlert(alert, distance);
        alert._lastNotified = now;
      }
    });
  },

  // DÃ©clencher une alerte visuelle + vocale
  triggerAlert: function (alert, distanceMeters) {
    const typeInfo = this.TYPES[alert.type];
    if (!typeInfo) return;

    console.warn(
      `âš ï¸ DANGER Ã  ${distanceMeters.toFixed(0)}m : ${typeInfo.label}`,
    );

    // Alerte vocale
    if (typeof speak === "function") {
      speak(typeInfo.voiceAlert);
    }

    // Vibration selon la prioritÃ©
    const vibratePattern =
      typeInfo.priority >= 3
        ? [300, 100, 300, 100, 300] // Urgent
        : [200, 100, 200]; // Normal
    if (navigator.vibrate) navigator.vibrate(vibratePattern);

    // Notification visuelle (toast)
    this.showToast(typeInfo, distanceMeters);
  },

  // Toast d'alerte visuelle
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
      background: `linear-gradient(135deg, ${typeInfo.color}22, rgba(0,0,0,0.95))`,
      border: `2px solid ${typeInfo.color}`,
      borderRadius: "16px",
      padding: "14px 24px",
      zIndex: "10000",
      color: "#fff",
      fontFamily: "'Inter', sans-serif",
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      backdropFilter: "blur(10px)",
      boxShadow: `0 0 30px ${typeInfo.color}44`,
      animation: "slideDown 0.4s ease-out",
    });

    toast.innerHTML = `
            <span style="font-size: 28px;">${typeInfo.icon}</span>
            <div>
                <div style="font-weight: bold;">${typeInfo.label}</div>
                <div style="font-size: 12px; color: #aaa;">Ã  ${distanceMeters.toFixed(0)} mÃ¨tres</div>
            </div>
        `;

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 5000);
  },

  // Afficher le panneau de signalement rapide
  showReportPanel: function () {
    let existing = document.getElementById("dz-report-panel");
    if (existing) {
      existing.remove();
      return;
    }

    const panel = document.createElement("div");
    panel.id = "dz-report-panel";
    Object.assign(panel.style, {
      position: "fixed",
      bottom: "0",
      left: "0",
      right: "0",
      background: "rgba(0,0,0,0.95)",
      borderTop: "2px solid rgba(0,210,255,0.3)",
      borderRadius: "20px 20px 0 0",
      padding: "20px",
      zIndex: "10001",
      backdropFilter: "blur(20px)",
      transition: "transform 0.3s ease",
    });

    let buttonsHTML = Object.entries(this.TYPES)
      .map(
        ([key, info]) =>
          `<button onclick="window.DangerZones.reportDanger('${key}'); document.getElementById('dz-report-panel').remove();"
                style="display:flex; flex-direction:column; align-items:center; gap:6px;
                       background:rgba(255,255,255,0.05); border:1px solid ${info.color}44;
                       border-radius:12px; padding:12px 8px; color:#fff; cursor:pointer;
                       font-size:12px; min-width:80px; transition: all 0.2s;">
                <span style="font-size:24px;">${info.icon}</span>
                <span>${info.label}</span>
            </button>`,
      )
      .join("");

    panel.innerHTML = `
            <div style="text-align:center; margin-bottom:16px;">
                <div style="width:40px; height:4px; background:#555; border-radius:2px; margin:0 auto 12px;"></div>
                <span style="color:#00d2ff; font-weight:bold; font-size:16px;">âš ï¸ Signaler un danger</span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px;">
                ${buttonsHTML}
            </div>
        `;
    document.body.appendChild(panel);
  },

  // Confirmer un signalement existant (+1 crÃ©dibilitÃ©)
  confirmReport: function (reportId) {
    const alert = this.alerts.find((a) => a.id === reportId);
    if (alert) {
      alert.confirmations = (alert.confirmations || 1) + 1;
    }
  },

  // Synchronisation Firebase
  syncToCloud: function (report) {
    if (typeof db !== "undefined") {
      db.collection("danger_zones")
        .add(report)
        .then(() => {})
        .catch((err) => console.error("âš ï¸ DangerZones sync error:", err));
    }
  },

  // Charger les signalements depuis Firebase
  loadFromCloud: function () {
    if (typeof db === "undefined") return;

    const cutoff = Date.now() - this.REPORT_TTL;
    db.collection("danger_zones")
      .where("timestamp", ">", cutoff)
      .get()
      .then((snapshot) => {
        this.alerts = [];
        snapshot.forEach((doc) => {
          this.alerts.push({ id: doc.id, ...doc.data() });
        });
      })
      .catch((err) => console.error("DangerZones cloud load error:", err));
  },

  // Sauvegarde locale
  saveLocalReports: function () {
    localStorage.setItem("dangerZoneReports", JSON.stringify(this.myReports));
  },

  loadLocalReports: function () {
    try {
      const data = localStorage.getItem("dangerZoneReports");
      this.myReports = data ? JSON.parse(data) : [];
    } catch (e) {
      this.myReports = [];
    }
  },

  // Calcul de distance (Haversine)
  getDistance: function (lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
};

// Auto-init
window.addEventListener("DOMContentLoaded", () => {
  window.DangerZones.init();
});
