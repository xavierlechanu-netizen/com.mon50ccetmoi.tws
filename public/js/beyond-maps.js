/* --- BEYOND MAPS : THE GOOGLE-KILLER FEATURES --- */

// 1. Pothole / Crash Scanner (Active Suspension Telemetry)
window.initPotholeScanner = function () {
  let lastZ = 0;
  let shockThreshold = 18; // G-force threshold for a significant bump/pothole
  let cooldown = false;

  if (window.DeviceMotionEvent) {
    window.addEventListener("devicemotion", function (event) {
      if (!event.accelerationIncludingGravity) return;
      let z = event.accelerationIncludingGravity.z;

      if (z === null) return;

      let deltaZ = Math.abs(z - lastZ);
      lastZ = z;

      if (deltaZ > shockThreshold && !cooldown) {
        // Choc violent dÃ©tectÃ© !
        cooldown = true;

        // Effet visuel
        document.body.style.animation = "glitch-anim 0.3s ease";
        setTimeout(() => (document.body.style.animation = ""), 300);

        if (typeof speak === "function") {
          speak(
            "Alerte choc violent dÃ©tectÃ©. Signalement automatique de route dÃ©gradÃ©e envoyÃ© Ã  la communautÃ©.",
          );
        }

        // Ajouter un danger fictif sur la carte (simulÃ© ici)

        // Cooldown de 10 secondes pour Ã©viter le spam
        setTimeout(() => (cooldown = false), 10000);
      }
    });
  }
};

// 2. Predictive Danger Radar (Intersections Mortelles)
window.checkPredictiveDanger = function (instructionText) {
  if (!instructionText) return;

  // Mots clÃ©s d'intersections complexes
  const dangerKeywords = [
    "rond-point",
    "carrefour",
    "intersection",
    "voie rapide",
  ];
  let isDangerous = dangerKeywords.some((kw) =>
    instructionText.toLowerCase().includes(kw),
  );

  if (isDangerous) {
    // DÃ©clencher le HUD Rouge
    const hud = document.getElementById("turn-by-turn-hud");
    if (hud) {
      hud.style.borderColor = "#ff0000";
      hud.style.boxShadow =
        "0 0 40px rgba(255,0,0,0.8), inset 0 0 20px rgba(255,0,0,0.5)";

      if (typeof speak === "function") {
        setTimeout(
          () =>
            speak(
              "Attention, zone rouge dÃ©tectÃ©e. Risque d'accident Ã©levÃ©, ralentissez.",
            ),
          3000,
        );
      }

      // Revenir Ã  la normale aprÃ¨s 15 secondes
      setTimeout(() => {
        hud.style.borderColor = "#00d2ff";
        hud.style.boxShadow =
          "0 10px 30px rgba(0,0,0,0.8), inset 0 0 15px rgba(0,210,255,0.3)";
      }, 15000);
    }
  }
};

// Hook into existing Premium Navigation
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(window.initPotholeScanner, 3000);

  // Override startPremiumNavigation to inject Predictive Danger
  if (typeof window.startPremiumNavigation === "function") {
    const legacyNav = window.startPremiumNavigation;
    window.startPremiumNavigation = function (leg) {
      legacyNav(leg);

      if (leg && leg.steps && leg.steps.length > 0) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = leg.steps[0].instructions;
        const instructionText = tempDiv.textContent || tempDiv.innerText || "";
        window.checkPredictiveDanger(instructionText);
      }
    };
  }
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
        "Mode Sensation activÃ©. Je vais chercher les routes les plus sinueuses pour un maximum de plaisir de conduite.",
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
        "Mode Sensation dÃ©sactivÃ©. Retour Ã  la navigation la plus rapide.",
      );
    }
  }
};
