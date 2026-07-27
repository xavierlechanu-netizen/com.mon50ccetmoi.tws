/**
 * PREDICTIVE MAINTENANCE AI v1.0
 * Calculates wear and tear based on riding style and vibrations.
 */

window.PredictiveMeca = {
  // Ã‰tat d'usure de 0 (neuf) Ã  100 (critique/panne)
  wearScore: JSON.parse(
    localStorage.getItem("meca_wear") ||
      '{"piston": 0, "belt": 0, "oil": 0, "brakes": 0, "tires": 0, "battery": 0}',
  ),

  // Distance totale pour les calculs de base
  totalKm: parseFloat(localStorage.getItem("total_distance") || "0"),

  updateWear: function (intensity, speed, braking, temp) {
    // intensity: vibrations (0-10)
    // speed: km/h
    // braking: force de freinage (0-10)
    // temp: tempÃ©rature ambiante (Celsius)

    const fatigueFactor = intensity * 0.05 + (speed > 45 ? 0.02 : 0.005);

    // Piston: souffre Ã  haute vitesse et fortes vibrations
    this.wearScore.piston += fatigueFactor * (speed > 60 ? 1.5 : 1);

    // Courroie: s'use avec l'accÃ©lÃ©ration (simulÃ©e via intensitÃ©)
    this.wearScore.belt += fatigueFactor * 0.8;

    // Huile: s'use avec la distance et la tempÃ©rature (si moteur trÃ¨s chaud)
    this.wearScore.oil += 0.01 + (temp > 30 ? 0.005 : 0);

    // Freins: s'use fortement lors des freinages brusques
    this.wearScore.brakes += braking * 0.1;

    // Pneus: s'use avec la distance et le freinage
    this.wearScore.tires += 0.005 + braking * 0.02;

    // Batterie: se dÃ©charge lÃ©gÃ¨rement, s'abÃ®me au froid
    this.wearScore.battery += 0.002 + (temp < 5 ? 0.01 : 0);

    // Cap usure Ã  100%
    for (let part in this.wearScore) {
      if (this.wearScore[part] > 100) this.wearScore[part] = 100;
    }

    localStorage.setItem("meca_wear", JSON.stringify(this.wearScore));
    this.checkAlerts();
    this.updateDashboardUI();
  },

  checkAlerts: function () {
    const critical = [];
    if (this.wearScore.piston > 90) critical.push("Piston");
    if (this.wearScore.belt > 90) critical.push("Courroie");
    if (this.wearScore.oil > 95) critical.push("Huile");
    if (this.wearScore.brakes > 90) critical.push("Freins");

    if (critical.length > 0 && Math.random() > 0.95) {
      // Ã‰viter de spammer vocalement
      if (typeof speak === "function") {
        speak(
          "Alerte IA PrÃ©dictive : Composants critiques dÃ©tectÃ©s : " +
            critical.join(", ") +
            ". Veuillez vÃ©rifier le diagnostic.",
        );
      }
    }
  },

  getHealthReport: function () {
    return this.wearScore;
  },

  getGlobalHealthScore: function () {
    let total = 0;
    let count = 0;
    for (let part in this.wearScore) {
      total += this.wearScore[part];
      count++;
    }
    return 100 - total / count; // 100 = Parfait, 0 = Ã‰pave
  },

  resetComponent: function (component) {
    if (this.wearScore[component] !== undefined) {
      this.wearScore[component] = 0;
      localStorage.setItem("meca_wear", JSON.stringify(this.wearScore));
      this.updateDashboardUI();
      if (typeof speak === "function")
        speak("Maintenance du composant " + component + " enregistrÃ©e.");
    }
  },

  updateDashboardUI: function () {
    // Mise Ã  jour de l'interface visuelle si elle est ouverte
    const modal = document.getElementById("ai-diagnostic-modal");
    if (modal && modal.style.display !== "none") {
      document.getElementById("ai-health-score").textContent =
        Math.round(this.getGlobalHealthScore()) + "%";

      for (let part in this.wearScore) {
        const bar = document.getElementById(`ai-bar-${part}`);
        const val = document.getElementById(`ai-val-${part}`);
        if (bar && val) {
          const wear = Math.round(this.wearScore[part]);
          bar.style.width = wear + "%";
          val.textContent = wear + "%";

          // Couleurs dynamiques
          if (wear > 80) bar.style.background = "#ff4444";
          else if (wear > 50) bar.style.background = "#ffbb33";
          else bar.style.background = "#00e676";
        }
      }
    }
  },

  // NEW: Riding Style Analyzer
  analyzeRidingStyle: function () {
    if (!window.Blackbox) return;

    const stats = window.Blackbox.getStats();
    if (stats.distance < 0.1) {
      speak("Trajet trop court pour analyser votre pilotage.");
      return;
    }

    // Base score = 100
    let pilotScore = 100;

    // Penalties for harsh riding
    if (stats.maxG > 1.5) pilotScore -= 10;
    if (stats.maxG > 2.5) pilotScore -= 15;
    if (stats.maxSpeed > 60) pilotScore -= 10;

    // Reward for Eco riding
    if (stats.avgSpeed > 25 && stats.avgSpeed < 45) pilotScore += 5;

    // Boundaries
    if (pilotScore > 100) pilotScore = 100;
    if (pilotScore < 0) pilotScore = 0;

    let feedback = "";
    let color = "";

    if (pilotScore >= 90) {
      feedback =
        "Pilotage parfait et Ã©co-responsable. Usure minimale des piÃ¨ces.";
      color = "#00e676";
      if (typeof speak === "function")
        speak("Score de pilotage : Excellent. Conduite fluide et Ã©conome.");
    } else if (pilotScore >= 70) {
      feedback =
        "Bon pilotage, mais quelques accÃ©lÃ©rations brusques dÃ©tectÃ©es.";
      color = "#ffbb33";
      if (typeof speak === "function")
        speak(
          "Score de pilotage : Bon. Attention aux accÃ©lÃ©rations brusques.",
        );
    } else {
      feedback =
        "Conduite trÃ¨s agressive ! Usure critique des freins et de la courroie.";
      color = "#ff4444";
      if (typeof speak === "function")
        speak(
          "Score de pilotage : MÃ©diocre. Conduite trop agressive pour la mÃ©canique.",
        );
    }

    this.showPilotScoreUI(pilotScore, feedback, color);
  },

  showPilotScoreUI: function (score, feedback, color) {
    const modal = document.createElement("div");
    modal.id = "pilot-score-modal";
    modal.style =
      "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:90000; display:flex; align-items:center; justify-content:center;";
    modal.innerHTML = `
            <div class="glassmorphism" style="padding:30px; text-align:center; max-width:90%;">
                <i class="fa-solid fa-flag-checkered" style="font-size:3rem; color:${color}; margin-bottom:15px;"></i>
                <h2 style="margin:0; font-size:1.5rem;">SCORE DE PILOTAGE</h2>
                <div style="font-size:4rem; font-weight:900; margin:20px 0; color:${color}; text-shadow: 0 0 20px ${color};">${score}<span style="font-size:2rem;">/100</span></div>
                <p style="font-size:1.1rem; margin-bottom:30px;">${feedback}</p>
                <button onclick="document.getElementById('pilot-score-modal').remove()" style="width:100%; padding:15px; background:var(--glass-bg); color:white; border:1px solid var(--accent); border-radius:10px; font-weight:bold; cursor:pointer;">FERMER LE RAPPORT</button>
            </div>
        `;
    document.body.appendChild(modal);
  },
};
