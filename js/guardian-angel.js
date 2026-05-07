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

    init: function() {
        console.log("Guardian Angel System : [ READY ]");
    },

    toggle: async function() {
        if (window.session && window.session.isGuest) {
            alert("L'Ange Gardien est réservé aux membres inscrits. Sécurisez vos rides maintenant ! 🛡️");
            return;
        }

        const btn = document.getElementById('btn-guardian-toggle');
        const halo = document.getElementById('guardian-halo');
        const statusText = document.getElementById('guardian-status');

        if (!this.isActive) {
            // ACTIVATION
            this.isActive = true;
            window.isGuardianActive = true; // Legacy support
            btn.classList.add('active');
            if (halo) halo.classList.remove('hidden');
            if (statusText) statusText.textContent = "ON";
            
            await this.startSession();
            speak("start_guardian"); // Utilise la clé du lexique
            vibrate([100, 50, 100]);
        } else {
            // DESACTIVATION
            this.isActive = false;
            window.isGuardianActive = false; // Legacy support
            btn.classList.remove('active');
            if (halo) halo.classList.add('hidden');
            if (statusText) statusText.textContent = "OFF";
            
            this.stopSession();
            speak("stop_guardian");
        }
    },

    startSession: async function() {
        if (typeof db === "undefined" || !window.session) return;
        
        const pos = currentPosition || { lat: 48.8566, lng: 2.3522 };
        this.sessionId = "guardian_" + window.session.uid + "_" + Date.now();
        
        const sessionData = {
            userId: window.session.uid,
            username: window.session.username || "Pilote Anonyme",
            startTime: firebase.firestore.FieldValue.serverTimestamp(),
            status: "SAFE",
            lastPos: pos,
            vMax: 0
        };

        try {
            await db.collection("guardian_sessions").doc(this.sessionId).set(sessionData);
            console.log("Guardian Session Started:", this.sessionId);
            
            if (navigator.share) {
                try {
                    const confirmShare = confirm("Ange Gardien actif. Voulez-vous partager votre lien de suivi en temps réel avec un proche ?");
                    if (confirmShare) {
                        await navigator.share({
                            title: 'Suis mon ride en direct !',
                            text: `Je roule avec mon50ccetmoi. Si j'ai un problème, tu seras alerté ici :`,
                            url: `https://mon50ccetmoi.app/track?s=${this.sessionId}`
                        });
                    }
                } catch(shareErr) { console.warn("Share cancelled"); }
            }
            
            this.startMonitoring();
        } catch (e) { 
            console.error("Guardian Start Fail:", e);
            this.startMonitoring();
        }
    },

    startMonitoring: function() {
        this.safetyCheckTimer = setInterval(async () => {
            if (!this.isActive || !currentPosition) return;
            
            const statusData = {
                lastPos: currentPosition,
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
                vMax: window.session.vMax || 0,
                isOnline: navigator.onLine
            };

            if (navigator.onLine) {
                try {
                    await db.collection("guardian_sessions").doc(this.sessionId).update(statusData);
                } catch (e) { localStorage.setItem('guardian_offline_buffer', JSON.stringify(statusData)); }
            } else {
                localStorage.setItem('guardian_offline_buffer', JSON.stringify(statusData));
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
    checkOvertakingSafety: function(speed, leanAngle) {
        if (!this.isActive || speed < 35) return;

        // Pattern: High lean (>30°) while at relatively high speed for a 50cc
        if (Math.abs(leanAngle) > 30) {
            const now = Date.now();
            if (now - this.lastOvertakeWarning > 12000) { // Throttle warnings (12s)
                speak("danger_overtake");
                vibrate([200, 100, 200]);
                if (window.NeuralHUD) window.NeuralHUD.logToConsole("SAFETY_ALERT: DANGEROUS_OVERTAKE");
                this.lastOvertakeWarning = now;
            }
        }
    },

    triggerSafetyPrompt: function() {
        vibrate([500, 200, 500]);
        speak("Alerte Ange Gardien. Vous êtes à l'arrêt depuis longtemps. Tout va bien ?");
        
        const prompt = document.createElement('div');
        prompt.className = "safety-prompt-overlay";
        prompt.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:20000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; padding:30px; text-align:center;";
        prompt.innerHTML = `
            <i class="fa-solid fa-shield-halved" style="font-size:4rem; color:#00d2ff; margin-bottom:20px;"></i>
            <h2>Vérification de Sécurité</h2>
            <p>L'Ange Gardien détecte un arrêt prolongé.</p>
            <button id="btn-safety-ok" style="width:100%; padding:20px; background:#00d2ff; color:black; border:none; border-radius:15px; font-weight:bold; font-size:1.2rem; margin-top:20px;">JE VAIS BIEN ✅</button>
            <button id="btn-safety-sos" style="width:100%; padding:15px; background:#ff4444; color:white; border:none; border-radius:15px; font-weight:bold; margin-top:15px;">BESOIN D'AIDE 🆘</button>
        `;
        document.body.appendChild(prompt);

        const timer = setTimeout(() => {
            this.triggerSOS("Inactivité prolongée détectée.");
            prompt.remove();
        }, 30000);

        document.getElementById('btn-safety-ok').onclick = () => {
            clearTimeout(timer);
            prompt.remove();
            speak("Ravi de l'entendre. Bonne route.");
        };

        document.getElementById('btn-safety-sos').onclick = () => {
            clearTimeout(timer);
            this.triggerSOS("Demande d'aide manuelle.");
            prompt.remove();
        };
    },

    triggerSOS: async function(reason) {
        if (!this.sessionId) return;
        
        speak("ALERTE SOS LANÇÉE. Transfert des données aux secours.");
        if (typeof Hardware !== "undefined" && Hardware.vibratePattern) {
            Hardware.vibratePattern('sos');
        }

        const structural = window.Blackbox ? window.Blackbox.getStructuralScore() : "UNKNOWN";

        if (navigator.onLine) {
            db.collection("guardian_sessions").doc(this.sessionId).update({
                status: "DANGER",
                alertReason: reason,
                deviceIntegrity: structural,
                alertTime: firebase.firestore.FieldValue.serverTimestamp()
            });

            db.collection("emergency_alerts").add({
                userId: window.session.uid,
                username: window.session.username,
                pos: currentPosition,
                reason: reason,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    },

    stopSession: function() {
        if (this.safetyCheckTimer) clearInterval(this.safetyCheckTimer);
        if (this.sessionId && navigator.onLine) {
            db.collection("guardian_sessions").doc(this.sessionId).update({
                status: "FINISHED",
                endTime: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        this.sessionId = null;
    }
};

window.toggleGuardianAngel = () => window.GuardianAngel.toggle();
window.triggerEmergencySOS = (r) => window.GuardianAngel.triggerSOS(r);
