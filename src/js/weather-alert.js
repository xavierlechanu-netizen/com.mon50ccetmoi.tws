import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { describeWeather, weatherIsStale } from './weather-advice.js';

﻿/**
 * INTELLIGENT WEATHER ALERT v1.0
 * Analyse les conditions météo sur l'itinéraire du pilote et alerte
 * vocalement en cas de danger (pluie, verglas, vent fort).
 */

window.WeatherAlert = {
  isMonitoring: false,
  checkInterval: null,
  lastCheckTime: 0,
  currentCondition: "CLEAR",

  // Messages d'alerte (déclenchés par la vraie météo)
  CONDITIONS: {
    CLEAR: { label: "Dégagé", danger: false, msg: "" },
    RAIN: {
      label: "Pluie",
      danger: true,
      msg: "Alerte météo. Pluie détectée sur votre itinéraire. Adhérence réduite, ralentissez.",
    },
    WIND: {
      label: "Vent Fort",
      danger: true,
      msg: "Alerte météo. Fortes rafales de vent. Maintenez fermement votre guidon.",
    },
    ICE: {
      label: "Risque de Verglas",
      danger: true,
      msg: "Alerte critique. Température proche de zéro. Risque extrême de verglas.",
    },
  },

  init: function () {},

  start: function () {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Vérification immédiate
    this.checkWeather(window.appMap?.currentPos);

    // Puis vérification toutes les 15 minutes (900000 ms)
    this.checkInterval = setInterval(() => {
      this.checkWeather(window.appMap?.currentPos);
    }, 900000);
  },

  stop: function () {
    this.isMonitoring = false;
    if (this.checkInterval) clearInterval(this.checkInterval);
  },

  checkWeather: async function (position) {
    if (!position && !window.currentPosition) return;

    const now = Date.now();
    // Évite de spammer les alertes (1 alerte max toutes les 15 min)
    if (now - this.lastCheckTime < 900000 && this.lastCheckTime !== 0) return;

    // Météo réelle (Open-Meteo, récupérée par fetchWeather). Avant (corrigé le 7/11/2026) :
    // pluie, vent ou verglas tirés au hasard « pour la démo ». Sans météo récente : aucune alerte.
    const condition = this.conditionFromWeather(window.currentWeather);
    if (!condition) return;

    if (condition !== "CLEAR" && condition !== this.currentCondition) {
      this.triggerAlert(condition);
    }

    this.currentCondition = condition;
    this.lastCheckTime = now;
  },

  triggerAlert: function (conditionKey) {
    const condition = this.CONDITIONS[conditionKey];
    if (!condition || !condition.danger) return;

    console.warn(`🌍¦️ ALERTE MÉTÉO : ${condition.label}`);

    // Notification Vocale
    if (typeof speak === "function") {
      speak(condition.msg);
    }

    // Notification Visuelle (Toast)
    this.showToast(condition);
  },

  showToast: function (condition) {
    const existing = document.getElementById("weather-toast");
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

    // eslint-disable-next-line no-restricted-syntax
toast.innerHTML = `
            <span style="font-size:24px;">☁️</span>
            <div>
                <div style="font-weight:bold; color:#00d2ff;">Alerte Météo : ${condition.label}</div>
                <div style="font-size:12px; color:#aaa;">Prudence recommandée</div>
            </div>
        `;

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 6000);
  },

  /** Condition d'alerte à partir de la vraie météo, ou null si elle est absente ou trop ancienne. */
  conditionFromWeather: function (weather) {
    if (weatherIsStale(weather)) return null;
    const type = describeWeather(weather, new Date().getHours()).type;
    if (type === "ice" || type === "cold") return weather.temp <= 2 || type === "ice" ? "ICE" : "CLEAR";
    if (type === "rain" || type === "storm") return "RAIN";
    if (type === "wind") return "WIND";
    return "CLEAR";
  },

  // Déclenché depuis la console pour tester
  testAlert: function (type = "RAIN") {
    this.triggerAlert(type);
  },
};

// Auto-init
window.addEventListener("DOMContentLoaded", () => {
  window.WeatherAlert.init();
});
