import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

﻿/* --- V3.0 SMART CITY & ZERO-CLICK DESTINY --- */

// 1. ZERO-CLICK DESTINY (IA Quantique)
window.initZeroClickDestiny = function () {
  // Retiré le 7/11/2026 : se lançait à chaque démarrage, « devinait » une destination d'après
  // l'heure (Lycée, Maison, Spot de rassemblement) et annonçait une connexion aux infrastructures
  // de la ville qui n'existe pas.
};

window.cancelZeroClick = function () {
  clearInterval(window.zeroClickInterval);
  const zeroClickScreen = document.getElementById("zero-click-screen");
  if (zeroClickScreen) zeroClickScreen.classList.add("hidden");
  if (typeof speak === "function")
    speak("Prédiction annulée. Mode manuel activé.");
};

// 2. V2X GREEN WAVE (Piratage Feux Tricolores 50cc)
window.v2xActive = false;

window.initV2XGreenWave = function () {
  // Rappel de la limite de vitesse des 50 cc et voitures sans permis (45 km/h).
  // Avant (corrigé le 7/11/2026) : prétendait communiquer avec les feux tricolores
  // (« feu rouge imminent », « vague verte synchronisée ») et incitait à accélérer.
  window.v2xActive = true;
  const v2xHud = document.getElementById("v2x-hud");
  const v2xStatus = document.getElementById("v2x-status");
  const v2xTargetSpeed = document.getElementById("v2x-target-speed");
  if (!v2xHud || !v2xStatus) return;
  v2xHud.classList.remove("hidden");
  if (v2xTargetSpeed) v2xTargetSpeed.innerText = "45 km/h max";
  let lastWarning = 0;
  setInterval(() => {
    if (!window.v2xActive) return;
    const currentSpeed = window.lastKnownSpeedKmh || 0;
    if (currentSpeed > 45) {
      v2xHud.style.borderColor = "#ff0055";
      v2xStatus.innerText = "RALENTISSEZ - 45 KM/H MAX";
      v2xStatus.style.color = "#ff0055";
      if (Date.now() - lastWarning > 30000 && typeof speak === "function") {
        lastWarning = Date.now();
        speak("Alerte : Vitesse excessive. Ralentissez immédiatement.");
      }
    } else if (currentSpeed > 0) {
      v2xHud.style.borderColor = "#00ffcc";
      v2xStatus.innerText = "VITESSE RESPECTÉE";
      v2xStatus.style.color = "#00ffcc";
    } else {
      v2xHud.style.borderColor = "#555";
      v2xStatus.innerText = "À L'ARRÊT";
      v2xStatus.style.color = "#aaa";
    }
  }, 1000);
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (localStorage.getItem("cnil_consent") === "true") {
      window.initZeroClickDestiny();
    }
  }, 2000);
});
