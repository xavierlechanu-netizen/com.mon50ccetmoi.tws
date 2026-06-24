/**
 * ADMINISTRATIVE TELEMETRY CONSOLE v100.00-GOLD
 * Real-time field diagnostics for mon50ccetmoi production release.
 */

window.Telemetry = {
    logs: [],
    isVisible: true,
    startTime: Date.now(),

    init: function() {
        console.log("📡 Telemetry Engine: Initializing diagnostics...");
        this.createHUD();
        this.hijackConsole();
        // this.trackGps(); // Désactivé temporairement pour éviter les conflits GPS avec app.js
        this.trackPerformance();
        this.trackBattery();
        
        // Auto-refresh UI
        setInterval(() => this.updateHUD(), 1000);

        // Auto-hide after initialization for better fluidity
        setTimeout(() => {
            this.addLog("SUCCESS", "Connexion établie. Masquage automatique pour plus de fluidité.");
            setTimeout(() => {
                if (this.isVisible) this.toggle();
            }, 2500);
        }, 1000);
    },

    createHUD: function() {
        const hud = document.createElement('div');
        hud.id = 'telemetry-console';
        hud.className = 'telemetry-glass';
        hud.innerHTML = `
            <div class="telemetry-header">
                <span>SYSTEM_TELEMETRY v100.00-GOLD</span>
                <button onclick="window.Telemetry.toggle()">[X]</button>
            </div>
            <div id="telemetry-stats" class="telemetry-stats">
                <div>UPTIME: <span id="tel-uptime">0s</span></div>
                <div>GPS: <span id="tel-gps">WAITING</span></div>
                <div>MEM: <span id="tel-mem">--</span></div>
                <div>BAT: <span id="tel-bat">--</span></div>
            </div>
            <div class="telemetry-actions">
                <button onclick="window.Telemetry.ping()">[ PING_SERVER ]</button>
                <button onclick="window.Telemetry.clearLogs()">[ CLEAR_LOGS ]</button>
            </div>
            <div id="telemetry-logs" class="telemetry-logs"></div>
        `;
        document.body.appendChild(hud);
    },

    hijackConsole: function() {
        const originalLog = console.log;
        const originalError = console.error;
        const self = this;

        console.log = function() {
            self.addLog("INFO", Array.from(arguments).join(" "));
            originalLog.apply(console, arguments);
        };

        console.error = function() {
            self.addLog("ERROR", Array.from(arguments).join(" "));
            originalError.apply(console, arguments);
            
            // Auto-show HUD if an error occurs so the rider is informed
            if (!self.isVisible) {
                self.toggle();
            }
        };
    },

    addLog: function(type, msg) {
        const timestamp = new Date().toLocaleTimeString();
        this.logs.push({ type, msg, timestamp });
        if (this.logs.length > 50) this.logs.shift();
        
        const logEl = document.getElementById('telemetry-logs');
        if (logEl) {
            const div = document.createElement('div');
            div.className = `log-entry log-${type.toLowerCase()}`;
            const timeSpan = document.createElement('span');
            timeSpan.className = 'log-time';
            timeSpan.textContent = `[${timestamp}] `;
            div.appendChild(timeSpan);
            div.appendChild(document.createTextNode(msg));
            logEl.appendChild(div);
            logEl.scrollTop = logEl.scrollHeight;
        }
    },

    trackGps: function() {
        // GARDE : ne pas accéder au GPS sans consentement de l'utilisateur
        if (localStorage.getItem('location_consent_accepted') !== 'true') {
            console.warn("mon50cc Telemetry : GPS bloqué — consentement non accordé.");
            return;
        }
        if ('geolocation' in navigator) {
            navigator.geolocation.watchPosition(
                (pos) => {
                    const acc = pos.coords.accuracy || 0;
                    const gpsStatus = document.getElementById('tel-gps');
                    if (gpsStatus) gpsStatus.textContent = `FIX (${acc.toFixed(1)}m)`;
                    if (acc > 50) {
                        this.addLog("WARN", `Low GPS Accuracy: ${acc}m`);
                    }
                },
                (err) => {
                    const gpsStatus = document.getElementById('tel-gps');
                    if (gpsStatus) gpsStatus.textContent = "ERROR: " + err.code;
                    this.addLog("ERROR", "GPS Failure: " + err.message);
                },
                { enableHighAccuracy: true, timeout: 30000, maximumAge: Infinity }
            );
        }
    },

    trackPerformance: function() {
        if (window.performance && window.performance.memory) {
            setInterval(() => {
                const mem = (window.performance.memory.usedJSHeapSize / 1048576).toFixed(1);
                const memEl = document.getElementById('tel-mem');
                if (memEl) memEl.textContent = `${mem} MB`;
            }, 5000);
        }
    },

    updateHUD: function() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const uptimeEl = document.getElementById('tel-uptime');
        if (uptimeEl) uptimeEl.textContent = `${uptime}s`;
    },

    toggle: function() {
        const hud = document.getElementById('telemetry-console');
        if (hud) {
            this.isVisible = !this.isVisible;
            hud.style.display = this.isVisible ? 'flex' : 'none';
        }
    },

    trackBattery: function() {
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                const update = () => {
                    const levelStr = `${Math.round(battery.level * 100)}%`;
                    const iconStr = battery.charging ? ' ⚡' : '';
                    
                    const batEl = document.getElementById('tel-bat');
                    if (batEl) batEl.textContent = levelStr + iconStr;
                    
                    const hudBatEl = document.getElementById('hud-bat');
                    if (hudBatEl) hudBatEl.textContent = levelStr + iconStr;
                };
                battery.addEventListener('levelchange', update);
                battery.addEventListener('chargingchange', update);
                update();
            });
        }
    },

    ping: function() {
        const start = Date.now();
        this.addLog("INFO", "Ping sequence initiated...");
        fetch('https://api.ipify.org?format=json')
            .then(() => {
                const latency = Date.now() - start;
                this.addLog("SUCCESS", `Server responsive (Latency: ${latency}ms)`);
            })
            .catch(err => this.addLog("ERROR", "Ping failed: " + err.message));
    },

    clearLogs: function() {
        this.logs = [];
        const logEl = document.getElementById('telemetry-logs');
        if (logEl) logEl.innerHTML = '';
        this.addLog("INFO", "Diagnostic logs cleared.");
    }
};

