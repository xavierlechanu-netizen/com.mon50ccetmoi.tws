/* --- SQUAD RADAR / SOCIAL MAP --- */

window.ghostRiders = [];
window.isSocialRadarActive = false;

window.initSocialRadar = function() {
    if (!window.map || !window.userLocation) {
        // Retry later if map is not ready
        setTimeout(window.initSocialRadar, 2000);
        return;
    }

    const pseudoList = ['GhostRider_75', 'TMAX_Killa', 'Ami_Racer_92', 'Zip_Master', 'Ligier_King', 'Booster_Spirit'];
    const vehicles = ['50cc 2T', '50cc 4T', 'Voiturette (VSP)', 'Électrique'];

    // Generate 10 ghost riders, some active, some inactive
    let purgedCount = 0;
    for (let i = 0; i < 10; i++) {
        // Random offset roughly ~500 meters
        let latOffset = (Math.random() - 0.5) * 0.01;
        let lngOffset = (Math.random() - 0.5) * 0.01;

        let riderPos = {
            lat: window.userLocation.lat + latOffset,
            lng: window.userLocation.lng + lngOffset
        };

        let pseudo = pseudoList[Math.floor(Math.random() * pseudoList.length)] + '_' + Math.floor(Math.random() * 99);
        let lvl = Math.floor(Math.random() * 50) + 1;
        let vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
        
        // Simulation of inactivity between 0 and 150 days
        let lastActiveDays = Math.floor(Math.random() * 150);
        
        if (lastActiveDays > 90) {
            purgedCount++;
            continue; // Skip rendering this user (Ghost user vanished)
        }

        // Create marker
        let marker = new google.maps.Marker({
            position: riderPos,
            map: null, // Hidden by default
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#00d2ff',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
            },
            title: pseudo
        });

        let infoWindow = new google.maps.InfoWindow({
            content: `
                <div style="color: #000; padding: 5px; font-family: 'Inter', sans-serif;">
                    <h3 style="margin: 0; font-size: 1.1rem; color: #ff0055;"><i class="fa-solid fa-user-astronaut"></i> ${pseudo}</h3>
                    <p style="margin: 5px 0 0 0; font-size: 0.9rem; font-weight: bold;">Lvl ${lvl} | ${vehicle}</p>
                </div>
            `
        });

        marker.addListener('click', () => {
            infoWindow.open(window.map, marker);
        });

        window.ghostRiders.push({
            marker: marker,
            baseLat: riderPos.lat,
            baseLng: riderPos.lng,
            angle: Math.random() * Math.PI * 2
        });
    }
    
    console.log(`[Radar Social] Nettoyage effectué : ${purgedCount} utilisateurs fantômes inactifs depuis plus de 90 jours ont été supprimés de la carte.`);

    // Animate ghost riders slowly moving
    setInterval(() => {
        if (!window.isSocialRadarActive) return;
        
        window.ghostRiders.forEach(ghost => {
            // Move in a small circle to simulate driving
            ghost.angle += 0.05;
            let nlat = ghost.baseLat + Math.sin(ghost.angle) * 0.0005;
            let nlng = ghost.baseLng + Math.cos(ghost.angle) * 0.0005;
            ghost.marker.setPosition({ lat: nlat, lng: nlng });
        });
    }, 1000);
};

window.toggleSocialRadar = function() {
    window.isSocialRadarActive = !window.isSocialRadarActive;
    const btn = document.getElementById('btn-social-radar');

    if (window.isSocialRadarActive) {
        if(btn) {
            btn.style.background = '#00d2ff';
            btn.style.color = '#000';
            btn.style.boxShadow = '0 0 30px #00d2ff';
        }
        
        // Ensure initialized
        if(window.ghostRiders.length === 0) window.initSocialRadar();
        
        window.ghostRiders.forEach(ghost => ghost.marker.setMap(window.map));
        
        if(typeof speak === 'function') {
            speak('Radar Social activé. Recherche des pilotes à proximité.');
        }
    } else {
        if(btn) {
            btn.style.background = 'rgba(0,0,0,0.8)';
            btn.style.color = '#fff';
            btn.style.boxShadow = '0 0 15px #00d2ff';
        }
        
        window.ghostRiders.forEach(ghost => ghost.marker.setMap(null));
        
        if(typeof speak === 'function') {
            speak('Radar Social désactivé.');
        }
    }
};

// Auto-init attempts
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.initSocialRadar, 5000);
});
