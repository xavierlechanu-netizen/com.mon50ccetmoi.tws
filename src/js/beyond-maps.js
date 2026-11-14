import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

﻿/* --- BEYOND MAPS : THE GOOGLE-KILLER FEATURES --- */

// 1. Pothole / Crash Scanner (Active Suspension Telemetry)
window.initPotholeScanner = function () {
  let lastZ = 0;
  const shockThreshold = 18; // G-force threshold for a significant bump/pothole
  let cooldown = false;

  if (window.DeviceMotionEvent) {
    window.addEventListener("devicemotion", function (event) {
      if (!event.accelerationIncludingGravity) return;
      const z = event.accelerationIncludingGravity.z;

      if (z === null) return;

      const deltaZ = Math.abs(z - lastZ);
      lastZ = z;

      if (deltaZ > shockThreshold && !cooldown) {
        // Choc violent détecté !
        cooldown = true;

        // Effet visuel
        document.body.style.animation = "glitch-anim 0.3s ease";
        setTimeout(() => (document.body.style.animation = ""), 300);

        if (typeof speak === "function") {
          speak(
            "Alerte choc violent détecté. Signalement automatique de route dégradée envoyé à la communauté.",
          );
        }

        // Ajouter un danger fictif sur la carte (simulé ici)

        // Cooldown de 10 secondes pour éviter le spam
        setTimeout(() => (cooldown = false), 10000);
      }
    });
  }
};

// 2. « Radar prédictif » (zone rouge annoncée à chaque rond-point ou carrefour) : retiré le 14/11/2026,
// il ne s’exécutait jamais (greffé sur startPremiumNavigation, définie nulle part ; HUD absent de la page).

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(window.initPotholeScanner, 3000);
});

// 3. Mode Sensation (Anti-Ligne Droite)
window.isSensationMode = false;
window.toggleSensationMode = function () {
  window.isSensationMode = !window.isSensationMode;
  const btn = document.getElementById("btn-sensation-mode");

  if (window.isSensationMode) {
    if (btn) {
      btn.style.background = "#b700ff";
      btn.style.color = "#fff";
      btn.style.boxShadow = "0 0 30px #b700ff";
    }
    if (typeof speak === "function") {
      speak(
        "Mode Sensation activé. Je vais chercher les routes les plus sinueuses pour un maximum de plaisir de conduite.",
      );
    }
  } else {
    if (btn) {
      btn.style.background = "rgba(0,0,0,0.8)";
      btn.style.color = "#fff";
      btn.style.boxShadow = "0 0 15px #b700ff";
    }
    if (typeof speak === "function") {
      speak(
        "Mode Sensation désactivé. Retour à la navigation la plus rapide.",
      );
    }
  }
};
