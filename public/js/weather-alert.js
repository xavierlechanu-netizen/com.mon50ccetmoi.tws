/**
 * INTELLIGENT WEATHER ALERT v1.0
 * Analyse les conditions mÃ©tÃ©o sur l'itinÃ©raire du pilote et alerte
 * vocalement en cas de danger (pluie, verglas, vent fort).
 */

window.WeatherAlert = {
  isMonitoring: false,
  checkInterval: null,
  lastCheckTime: 0,
  currentCondition: "CLEAR",

  // Mock conditions for demo purposes
  CONDITIONS: {
    CLEAR: { label: "DÃ©gagÃ©", danger: false, msg: "" },
    RAIN: {
      label: "Pluie",
      danger: true,
      msg: "Alerte mÃ©tÃ©o. Pluie dÃ©tectÃ©e sur votre itinÃ©raire. AdhÃ©rence rÃ©duite, ralentissez.",
    },
    WIND: {
      label: "Vent Fort",
      danger: true,
      msg: "Alerte mÃ©tÃ©o. Fortes rafales de vent. Maintenez fermement votre guidon.",
    },
    ICE: {
      label: "Risque de Verglas",
      danger: true,
      msg: "Alerte critique. TempÃ©rature proche de zÃ©ro. Risque extrÃªme de verglas.",
    },
  },

  init: function () {},

  start: function () {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // VÃ©rification immÃ©diate
    this.checkWeather(window.appMap?.currentPos);

    // Puis vÃ©rification toutes les 15 minutes (900000 ms)
    this.checkInterval = setInterval(() => {
      this.checkWeather(window.appMap?.currentPos);
    }, 900000);
  },

  stop: function () {
    this.isMonitoring = false;
    if (this.checkInterval) clearInterval(this.checkInterval);
  },

  checkWeather: async function (position) {
    if (!position) return;

    const now = Date.now();
    // Ã‰vite de spammer les alertes (1 alerte max toutes les 15 min)
    if (now - this.lastCheckTime < 900000 && this.lastCheckTime !== 0) return;

    // Dans un cas rÃ©el, appel vers OpenWeatherMap API ou MÃ©tÃ©o France
    // Ici, nous simulons la mÃ©tÃ©o alÃ©atoirement pour la dÃ©mo
    const simulatedWeather = this.simulateWeatherAPI();

    if (
      simulatedWeather !== "CLEAR" &&
      simulatedWeather !== this.currentCondition
    ) {
      this.triggerAlert(simulatedWeather);
    }

    this.currentCondition = simulatedWeather;
    this.lastCheckTime = now;
  },

  triggerAlert: function (conditionKey) {
    const condition = this.CONDITIONS[conditionKey];
    if (!condition || !condition.danger) return;

    console.warn(`ðŸŒ¦ï¸ ALERTE MÃ‰TÃ‰O : ${condition.label}`);

    // Notification Vocale
    if (typeof speak === "function") {
      speak(condition.msg);
    }

    // Notification Visuelle (Toast)
    this.showToast(condition);
  },

  showToast: function (condition) {
    let existing = document.getElementById("weather-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "weather-toast";
    Object.assign(toast.style, {
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background:
        "linear-gradient(135deg, rgba(0,40,80,0.95), rgba(0,0,0,0.95))",
      border: "2px solid #00d2ff",
      borderRadius: "30px",
      padding: "12px 24px",
      zIndex: "10001",
      color: "#fff",
      fontFamily: "'Inter', sans-serif",
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      boxShadow: "0 0 20px rgba(0,210,255,0.4)",
      animation: "slideDown 0.4s ease-out",
    });

    toast.innerHTML = `
            <span style="font-size:24px;">â˜ï¸</span>
            <div>
                <div style="font-weight:bold; color:#00d2ff;">Alerte MÃ©tÃ©o : ${condition.label}</div>
                <div style="font-size:12px; color:#aaa;">Prudence recommandÃ©e</div>
            </div>
        `;

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 6000);
  },

  simulateWeatherAPI: function () {
    // Renvoie 80% du temps CLEAR, et 20% du temps une alerte
    const rand = Math.random();
    if (rand > 0.95) return "ICE";
    if (rand > 0.85) return "WIND";
    if (rand > 0.8) return "RAIN";
    return "CLEAR";
  },

  // DÃ©clenchÃ© depuis la console pour tester
  testAlert: function (type = "RAIN") {
    this.triggerAlert(type);
  },
};

// Auto-init
window.addEventListener("DOMContentLoaded", () => {
  window.WeatherAlert.init();
});
