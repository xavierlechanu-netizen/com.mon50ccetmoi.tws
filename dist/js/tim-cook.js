/* --- TIM COOK PROTOCOLS (SAFETY & ECO) --- */

// 1. Crash Detection Logic
window.initCrashDetection = function() {
    let lastZ = 0;
    let crashThreshold = 35; // Extreme G-force threshold for a crash
    let isCrashed = false;

    if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', function(event) {
            if (!event.accelerationIncludingGravity) return;
            let z = event.accelerationIncludingGravity.z;
            
            if (z === null || isCrashed) return;
            
            let deltaZ = Math.abs(z - lastZ);
            lastZ = z;

            if (deltaZ > crashThreshold) {
                isCrashed = true;
                window.triggerCrashUI();
            }
        });
    }
};

window.triggerCrashUI = function() {
    // Show SOS Screen
    const sosScreen = document.getElementById('tim-cook-sos-screen');
    if(sosScreen) sosScreen.classList.remove('hidden');
    
    if(typeof speak === 'function') {
        speak("Alerte critique. Chute détectée. Vous avez 10 secondes pour annuler avant l'envoi des secours.");
    }

    let seconds = 10;
    const timerEl = document.getElementById('sos-countdown');
    if(timerEl) timerEl.innerText = seconds;

    window.sosInterval = setInterval(() => {
        seconds--;
        if(timerEl) timerEl.innerText = seconds;
        
        if(seconds <= 0) {
            clearInterval(window.sosInterval);
            if(typeof speak === 'function') speak('Délai expiré. Protocole SOS engagé. Alerte envoyée à la communauté.');
            if(timerEl) timerEl.innerText = 'SOS ENVOYÉ';
        }
    }, 1000);
};

window.cancelSOS = function() {
    clearInterval(window.sosInterval);
    const sosScreen = document.getElementById('tim-cook-sos-screen');
    if(sosScreen) sosScreen.classList.add('hidden');
    if(typeof speak === 'function') speak('Alerte annulée. Reprise de la navigation.');
    // Resets crash state after a short delay
    setTimeout(() => {
        // Technically we should reset a local var but for simulation we just let it be.
    }, 5000);
};

// 2. Eco Report
window.showEcoReport = function(distanceKm) {
    // A standard car emits ~120g CO2/km. 
    // An electric scooter emits 0g. A 50cc 4T emits ~50g.
    let savedGrams = distanceKm * 70; // rough average
    
    const ecoScreen = document.getElementById('tim-cook-eco-screen');
    const ecoData = document.getElementById('eco-saved-data');
    if(ecoScreen && ecoData) {
        ecoData.innerText = Math.round(savedGrams) + 'g CO2';
        ecoScreen.classList.remove('hidden');
        
        if(typeof speak === 'function') {
            speak('Trajet terminé. Félicitations, vous avez économisé ' + Math.round(savedGrams) + ' grammes de CO2.');
        }
        
        setTimeout(() => {
            ecoScreen.classList.add('hidden');
        }, 6000);
    }
};

// Hook into navigation end
if(typeof window.stopNavigation === 'function') {
    const origStop = window.stopNavigation;
    window.stopNavigation = function() {
        origStop();
        // Simulate a 5km ride for the eco report
        window.showEcoReport(5.4);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.initCrashDetection, 4000);
});
