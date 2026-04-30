window.AntiTheft = {
    isSentryActive: false,
    sentryListener: null,

    toggleSentryMode: function() {
        if (this.isSentryActive) {
            this.stopSentry();
            speak("Mode Sentinelle désactivé.");
        } else {
            this.startSentry();
            speak("Mode Sentinelle activé. Périmètre sécurisé.");
        }
        const btn = document.getElementById('btn-parking-toggle');
        if (btn) btn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Mode Parking : ${this.isSentryActive ? 'SENTINEL' : 'OFF'}`;
    },

    startSentry: function() {
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
        window.addEventListener('devicemotion', this.sentryListener);
    },

    stopSentry: function() {
        this.isSentryActive = false;
        if (this.sentryListener) window.removeEventListener('devicemotion', this.sentryListener);
    },

    triggerSentryAlert: function(force) {
        speak("ALERTE : Mouvement suspect détecté. Enregistrement Sentinel activé.");
        vibrate([500, 200, 500]);
        
        // Deterrent: Flashlight blink if available
        if (typeof Hardware !== "undefined" && Hardware.toggleFlashlightSOS) {
            Hardware.toggleFlashlightSOS(true);
            setTimeout(() => Hardware.toggleFlashlightSOS(false), 2000);
        }

        // HUD Log
        if (window.NeuralHUD) {
            window.NeuralHUD.logToConsole(`SENTRY_ALERT: MOTION_DETECTED (${force.toFixed(1)}G)`);
        }
        
        // Remote Notification simulation
        console.warn("SENTRY_CLOUD_ALERT: Potential tampering detected at " + new Date().toLocaleTimeString());
    },

    reportTheft: async function() {
        // ... (Keep existing reportTheft)
    }
};
