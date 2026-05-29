/* --- V3.0 SMART CITY & ZERO-CLICK DESTINY --- */

// 1. ZERO-CLICK DESTINY (IA Quantique)
window.initZeroClickDestiny = function() {
    const zeroClickScreen = document.getElementById('zero-click-screen');
    const destinationLabel = document.getElementById('zero-click-destination');
    const countdownLabel = document.getElementById('zero-click-countdown');
    
    if(!zeroClickScreen || !destinationLabel || !countdownLabel) return;

    // Simulation de l'IA qui devine la destination selon l'heure
    const hour = new Date().getHours();
    let predictedDestination = "Lycée / CFA";
    if (hour >= 17 && hour <= 20) predictedDestination = "Maison";
    else if (hour > 20 || hour < 5) predictedDestination = "Spot de Rassemblement VSP/50cc";
    
    destinationLabel.innerText = predictedDestination;
    zeroClickScreen.classList.remove('hidden');

    if(typeof speak === 'function') speak('Intelligence prédictive activée. Itinéraire vers ' + predictedDestination + ' dans 3 secondes.');

    let timer = 3;
    window.zeroClickInterval = setInterval(() => {
        timer--;
        countdownLabel.innerText = timer;
        
        if (timer <= 0) {
            clearInterval(window.zeroClickInterval);
            zeroClickScreen.classList.add('hidden');
            if(typeof speak === 'function') speak('Navigation autonome engagée. Connexion aux infrastructures de la ville.');
            
            // On simule le lancement de la navigation vers la destination
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = predictedDestination;
            
            // Démarrage de V2X après lancement
            setTimeout(window.initV2XGreenWave, 2000);
        }
    }, 1000);
};

window.cancelZeroClick = function() {
    clearInterval(window.zeroClickInterval);
    const zeroClickScreen = document.getElementById('zero-click-screen');
    if(zeroClickScreen) zeroClickScreen.classList.add('hidden');
    if(typeof speak === 'function') speak('Prédiction annulée. Mode manuel activé.');
};

// 2. V2X GREEN WAVE (Piratage Feux Tricolores 50cc)
window.v2xActive = false;

window.initV2XGreenWave = function() {
    window.v2xActive = true;
    const v2xHud = document.getElementById('v2x-hud');
    const v2xStatus = document.getElementById('v2x-status');
    const v2xTargetSpeed = document.getElementById('v2x-target-speed');
    
    if(!v2xHud || !v2xStatus) return;
    v2xHud.classList.remove('hidden');

    // Boucle V2X
    setInterval(() => {
        if(!window.v2xActive) return;
        
        const currentSpeed = window.lastKnownSpeedKmh || 0; // Vient de telemetry.js/infallible.js
        
        // Pour un 50cc/VSP, la vitesse idéale pour choper les feux verts en ville est souvent 42 km/h.
        const optimalSpeed = 42; 
        
        if(v2xTargetSpeed) v2xTargetSpeed.innerText = optimalSpeed + ' km/h';

        if (currentSpeed > 45) {
            // Excès de vitesse 50cc -> Risque de feu rouge
            v2xHud.style.borderColor = '#ff0055';
            v2xStatus.innerText = "RALENTISSEZ - FEU ROUGE IMMINENT";
            v2xStatus.style.color = '#ff0055';
            if (Math.random() > 0.95 && typeof speak === 'function') {
                speak("Vitesse excessive pour un 50cc. Ralentissez à 42 km heure pour attraper la vague verte.");
            }
        } else if (currentSpeed >= 38 && currentSpeed <= 45) {
            // Vitesse parfaite Onde Verte
            v2xHud.style.borderColor = '#00ffcc';
            v2xStatus.innerText = "VAGUE VERTE SYNCHRONISÉE";
            v2xStatus.style.color = '#00ffcc';
        } else if (currentSpeed > 0 && currentSpeed < 38) {
            // Trop lent
            v2xHud.style.borderColor = '#ffaa00';
            v2xStatus.innerText = "ACCÉLÉREZ LÉGÈREMENT";
            v2xStatus.style.color = '#ffaa00';
        } else {
            // À l'arrêt
            v2xHud.style.borderColor = '#555';
            v2xStatus.innerText = "ATTENTE FEU VERT...";
            v2xStatus.style.color = '#aaa';
        }
        
    }, 1000);
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if(localStorage.getItem('cnil_consent') === 'true') {
            window.initZeroClickDestiny();
        }
    }, 2000);
});
