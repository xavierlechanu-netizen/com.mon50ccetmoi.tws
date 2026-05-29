/**
 * GHOST RIDER v1.0 - Predictive Safety System
 * Anticipates dangers and alerts the rider before impact.
 */

window.GhostRider = {
    dangerZones: [
        { name: "Virage de la Mort", lat: 48.85, lng: 2.35, radius: 200, level: "HIGH" },
        // On pourra ajouter ici des points noirs réels (stats accidents)
    ],
    lastAlertZone: null,

    monitor: function() {
        if (!currentPosition) return;
        
        // 1. Check Danger Zones (Pre-defined)
        this.dangerZones.forEach(zone => {
            if (typeof google === "undefined" || !google.maps || !google.maps.geometry) return;
            
            const dist = google.maps.geometry.spherical.computeDistanceBetween(
                new google.maps.LatLng(currentPosition.lat, currentPosition.lng),
                new google.maps.LatLng(zone.lat, zone.lng)
            );

            if (dist < zone.radius && this.lastAlertZone !== zone.name) {
                this.triggerAlert("ZONE DANGEREUSE", `Prudence : ${zone.name} à proximité.`);
                this.lastAlertZone = zone.name;
            } else if (dist > zone.radius && this.lastAlertZone === zone.name) {
                this.lastAlertZone = null;
            }
        });

        // 2. Monitoring Community SOS (Proximity Radar)
        this.checkCommunitySOS();

        // 3. Update Stealth Heatmap
        this.updateHeatmap();
    },

    updateHeatmap: function() {
        if (typeof google === "undefined" || !map) return;
        
        // On récupère tous les signalements récents (3h) pour créer la heatmap
        db.collection("hazards").where("timestamp", ">=", new Date(Date.now() - 10800000))
        .get().then(snap => {
            const points = [];
            snap.forEach(doc => {
                const h = doc.data();
                points.push(new google.maps.LatLng(h.pos.lat, h.pos.lng));
            });

            if (typeof google === "undefined" || !google.maps || !google.maps.visualization) return;

            if (this.heatmap) this.heatmap.setMap(null);
            this.heatmap = new google.maps.visualization.HeatmapLayer({
                data: points,
                map: map,
                radius: 50,
                opacity: 0.6,
                gradient: [
                    'rgba(0, 255, 255, 0)',
                    'rgba(0, 255, 255, 1)',
                    'rgba(0, 191, 255, 1)',
                    'rgba(0, 127, 255, 1)',
                    'rgba(0, 63, 255, 1)',
                    'rgba(0, 0, 255, 1)',
                    'rgba(0, 0, 223, 1)',
                    'rgba(0, 0, 191, 1)',
                    'rgba(0, 0, 159, 1)',
                    'rgba(0, 0, 127, 1)',
                    'rgba(63, 0, 91, 1)',
                    'rgba(127, 0, 63, 1)',
                    'rgba(191, 0, 31, 1)',
                    'rgba(255, 0, 0, 1)'
                ]
            });
        });
    },

    triggerAlert: function(title, msg) {
        const banner = document.getElementById('safety-banner');
        if (!banner) return;

        banner.innerHTML = `<i class="fa-solid fa-ghost"></i> <strong>${title}</strong>: ${msg}`;
        banner.classList.remove('hidden');
        banner.classList.add('pulse-alert');
        
        speak(msg);
        vibrate([200, 100, 200]);

        setTimeout(() => {
            banner.classList.remove('pulse-alert');
            banner.classList.add('hidden');
        }, 6000);
    },

    checkCommunitySOS: function() {
        if (typeof db === "undefined") return;
        
        const now = Date.now();
        db.collection("emergency_alerts").where("timestamp", ">=", new Date(now - 1800000)) // Last 30 mins
        .onSnapshot(snap => {
            snap.forEach(doc => {
                const alert = doc.data();
                if (alert.userId === window.session?.uid) return;

                if (typeof google === "undefined" || !google.maps || !google.maps.geometry) return;

                const dist = google.maps.geometry.spherical.computeDistanceBetween(
                    new google.maps.LatLng(currentPosition.lat, currentPosition.lng),
                    new google.maps.LatLng(alert.pos.lat, alert.pos.lng)
                );

                if (dist < 3000) { // 3km range
                    this.triggerAlert("SOS PROXIMITÉ", `Pilote en difficulté à ${Math.round(dist)}m ! Regardez la carte.`);
                    this.showSOSMarkerOnMap(alert);
                }
            });
        });
    },

    showSOSMarkerOnMap: function(alert) {
        if (!map) return;
        const marker = new google.maps.Marker({
            position: alert.pos,
            map: map,
            icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 8,
                fillColor: "#ff4444",
                fillOpacity: 1,
                strokeWeight: 2,
                rotation: 0 // Will pulse
            },
            title: "SOS " + alert.username
        });
        
        let angle = 0;
        setInterval(() => {
            angle = (angle + 45) % 360;
            const icon = marker.getIcon();
            icon.rotation = angle;
            marker.setIcon(icon);
        }, 500);

        setTimeout(() => marker.setMap(null), 300000); // 5 mins
    }
};

// Start monitoring loop
setInterval(() => window.GhostRider.monitor(), 10000);
