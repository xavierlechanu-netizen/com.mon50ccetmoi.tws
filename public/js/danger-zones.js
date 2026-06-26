/**
 * DANGER ZONES v1.0 (Signalement Communautaire)
 * Système type Waze pour signaler et alerter les dangers sur la route.
 * Nids-de-poule, gravillons, routes glissantes, contrôles...
 */

window.DangerZones = {
    alerts: [],          // Alertes actives à proximité
    myReports: [],       // Mes signalements
    isMonitoring: false,
    currentPos: null,
    checkInterval: null,

    // Types de dangers avec icônes et priorités
    TYPES: {
        POTHOLE:      { icon: '🕳️', label: 'Nid-de-poule',     priority: 3, color: '#ff6600', voiceAlert: 'Attention, nid-de-poule signalé devant vous.' },
        GRAVEL:       { icon: '⚠️', label: 'Gravillons',        priority: 2, color: '#ffaa00', voiceAlert: 'Prudence, route avec gravillons à proximité.' },
        SLIPPERY:     { icon: '🌧️', label: 'Route glissante',   priority: 3, color: '#3399ff', voiceAlert: 'Attention, chaussée glissante signalée.' },
        ROADWORKS:    { icon: '🚧', label: 'Travaux',           priority: 2, color: '#ff9900', voiceAlert: 'Zone de travaux signalée sur votre itinéraire.' },
        ACCIDENT:     { icon: '🚨', label: 'Accident',          priority: 4, color: '#ff0044', voiceAlert: 'Accident signalé devant vous. Réduisez votre vitesse.' },
        POLICE:       { icon: '👮', label: 'Contrôle',          priority: 1, color: '#6666ff', voiceAlert: 'Contrôle de police signalé à proximité.' },
        ANIMAL:       { icon: '🐕', label: 'Animal sur route',  priority: 3, color: '#88cc00', voiceAlert: 'Animal signalé sur la chaussée, ralentissez.' },
        FLOOD:        { icon: '🌊', label: 'Inondation',        priority: 4, color: '#0088ff', voiceAlert: 'Route inondée signalée. Évitez cette zone.' }
    },

    // Rayon d'alerte en mètres
    ALERT_RADIUS: 500,
    // Durée de vie d'un signalement (2 heures)
    REPORT_TTL: 2 * 60 * 60 * 1000,

    init: function() {
        console.log("⚠️ DangerZones Engine: [ READY ]");
        this.loadLocalReports();
    },

    // Démarrer la surveillance GPS
    startMonitoring: function() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;

        // Vérifier les alertes à proximité toutes les 5 secondes
        this.checkInterval = setInterval(() => {
            if (this.currentPos) {
                this.checkNearbyDangers();
            }
        }, 5000);

        console.log("⚠️ DangerZones : Monitoring activé");
    },

    stopMonitoring: function() {
        this.isMonitoring = false;
        if (this.checkInterval) clearInterval(this.checkInterval);
        console.log("⚠️ DangerZones : Monitoring désactivé");
    },

    // Mettre à jour la position (appelé par le GPS de app-map.js)
    updatePosition: function(lat, lng) {
        this.currentPos = { lat, lng };
    },

    // Signaler un danger (bouton dans l'UI)
    reportDanger: function(type) {
        if (!this.currentPos) {
            alert("Position GPS non disponible. Activez la localisation.");
            return;
        }
        if (!this.TYPES[type]) {
            console.error("DangerZones : Type inconnu →", type);
            return;
        }

        const report = {
            id: `dz_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            type: type,
            lat: this.currentPos.lat,
            lng: this.currentPos.lng,
            timestamp: Date.now(),
            reporter: (window.session && window.session.uid) || 'anonymous',
            confirmations: 1,  // Le créateur compte comme 1
            active: true
        };

        this.myReports.push(report);
        this.saveLocalReports();

        // Enregistrer dans Firebase pour la communauté
        this.syncToCloud(report);

        // Feedback
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        if (typeof speak === 'function') {
            speak(`${this.TYPES[type].label} signalé. Merci de protéger la communauté.`);
        }

        console.log(`⚠️ DangerZones : ${this.TYPES[type].label} signalé à ${report.lat}, ${report.lng}`);
        return report;
    },

    // Vérifier les dangers à proximité
    checkNearbyDangers: function() {
        if (!this.currentPos || this.alerts.length === 0) return;

        const now = Date.now();
        this.alerts.forEach(alert => {
            // Ignorer les alertes expirées
            if (now - alert.timestamp > this.REPORT_TTL) return;
            // Ignorer si déjà notifié dans les 60 dernières secondes
            if (alert._lastNotified && now - alert._lastNotified < 60000) return;

            const distance = this.getDistance(
                this.currentPos.lat, this.currentPos.lng,
                alert.lat, alert.lng
            );

            if (distance <= this.ALERT_RADIUS) {
                this.triggerAlert(alert, distance);
                alert._lastNotified = now;
            }
        });
    },

    // Déclencher une alerte visuelle + vocale
    triggerAlert: function(alert, distanceMeters) {
        const typeInfo = this.TYPES[alert.type];
        if (!typeInfo) return;

        console.warn(`⚠️ DANGER à ${distanceMeters.toFixed(0)}m : ${typeInfo.label}`);

        // Alerte vocale
        if (typeof speak === 'function') {
            speak(typeInfo.voiceAlert);
        }

        // Vibration selon la priorité
        const vibratePattern = typeInfo.priority >= 3
            ? [300, 100, 300, 100, 300]  // Urgent
            : [200, 100, 200];            // Normal
        if (navigator.vibrate) navigator.vibrate(vibratePattern);

        // Notification visuelle (toast)
        this.showToast(typeInfo, distanceMeters);
    },

    // Toast d'alerte visuelle
    showToast: function(typeInfo, distanceMeters) {
        let existing = document.getElementById('dz-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'dz-toast';
        Object.assign(toast.style, {
            position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
            background: `linear-gradient(135deg, ${typeInfo.color}22, rgba(0,0,0,0.95))`,
            border: `2px solid ${typeInfo.color}`,
            borderRadius: '16px', padding: '14px 24px', zIndex: '10000',
            color: '#fff', fontFamily: "'Inter', sans-serif", fontSize: '14px',
            display: 'flex', alignItems: 'center', gap: '12px',
            backdropFilter: 'blur(10px)', boxShadow: `0 0 30px ${typeInfo.color}44`,
            animation: 'slideDown 0.4s ease-out'
        });

        toast.innerHTML = `
            <span style="font-size: 28px;">${typeInfo.icon}</span>
            <div>
                <div style="font-weight: bold;">${typeInfo.label}</div>
                <div style="font-size: 12px; color: #aaa;">à ${distanceMeters.toFixed(0)} mètres</div>
            </div>
        `;

        document.body.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
    },

    // Afficher le panneau de signalement rapide
    showReportPanel: function() {
        let existing = document.getElementById('dz-report-panel');
        if (existing) { existing.remove(); return; }

        const panel = document.createElement('div');
        panel.id = 'dz-report-panel';
        Object.assign(panel.style, {
            position: 'fixed', bottom: '0', left: '0', right: '0',
            background: 'rgba(0,0,0,0.95)', borderTop: '2px solid rgba(0,210,255,0.3)',
            borderRadius: '20px 20px 0 0', padding: '20px', zIndex: '10001',
            backdropFilter: 'blur(20px)', transition: 'transform 0.3s ease'
        });

        let buttonsHTML = Object.entries(this.TYPES).map(([key, info]) =>
            `<button onclick="window.DangerZones.reportDanger('${key}'); document.getElementById('dz-report-panel').remove();"
                style="display:flex; flex-direction:column; align-items:center; gap:6px;
                       background:rgba(255,255,255,0.05); border:1px solid ${info.color}44;
                       border-radius:12px; padding:12px 8px; color:#fff; cursor:pointer;
                       font-size:12px; min-width:80px; transition: all 0.2s;">
                <span style="font-size:24px;">${info.icon}</span>
                <span>${info.label}</span>
            </button>`
        ).join('');

        panel.innerHTML = `
            <div style="text-align:center; margin-bottom:16px;">
                <div style="width:40px; height:4px; background:#555; border-radius:2px; margin:0 auto 12px;"></div>
                <span style="color:#00d2ff; font-weight:bold; font-size:16px;">⚠️ Signaler un danger</span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px;">
                ${buttonsHTML}
            </div>
        `;
        document.body.appendChild(panel);
    },

    // Confirmer un signalement existant (+1 crédibilité)
    confirmReport: function(reportId) {
        const alert = this.alerts.find(a => a.id === reportId);
        if (alert) {
            alert.confirmations = (alert.confirmations || 1) + 1;
            console.log(`⚠️ DangerZones : Signalement confirmé (${alert.confirmations} confirmations)`);
        }
    },

    // Synchronisation Firebase
    syncToCloud: function(report) {
        if (typeof db !== 'undefined') {
            db.collection("danger_zones").add(report)
                .then(() => console.log("⚠️ DangerZones : Synced to cloud"))
                .catch(err => console.error("⚠️ DangerZones sync error:", err));
        }
    },

    // Charger les signalements depuis Firebase
    loadFromCloud: function() {
        if (typeof db === 'undefined') return;

        const cutoff = Date.now() - this.REPORT_TTL;
        db.collection("danger_zones")
            .where("timestamp", ">", cutoff)
            .get()
            .then(snapshot => {
                this.alerts = [];
                snapshot.forEach(doc => {
                    this.alerts.push({ id: doc.id, ...doc.data() });
                });
                console.log(`⚠️ DangerZones : ${this.alerts.length} alertes actives chargées`);
            })
            .catch(err => console.error("DangerZones cloud load error:", err));
    },

    // Sauvegarde locale
    saveLocalReports: function() {
        localStorage.setItem('dangerZoneReports', JSON.stringify(this.myReports));
    },

    loadLocalReports: function() {
        try {
            const data = localStorage.getItem('dangerZoneReports');
            this.myReports = data ? JSON.parse(data) : [];
        } catch (e) {
            this.myReports = [];
        }
    },

    // Calcul de distance (Haversine)
    getDistance: function(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
};

// Auto-init
window.addEventListener('DOMContentLoaded', () => {
    window.DangerZones.init();
});
