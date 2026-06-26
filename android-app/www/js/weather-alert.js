/**
 * INTELLIGENT WEATHER ALERT v1.0
 * Analyse les conditions météo sur l'itinéraire du pilote et alerte 
 * vocalement en cas de danger (pluie, verglas, vent fort).
 */

window.WeatherAlert = {
    isMonitoring: false,
    checkInterval: null,
    lastCheckTime: 0,
    currentCondition: 'CLEAR',

    // Mock conditions for demo purposes
    CONDITIONS: {
        'CLEAR': { label: "Dégagé", danger: false, msg: "" },
        'RAIN':  { label: "Pluie", danger: true, msg: "Alerte météo. Pluie détectée sur votre itinéraire. Adhérence réduite, ralentissez." },
        'WIND':  { label: "Vent Fort", danger: true, msg: "Alerte météo. Fortes rafales de vent. Maintenez fermement votre guidon." },
        'ICE':   { label: "Risque de Verglas", danger: true, msg: "Alerte critique. Température proche de zéro. Risque extrême de verglas." }
    },

    init: function() {
        console.log("🌦️ WeatherAlert Engine: [ READY ]");
    },

    start: function() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;
        
        console.log("🌦️ WeatherAlert : Monitoring activé");
        
        // Vérification immédiate
        this.checkWeather(window.appMap?.currentPos);

        // Puis vérification toutes les 15 minutes (900000 ms)
        this.checkInterval = setInterval(() => {
            this.checkWeather(window.appMap?.currentPos);
        }, 900000);
    },

    stop: function() {
        this.isMonitoring = false;
        if (this.checkInterval) clearInterval(this.checkInterval);
        console.log("🌦️ WeatherAlert : Monitoring désactivé");
    },

    checkWeather: async function(position) {
        if (!position) return;
        
        const now = Date.now();
        // Évite de spammer les alertes (1 alerte max toutes les 15 min)
        if (now - this.lastCheckTime < 900000 && this.lastCheckTime !== 0) return;
        
        console.log(`🌦️ WeatherAlert : Analyse météo pour [${position.lat.toFixed(2)}, ${position.lng.toFixed(2)}]...`);

        // Dans un cas réel, appel vers OpenWeatherMap API ou Météo France
        // Ici, nous simulons la météo aléatoirement pour la démo
        const simulatedWeather = this.simulateWeatherAPI();
        
        if (simulatedWeather !== 'CLEAR' && simulatedWeather !== this.currentCondition) {
            this.triggerAlert(simulatedWeather);
        }
        
        this.currentCondition = simulatedWeather;
        this.lastCheckTime = now;
    },

    triggerAlert: function(conditionKey) {
        const condition = this.CONDITIONS[conditionKey];
        if (!condition || !condition.danger) return;

        console.warn(`🌦️ ALERTE MÉTÉO : ${condition.label}`);

        // Notification Vocale
        if (typeof speak === 'function') {
            speak(condition.msg);
        }

        // Notification Visuelle (Toast)
        this.showToast(condition);
    },

    showToast: function(condition) {
        let existing = document.getElementById('weather-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'weather-toast';
        Object.assign(toast.style, {
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, rgba(0,40,80,0.95), rgba(0,0,0,0.95))',
            border: '2px solid #00d2ff', borderRadius: '30px', padding: '12px 24px',
            zIndex: '10001', color: '#fff', fontFamily: "'Inter', sans-serif", fontSize: '14px',
            display: 'flex', alignItems: 'center', gap: '12px',
            boxShadow: '0 0 20px rgba(0,210,255,0.4)', animation: 'slideDown 0.4s ease-out'
        });

        toast.innerHTML = `
            <span style="font-size:24px;">☁️</span>
            <div>
                <div style="font-weight:bold; color:#00d2ff;">Alerte Météo : ${condition.label}</div>
                <div style="font-size:12px; color:#aaa;">Prudence recommandée</div>
            </div>
        `;

        document.body.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 6000);
    },

    simulateWeatherAPI: function() {
        // Renvoie 80% du temps CLEAR, et 20% du temps une alerte
        const rand = Math.random();
        if (rand > 0.95) return 'ICE';
        if (rand > 0.85) return 'WIND';
        if (rand > 0.80) return 'RAIN';
        return 'CLEAR';
    },

    // Déclenché depuis la console pour tester
    testAlert: function(type = 'RAIN') {
        this.triggerAlert(type);
    }
};

// Auto-init
window.addEventListener('DOMContentLoaded', () => {
    window.WeatherAlert.init();
});
