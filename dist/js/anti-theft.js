window.AntiTheft = {
  isSentryActive: false,
  sentryListener: null,

  toggleSentryMode: function () {
    if (this.isSentryActive) {
      this.stopSentry();
      speak("Mode Sentinelle désactivé.");
    } else {
      this.startSentry();
      speak(
        "Mode Sentinelle activé. Périmètre sécurisé. Je surveille l'accéléromètre.",
      );
    }

    const btn = document.getElementById("dock-btn-sentry");
    if (btn) {
      if (this.isSentryActive) {
        btn.style.color = "#ff0000";
        btn.style.animation = "pulse-halo 1.5s infinite";
        btn.title = "Mode Sentinelle ACTIF (Appuyer pour désactiver)";
      } else {
        btn.style.color = "#ff3333";
        btn.style.animation = "none";
        btn.title = "Mode Sentinelle";
      }
    }
  },

  startSentry: function () {
    this.isSentryActive = true;
    let lastPeak = 0;

    this.sentryListener = (e) => {
      const acc = e.acceleration;
      if (!acc) return;
      const force = Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z);

      if (force > 3.0 && Date.now() - lastPeak > 3000) {
        lastPeak = Date.now();
        this.triggerSentryAlert(force);
      }
    };
    window.addEventListener("devicemotion", this.sentryListener);
  },

  playSiren: function () {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.oscillator = this.audioCtx.createOscillator();
    this.gainNode = this.audioCtx.createGain();

    this.oscillator.type = "square";
    this.oscillator.frequency.setValueAtTime(800, this.audioCtx.currentTime);
    this.oscillator.frequency.linearRampToValueAtTime(
      1200,
      this.audioCtx.currentTime + 0.5,
    );
    this.oscillator.frequency.linearRampToValueAtTime(
      800,
      this.audioCtx.currentTime + 1.0,
    );

    // Loop effect
    this.sirenInterval = setInterval(() => {
      if (!this.isSentryActive) return;
      this.oscillator.frequency.setValueAtTime(800, this.audioCtx.currentTime);
      this.oscillator.frequency.linearRampToValueAtTime(
        1200,
        this.audioCtx.currentTime + 0.5,
      );
      this.oscillator.frequency.linearRampToValueAtTime(
        800,
        this.audioCtx.currentTime + 1.0,
      );
    }, 1000);

    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.audioCtx.destination);
    this.gainNode.gain.setValueAtTime(1, this.audioCtx.currentTime);
    this.oscillator.start();
  },

  stopSiren: function () {
    if (this.sirenInterval) clearInterval(this.sirenInterval);
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.disconnect();
      this.oscillator = null;
    }
    const overlay = document.getElementById("glitch-overlay");
    if (overlay) overlay.style.display = "none";
  },

  stopSentry: function () {
    this.isSentryActive = false;
    this.stopSiren();
    if (this.sentryListener)
      window.removeEventListener("devicemotion", this.sentryListener);
  },

  triggerSentryAlert: function (force) {
    speak(
      "ALERTE : Mouvement suspect détecté. Enregistrement Sentinel activé.",
    );
    vibrate([500, 200, 500]);
    if (!this.oscillator) this.playSiren();
    const overlay = document.getElementById("glitch-overlay");
    if (overlay) {
      overlay.style.display = "block";
      overlay.style.opacity = "0.8";
      overlay.style.background = "red";
    }

    // Deterrent: Flashlight blink if available
    if (typeof Hardware !== "undefined" && Hardware.toggleFlashlightSOS) {
      Hardware.toggleFlashlightSOS(true);
      setTimeout(() => Hardware.toggleFlashlightSOS(false), 2000);
    }

    // HUD Log
    if (window.NeuralHUD) {
      window.NeuralHUD.logToConsole(
        `SENTRY_ALERT: MOTION_DETECTED (${force.toFixed(1)}G)`,
      );
    }

    // Remote Notification simulation / Firebase Cloud Function call
    const projectId = window.CONFIG?.FIREBASE?.projectId || "mon50ccetmoi";
    const functionUrl = `https://europe-west1-${projectId}.cloudfunctions.net/triggerAntiTheftAlert`;

    fetch(functionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: window.session?.uid || "GUEST",
        force: force,
        location: window.currentPosition
          ? `${window.currentPosition.lat},${window.currentPosition.lng}`
          : "Unknown",
      }),
    })
      .then((res) => res.json())
      .then((data) => {})
      .catch((err) => {
        console.error("SENTRY_CLOUD_ALERT: Failed to notify server", err);
      });
  },

  reportTheft: async function () {
    // ... (Keep existing reportTheft)
  },
};
