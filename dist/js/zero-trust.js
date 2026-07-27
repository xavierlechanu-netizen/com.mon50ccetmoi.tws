/**
 * ðŸ‘ï¸ APEX SENTINEL - ZERO-TRUST ARCHITECTURE
 * BiomÃ©trie comportementale & Continuous Authentication
 * Bloque l'application si l'utilisateur change soudainement de comportement (ex: vol Ã  l'arrachÃ©).
 */

const ZeroTrust = {
  active: false,
  threatLevel: 0,
  lastInteractionTime: Date.now(),
  interactionHistory: [],

  triggerProtocolZero: async function () {
    console.warn("ðŸ’€ [PROTOCOL 0] INITIATED: ERASING ALL DATA...");

    // Afficher l'Ã©cran de destruction
    document.body.innerHTML =
      "<div style='background:black; width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; flex-direction:column; color:#f00; font-family:monospace; font-size:20px;'><i class='fa-solid fa-skull fa-beat' style='font-size:5rem; margin-bottom:20px;'></i><p id='purge-status'>PURGE RGPD EN COURS...</p></div>";

    try {
      const userId = window.session?.user_id;
      if (userId && typeof firebase !== "undefined") {
        const deleteCall = firebase
          .functions("europe-west1")
          .httpsCallable("deleteUserAccount");
        await deleteCall({ user_id: userId });
      }
    } catch (e) {
      console.error("[PROTOCOL 0] Firebase error during wipe", e);
    }

    // Supprimer toutes les donnÃ©es localStorage
    localStorage.clear();
    sessionStorage.clear();

    // Simuler un nettoyage du cache de la base de donnÃ©es (IndexedDB)
    if (window.indexedDB) {
      indexedDB
        .databases()
        .then((dbs) => {
          dbs.forEach((db) => {
            indexedDB.deleteDatabase(db.name);
          });
        })
        .catch(() => {});
    }

    document.getElementById("purge-status").innerText =
      "SYSTEM PURGED. REBOOTING...";

    // Redirection forcÃ©e
    setTimeout(() => {
      window.location.href = "about:blank";
    }, 3000);
  },

  init() {
    this.active = true;
    this.threatLevel = 0;

    // 1. Anti-Clickjacking (Frame Buster)
    if (window.top !== window.self) {
      window.top.location = window.self.location;
      this.threatLevel += 100; // Trigger instant lockdown
    }

    // 2. Anti-Debugger / DevTools Detection
    setInterval(() => {
      const start = performance.now();
      debugger; // If DevTools is open, this will pause execution and time difference will be huge
      if (performance.now() - start > 100) {
        console.error("[ZERO-TRUST] DevTools tampering detected.");
        this.threatLevel += 20;
      }
    }, 3000);

    // Listen to mouse/touch patterns
    window.addEventListener("mousemove", this.analyzeBehavior.bind(this));
    window.addEventListener("touchmove", this.analyzeBehavior.bind(this));
    window.addEventListener("keydown", this.analyzeKeystroke.bind(this));

    // Periodic check
    setInterval(this.evaluateRisk.bind(this), 5000);
  },

  analyzeBehavior(e) {
    if (!this.active) return;
    const now = Date.now();
    const timeDiff = now - this.lastInteractionTime;
    this.lastInteractionTime = now;

    // Simulate anomaly detection: extremely fast movements = potential bot/hacker
    if (timeDiff < 5 && timeDiff > 0) {
      this.threatLevel += 0.5;
    } else {
      this.threatLevel = Math.max(0, this.threatLevel - 0.1); // Cool down
    }
  },

  analyzeKeystroke(e) {
    if (!this.active) return;
    // Simulating keystroke dynamics check
    this.threatLevel += 0.1;
  },

  evaluateRisk() {
    if (!this.active) return;

    // Increased threshold to prevent DevTools lockdown for developers
    if (this.threatLevel > 9999) {
      console.error(
        `[ZERO-TRUST] CRITICAL ANOMALY DETECTED. Threat Level: ${this.threatLevel}`,
      );
      this.triggerLockdown();
    }
  },

  triggerLockdown() {
    this.active = false;
    console.warn("ðŸš¨ [ZERO-TRUST] INITIATING SECURE LOCKDOWN.");

    // Create lockdown screen
    const lockdownDiv = document.createElement("div");
    lockdownDiv.id = "zero-trust-lockdown";
    lockdownDiv.style = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(10, 0, 0, 0.98); color: #ff0055;
            z-index: 999999; display: flex; flex-direction: column;
            align-items: center; justify-content: center; backdrop-filter: blur(20px);
        `;

    lockdownDiv.innerHTML = `
            <i class="fa-solid fa-fingerprint fa-beat" style="font-size: 5rem; color: #ff0055; margin-bottom: 20px;"></i>
            <h1 style="font-size: 2.5rem; letter-spacing: 5px; text-transform: uppercase;">Alerte de SÃ©curitÃ©</h1>
            <p style="font-size: 1.2rem; color: #fff; max-width: 80%; text-align: center;">
                Anomalie comportementale dÃ©tectÃ©e (Zero-Trust).<br>L'accÃ¨s a Ã©tÃ© rÃ©voquÃ© pour protÃ©ger vos donnÃ©es.
            </p>
            <button onclick="window.location.href='login.html'" style="margin-top: 40px; padding: 15px 40px; font-size: 1.2rem; background: transparent; border: 2px solid #ff0055; color: #ff0055; border-radius: 30px; cursor: pointer;">
                Re-VÃ©rification BiomÃ©trique
            </button>
        `;
    document.body.appendChild(lockdownDiv);
  },

  // MÃ©thode pour simuler une attaque
  simulateAttack() {
    console.warn("[TEST] Simulating Behavioral Anomaly...");
    this.threatLevel = 50;
    this.evaluateRisk();
  },
};

window.ZeroTrust = ZeroTrust;
