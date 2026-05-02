/**
 * SENTINEL KERNEL v1.0
 * Self-Healing & Autonomous Development Engine.
 */

window.Sentinel = {
    errorLog: [],
    healthStatus: "OPTIMAL",
    isLockdownActive: false,

    init: function() {
        console.log("🌌 Sentinel Kernel : Nerve System Active.");
        this.initLockdownProtocol();
        this.startGlobalMonitoring();
        this.checkSelfIntegrity();
        this.startSecurityShield();
    },

    initLockdownProtocol: function() {
        window.addEventListener('devicemotion', (e) => {
            if (this.isLockdownActive) return;
            const acc = e.acceleration;
            if (!acc) return;
            
            // SNATCH DETECTION: Sudden violent jerk ( > 40 m/s2 )
            const force = Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z);
            if (force > 45) {
                this.logToSentinel("ALERTE_ARRACHAGE: DÉTECTÉ");
                this.triggerLockdown();
            }
        });
    },

    triggerLockdown: function() {
        this.isLockdownActive = true;
        this.healthStatus = "LOCKDOWN";
        
        // Seal sensitive data
        if (window.Wallet) window.Wallet.lockdown();
        
        // Notification Oracle
        if (window.NeuralHUD) window.NeuralHUD.speakOracle('threat_detected');
        
        // Sign out for safety
        setTimeout(() => {
            localStorage.removeItem('session_key');
            window.location.reload(); 
        }, 2000);
    },

    logToSentinel: function(msg) {
        console.log(`[SENTINEL] ${msg}`);
    },

    // 1. Surveillance et Interception des Bugs
    startGlobalMonitoring: function() {
        window.onerror = (msg, url, line) => {
            this.handleBug("Runtime Error", {msg, url, line});
            return true;
        };

        window.onunhandledrejection = (event) => {
            this.handleBug("Promise Rejection", event.reason);
        };
    },

    // 2. Autonomous Security Shield
    startSecurityShield: function() {
        // Detect DevTools (Anti-Debug) - Désactivé en mode dev local
        setInterval(() => {
            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                const startTime = performance.now();
                // debugger; // Retiré pour permettre le debug
                const endTime = performance.now();
                if (endTime - startTime > 100) {
                    this.triggerPanicMode("DEBUGGER_DETECTED");
                }
            }
        }, 10000);

        // Detect Global Object Tampering
        const criticalGlobals = ['google', 'firebase', 'CryptoJS', 'NeuralHUD'];
        criticalGlobals.forEach(g => {
            if (window[g] && Object.isFrozen && !Object.isFrozen(window[g])) {
                try { Object.freeze(window[g]); } catch(e) {}
            }
        });

        this.checkTampering();
    },

    checkTampering: function() {
        // Simple code integrity check (length check for critical scripts)
        if (document.scripts.length > 50) { // Arbitrary limit for suspicious injection
            this.triggerPanicMode("SUSPICIOUS_SCRIPT_COUNT");
        }
    },

    triggerPanicMode: function(reason) {
        this.healthStatus = "COMPROMISED";
        console.error(`🚨 SECURITY ALERT : ${reason}. Terminating sensitive sessions.`);
        
        if (typeof logout === "function") logout();
        
        document.body.innerHTML = `
            <div style="background:#000; color:#ff4d4d; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; font-family:monospace; padding:20px;">
                <h1 style="font-size:3rem;">SYSTEM_COMPROMISED</h1>
                <p>Sentinel a détecté une intrusion ou une tentative de modification du code source.</p>
                <p style="color:#666;">Code d'erreur: ${reason}</p>
                <button onclick="location.reload()" style="margin-top:20px; padding:10px 20px; background:#ff4d4d; border:none; color:black; font-weight:bold;">RE-BOOT SYSTEM</button>
            </div>
        `;

        if (typeof Blackbox !== "undefined") {
            Blackbox.addEvent("SECURITY_BREACH", { reason });
        }
    },

    repairAttempts: {},

    handleBug: function(type, detail) {
        const now = Date.now();
        console.warn(`🚀 Sentinel : Bug intercepté (${type}). Analyse en cours...`);
        
        this.errorLog.push({type, detail, time: now});
        this.healthStatus = "MONITORING";

        // On ne répare plus automatiquement pour éviter les boucles au démarrage
        // if (detail && detail.msg && detail.msg.includes('google')) this.repairModule('Maps');
        
        setTimeout(() => {
            this.healthStatus = "OPTIMAL";
        }, 1000);
    },

    repairModule: function(name) {
        console.log(`[SENTINEL] Tentative de réparation du module : ${name}`);
        if (name === 'Maps' && typeof initMap === "function") {
            // On ne relance pas initMap si on sait que la clé est bloquée
            if (window.mapsSDKLoaded) return; 
            initMap();
        }
    },

    checkSelfIntegrity: function() {
        const loadTime = performance.now();
        if (loadTime > 2000) {
            localStorage.setItem('sentinel_optimized_boot', 'true');
        }
    }
};

window.Sentinel.init();
