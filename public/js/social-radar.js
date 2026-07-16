/**
 * SOCIAL RADAR (GHOST RIDER MODE) & REGIONAL WELCOME
 * v1.0
 */

// 2. Social Radar (Ghost Rider Mode)
class SocialRadarManager {
    constructor() {
        this.isActive = false;
        this.ghostMarkers = [];
        this.radarInterval = null;
    }

    toggleRadar() {
        this.isActive = !this.isActive;
        const btn = document.getElementById('dock-btn-social');
        
        if (this.isActive) {
            if (btn) btn.style.color = '#00f2ff';
            if (btn) btn.style.textShadow = '0 0 10px #00f2ff';
            if (typeof speak === 'function') speak("Radar social activé. Recherche d'autres pilotes en cours.");
            this.startScanning();
        } else {
            if (btn) btn.style.color = '#99aab5';
            if (btn) btn.style.textShadow = 'none';
            if (typeof speak === 'function') speak("Radar social désactivé.");
            this.stopScanning();
        }
    }

    startScanning() {
        // Simulation d'apparition de pilotes fantômes autour de la position actuelle
        if (!window.currentPosition || typeof map === 'undefined') return;
        
        this.spawnGhost(window.currentPosition.lat + 0.01, window.currentPosition.lng + 0.01, "Ghost_73");
        this.spawnGhost(window.currentPosition.lat - 0.005, window.currentPosition.lng + 0.015, "Netizen_Max");
        
        // Scan continu
        this.radarInterval = setInterval(() => {
            this.updateGhosts();
        }, 3000);
    }

    stopScanning() {
        if (this.radarInterval) {
            clearInterval(this.radarInterval);
            this.radarInterval = null;
        }
        this.ghostMarkers.forEach(m => {
            if (typeof map !== 'undefined' && map.removeLayer) {
                map.removeLayer(m);
            }
        });
        this.ghostMarkers = [];
    }

    spawnGhost(lat, lng, name) {
        if (typeof L === 'undefined' || typeof map === 'undefined') return;
        
        // Création d'une icône fantôme cyberpunk
        const ghostIcon = L.divIcon({
            html: '<i class="fa-solid fa-motorcycle" style="color: rgba(0, 242, 255, 0.6); font-size: 24px; filter: drop-shadow(0 0 10px #00f2ff);"></i>',
            className: 'ghost-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        const marker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map);
        marker.bindPopup(`<strong style="color:#00f2ff">${name}</strong><br>En balade`).openPopup();
        this.ghostMarkers.push(marker);
    }

    updateGhosts() {
        // Déplace légèrement les fantômes pour simuler la conduite
        this.ghostMarkers.forEach(m => {
            const pos = m.getLatLng();
            m.setLatLng([pos.lat + (Math.random() - 0.5) * 0.002, pos.lng + (Math.random() - 0.5) * 0.002]);
        });
    }
}

window.socialRadarManager = new SocialRadarManager();
