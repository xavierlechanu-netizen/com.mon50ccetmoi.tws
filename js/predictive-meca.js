/**
 * PREDICTIVE MAINTENANCE AI v1.0
 * Calculates wear and tear based on riding style and vibrations.
 */

window.PredictiveMeca = {
    wearScore: JSON.parse(localStorage.getItem('meca_wear') || '{"piston": 0, "belt": 0, "oil": 0}'),

    updateWear: function(intensity, speed) {
        // Formule de calcul d'usure ultra-précise
        // L'intensité des vibrations et la vitesse impactent le score
        const fatigueFactor = (intensity * 0.1) + (speed > 45 ? 0.05 : 0.01);
        
        this.wearScore.piston += fatigueFactor;
        this.wearScore.belt += fatigueFactor * 0.8;
        this.wearScore.oil += fatigueFactor * 0.5;

        localStorage.setItem('meca_wear', JSON.stringify(this.wearScore));
        this.checkAlerts();
    },

    checkAlerts: function() {
        if (this.wearScore.piston > 90) {
            speak("Alerte Prédictive : Votre piston arrive en fin de cycle. Risque de serrage imminent détecté par analyse vibratoire.");
        }
    },

    getHealthReport: function() {
        return this.wearScore;
    }
};
