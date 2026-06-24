/**
 * PREDICTIVE MAINTENANCE AI v1.0
 * Calculates wear and tear based on riding style and vibrations.
 */

window.PredictiveMeca = {
    // État d'usure de 0 (neuf) à 100 (critique/panne)
    wearScore: JSON.parse(localStorage.getItem('meca_wear') || '{"piston": 0, "belt": 0, "oil": 0, "brakes": 0, "tires": 0, "battery": 0}'),
    
    // Distance totale pour les calculs de base
    totalKm: parseFloat(localStorage.getItem('total_distance') || '0'),

    updateWear: function(intensity, speed, braking, temp) {
        // intensity: vibrations (0-10)
        // speed: km/h
        // braking: force de freinage (0-10)
        // temp: température ambiante (Celsius)

        const fatigueFactor = (intensity * 0.05) + (speed > 45 ? 0.02 : 0.005);
        
        // Piston: souffre à haute vitesse et fortes vibrations
        this.wearScore.piston += fatigueFactor * (speed > 60 ? 1.5 : 1);
        
        // Courroie: s'use avec l'accélération (simulée via intensité)
        this.wearScore.belt += fatigueFactor * 0.8;
        
        // Huile: s'use avec la distance et la température (si moteur très chaud)
        this.wearScore.oil += 0.01 + (temp > 30 ? 0.005 : 0);
        
        // Freins: s'use fortement lors des freinages brusques
        this.wearScore.brakes += (braking * 0.1);
        
        // Pneus: s'use avec la distance et le freinage
        this.wearScore.tires += 0.005 + (braking * 0.02);
        
        // Batterie: se décharge légèrement, s'abîme au froid
        this.wearScore.battery += 0.002 + (temp < 5 ? 0.01 : 0);

        // Cap usure à 100%
        for (let part in this.wearScore) {
            if (this.wearScore[part] > 100) this.wearScore[part] = 100;
        }

        localStorage.setItem('meca_wear', JSON.stringify(this.wearScore));
        this.checkAlerts();
        this.updateDashboardUI();
    },

    checkAlerts: function() {
        const critical = [];
        if (this.wearScore.piston > 90) critical.push("Piston");
        if (this.wearScore.belt > 90) critical.push("Courroie");
        if (this.wearScore.oil > 95) critical.push("Huile");
        if (this.wearScore.brakes > 90) critical.push("Freins");

        if (critical.length > 0 && Math.random() > 0.95) { // Éviter de spammer vocalement
            if (typeof speak === 'function') {
                speak("Alerte IA Prédictive : Composants critiques détectés : " + critical.join(", ") + ". Veuillez vérifier le diagnostic.");
            }
        }
    },

    getHealthReport: function() {
        return this.wearScore;
    },
    
    getGlobalHealthScore: function() {
        let total = 0;
        let count = 0;
        for (let part in this.wearScore) {
            total += this.wearScore[part];
            count++;
        }
        return 100 - (total / count); // 100 = Parfait, 0 = Épave
    },

    resetComponent: function(component) {
        if (this.wearScore[component] !== undefined) {
            this.wearScore[component] = 0;
            localStorage.setItem('meca_wear', JSON.stringify(this.wearScore));
            this.updateDashboardUI();
            if (typeof speak === 'function') speak("Maintenance du composant " + component + " enregistrée.");
        }
    },

    updateDashboardUI: function() {
        // Mise à jour de l'interface visuelle si elle est ouverte
        const modal = document.getElementById('ai-diagnostic-modal');
        if (modal && modal.style.display !== 'none') {
            document.getElementById('ai-health-score').textContent = Math.round(this.getGlobalHealthScore()) + '%';
            
            for (let part in this.wearScore) {
                const bar = document.getElementById(`ai-bar-${part}`);
                const val = document.getElementById(`ai-val-${part}`);
                if (bar && val) {
                    const wear = Math.round(this.wearScore[part]);
                    bar.style.width = wear + '%';
                    val.textContent = wear + '%';
                    
                    // Couleurs dynamiques
                    if (wear < 50) bar.style.backgroundColor = '#4caf50'; // Vert
                    else if (wear < 85) bar.style.backgroundColor = '#ff9800'; // Orange
                    else bar.style.backgroundColor = '#f44336'; // Rouge
                }
            }
        }
    }
};
