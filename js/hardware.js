/**
 * SMART HARDWARE MANAGER v1.0
 * Exploits native smartphone features for safety.
 */

window.Hardware = {
    flashlightInterval: null,

    init: function() {
        this.watchBattery();
        this.watchLuminosity();
    },

    // 1. SMART BATTERY
    watchBattery: function() {
        if (!navigator.getBattery) return;
        navigator.getBattery().then(battery => {
            const check = () => {
                if (battery.level <= 0.20 && !battery.charging) {
                    Hardware.setUltraPowerMode(true);
                } else {
                    Hardware.setUltraPowerMode(false);
                }
            };
            battery.addEventListener('levelchange', check);
            check();
        });
    },

    // 2. AMBIENT LIGHT (Real-time auto theme)
    watchLuminosity: function() {
        if ('AmbientLightSensor' in window) {
            try {
                const sensor = new AmbientLightSensor();
                sensor.onreading = () => {
                    if (sensor.illuminance < 20) {
                        document.body.classList.add('night-theme');
                    } else {
                        document.body.classList.remove('night-theme');
                    }
                };
                sensor.start();
            } catch (e) { console.log("Light sensor access denied."); }
        }
    },

    // 3. FLASHLIGHT SOS (Visual Signal)
    toggleFlashlightSOS: async function(active) {
        if (this.flashlightInterval) clearInterval(this.flashlightInterval);
        
        if (!active) return;

        // Try to get camera track
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities();
            
            if (capabilities.torch) {
                this.flashlightInterval = setInterval(async () => {
                    const settings = track.getSettings();
                    await track.applyConstraints({
                        advanced: [{ torch: !settings.torch }]
                    });
                }, 500); // Pulse every 500ms
            }
        } catch (e) { console.warn("Flashlight access fail:", e); }
    },

    // 4. NUANCED HAPTICS
    vibratePattern: function(type) {
        if (!navigator.vibrate || !navigator.userActivation || !navigator.userActivation.hasBeenActive) return;
        
        switch(type) {
            case 'danger': 
                navigator.vibrate([500, 100, 500, 100, 500]); break;
            case 'warning': 
                navigator.vibrate([100, 50, 100, 50, 100]); break;
            case 'radar': 
                navigator.vibrate([50]); break;
            case 'sos':
                navigator.vibrate([200, 200, 200, 500, 500, 500, 200, 200, 200]); break; // S-O-S in Morse
            default:
                navigator.vibrate(10);
        }
    },

    // 5. ULTRA POWER SAVER (NEW)
    isUltraMode: false,

    setUltraPowerMode: function(active) {
        this.isUltraMode = active;
        if (active) {
            document.body.classList.add('ultra-battery-saver');
            speak("Mode économie d'énergie Ultra Max activé.");
            this.vibratePattern('warning');
            // Réduire la fréquence des logs Blackbox
            if (window.Blackbox) window.Blackbox.maxEntries = 10;
        } else {
            document.body.classList.remove('ultra-battery-saver');
            if (window.Blackbox) window.Blackbox.maxEntries = 60;
        }
    },

    // Déterminer la fréquence GPS optimale
    getOptimalGPSFrequency: function() {
        if (!window.isRiding) return 30000; // 30s si arrêté
        if (this.isUltraMode) return 10000; // 10s si batterie faible
        return 2000; // 2s en mode normal
    }
};

window.addEventListener('DOMContentLoaded', () => {
    window.Hardware.init();
});

