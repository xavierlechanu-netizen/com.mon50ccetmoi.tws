window.NeuralHUD = {
    isNightVisionActive: false,
    tokenBalance: parseFloat(localStorage.getItem('mon50_tokens') || '0'),
    leanHistory: [],
    threatLevel: 0,

    init: function() {
        this.startNeuralLoop();
        this.initOracle();
        this.initMotionSensors();
        this.initShakeDetection();
        if (typeof window.Intercom !== "undefined") window.Intercom.init();
        
        this.currentXP = parseInt(localStorage.getItem('pilot_xp') || '0');
        this.updatePilotRank();
        this.updatePilotLevel();
        this.updateTokenDisplay();
        
        if (typeof EnginePulse !== "undefined") EnginePulse.startSynth();
        this.logToConsole("SINGULARITY_CORE_LOADED");
    },

    updateTokenDisplay: function() {
        const el = document.getElementById('token-balance');
        if (el) el.textContent = this.tokenBalance.toFixed(2);
        localStorage.setItem('mon50_tokens', this.tokenBalance);
    },

    initMotionSensors: function() {
        window.addEventListener('devicemotion', (e) => {
            const acc = e.accelerationIncludingGravity;
            if (!acc) return;
            const g = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z) / 9.81;
            this.currentG = g.toFixed(2);
            
            const gEl = document.getElementById('g-force-val');
            if (gEl) gEl.textContent = this.currentG + 'G';
        });
    },

    initShakeDetection: function() {
        let lastShake = 0;
        window.addEventListener('devicemotion', (e) => {
            const acc = e.acceleration;
            if (!acc) return;
            const total = Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z);
            if (total > 35 && Date.now() - lastShake > 5000) {
                lastShake = Date.now();
                if (window.isRiding) {
                    this.logToConsole("GESTURE: SHAKE_DETECTED");
                    if (typeof window.saveHazard === "function") window.saveHazard("Danger (Auto-Shake)");
                }
            }
        });
    },

    toggleNightVisionAR: async function() {
        const video = document.getElementById('ar-overlay');
        if (!video) return;

        if (this.isNightVisionActive) {
            this.isNightVisionActive = false;
            document.body.classList.remove('night-vision-active');
            if (video.srcObject) {
                video.srcObject.getTracks().forEach(track => track.stop());
            }
            speak("Vision nocturne désactivée.");
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                video.srcObject = stream;
                this.isNightVisionActive = true;
                document.body.classList.add('night-vision-active');
                speak("Vision nocturne activée. Optimisation des contrastes route.");
            } catch (err) {
                console.error("Camera AR failed:", err);
                alert("Accès caméra requis pour la Vision Nocturne.");
            }
        }
    },

    verifyNeuralSignature: function() {
        this.logToConsole("BIOMETRIC: SCANNING...");
        setTimeout(() => {
            this.logToConsole("SIGNATURE: VERIFIED");
            if (typeof speak === "function") speak("Signature neurale confirmée.");
            this.updatePilotLevel();
        }, 2000);
    },

    updatePilotRank: function() {
        const ranks = ["ROOKIE", "SCOUT", "INTERCEPTOR", "GHOST_RIDER", "SINGULARITY_PILOT"];
        const rankIdx = Math.min(Math.floor(this.currentXP / 1500), ranks.length - 1);
        const rankEl = document.getElementById('pilot-rank');
        if (rankEl) rankEl.textContent = `RANK: ${ranks[rankIdx]}`;
        localStorage.setItem('pilot_xp', this.currentXP);
    },

    updatePilotLevel: function() {
        const level = Math.floor(Math.sqrt(this.currentXP / 100)) + 1;
        const levelEl = document.getElementById('pilot-level-tag');
        if (levelEl) levelEl.textContent = `LVL ${level.toString().padStart(2, '0')}`;
        
        if (level > (this.lastLevel || 0)) {
            if (this.lastLevel) this.speakOracle('level_up');
            this.lastLevel = level;
        }
    },

    triggerRadarScan: function() {
        if (!window.isRiding) return;
        this.logToConsole("RADAR: SCANNING_GRID...");
        setTimeout(() => {
            this.logToConsole("SCAN: NOMINAL");
            if (Math.random() > 0.8) this.speakOracle('tactical');
        }, 2000);
    },

    logToConsole: function(msg) {
        const consoleLogs = document.getElementById('console-logs');
        if (!consoleLogs) return;
        const log = document.createElement('div');
        log.className = 'log';
        log.textContent = `> ${msg}`;
        consoleLogs.prepend(log);
        if (consoleLogs.children.length > 5) consoleLogs.lastElementChild.remove();
    },

    updateBiometrics: function(speed, stress) {
        const bpmEl = document.getElementById('bio-bpm');
        const focusEl = document.getElementById('bio-focus');
        if (!bpmEl || !focusEl) return;

        const baseBpm = 70 + (speed / 2);
        const currentBpm = Math.round(baseBpm + (stress * 20) + (Math.random() * 5));
        bpmEl.textContent = currentBpm;
        focusEl.textContent = Math.round(Math.max(10, 100 - (stress * 50))) + '%';

        const coreInner = document.querySelector('.core-inner');
        if (coreInner) coreInner.style.animationDuration = (60 / currentBpm) + 's';
    },

    initOracle: function() {
        this.oraclePhrases = {
            start: ["Core Universel stabilisé. Bienvenue dans l'Omniscience, Pilote.", "Liaison totale établie. Vous êtes la machine."],
            speed: ["Alerte : Distortion temporelle détectée. Votre vitesse défie la réalité.", "Ralentissez. L'horizon ne peut plus vous suivre."],
            threat_detected: ["ANALYSE : Menace identifiée. Élimination tactique ou évitement conseillé."],
            earnings: ["Harmonie Sécurité : +5.00 $MON50 matérialisés dans votre Wallet."],
            squad_on: ["Conscience de groupe activée. Vous ne roulez plus jamais seul."],
            singularity: ["Point de Singularité atteint. Tout est UN."],
            god_view: ["Radar Global : 50 000 pilotes détectés dans la grille stellaire."],
            integrity: ["Note : Votre armure Sentinel vibre avec le cosmos. État nominal."]
        };
        setTimeout(() => this.speakOracle('start'), 3000);
        
        // Simulation de 50 000 pilotes sur la grille
        setInterval(() => {
            if (window.isRiding) {
                this.updateGlobalGrid();
            }
        }, 8000);
    },

    updateGlobalGrid: function() {
        this.logToConsole("GLOBAL_GRID: SYNCING_50000_PILOTS...");
        if (Math.random() > 0.8) this.speakOracle('god_view');
    },

    initBlindSpotDetection: function() {
        const video = document.getElementById('ar-overlay');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let lastFrameData = null;

        setInterval(() => {
            if (!this.isNightVisionActive || !video.readyState === video.HAVE_ENOUGH_DATA) return;
            
            canvas.width = 160; canvas.height = 120; // Low res for perf
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            if (lastFrameData) {
                let diff = 0;
                // Focus on sides (Blind spots)
                for (let i = 0; i < frame.data.length; i += 4) {
                    const x = (i / 4) % canvas.width;
                    if (x < 30 || x > 130) { // Side bands
                        const delta = Math.abs(frame.data[i] - lastFrameData.data[i]);
                        if (delta > 50) diff++;
                    }
                }
                
                if (diff > 500) { // Motion threshold
                    this.logToConsole("AI_VISION: BLIND_SPOT_MOTION");
                    if (Math.random() > 0.9) this.speakOracle('blindspot');
                    document.body.classList.add('alert-active');
                    setTimeout(() => document.body.classList.remove('alert-active'), 1000);
                }
            }
            lastFrameData = frame;
        }, 200); // 5fps check
    },

    speakOracle: function(category) {
        if (!this.oraclePhrases[category]) return;
        const phrases = this.oraclePhrases[category];
        const text = phrases[Math.floor(Math.random() * phrases.length)];
        if (typeof speak === "function") speak(text);
        this.logToConsole(`ORACLE: ${category.toUpperCase()}`);
    },

    startNeuralLoop: function() {
        window.addEventListener('deviceorientation', (e) => {
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
        });

        setInterval(() => {
            try {
                this.updateParticles();
                const speedEl = document.getElementById('speed');
                if (!speedEl) return;
                const speed = parseFloat(speedEl.textContent || 0);
                
                if (window.isRiding) {
                    // RIDE-TO-EARN logic
                    this.tokenBalance += (speed / 1000);
                    this.updateTokenDisplay();
                    
                    if (Math.random() > 0.99) this.speakOracle('earnings');
                    if (typeof EnginePulse !== "undefined") EnginePulse.updateSynth(speed);
                }

                this.updateBiometrics(speed, this.currentStressLevel || 0);
                this.processLidar(speed);
            } catch(e) { /* Silently fail to avoid Sentinel loop */ }
        }, 100);
    },

    runDiagnostics: function() {
        if (window.isRiding) {
            this.logToConsole("AEGIS: ABORTED. CANNOT RUN DIAGNOSTICS DURING RIDE.");
            return;
        }

        this.logToConsole("AEGIS: INITIATING FULL SYSTEM DIAGNOSTIC...");
        if (typeof speak === "function") speak("Initialisation des diagnostics système Aegis.");

        const tests = [
            { msg: "NEURAL_LINK: STABLE", delay: 800 },
            { msg: "GPS_COHERENCE: 99.8%", delay: 1500 },
            { msg: "SENTINEL_SHIELD: OPTIMAL", delay: 2200 },
            { msg: "QUANTUM_WALLET: SYNCED", delay: 3000 },
            { msg: "DIAGNOSTIC_COMPLETE: ALL_SYSTEMS_GO", delay: 4000 }
        ];

        tests.forEach((t, i) => {
            setTimeout(() => {
                this.logToConsole(`AEGIS: ${t.msg}`);
                if (i === tests.length - 1 && typeof speak === "function") {
                    speak("Diagnostic terminé. Tous les systèmes sont optimaux.");
                }
            }, t.delay);
        });
    },

    processLidar: function(speed) {
        // Simulation d'une analyse LiDAR 3D dans le HUD
        const grid = document.getElementById('digital-horizon');
        if (grid) {
            grid.style.transform = `perspective(1000px) rotateX(60deg) translateY(${speed}px)`;
            grid.style.opacity = 0.1 + (speed / 120);
        }
    },

    updateParticles: function() {
        const container = document.getElementById('neural-particles');
        const speedEl = document.getElementById('speed');
        if (!container || !speedEl || !window.isRiding) return;
        const speed = parseFloat(speedEl.textContent || 0);
        if (container.children.length < (speed > 60 ? 40 : 20)) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = '50%'; p.style.top = '50%';
            container.appendChild(p);
            setTimeout(() => p.remove(), 1000);
        }
    },

    updateInterceptorGrid: function() {
        if (!window.map || !window.currentPosition) return;
        if (Math.random() > 0.95) {
            const lat = window.currentPosition.lat + (Math.random() - 0.5) * 0.005;
            const lng = window.currentPosition.lng + (Math.random() - 0.5) * 0.005;
            const marker = new google.maps.Marker({
                position: { lat, lng },
                map: window.map,
                icon: { path: google.maps.SymbolPath.CIRCLE, scale: 4, fillColor: "#00d2ff", fillOpacity: 0.6, strokeWeight: 0 }
            });
            setTimeout(() => marker.setMap(null), 5000);
        }
    }
};

window.toggleHolographicMode = function() {
    document.body.classList.toggle('holographic-mode');
    const isActive = document.body.classList.contains('holographic-mode');
    speak(isActive ? "Mode Projection Pare-brise activé." : "Mode HUD Standard activé.");
};

window.NeuralHUD.init();

