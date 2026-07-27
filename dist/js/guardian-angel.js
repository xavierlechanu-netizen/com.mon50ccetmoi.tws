/**
 * GUARDIAN ANGEL SYSTEM v2.0
 * The ultimate safety shield for mon50ccetmoi riders.
 */

window.GuardianAngel = {
  isActive: false,
  sessionId: null,
  safetyCheckTimer: null,
  lastUpdatePos: null,
  lastOvertakeWarning: 0,

  init: function () {
    // 1. Crash Detection Listener
    window.addEventListener("devicemotion", (event) => {
      if (!this.isActive || this.crashCountdown) return;

      const acc = event.accelerationIncludingGravity;
      if (acc) {
        // Calculate total acceleration vector
        const gForce =
          Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z) / 9.81;

        // If G-Force > 5G (approx 50m/s^2), trigger Crash Detection
        if (gForce > 5.0) {
          this.detectCrash();
        }
      }
    });
  },

  toggle: async function () {
    if (window.session && window.session.isGuest) {
      alert(
        "L'Ange Gardien est rÃ©servÃ© aux membres inscrits. SÃ©curisez vos rides maintenant ! ðŸ›¡ï¸",
      );
      return;
    }

    const btn = document.getElementById("btn-guardian-toggle");
    const halo = document.getElementById("guardian-halo");
    const statusText = document.getElementById("guardian-status");

    if (!this.isActive) {
      // ACTIVATION
      this.isActive = true;
      window.isGuardianActive = true; // Legacy support
      btn.classList.add("active");
      if (halo) halo.classList.remove("hidden");
      if (statusText) statusText.textContent = "ON";

      await this.startSession();
      speak("start_guardian"); // Utilise la clÃ© du lexique
      vibrate([100, 50, 100]);
    } else {
      // DESACTIVATION
      this.isActive = false;
      window.isGuardianActive = false; // Legacy support
      btn.classList.remove("active");
      if (halo) halo.classList.add("hidden");
      if (statusText) statusText.textContent = "OFF";

      this.stopSession();
      speak("stop_guardian");
    }
  },

  startSession: async function () {
    if (typeof db === "undefined" || !window.session) return;

    const pos = currentPosition || { lat: 48.8566, lng: 2.3522 };
    this.sessionId = "guardian_" + window.session.uid + "_" + Date.now();

    const sessionData = {
      userId: window.session.uid,
      username: window.session.username || "Pilote Anonyme",
      startTime: firebase.firestore.FieldValue.serverTimestamp(),
      status: "SAFE",
      lastPos: pos,
      vMax: 0,
    };

    try {
      await db
        .collection("guardian_sessions")
        .doc(this.sessionId)
        .set(sessionData);

      if (navigator.share) {
        try {
          const confirmShare = confirm(
            "Ange Gardien actif. Voulez-vous partager votre lien de suivi en temps rÃ©el avec un proche ?",
          );
          if (confirmShare) {
            await navigator.share({
              title: "Suis mon ride en direct !",
              text: `Je roule avec mon50ccetmoi. Si j'ai un problÃ¨me, tu seras alertÃ© ici :`,
              url: `https://mon50ccetmoi.app/track?s=${this.sessionId}`,
            });
          }
        } catch (shareErr) {
          console.warn("Share cancelled");
        }
      }

      this.startMonitoring();
    } catch (e) {
      console.error("Guardian Start Fail:", e);
      this.startMonitoring();
    }
  },

  startMonitoring: function () {
    this.safetyCheckTimer = setInterval(async () => {
      if (!this.isActive || !currentPosition) return;

      const statusData = {
        lastPos: currentPosition,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
        vMax: window.session.vMax || 0,
        isOnline: navigator.onLine,
      };

      if (navigator.onLine) {
        try {
          await db
            .collection("guardian_sessions")
            .doc(this.sessionId)
            .update(statusData);
        } catch (e) {
          localStorage.setItem(
            "guardian_offline_buffer",
            JSON.stringify(statusData),
          );
        }
      } else {
        localStorage.setItem(
          "guardian_offline_buffer",
          JSON.stringify(statusData),
        );
      }

      // Inactivity Check
      if (!window.isRiding) {
        if (!this.lastStopCheck) this.lastStopCheck = Date.now();
        const stopDuration = (Date.now() - this.lastStopCheck) / 1000;
        if (stopDuration > 180) {
          this.triggerSafetyPrompt();
          this.lastStopCheck = Date.now();
        }
      } else {
        this.lastStopCheck = null;
      }
    }, 15000);
  },

  /**
   * NEW: Check for dangerous overtaking patterns
   * Triggered by rapid lean angle changes or high lean at speed.
   */
  checkOvertakingSafety: function (speed, leanAngle) {
    if (!this.isActive || speed < 35) return;

    // Pattern: High lean (>30Â°) while at relatively high speed for a 50cc
    if (Math.abs(leanAngle) > 30) {
      const now = Date.now();
      if (now - this.lastOvertakeWarning > 12000) {
        // Throttle warnings (12s)
        speak("danger_overtake");
        vibrate([200, 100, 200]);
        if (window.NeuralHUD)
          window.NeuralHUD.logToConsole("SAFETY_ALERT: DANGEROUS_OVERTAKE");
        this.lastOvertakeWarning = now;
      }
    }
  },

  triggerSafetyPrompt: function () {
    vibrate([500, 200, 500]);
    speak(
      "Alerte Ange Gardien. Vous Ãªtes Ã  l'arrÃªt depuis longtemps. Tout va bien ?",
    );

    const prompt = document.createElement("div");
    prompt.className = "safety-prompt-overlay";
    prompt.style =
      "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:20000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; padding:30px; text-align:center;";
    prompt.innerHTML = `
            <i class="fa-solid fa-shield-halved" style="font-size:4rem; color:#00d2ff; margin-bottom:20px;"></i>
            <h2>VÃ©rification de SÃ©curitÃ©</h2>
            <p>L'Ange Gardien dÃ©tecte un arrÃªt prolongÃ©.</p>
            <button id="btn-safety-ok" style="width:100%; padding:20px; background:#00d2ff; color:black; border:none; border-radius:15px; font-weight:bold; font-size:1.2rem; margin-top:20px;">JE VAIS BIEN âœ…</button>
            <button id="btn-safety-sos" style="width:100%; padding:15px; background:#ff4444; color:white; border:none; border-radius:15px; font-weight:bold; margin-top:15px;">BESOIN D'AIDE ðŸ†˜</button>
        `;
    document.body.appendChild(prompt);

    const timer = setTimeout(() => {
      this.triggerSOS("InactivitÃ© prolongÃ©e dÃ©tectÃ©e.");
      prompt.remove();
    }, 30000);

    document.getElementById("btn-safety-ok").onclick = () => {
      clearTimeout(timer);
      prompt.remove();
      speak("Ravi de l'entendre. Bonne route.");
    };

    document.getElementById("btn-safety-sos").onclick = () => {
      clearTimeout(timer);
      this.triggerSOS("Demande d'aide manuelle.");
      prompt.remove();
    };
  },

  /**
   * NEW: CRASH DETECTION LOGIC
   */
  detectCrash: function () {
    if (this.crashCountdown) return;

    console.warn("CRASH DÃ‰TECTÃ‰ (>5G) !");
    vibrate([1000, 500, 1000, 500, 1000]);
    speak(
      "Alerte de collision majeure dÃ©tectÃ©e. Appel des secours dans 15 secondes.",
    );

    const prompt = document.createElement("div");
    prompt.className = "crash-prompt-overlay";
    prompt.style =
      "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255, 0, 0, 0.95); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; padding:30px; text-align:center; animation: pulseRed 1s infinite;";
    prompt.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="font-size:5rem; color:#fff; margin-bottom:20px;"></i>
            <h1 style="font-size:3rem; margin:0;">CRASH DÃ‰TECTÃ‰</h1>
            <p style="font-size:1.2rem; font-weight:bold;">Envoi des secours dans <span id="crash-timer" style="font-size:2rem;">15</span>s</p>
            <button id="btn-crash-cancel" style="width:100%; padding:20px; background:#fff; color:red; border:none; border-radius:15px; font-weight:900; font-size:1.5rem; margin-top:40px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);">JE VAIS BIEN (ANNULER)</button>
        `;
    document.body.appendChild(prompt);

    let timeLeft = 15;
    this.crashCountdown = setInterval(() => {
      timeLeft--;
      const timerEl = document.getElementById("crash-timer");
      if (timerEl) timerEl.textContent = timeLeft;

      if (timeLeft <= 0) {
        clearInterval(this.crashCountdown);
        this.crashCountdown = null;
        prompt.remove();
        this.triggerSOS("Choc violent (>5G). Aucune rÃ©ponse du pilote.");
      }
    }, 1000);

    document.getElementById("btn-crash-cancel").onclick = () => {
      clearInterval(this.crashCountdown);
      this.crashCountdown = null;
      prompt.remove();
      speak("Alerte de collision annulÃ©e. Restez prudent.");
    };
  },

  triggerSOS: async function (reason) {
    if (!this.sessionId || typeof db === "undefined") return;

    speak("ALERTE SOS LANÃ‡Ã‰E. Transfert des donnÃ©es aux secours.");
    if (typeof Hardware !== "undefined" && Hardware.vibratePattern) {
      Hardware.vibratePattern("sos");
    }

    const structural = window.Blackbox
      ? window.Blackbox.getStructuralScore()
      : "UNKNOWN";

    if (navigator.onLine) {
      db.collection("guardian_sessions").doc(this.sessionId).update({
        status: "DANGER",
        alertReason: reason,
        deviceIntegrity: structural,
        alertTime: firebase.firestore.FieldValue.serverTimestamp(),
      });

      db.collection("emergency_alerts").add({
        userId: window.session.uid,
        username: window.session.username,
        pos: currentPosition,
        reason: reason,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    // SMS Fallback
    const smsBody = encodeURIComponent(
      `URGENCE MON50CC ! ${reason} Position GPS: https://maps.google.com/?q=${currentPosition?.lat},${currentPosition?.lng}`,
    );
    window.location.href = `sms:?body=${smsBody}`;
  },

  stopSession: function () {
    if (this.safetyCheckTimer) clearInterval(this.safetyCheckTimer);
    if (this.sessionId && navigator.onLine) {
      db.collection("guardian_sessions").doc(this.sessionId).update({
        status: "FINISHED",
        endTime: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    this.sessionId = null;
  },
};

window.toggleGuardianAngel = () => window.GuardianAngel.toggle();
window.triggerEmergencySOS = (r) => window.GuardianAngel.triggerSOS(r);
