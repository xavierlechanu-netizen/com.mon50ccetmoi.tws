window.NeuralHUD = {
  isNightVisionActive: false,
  tokenBalance: parseFloat(localStorage.getItem("mon50_tokens") || "0"),
  leanHistory: [],
  threatLevel: 0,

  init: function () {
    if (typeof this.initInterceptorMode === "function")
      this.initInterceptorMode();
    this.startNeuralLoop();
    this.initOracle();
    this.initMotionSensors();
    this.initShakeDetection();
    this.initQuantumWave();
    this.initCoreInteraction();
    this.initOBDListener();
    if (typeof window.Intercom !== "undefined") window.Intercom.init();

    this.currentXP = parseInt(localStorage.getItem("pilot_xp") || "0");
    this.updatePilotRank();
    this.updatePilotLevel();
    this.updateTokenDisplay();

    if (typeof EnginePulse !== "undefined") EnginePulse.startSynth();
    this.logToConsole("SINGULARITY_CORE_LOADED");
  },

  updateTokenDisplay: function () {
    const el = document.getElementById("token-balance");
    if (el) el.textContent = this.tokenBalance.toFixed(2);
    localStorage.setItem("mon50_tokens", this.tokenBalance);
  },

  initMotionSensors: function () {
    window.addEventListener("devicemotion", (e) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const g = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z) / 9.81;
      this.currentG = g.toFixed(2);

      const gEl = document.getElementById("g-force-val");
      if (gEl) gEl.textContent = this.currentG + "G";
    });
  },

  initShakeDetection: function () {
    let lastShake = 0;
    window.addEventListener("devicemotion", (e) => {
      const acc = e.acceleration;
      if (!acc) return;
      const total = Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z);
      if (total > 35 && Date.now() - lastShake > 5000) {
        lastShake = Date.now();
        if (window.isRiding) {
          this.logToConsole("GESTURE: SHAKE_DETECTED");
          if (typeof window.saveHazard === "function")
            window.saveHazard("Danger (Auto-Shake)");
        }
      }
    });
  },

  initOBDListener: function () {
    window.addEventListener("obd_status", (e) => {
      const connected = e.detail.connected;
      this.logToConsole(`OBD_II_LINK: ${connected ? "ESTABLISHED" : "LOST"}`);
      if (typeof speak === "function") {
        speak(
          connected
            ? "Liaison tÃ©lÃ©mÃ©trique moteur Ã©tablie."
            : "Alerte : Connexion moteur perdue.",
        );
      }
      const btn = document.getElementById("dock-btn-obd");
      if (btn) {
        btn.style.color = connected ? "#00ffcc" : "#ffaa00";
        btn.style.textShadow = connected ? "0 0 10px #00ffcc" : "none";
      }
    });

    window.addEventListener("obd_data", (e) => {
      const data = e.detail;
      if (data.type === "speed") {
        const speedEl = document.getElementById("speed");
        if (speedEl) speedEl.textContent = data.value;

        const speedBar = document.getElementById("speed-bar");
        if (speedBar)
          speedBar.style.width = Math.min(100, (data.value / 60) * 100) + "%";
      } else if (data.type === "temp") {
        const tempEl = document.getElementById("weather-temp");
        if (tempEl) {
          tempEl.textContent = data.value + "Â°C";
          tempEl.style.color = data.value > 90 ? "#ff4d4d" : "#00d2ff";
          const icon = tempEl.parentElement.querySelector("i");
          if (icon) {
            icon.className = "fa-solid fa-temperature-three-quarters";
            icon.style.color = data.value > 90 ? "#ff4d4d" : "#00d2ff";
          }
        }
      } else if (data.type === "rpm") {
        if (Math.random() > 0.98) this.logToConsole(`RPM: ${data.value}`);
      }
    });
  },

  toggleNightVisionAR: async function () {
    const video = document.getElementById("ar-overlay");
    if (!video) return;

    if (this.isNightVisionActive) {
      this.isNightVisionActive = false;
      document.body.classList.remove("night-vision-active");
      if (video.srcObject) {
        video.srcObject.getTracks().forEach((track) => track.stop());
      }
      speak("Vision nocturne dÃ©sactivÃ©e.");
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        video.srcObject = stream;
        this.isNightVisionActive = true;
        document.body.classList.add("night-vision-active");
        speak("Vision nocturne activÃ©e. Optimisation des contrastes route.");
      } catch (err) {
        console.error("Camera AR failed:", err);
        alert("AccÃ¨s camÃ©ra requis pour la Vision Nocturne.");
      }
    }
  },

  verifyNeuralSignature: function () {
    this.logToConsole("BIOMETRIC: SCANNING...");
    setTimeout(() => {
      this.logToConsole("SIGNATURE: VERIFIED");
      if (typeof speak === "function") speak("Signature neurale confirmÃ©e.");
      this.updatePilotLevel();
    }, 2000);
  },

  updatePilotRank: function () {
    const ranks = [
      "ROOKIE",
      "SCOUT",
      "INTERCEPTOR",
      "GHOST_RIDER",
      "SINGULARITY_PILOT",
    ];
    const rankIdx = Math.min(
      Math.floor(this.currentXP / 1500),
      ranks.length - 1,
    );
    const rankEl = document.getElementById("pilot-rank");
    if (rankEl) rankEl.textContent = `RANK: ${ranks[rankIdx]}`;
    localStorage.setItem("pilot_xp", this.currentXP);
  },

  updatePilotLevel: function () {
    const level = Math.floor(Math.sqrt(this.currentXP / 100)) + 1;
    const levelEl = document.getElementById("pilot-level-tag");
    if (levelEl)
      levelEl.textContent = `LVL ${level.toString().padStart(2, "0")}`;

    if (this.lastLevel && level > this.lastLevel) {
      this.speakOracle("level_up");
      this.triggerLevelUpAnimation(level);
    }
    this.lastLevel = level;
  },

  triggerLevelUpAnimation: function (newLevel) {
    this.logToConsole(`LEVEL UP: ${newLevel}`);
    const overlay = document.createElement("div");
    overlay.style = `position:fixed; top:50%; left:50%; transform:translate(-50%, -50%) scale(0.5); z-index:999999; text-align:center; color:#00d2ff; font-family:'JetBrains Mono', monospace; text-shadow:0 0 20px #00d2ff; pointer-events:none; transition:transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.5s; opacity:0;`;
    overlay.innerHTML = `<i class="fa-solid fa-angles-up" style="font-size:4rem; margin-bottom:10px;"></i><h1 style="margin:0; font-size:3rem;">NIVEAU ${newLevel}</h1><p style="margin:0; font-size:1.5rem; color:#fff;">FÃ©licitations Pilote</p>`;
    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.style.opacity = "1";
      overlay.style.transform = "translate(-50%, -50%) scale(1)";
    }, 50);

    setTimeout(() => {
      overlay.style.opacity = "0";
      overlay.style.transform = "translate(-50%, -50%) scale(1.5)";
      setTimeout(() => overlay.remove(), 500);
    }, 3000);
  },

  triggerRadarScan: function () {
    if (!window.isRiding) return;
    this.logToConsole("RADAR: SCANNING_GRID...");
    setTimeout(() => {
      this.logToConsole("SCAN: NOMINAL");
      if (Math.random() > 0.8) this.speakOracle("tactical");
    }, 2000);
  },

  logToConsole: function (msg) {
    const consoleLogs = document.getElementById("console-logs");
    if (consoleLogs) {
      const log = document.createElement("div");
      log.className = "log";
      log.textContent = `> ${msg}`;
      consoleLogs.prepend(log);
      if (consoleLogs.children.length > 5)
        consoleLogs.lastElementChild.remove();
    }
    // Feed into hijacked console for Telemetry capture
  },

  updateBiometrics: function (speed, stress) {
    const bpmEl = document.getElementById("bio-bpm");
    const focusEl = document.getElementById("bio-focus");
    if (!bpmEl || !focusEl) return;

    const baseBpm = 70 + speed / 2;
    const currentBpm = Math.round(baseBpm + stress * 20 + Math.random() * 5);
    bpmEl.textContent = currentBpm;
    focusEl.textContent = Math.round(Math.max(10, 100 - stress * 50)) + "%";

    const coreInner = document.querySelector(".core-inner");
    if (coreInner) coreInner.style.animationDuration = 60 / currentBpm + "s";

    // Update Quantum Bar based on focus
    const segments = document.querySelectorAll(".sync-segment");
    const activeCount = Math.floor((100 - stress * 50) / 20);
    segments.forEach((s, i) => {
      if (i < activeCount) s.classList.add("active");
      else s.classList.remove("active");
    });
  },

  initQuantumWave: function () {
    const canvas = document.getElementById("quantum-wave-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let phase = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.strokeStyle = "#00f2ff";
      ctx.lineWidth = 2;

      const speedEl = document.getElementById("speed");
      const speed = parseFloat(speedEl ? speedEl.textContent : 0);
      const amplitude = 10 + speed / 2;
      const frequency = 0.05 + speed / 1000;

      for (let x = 0; x < canvas.width; x++) {
        const y =
          canvas.height / 2 + Math.sin(x * frequency + phase) * amplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      phase += 0.1 + speed / 500;
      requestAnimationFrame(animate);
    };

    canvas.width = 120;
    canvas.height = 120;
    animate();
  },

  initCoreInteraction: function () {
    const core = document.getElementById("neural-core");
    if (!core) return;
    core.style.pointerEvents = "auto";
    core.addEventListener("click", () => {
      this.triggerTacticalPulse();
    });
  },

  triggerTacticalPulse: function () {
    this.logToConsole("TACTICAL_PULSE: INITIATED");
    if (typeof speak === "function")
      speak("Impulsion tactique envoyÃ©e. Analyse de zone en cours.");

    const core = document.getElementById("neural-core");
    core.style.transform = "translate(-50%, -50%) scale(1.5)";
    core.style.opacity = "0.8";

    document.body.classList.add("glitch-active");

    setTimeout(() => {
      core.style.transform = "translate(-50%, -50%) scale(1)";
      core.style.opacity = "0.25";
      document.body.classList.remove("glitch-active");
      this.logToConsole("PULSE: DATA_RECEIVED");
    }, 1000);
  },

  initOracle: function () {
    this.oraclePhrases = {
      start: [
        "Core Universel stabilisÃ©. Bienvenue dans l'Omniscience, Pilote.",
        "Liaison totale Ã©tablie. Vous Ãªtes la machine.",
      ],
      speed: [
        "Alerte : Distortion temporelle dÃ©tectÃ©e. Votre vitesse dÃ©fie la rÃ©alitÃ©.",
        "Ralentissez. L'horizon ne peut plus vous suivre.",
      ],
      threat_detected: [
        "ANALYSE : Menace identifiÃ©e. Ã‰limination tactique ou Ã©vitement conseillÃ©.",
      ],
      earnings: [
        "Harmonie SÃ©curitÃ© : +5.00 $MON50 matÃ©rialisÃ©s dans votre Wallet.",
      ],
      squad_on: [
        "Conscience de groupe activÃ©e. Vous ne roulez plus jamais seul.",
      ],
      singularity: ["Point de SingularitÃ© atteint. Tout est UN."],
      god_view: [
        "Radar Global : 50 000 pilotes dÃ©tectÃ©s dans la grille stellaire.",
      ],
      integrity: [
        "Note : Votre armure Sentinel vibre avec le cosmos. Ã‰tat nominal.",
      ],
    };
    setTimeout(() => this.speakOracle("start"), 3000);

    // Simulation de 50 000 pilotes sur la grille
    setInterval(() => {
      if (window.isRiding) {
        this.updateGlobalGrid();
      }
    }, 8000);
  },

  updateGlobalGrid: function () {
    this.logToConsole("GLOBAL_GRID: SYNCING_50000_PILOTS...");
    if (Math.random() > 0.8) this.speakOracle("god_view");
  },

  initBlindSpotDetection: function () {
    const video = document.getElementById("ar-overlay");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    let lastFrameData = null;

    setInterval(() => {
      if (
        !this.isNightVisionActive ||
        video.readyState !== video.HAVE_ENOUGH_DATA
      )
        return;

      canvas.width = 160;
      canvas.height = 120; // Low res for perf
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (lastFrameData) {
        let diff = 0;
        // Focus on sides (Blind spots)
        for (let i = 0; i < frame.data.length; i += 4) {
          const x = (i / 4) % canvas.width;
          if (x < 30 || x > 130) {
            // Side bands
            const delta = Math.abs(frame.data[i] - lastFrameData.data[i]);
            if (delta > 50) diff++;
          }
        }

        if (diff > 500) {
          // Motion threshold
          this.logToConsole("AI_VISION: BLIND_SPOT_MOTION");
          if (Math.random() > 0.9) this.speakOracle("blindspot");
          document.body.classList.add("alert-active");
          setTimeout(
            () => document.body.classList.remove("alert-active"),
            1000,
          );
        }
      }
      lastFrameData = frame;
    }, 200); // 5fps check
  },

  speakOracle: function (category) {
    if (!this.oraclePhrases[category]) return;
    const phrases = this.oraclePhrases[category];
    const text = phrases[Math.floor(Math.random() * phrases.length)];
    if (typeof speak === "function") speak(text);
    this.logToConsole(`ORACLE: ${category.toUpperCase()}`);
  },

  startNeuralLoop: function () {
    window.addEventListener("deviceorientation", (e) => {
      // DÃ©sactivÃ© : EmpÃªche le HUD et le radar de "bouger tout seul" de faÃ§on erratique avec le gyroscope
      /*
            const hud = document.getElementById('hud');
            const radar = document.getElementById('radar-sweep');
            const lean = Math.round(e.gamma);
            if (hud) {
                const tx = (e.beta - 45) / 8; 
                const ty = e.gamma / 8;
                hud.style.transform = `rotateX(${tx}deg) rotateY(${ty}deg) rotateZ(${lean/2}deg)`;
            }
            if (radar) {
                radar.style.transform = `translate(-50%, -50%) rotate(${lean * 2}deg) scale(${1 + Math.abs(e.beta/90)})`;
            }
            */
    });

    const intervalTime = window.isLiteMode ? 500 : 100;
    setInterval(() => {
      try {
        if (!window.isLiteMode) this.updateParticles();
        const speedEl = document.getElementById("speed");
        if (!speedEl) return;
        const speed = parseFloat(speedEl.textContent || 0);

        if (window.isRiding) {
          // ROULER & GAGNER logic
          this.tokenBalance += speed / (3600000 / intervalTime);
          this.updateTokenDisplay();

          if (Math.random() > 0.99) this.speakOracle("earnings");
          if (typeof EnginePulse !== "undefined" && !window.isLiteMode)
            EnginePulse.updateSynth(speed);
        }

        if (!window.isLiteMode) {
          this.updateBiometrics(speed, this.currentStressLevel || 0);
          this.processLidar(speed);
        }
      } catch (e) {
        /* Silently fail to avoid Sentinel loop */
      }
    }, intervalTime);
  },

  runDiagnostics: function () {
    if (window.isRiding) {
      this.logToConsole("AEGIS: ABORTED. CANNOT RUN DIAGNOSTICS DURING RIDE.");
      return;
    }

    this.logToConsole("AEGIS: INITIATING FULL SYSTEM DIAGNOSTIC...");
    if (typeof speak === "function")
      speak("Initialisation des diagnostics systÃ¨me Aegis.");

    const tests = [
      { msg: "NEURAL_LINK: STABLE", delay: 800 },
      { msg: "GPS_COHERENCE: 99.8%", delay: 1500 },
      { msg: "SENTINEL_SHIELD: OPTIMAL", delay: 2200 },
      { msg: "QUANTUM_WALLET: SYNCED", delay: 3000 },
      { msg: "DIAGNOSTIC_COMPLETE: ALL_SYSTEMS_GO", delay: 4000 },
    ];

    tests.forEach((t, i) => {
      setTimeout(() => {
        this.logToConsole(`AEGIS: ${t.msg}`);
        if (i === tests.length - 1 && typeof speak === "function") {
          speak("Diagnostic terminÃ©. Tous les systÃ¨mes sont optimaux.");
        }
      }, t.delay);
    });
  },

  processLidar: function (speed) {
    // Simulation d'une analyse LiDAR 3D dans le HUD
    const grid = document.getElementById("digital-horizon");
    if (grid) {
      grid.style.transform = `perspective(1000px) rotateX(60deg) translateY(${speed}px)`;
      grid.style.opacity = 0.1 + speed / 120;
    }
  },

  updateParticles: function () {
    const container = document.getElementById("neural-particles");
    const speedEl = document.getElementById("speed");
    if (!container || !speedEl || !window.isRiding) return;
    const speed = parseFloat(speedEl.textContent || 0);
    if (container.children.length < (speed > 60 ? 40 : 20)) {
      const p = document.createElement("div");
      p.className = "particle";
      p.style.left = "50%";
      p.style.top = "50%";
      container.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
  },

  updateInterceptorGrid: function () {
    if (!window.map || !window.currentPosition) return;
    if (Math.random() > 0.95) {
      const lat = window.currentPosition.lat + (Math.random() - 0.5) * 0.005;
      const lng = window.currentPosition.lng + (Math.random() - 0.5) * 0.005;
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: window.map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 4,
          fillColor: "#00d2ff",
          fillOpacity: 0.6,
          strokeWeight: 0,
        },
      });
      setTimeout(() => marker.setMap(null), 5000);
    }
  },
};

