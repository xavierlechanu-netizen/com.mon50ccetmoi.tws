/**
 * HAPTIC NAVIGATION ENGINE — MODE COCKPIT OLED HUD & GUIDAGE TACTILE
 * ─────────────────────────────────────────────────────────────────────────────
 * Spécialement conçu pour les conducteurs de 50cc/VSP et les utilisateurs sourds/malentendants :
 *  - Mode Stealth en croisière : Écran noir OLED complet (#000000) pour reposer la vision
 *    nocturne, éliminer les distractions et préserver la batterie du smartphone.
 *  - Wake-up Flash réflexe à l'approche (< 180m) :
 *      1. "Coup de coude" tactile (signatures vibratoires directionnelles asymétriques)
 *      2. Flash lumineux périphérique (vision périphérique réflexe sans focaliser)
 *      3. Flèche de manœuvre géante XXL et distance en chiffres géants (lisible à 1m)
 *  - Fallback intelligent pour iOS (Safari ne supportant pas navigator.vibrate) :
 *    compensation automatique par flash périphérique dynamique.
 *  - Compatible Black Box Francelog (ESP32 BLE) pour vibration déportée sur guidon.
 *  - Conforme OWASP ASVS v5.0.0 (zéro innerHTML dynamique non assaini).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const NAV_MODES = Object.freeze({
  HUD_FLASH: "hud_flash",       // Écran noir OLED + Réveil Flash XXL à <180m + Haptique (Recommandé)
  TACTILE_PUR: "tactile_pur",   // 100% tactile dans la veste (zéro visuel total)
  STANDARD: "standard"          // Carte Google Maps classique + retours vibratoires
});

export const HAPTIC_PATTERNS = Object.freeze({
  LEFT: [100, 80, 250],                         // 2 pulsations (court-long)
  RIGHT: [80, 50, 80, 50, 80],                  // 3 pulsations rapides (staccato ternaire)
  STRAIGHT: [240],                              // 1 pulsation continue et douce
  ROUNDABOUT: [120, 60, 120, 60, 260],          // 2 moyennes + 1 longue (rotation)
  UTURN: [350, 100, 350],                       // 2 secousses appuyées
  HAZARD: [70, 40, 70, 40, 70, 40, 250],       // Rafale d'urgence danger/radar
  DESTINATION: [160, 80, 160, 80, 450],         // Séquence d'arrivée
  START: [100, 80, 100],                        // Démarrage session
  STOP: [180, 80, 180],                         // Fin session
  CONFIRM: [90]                                 // Validation étape franchie
});

export const HAPTIC_MODE_STORAGE_KEY = "mon50cc_nav_haptic_mode";

class HapticNavigationEngine {
  constructor() {
    this.currentMode = this.loadModePreference();
    this.isNavigating = false;
    this.lastManeuver = null;
    this.lastVibrationTimestamp = 0;
    this.hudElement = null;
    this.isManeuverActive = false;
    this.currentSpeed = 0;
  }

  loadModePreference() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = window.localStorage.getItem(HAPTIC_MODE_STORAGE_KEY);
        if (saved && Object.values(NAV_MODES).includes(saved)) {
          return saved;
        }
      }
    } catch (e) {
      console.warn("[HapticNav] Erreur lecture localStorage :", e);
    }
    return NAV_MODES.HUD_FLASH; // Mode par défaut recommandé
  }

  setMode(mode) {
    if (!Object.values(NAV_MODES).includes(mode)) return;
    this.currentMode = mode;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(HAPTIC_MODE_STORAGE_KEY, mode);
      }
    } catch (e) {
      console.warn("[HapticNav] Erreur écriture localStorage :", e);
    }

    if (this.isNavigating) {
      this.syncDisplayWithMode();
    }

    this.vibratePattern(HAPTIC_PATTERNS.CONFIRM);
    this.updateSegmentedControlUI();
    return this.currentMode;
  }

  get isExclusiveHaptic() {
    return this.currentMode === NAV_MODES.TACTILE_PUR;
  }

  get isHudActive() {
    return this.currentMode === NAV_MODES.HUD_FLASH || this.currentMode === NAV_MODES.TACTILE_PUR;
  }

  /**
   * Vérifie si le vibreur matériel est supporté
   */
  isVibrationSupported() {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  }

  /**
   * Émet un motif vibratoire et notifie la Black Box BLE si connectée
   */
  vibratePattern(pattern) {
    let triggered = false;

    // 1. Vibration smartphone (Android / navigateurs compatibles)
    if (this.isVibrationSupported()) {
      try {
        navigator.vibrate(0);
        triggered = navigator.vibrate(pattern);
      } catch (err) {
        console.warn("[HapticNav] Erreur vibrate :", err);
      }
    }

    // 2. Déport vers la Black Box (Francelog ESP32) si connectée en BLE
    if (typeof window !== "undefined") {
      const blackbox = window.blackboxCore || window.BlackBoxCore;
      if (blackbox && typeof blackbox.sendHapticPulse === "function") {
        try {
          blackbox.sendHapticPulse(pattern);
        } catch (e) {
          /* silence */
        }
      }
    }

    // 3. Fallback visuel réflexe si pas de vibration (ex: iPhone Safari)
    if (!triggered && !this.isVibrationSupported() && this.hudElement) {
      this.triggerPeripheralFlash("turn");
    }

    return triggered;
  }

  /**
   * Flash lumineux périphérique (stimule la vision périphérique du motard sans forcer la focalisation)
   */
  triggerPeripheralFlash(type = "turn") {
    if (!this.hudElement) return;
    const flashClass = type === "hazard" ? "peripheral-flash-hazard" : "peripheral-flash-turn";
    this.hudElement.classList.remove("peripheral-flash-turn", "peripheral-flash-hazard");
    // Reflow pour relancer l'animation
    void this.hudElement.offsetWidth;
    this.hudElement.classList.add(flashClass);
    setTimeout(() => {
      if (this.hudElement) {
        this.hudElement.classList.remove(flashClass);
      }
    }, 1200);
  }

  /**
   * Résolution du type de direction selon la manœuvre ou le texte
   */
  resolveDirectionType(maneuver, instructionText = "") {
    const m = String(maneuver || "").toLowerCase();
    const t = String(instructionText || "").toLowerCase();

    if (m.includes("uturn") || t.includes("demi-tour") || t.includes("u-turn")) return "UTURN";
    if (m.includes("roundabout") || m.includes("rotary") || t.includes("rond-point") || t.includes("giratoire")) return "ROUNDABOUT";
    if (m.includes("left") || t.includes("gauche")) return "LEFT";
    if (m.includes("right") || t.includes("droite")) return "RIGHT";
    if (m.includes("straight") || t.includes("tout droit") || t.includes("continuez")) return "STRAIGHT";
    if (t.includes("arrivé") || t.includes("destination") || t.includes("arrived")) return "DESTINATION";

    return "STRAIGHT";
  }

  /**
   * Extrait le numéro de sortie d'un rond-point
   */
  extractRoundaboutExit(instructionText = "") {
    const text = String(instructionText).toLowerCase();
    const match = text.match(/(\d+)(?:ère|ème|e|er|st|nd|rd|th)?\s*sortie/i) || text.match(/take the (\d+)/i);
    return match ? match[1] : null;
  }

  /**
   * Démarre une session de navigation
   */
  startNavigation() {
    this.isNavigating = true;
    this.lastManeuver = null;
    this.lastVibrationTimestamp = Date.now();

    this.ensureHudDOM();
    this.syncDisplayWithMode();
    this.vibratePattern(HAPTIC_PATTERNS.START);
  }

  /**
   * Arrête la session de navigation
   */
  stopNavigation() {
    this.isNavigating = false;
    this.hideHUD();
    this.vibratePattern(HAPTIC_PATTERNS.STOP);
  }

  /**
   * Mise à jour de l'étape de navigation active
   * @param {Object} step - Étape active Google Maps
   * @param {number} distToNextTurn - Distance en mètres avant la manœuvre
   * @param {string} nextStepText - Consigne suivante
   * @param {number} speed - Vitesse actuelle (km/h)
   */
  updateStep(step, distToNextTurn, nextStepText = "", speed = 0) {
    if (!this.isNavigating) return;
    this.currentSpeed = Math.round(speed || 0);

    const maneuver = step.maneuver;
    const cleanInstruction = step.cleanInstruction || "";
    const dirType = this.resolveDirectionType(maneuver, cleanInstruction);

    // Mise à jour de l'affichage de croisière (vitesse)
    this.updateCruiseDisplay();

    // Seuil de réveil : à moins de 180m, le cockpit se réveille
    const isApproaching = distToNextTurn <= 180;

    if (isApproaching) {
      this.wakeUpManeuverHUD(dirType, distToNextTurn, cleanInstruction, nextStepText);

      // Déclenchement de la vibration haptique (avec anti-rebond)
      const now = Date.now();
      if (now - this.lastVibrationTimestamp > 3500 || this.lastManeuver !== dirType) {
        this.lastManeuver = dirType;
        this.lastVibrationTimestamp = now;
        const pattern = HAPTIC_PATTERNS[dirType] || HAPTIC_PATTERNS.STRAIGHT;
        this.vibratePattern(pattern);
        this.triggerPeripheralFlash("turn");
      }
    } else {
      // En croisière (> 180m) : plongée en mode furtif OLED
      this.sleepToCruiseHUD();
    }
  }

  /**
   * Alerte de danger imminent (Radar, obstacle, accident à < 250m)
   */
  triggerHazardAlert(hazardTitle, distMeters) {
    if (!this.isNavigating) return;
    this.showHazardHUD(hazardTitle, distMeters);
    this.vibratePattern(HAPTIC_PATTERNS.HAZARD);
    this.triggerPeripheralFlash("hazard");
  }

  /**
   * Arrivée à destination
   */
  triggerDestinationReached() {
    this.vibratePattern(HAPTIC_PATTERNS.DESTINATION);
    this.stopNavigation();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GESTION DU HUD OLED HAUTE VISIBILITÉ
  // ───────────────────────────────────────────────────────────────────────────

  syncDisplayWithMode() {
    if (!this.hudElement) return;

    if (this.currentMode === NAV_MODES.HUD_FLASH) {
      this.hudElement.style.display = "flex";
      document.body.classList.add("haptic-hud-active");
      this.sleepToCruiseHUD();
    } else if (this.currentMode === NAV_MODES.TACTILE_PUR) {
      this.hudElement.style.display = "flex";
      document.body.classList.add("haptic-hud-active");
      this.setBlindTactileState();
    } else {
      this.hudElement.style.display = "none";
      document.body.classList.remove("haptic-hud-active");
    }
  }

  hideHUD() {
    if (this.hudElement) {
      this.hudElement.style.display = "none";
      document.body.classList.remove("haptic-hud-active");
    }
  }

  updateCruiseDisplay() {
    const speedEl = document.getElementById("hud-cruise-speed-val");
    if (speedEl) {
      speedEl.textContent = String(this.currentSpeed);
    }
  }

  sleepToCruiseHUD() {
    if (this.currentMode !== NAV_MODES.HUD_FLASH) return;

    const cruiseState = document.getElementById("hud-cruise-state");
    const maneuverState = document.getElementById("hud-maneuver-state");
    const hazardState = document.getElementById("hud-hazard-alert");

    if (cruiseState) cruiseState.style.display = "flex";
    if (maneuverState) maneuverState.style.display = "none";
    if (hazardState) hazardState.style.display = "none";
    this.isManeuverActive = false;
  }

  wakeUpManeuverHUD(dirType, distMeters, instructionText, nextStepText) {
    if (this.currentMode === NAV_MODES.TACTILE_PUR) {
      // En mode tactile pur, l'écran reste noir
      return;
    }

    const cruiseState = document.getElementById("hud-cruise-state");
    const maneuverState = document.getElementById("hud-maneuver-state");

    if (cruiseState) cruiseState.style.display = "none";
    if (maneuverState) maneuverState.style.display = "flex";
    this.isManeuverActive = true;

    // Icône géante
    const iconEl = document.getElementById("hud-maneuver-icon");
    const exitBadge = document.getElementById("hud-roundabout-exit");
    if (iconEl) {
      iconEl.className = "fa-solid";
      if (dirType === "LEFT") {
        iconEl.classList.add("fa-arrow-turn-left");
        if (exitBadge) exitBadge.style.display = "none";
      } else if (dirType === "RIGHT") {
        iconEl.classList.add("fa-arrow-turn-right");
        if (exitBadge) exitBadge.style.display = "none";
      } else if (dirType === "ROUNDABOUT") {
        iconEl.classList.add("fa-rotate-right");
        const exitNum = this.extractRoundaboutExit(instructionText);
        if (exitBadge && exitNum) {
          exitBadge.textContent = exitNum;
          exitBadge.style.display = "flex";
        } else if (exitBadge) {
          exitBadge.style.display = "none";
        }
      } else if (dirType === "UTURN") {
        iconEl.classList.add("fa-arrow-rotate-left");
        if (exitBadge) exitBadge.style.display = "none";
      } else {
        iconEl.classList.add("fa-arrow-up");
        if (exitBadge) exitBadge.style.display = "none";
      }
    }

    // Distance géante
    const distEl = document.getElementById("hud-dist-val");
    if (distEl) {
      distEl.textContent = distMeters < 1000 ? `${distMeters} m` : `${(distMeters / 1000).toFixed(1)} km`;
    }

    // Rue & Consigne
    const streetEl = document.getElementById("hud-street-val");
    if (streetEl) {
      streetEl.textContent = instructionText || "Continuez";
    }

    const nextEl = document.getElementById("hud-next-val");
    if (nextEl) {
      nextEl.textContent = nextStepText ? `Puis : ${nextStepText}` : "";
    }
  }

  showHazardHUD(title, distMeters) {
    const hazardState = document.getElementById("hud-hazard-alert");
    if (hazardState) {
      hazardState.style.display = "flex";
      const titleEl = document.getElementById("hud-hz-title");
      if (titleEl) titleEl.textContent = title || "Danger à l'approche";
      const distEl = document.getElementById("hud-hz-dist");
      if (distEl) distEl.textContent = `${distMeters}m`;
    }
  }

  setBlindTactileState() {
    const cruiseState = document.getElementById("hud-cruise-state");
    const maneuverState = document.getElementById("hud-maneuver-state");
    const hazardState = document.getElementById("hud-hazard-alert");

    if (cruiseState) cruiseState.style.display = "none";
    if (maneuverState) maneuverState.style.display = "none";
    if (hazardState) hazardState.style.display = "none";
  }

  /**
   * Construction du DOM du Cockpit OLED HUD
   */
  ensureHudDOM() {
    if (this.hudElement || typeof document === "undefined") return;

    let overlay = document.getElementById("haptic-hud-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "haptic-hud-overlay";
      overlay.className = "haptic-hud-overlay";

      // 1. Barre supérieure
      const topBar = document.createElement("div");
      topBar.className = "hud-top-bar";

      const pill = document.createElement("div");
      pill.className = "hud-mode-pill";
      const pulseDot = document.createElement("span");
      pulseDot.className = "hud-pulse-dot";
      pill.appendChild(pulseDot);
      const pillText = document.createElement("span");
      pillText.id = "hud-top-mode-label";
      pillText.textContent = "Cockpit HUD · Zéro Distraction";
      pill.appendChild(pillText);
      topBar.appendChild(pill);

      const btnSwitch = document.createElement("button");
      btnSwitch.type = "button";
      btnSwitch.className = "hud-btn-switch";
      const iconMap = document.createElement("i");
      iconMap.className = "fa-solid fa-map";
      btnSwitch.appendChild(iconMap);
      btnSwitch.appendChild(document.createTextNode(" Carte"));
      btnSwitch.addEventListener("click", () => {
        this.setMode(NAV_MODES.STANDARD);
      });
      topBar.appendChild(btnSwitch);

      overlay.appendChild(topBar);

      // 2. Zone centrale
      const centerStage = document.createElement("div");
      centerStage.className = "hud-center-stage";

      // A. État de croisière (Noir OLED furtif)
      const cruiseDiv = document.createElement("div");
      cruiseDiv.id = "hud-cruise-state";
      cruiseDiv.className = "hud-cruise-state";

      const speedVal = document.createElement("div");
      speedVal.id = "hud-cruise-speed-val";
      speedVal.className = "hud-cruise-speed";
      speedVal.textContent = "0";
      cruiseDiv.appendChild(speedVal);

      const speedUnit = document.createElement("div");
      speedUnit.className = "hud-cruise-unit";
      speedUnit.textContent = "KM/H · CROISIÈRE";
      cruiseDiv.appendChild(speedUnit);

      const cruiseStatus = document.createElement("div");
      cruiseStatus.className = "hud-cruise-status";
      const iconRoad = document.createElement("i");
      iconRoad.className = "fa-solid fa-road";
      cruiseStatus.appendChild(iconRoad);
      cruiseStatus.appendChild(document.createTextNode(" Écran en veille active · Yeux sur la route"));
      cruiseDiv.appendChild(cruiseStatus);

      centerStage.appendChild(cruiseDiv);

      // B. État de Réveil Manœuvre (< 180m)
      const maneuverDiv = document.createElement("div");
      maneuverDiv.id = "hud-maneuver-state";
      maneuverDiv.className = "hud-maneuver-state";

      const iconWrap = document.createElement("div");
      iconWrap.className = "hud-icon-wrap";
      const maneuverIcon = document.createElement("i");
      maneuverIcon.id = "hud-maneuver-icon";
      maneuverIcon.className = "fa-solid fa-arrow-turn-right";
      iconWrap.appendChild(maneuverIcon);

      const exitBadge = document.createElement("div");
      exitBadge.id = "hud-roundabout-exit";
      exitBadge.className = "hud-roundabout-exit-badge";
      exitBadge.style.display = "none";
      iconWrap.appendChild(exitBadge);

      maneuverDiv.appendChild(iconWrap);

      const distVal = document.createElement("div");
      distVal.id = "hud-dist-val";
      distVal.className = "hud-distance-number";
      distVal.textContent = "120 m";
      maneuverDiv.appendChild(distVal);

      const streetVal = document.createElement("div");
      streetVal.id = "hud-street-val";
      streetVal.className = "hud-street-name";
      streetVal.textContent = "Tournez à droite";
      maneuverDiv.appendChild(streetVal);

      const nextVal = document.createElement("div");
      nextVal.id = "hud-next-val";
      nextVal.className = "hud-next-step-hint";
      maneuverDiv.appendChild(nextVal);

      centerStage.appendChild(maneuverDiv);

      // C. Alerte Danger
      const hazardAlert = document.createElement("div");
      hazardAlert.id = "hud-hazard-alert";
      hazardAlert.className = "hud-hazard-alert";

      const hzIcon = document.createElement("i");
      hzIcon.className = "fa-solid fa-triangle-exclamation hz-icon";
      hazardAlert.appendChild(hzIcon);

      const hzInfo = document.createElement("div");
      hzInfo.className = "hz-info";
      const hzTitle = document.createElement("div");
      hzTitle.id = "hud-hz-title";
      hzTitle.className = "hz-title";
      hzTitle.textContent = "Zone de danger";
      hzInfo.appendChild(hzTitle);
      const hzSub = document.createElement("div");
      hzSub.className = "hz-sub";
      hzSub.textContent = "Ralentissez immédiatement";
      hzInfo.appendChild(hzSub);
      hazardAlert.appendChild(hzInfo);

      const hzDist = document.createElement("div");
      hzDist.id = "hud-hz-dist";
      hzDist.className = "hz-dist";
      hzDist.textContent = "150m";
      hazardAlert.appendChild(hzDist);

      centerStage.appendChild(hazardAlert);

      overlay.appendChild(centerStage);

      // 3. Barre inférieure (Sécurité & Arrêt d'urgence)
      const bottomBar = document.createElement("div");
      bottomBar.className = "hud-bottom-bar";

      // Pastilles de mémorisation tactile à l'arrêt
      const trainingPills = document.createElement("div");
      trainingPills.className = "hud-training-pills";

      const createChip = (iconClass, text, pattern, isDanger = false) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `hud-tactile-chip ${isDanger ? "danger-chip" : ""}`;
        const icon = document.createElement("i");
        icon.className = iconClass;
        chip.appendChild(icon);
        chip.appendChild(document.createTextNode(` ${text}`));
        chip.addEventListener("click", () => {
          this.vibratePattern(pattern);
          this.triggerPeripheralFlash(isDanger ? "hazard" : "turn");
        });
        return chip;
      };

      trainingPills.appendChild(createChip("fa-solid fa-arrow-turn-left", "Gauche (2 bips)", HAPTIC_PATTERNS.LEFT));
      trainingPills.appendChild(createChip("fa-solid fa-arrow-turn-right", "Droite (3 bips)", HAPTIC_PATTERNS.RIGHT));
      trainingPills.appendChild(createChip("fa-solid fa-triangle-exclamation", "Danger (Rafale)", HAPTIC_PATTERNS.HAZARD, true));

      bottomBar.appendChild(trainingPills);

      // Bouton géant d'arrêt d'urgence tactile
      const btnStop = document.createElement("button");
      btnStop.type = "button";
      btnStop.className = "hud-btn-emergency-stop";
      const iconStop = document.createElement("i");
      iconStop.className = "fa-solid fa-hand";
      btnStop.appendChild(iconStop);
      btnStop.appendChild(document.createTextNode(" Arrêter le guidage GPS"));
      btnStop.addEventListener("click", () => {
        if (typeof window.stopTurnByTurnNavigation === "function") {
          window.stopTurnByTurnNavigation();
        } else {
          this.stopNavigation();
        }
      });
      bottomBar.appendChild(btnStop);

      overlay.appendChild(bottomBar);

      document.body.appendChild(overlay);
    }

    this.hudElement = overlay;
  }

  updateSegmentedControlUI() {
    const buttons = document.querySelectorAll(".nav-haptic-segmented-control button");
    buttons.forEach((btn) => {
      const mode = btn.getAttribute("data-nav-mode");
      btn.classList.toggle("active", mode === this.currentMode);
    });
  }
}

export const HapticNav = new HapticNavigationEngine();

if (typeof window !== "undefined") {
  window.HapticNav = HapticNav;
  window.NAV_MODES = NAV_MODES;
}
