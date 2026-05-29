/* --- INFALLIBLE ARCHITECTURE: WATCHDOG & DEAD RECKONING --- */

// 1. WATCHDOG (Auto-Healing)
window.onerror = function(message, source, lineno, colno, error) {
    console.warn("[WATCHDOG] Erreur fatale interceptée : ", message);
    // Au lieu de crasher, on tente un "Soft Reset" du module concerné
    const body = document.body;
    if(body && body.style.display === 'none') {
        body.style.display = 'block'; // Empêche l'écran blanc mortel
    }
    
    // Si l'erreur vient du chargement Maps, on force le mode dégradé
    if(message.includes("google") || message.includes("maps")) {
        console.warn("[WATCHDOG] Bascule en mode Hors-Ligne forcé.");
        if(typeof window.initOfflineMap === 'function') {
            window.initOfflineMap();
        }
    }
    // L'erreur est interceptée, l'app ne s'arrête pas
    return true; 
};

window.onunhandledrejection = function(event) {
    console.warn("[WATCHDOG] Promesse rejetée silencieusement : ", event.reason);
    event.preventDefault(); // Empêche l'application de s'effondrer
};

// 2. DEAD RECKONING (Mode Tunnel / Perte GPS)
window.lastKnownSpeedKmh = 0;
window.lastKnownHeading = 0;
window.gpsLastUpdate = Date.now();
window.isDeadReckoning = false;
window.deadReckoningInterval = null;

window.updateWatchdogTelemetry = function(speed, heading) {
    window.lastKnownSpeedKmh = speed;
    window.lastKnownHeading = heading;
    window.gpsLastUpdate = Date.now();
    
    // Si on a récupéré le signal
    if (window.isDeadReckoning) {
        window.isDeadReckoning = false;
        clearInterval(window.deadReckoningInterval);
        const tunnelAlert = document.getElementById('tunnel-warning');
        if(tunnelAlert) tunnelAlert.classList.add('hidden');
        if(typeof speak === 'function') speak('Signal GPS récupéré.');
        console.log("[DEAD RECKONING] Fin du mode tunnel.");
    }
};

window.checkGPSSignal = function() {
    const timeSinceLastGPS = Date.now() - window.gpsLastUpdate;
    
    // Si plus de 6 secondes sans GPS et qu'on roulait, on est dans un tunnel
    if (timeSinceLastGPS > 6000 && window.lastKnownSpeedKmh > 10 && !window.isDeadReckoning) {
        window.isDeadReckoning = true;
        
        // Afficher l'alerte
        const tunnelAlert = document.getElementById('tunnel-warning');
        if(tunnelAlert) tunnelAlert.classList.remove('hidden');
        
        if(typeof speak === 'function') speak('Signal perdu. Mode tunnel activé, navigation mathématique en cours.');
        console.warn("[DEAD RECKONING] Mode tunnel activé !");
        
        // Commencer à avancer le marqueur artificiellement
        window.deadReckoningInterval = setInterval(() => {
            if(!window.userLocation || !window.userMarker) return;
            
            // Calculer la distance parcourue en 1 seconde
            // km/h -> m/s = / 3.6
            const distanceMeters = window.lastKnownSpeedKmh / 3.6;
            
            // Calcul mathématique très simplifié pour trouver les nouvelles coordonnées
            // 1 degré de latitude = ~111km
            const latOffset = (distanceMeters / 111000) * Math.cos(window.lastKnownHeading * Math.PI / 180);
            const lngOffset = (distanceMeters / (111000 * Math.cos(window.userLocation.lat * Math.PI / 180))) * Math.sin(window.lastKnownHeading * Math.PI / 180);
            
            window.userLocation.lat += latOffset;
            window.userLocation.lng += lngOffset;
            
            // Mettre à jour visuellement
            window.userMarker.setPosition(window.userLocation);
            if(window.map) window.map.panTo(window.userLocation);
            
        }, 1000);
    }
};

// Lancer le vérificateur de signal
setInterval(window.checkGPSSignal, 2000);