window.toggleHolographicMode = function () {
  document.body.classList.toggle("holographic-mode");
  const isActive = document.body.classList.contains("holographic-mode");
  speak(
    isActive
      ? "Mode Projection Pare-brise activÃ©."
      : "Mode HUD Standard activÃ©.",
  );
};

window.NeuralHUD.init();

if (window.NeuralHUD) {
  window.NeuralHUD.initInterceptorMode = function () {
    this.logToConsole("INTERCEPTOR_MODE: ENGAGED");
    this.updateWeatherRadar();
    setInterval(() => this.updateWeatherRadar(), 15000); // Update every 15s

    // Random glitch events for high speed
    setInterval(() => {
      if (window.session && window.session.vMax > 80 && Math.random() > 0.8) {
        this.triggerGlitchAlert("OVER_SPEED_WARNING");
      }
    }, 10000);
  };

  window.NeuralHUD.updateWeatherRadar = function () {
    const tempEl = document.getElementById("weather-temp");
    const windEl = document.getElementById("weather-wind");
    const radarEl = document.getElementById("radar-users");

    if (tempEl) {
      // Fake realistic temp between 12 and 22
      const temp = Math.floor(Math.random() * 10) + 12;
      tempEl.textContent = temp + "Â°C";
      // Wind speed between 5 and 35 km/h
      const wind = Math.floor(Math.random() * 30) + 5;
      windEl.textContent = wind + " km/h";

      if (wind > 25) {
        windEl.style.color = "#ffb703"; // Warning high wind
      } else {
        windEl.style.color = "#00d2ff"; // Normal
      }
    }

    if (radarEl) {
      // Fake nearby users
      const users = Math.floor(Math.random() * 8);
      if (users > 0) {
        radarEl.innerHTML = `<span><strong style="color:#fff;">${users}</strong> Pilotes dans le secteur</span>`;
      } else {
        radarEl.innerHTML = `<span style="color:#aaa;">Zone dÃ©gagÃ©e</span>`;
      }
    }
  };

  window.NeuralHUD.triggerGlitchAlert = function (reason) {
    this.logToConsole("ALERT: " + reason);
    const overlay = document.getElementById("glitch-overlay");
    if (!overlay) return;

    overlay.style.display = "block";

    // Flashing effect
    let flashes = 0;
    const flashInterval = setInterval(() => {
      overlay.style.opacity = flashes % 2 === 0 ? "1" : "0.2";
      flashes++;
      if (flashes > 5) {
        clearInterval(flashInterval);
        overlay.style.opacity = "0";
        setTimeout(() => {
          overlay.style.display = "none";
        }, 200);
      }
    }, 80);

    // Glitch the whole body slightly
    document.body.style.filter =
      "contrast(150%) hue-rotate(90deg) saturate(200%)";
    setTimeout(() => {
      document.body.style.filter = "none";
    }, 500);

    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
  };
}
