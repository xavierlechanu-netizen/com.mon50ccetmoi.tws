/**
 * NEURAL-SYNC v1.0
 * The "Conscience" of the Interceptor.
 * Manages Stress Shield and V2V Haptic Matrix.
 */

window.NeuralSync = {
    lastJerk: 0,
    isShieldActive: false,

    init: function() {
        console.log("Neural-Sync : Prêt.");
        this.startV2VScanner();
    },

    analyzeIncident: function(accel) {
        // Détection de panique (Force G brutale > 15)
        const totalG = Math.abs(accel.x) + Math.abs(accel.y) + Math.abs(accel.z);
        
        if (totalG > 18 && !this.isShieldActive) {
            this.triggerStressShield();
        }
    },

    triggerStressShield: function() {
        this.isShieldActive = true;
        Hardware.vibratePattern('danger');
        document.body.classList.add('stress-shield-active');
        
        speak("Bouclier Neural activé. Incident enregistré dans la Blackbox.");
        
        // Tag automatique du rapport Blackbox
        if (window.Blackbox) {
            window.Blackbox.addEvent("EMERGENCY_MANEUVER", {force: "HIGH"});
        }

        setTimeout(() => {
            this.isShieldActive = false;
            document.body.classList.remove('stress-shield-active');
        }, 5000);
    },

    startV2VScanner: function() {
        // Simulation de détection d'autres riders (V2V)
        setInterval(() => {
            if (window.isRiding && Math.random() > 0.98) {
                this.triggerV2VWave();
            }
        }, 10000);
    },

    triggerV2VWave: function() {
        speak("Pilote CHEZBIGBOO détecté. Salut motard transmis.");
        Hardware.vibratePattern('warning'); // Double vibration "V"
        
        const halo = document.createElement('div');
        halo.className = 'v2v-halo';
        document.body.appendChild(halo);
        setTimeout(() => halo.remove(), 3000);
    }
};
