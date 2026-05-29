window.setCrewMode = function(mode) {
    window.session = window.session || {};
    window.session.crewMode = mode;
    
    const btnSolo = document.getElementById('btn-solo');
    const btnDuo = document.getElementById('btn-duo');
    if(btnSolo) btnSolo.style.borderColor = mode === 'solo' ? '#00d2ff' : '#444';
    if(btnDuo) btnDuo.style.borderColor = mode === 'duo' ? '#00d2ff' : '#444';
};

window.saveVehicleProfile = function() {
    const motor = document.getElementById('scooter-motor');
    window.session = window.session || {};
    window.session.motor = motor ? motor.value : '2t';
    if(!window.session.crewMode) window.session.crewMode = 'solo';
    
    localStorage.setItem('session', JSON.stringify(window.session));
    
    const screen = document.getElementById('vehicle-config-screen');
    if(screen) screen.classList.add('hidden');
    
    if(typeof speak === 'function') speak('Profil véhicule sauvegardé. Prêt pour le départ.');
};

// Override the startPremiumNavigation to include the warning and ETA adjustment
if(typeof window.startPremiumNavigation === 'function') {
    const originalNav = window.startPremiumNavigation;
    window.startPremiumNavigation = function(leg) {
        // Appeler la nav originale
        originalNav(leg);
        
        // Ajuster l'ETA si duo ou voiturette
        if(window.session) {
            const isDuo = window.session.crewMode === 'duo';
            const isVSP = window.session.motor === 'vsp';
            
            if(isDuo || isVSP) {
                const etaEl = document.getElementById('nav-eta');
                const arrEl = document.getElementById('nav-arrival-time');
                
                if(etaEl) {
                    const originalMins = Math.ceil(leg.duration.value / 60);
                    let multiplier = 1.0;
                    
                    if(isDuo && !isVSP) multiplier = 1.15; // Scooter Duo = +15%
                    if(isVSP) multiplier = 1.25; // Voiturette = +25% (impossible de remonter les files)
                    
                    const newMins = Math.ceil(originalMins * multiplier);
                    etaEl.textContent = newMins + ' min';
                    
                    if(arrEl) {
                        const now = new Date();
                        now.setMinutes(now.getMinutes() + newMins);
                        const hours = now.getHours().toString().padStart(2, '0');
                        const mins = now.getMinutes().toString().padStart(2, '0');
                        arrEl.textContent = hours + ':' + mins;
                    }
                    
                    // Afficher une alerte de perte de puissance ou encombrement
                    if(typeof speak === 'function') {
                        if(isVSP) {
                            setTimeout(() => speak('Mode Voiturette détecté. Temps de trajet ajusté car vous ne pouvez pas remonter les files de trafic.'), 4000);
                        } else if(isDuo) {
                            setTimeout(() => speak('Mode Duo détecté. Le temps de trajet a été augmenté pour anticiper la perte de puissance en montée.'), 4000);
                        }
                    }
                    
                    // Mettre l'ETA en orange/rouge
                    etaEl.style.color = '#ffb703';
                    etaEl.style.textShadow = '0 0 10px #ffb703';
                }
            }
        }
    };
}
