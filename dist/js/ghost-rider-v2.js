/**
 * GHOST RIDER v1.1 - Predictive Safety System (STABLE V2)
 */
window.GhostRider = {
    dangerZones: [
        { name: "Virage de la Mort", lat: 48.85, lng: 2.35, radius: 200, level: "HIGH" },
    ],
    lastAlertZone: null,

    monitor: function() {
        // Sécurité maximale : si Maps n'est pas chargé à 100%, on ne fait rien
        if (typeof google === "undefined" || !google.maps || !google.maps.geometry || !window.currentPosition) {
            return;
        }
        
        try {
            this.dangerZones.forEach(zone => {
                const dist = google.maps.geometry.spherical.computeDistanceBetween(
                    new google.maps.LatLng(window.currentPosition.lat, window.currentPosition.lng),
                    new google.maps.LatLng(zone.lat, zone.lng)
                );

                if (dist < zone.radius && this.lastAlertZone !== zone.name) {
                    this.triggerAlert("ZONE DANGEREUSE", `Prudence : ${zone.name} à proximité.`);
                    this.lastAlertZone = zone.name;
                } else if (dist > zone.radius && this.lastAlertZone === zone.name) {
                    this.lastAlertZone = null;
                }
            });
            this.checkCommunitySOS();
        } catch(e) { console.warn("GhostRider Monitor Skip:", e); }
    },

    triggerAlert: function(title, msg) {
        const banner = document.getElementById('safety-banner');
        if (!banner) return;
        banner.innerHTML = `<i class="fa-solid fa-ghost"></i> <strong>${title}</strong>: ${msg}`;
        banner.classList.remove('hidden');
        if (typeof speak === "function") speak(msg);
        setTimeout(() => banner.classList.add('hidden'), 6000);
    },

    checkCommunitySOS: function() {
        // Temporairement désactivé pour la stabilité de la release
    }
};

// Start monitoring loop (Délai de 15s au démarrage pour laisser Maps se stabiliser)
setTimeout(() => {
    setInterval(() => window.GhostRider.monitor(), 10000);
}, 15000);