// Auto-start on load
window.addEventListener('load', () => window.Telemetry.init());

/* --- ULTRA PREMIUM TELEMETRY & AR MODULE --- */

// 1. AR Vision Mode
window.isARMode = false;
window.toggleARMode = async function() {
    const videoObj = document.getElementById('ar-camera-feed');
    const mapContainer = document.getElementById('map');
    const arBtn = document.getElementById('btn-ar-toggle');
    
    if(!window.isARMode) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if(videoObj) {
                videoObj.srcObject = stream;
                videoObj.classList.remove('hidden');
                videoObj.play();
            }
            if(mapContainer) mapContainer.style.opacity = '0.3'; // Semi-transparent map overlay
            if(arBtn) arBtn.style.color = '#ff0055';
            window.isARMode = true;
            if(typeof speak === 'function') speak('Réalité Augmentée activée.');
        } catch(err) {
            console.error('AR Camera error:', err);
            alert("Impossible d'accéder à la caméra pour le mode AR.");
        }
    } else {
        if(videoObj && videoObj.srcObject) {
            videoObj.srcObject.getTracks().forEach(track => track.stop());
            videoObj.classList.add('hidden');
        }
        if(mapContainer) mapContainer.style.opacity = '1';
        if(arBtn) arBtn.style.color = '#fff';
        window.isARMode = false;
        if(typeof speak === 'function') speak('Réalité Augmentée désactivée.');
    }
};

// 2. Gyroscope / Lean Angle (Horizon Artificiel)
window.initAdvancedTelemetry = function() {
    const horizonLine = document.getElementById('lean-angle-horizon');
    const leanText = document.getElementById('lean-angle-text');
    
    if(window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', function(event) {
            // gamma is the left-to-right tilt in degrees, where right is positive
            let lean = event.gamma; 
            if(lean === null) return;
            
            // Limit tilt display between -60 and +60 degrees
            if(lean > 60) lean = 60;
            if(lean < -60) lean = -60;
            
            if(horizonLine) {
                horizonLine.style.transform = 'rotate(' + lean + 'deg)';
            }
            if(leanText) {
                leanText.textContent = Math.abs(Math.round(lean)) + '°';
                if(Math.abs(lean) > 40) leanText.style.color = '#ff0055';
                else leanText.style.color = '#00d2ff';
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.initAdvancedTelemetry, 2000);
});
