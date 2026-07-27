/**
 * DRIVING SCORE ENGINE v1.0 (InsurTech Core)
 * Score de conduite 0-100 calculÃ© en temps rÃ©el Ã  partir de la tÃ©lÃ©mÃ©trie.
 * ExploitÃ© par le portail B2B Assureur pour le "Pay How You Drive".
 */

window.DrivingScore = {
  currentScore: 100, // Commence Ã  100, les infractions font baisser
  sessionPenalties: [],
  isTracking: false,
  lastGForce: 0,
  smoothAccelHistory: [],

  // Seuils de pÃ©nalitÃ© (calibrÃ©s pour un 50cc / VSP)
  THRESHOLDS: {
    HARD_BRAKE: 2.5, // G-Force freinage brusque
    HARD_ACCEL: 2.0, // G-Force accÃ©lÃ©ration violente
    OVER_SPEED: 47, // km/h (limite lÃ©gale 45 + tolÃ©rance)
    CORNERING: 1.8, // G-Force virage agressif
    PENALTY_HARD_BRAKE: -5,
    PENALTY_HARD_ACCEL: -3,
    PENALTY_OVER_SPEED: -8,
    PENALTY_CORNERING: -4,
    BONUS_SMOOTH_KM: +1, // Bonus par km sans infraction
  },

  init: function () {
    this.currentScore = parseInt(
      localStorage.getItem("drivingScore") || "100",
      10,
    );
    this.createScoreHUD();

    // Ã‰couter l'accÃ©lÃ©romÃ¨tre
    window.addEventListener("devicemotion", (event) => {
      if (!this.isTracking) return;
      this.analyzeMotion(event);
    });
  },

  // CrÃ©er le petit badge de score flottant
  createScoreHUD: function () {
    const badge = document.createElement("div");
    badge.id = "driving-score-badge";
    badge.innerHTML = `
            <div class="ds-ring">
                <svg viewBox="0 0 36 36">
                    <path class="ds-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                    <path class="ds-fill" id="ds-arc" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                </svg>
                <span id="ds-value">${this.currentScore}</span>
            </div>
            <span class="ds-label">Score</span>
        `;
    Object.assign(badge.style, {
      position: "fixed",
      bottom: "120px",
      right: "15px",
      zIndex: "9998",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      cursor: "pointer",
      transition: "transform 0.3s ease",
    });
    badge.addEventListener("click", () => this.showDetailPanel());
    document.body.appendChild(badge);
    this.updateScoreVisual();
  },

  // Analyser les donnÃ©es de mouvement en temps rÃ©el
  analyzeMotion: function (event) {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;

    const gForce =
      Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z) / 9.81;
    this.lastGForce = gForce;

    // Historique pour lissage (Ã©viter les faux positifs)
    this.smoothAccelHistory.push(gForce);
    if (this.smoothAccelHistory.length > 5) this.smoothAccelHistory.shift();
    const avgG =
      this.smoothAccelHistory.reduce((a, b) => a + b, 0) /
      this.smoothAccelHistory.length;

    // Freinage brusque
    if (avgG > this.THRESHOLDS.HARD_BRAKE && acc.z < -15) {
      this.applyPenalty(
        "HARD_BRAKE",
        `Freinage brusque dÃ©tectÃ© (${avgG.toFixed(1)}G)`,
      );
    }
    // AccÃ©lÃ©ration violente
    else if (avgG > this.THRESHOLDS.HARD_ACCEL && acc.z > 15) {
      this.applyPenalty(
        "HARD_ACCEL",
        `AccÃ©lÃ©ration agressive (${avgG.toFixed(1)}G)`,
      );
    }
    // Virage agressif (G latÃ©ral)
    else if (Math.abs(acc.x) / 9.81 > this.THRESHOLDS.CORNERING) {
      this.applyPenalty(
        "CORNERING",
        `Virage agressif (${(Math.abs(acc.x) / 9.81).toFixed(1)}G latÃ©ral)`,
      );
    }
  },

  // VÃ©rifier l'excÃ¨s de vitesse (appelÃ© par le GPS de app-map.js)
  checkSpeed: function (currentSpeedKmh) {
    if (currentSpeedKmh > this.THRESHOLDS.OVER_SPEED) {
      this.applyPenalty(
        "OVER_SPEED",
        `ExcÃ¨s de vitesse : ${currentSpeedKmh.toFixed(0)} km/h`,
      );
    }
  },

  // Bonus par kilomÃ¨tre sans infraction (appelÃ© par la tÃ©lÃ©mÃ©trie)
  awardSmoothKm: function () {
    const lastPenaltyTime =
      this.sessionPenalties.length > 0
        ? this.sessionPenalties[this.sessionPenalties.length - 1].time
        : 0;

    // Si aucune pÃ©nalitÃ© dans les 5 derniÃ¨res minutes
    if (Date.now() - lastPenaltyTime > 300000) {
      this.currentScore = Math.min(
        100,
        this.currentScore + this.THRESHOLDS.BONUS_SMOOTH_KM,
      );
      this.saveAndUpdate();
    }
  },

  // Appliquer une pÃ©nalitÃ© (avec cooldown anti-spam de 10s)
  applyPenalty: function (type, description) {
    const now = Date.now();
    const lastSameType = this.sessionPenalties
      .filter((p) => p.type === type)
      .pop();
    if (lastSameType && now - lastSameType.time < 10000) return; // Cooldown 10s

    const penalty = this.THRESHOLDS[`PENALTY_${type}`];
    this.currentScore = Math.max(0, this.currentScore + penalty);

    this.sessionPenalties.push({ type, description, penalty, time: now });
    this.saveAndUpdate();

    console.warn(`ðŸ† DrivingScore : ${penalty} pts â†’ ${description}`);

    // Vibration d'avertissement
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

    // Alerte vocale pour les infractions graves
    if (penalty <= -5 && typeof speak === "function") {
      speak(`Attention. ${description}. Votre score de conduite baisse.`);
    }
  },

  // Sauvegarder et mettre Ã  jour le visuel
  saveAndUpdate: function () {
    localStorage.setItem("drivingScore", this.currentScore.toString());
    this.updateScoreVisual();

    // Notifier le ReferralManager pour le bonus de conduite sÃ©curisÃ©e
    if (this.currentScore >= 80 && window.ReferralManager) {
      window.ReferralManager.checkSafeDrivingBonus(true);
    }
  },

  updateScoreVisual: function () {
    const valueEl = document.getElementById("ds-value");
    const arcEl = document.getElementById("ds-arc");
    if (!valueEl || !arcEl) return;

    valueEl.textContent = this.currentScore;
    arcEl.setAttribute("stroke-dasharray", `${this.currentScore}, 100`);

    // Couleur dynamique selon le score
    let color = "#00ff88"; // Vert (excellent)
    if (this.currentScore < 70) color = "#ffaa00"; // Orange (attention)
    if (this.currentScore < 40) color = "#ff3355"; // Rouge (danger)

    arcEl.style.stroke = color;
    valueEl.style.color = color;
  },

  // Activer/DÃ©sactiver le tracking (liÃ© Ã  GuardianAngel)
  start: function () {
    this.isTracking = true;
    this.sessionPenalties = [];
  },

  stop: function () {
    this.isTracking = false;
  },

  // Panneau de dÃ©tail (affiche les pÃ©nalitÃ©s de la session)
  showDetailPanel: function () {
    let existing = document.getElementById("ds-detail-panel");
    if (existing) {
      existing.remove();
      return;
    }

    const panel = document.createElement("div");
    panel.id = "ds-detail-panel";
    Object.assign(panel.style, {
      position: "fixed",
      bottom: "200px",
      right: "15px",
      width: "280px",
      background: "rgba(0,0,0,0.92)",
      border: "1px solid rgba(0,210,255,0.3)",
      borderRadius: "16px",
      padding: "16px",
      zIndex: "9999",
      color: "#fff",
      fontFamily: "'Courier New', monospace', fontSize: '12px",
      backdropFilter: "blur(10px)",
      boxShadow: "0 0 30px rgba(0,210,255,0.2)",
    });

    let penaltiesHTML =
      this.sessionPenalties.length === 0
        ? '<div style="color:#00ff88; text-align:center;">âœ… Aucune infraction</div>'
        : this.sessionPenalties
            .slice(-5)
            .map(
              (p) =>
                `<div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <span style="color:#ff3355;">${p.penalty}</span> ${p.description}
                </div>`,
            )
            .join("");

    panel.innerHTML = `
            <div style="font-size:14px; font-weight:bold; margin-bottom:10px; color:#00d2ff;">
                ðŸ“Š Score de Conduite : ${this.currentScore}/100
            </div>
            <div style="font-size:11px; color:#888; margin-bottom:8px;">
                DerniÃ¨res infractions (session) :
            </div>
            ${penaltiesHTML}
            <div style="margin-top:12px; font-size:10px; color:#666; text-align:center;">
                Tap pour fermer
            </div>
        `;
    panel.addEventListener("click", () => panel.remove());
    document.body.appendChild(panel);
  },

  // GÃ©nÃ©rer un rÃ©sumÃ© pour le portail B2B Assureur
  generateInsuranceReport: function () {
    return {
      score: this.currentScore,
      totalPenalties: this.sessionPenalties.length,
      hardBrakes: this.sessionPenalties.filter((p) => p.type === "HARD_BRAKE")
        .length,
      hardAccels: this.sessionPenalties.filter((p) => p.type === "HARD_ACCEL")
        .length,
      overSpeeds: this.sessionPenalties.filter((p) => p.type === "OVER_SPEED")
        .length,
      aggressiveTurns: this.sessionPenalties.filter(
        (p) => p.type === "CORNERING",
      ).length,
      riskLevel:
        this.currentScore >= 80
          ? "LOW"
          : this.currentScore >= 50
            ? "MEDIUM"
            : "HIGH",
      timestamp: new Date().toISOString(),
    };
  },
};

// Auto-init
window.addEventListener("DOMContentLoaded", () => {
  window.DrivingScore.init();
});
