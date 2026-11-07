import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { coarsePosition, recentCutoff, MAX_SHARED_POSITIONS } from './location-privacy.js';

/**
 * RADAR SOCIAL - Partage GPS Temps Réel
 * Fonctionnalité de suivi communautaire (Privacy by Design)
 */

window.RadarSocial = {
    isActive: false, // Ghost Mode activé par défaut (RGPD)
    watchId: null,
    radarUnsubscribe: null,
    friendsMarkers: {}, // Stockage des marqueurs Leaflet/GoogleMaps des autres utilisateurs

    toggleGhostMode: async function () {
        if (!window.session || !window.session.uid) {
            return alert("Connectez-vous pour utiliser le Radar Social.");
        }

        const btn = document.getElementById("btn-ghost-mode");
        
        if (!this.isActive) {
            // DÉSACTIVER LE GHOST MODE (Passer public)
            const confirmPublic = confirm("Radar Social : Votre position sera visible par les autres motards de la communauté. Continuer ?");
            if (!confirmPublic) return;

            this.isActive = true;
            if (btn) {
                btn.classList.add("active");
                // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = '<i class="fa-solid fa-eye"></i> Radar ON';
            }
            if (typeof speak === "function") speak("Mode fantôme désactivé. Radar social actif.");

            this.startBroadcasting();
            this.listenToCommunity();
        } else {
            // ACTIVER LE GHOST MODE (Passer privé)
            this.isActive = false;
            if (btn) {
                btn.classList.remove("active");
                // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = '<i class="fa-solid fa-ghost"></i> Ghost Mode';
            }
            if (typeof speak === "function") speak("Mode fantôme activé. Vous êtes invisible.");

            this.stopBroadcasting();
        }
    },

    startBroadcasting: function () {
        if (!navigator.geolocation) return;

        this.watchId = navigator.geolocation.watchPosition(
            (pos) => {
                if (!this.isActive || typeof db === "undefined") return;

                // Position arrondie à ~100 m : visible par les autres membres (location-privacy.js)
                const shared = coarsePosition(pos.coords.latitude, pos.coords.longitude);
                if (!shared) return;
                const spd = pos.coords.speed || 0; // m/s

                // Mise à jour optimisée dans Firestore
                db.collection("social_radar").doc(window.session.uid).set({
                    username: window.session.username,
                    lat: shared.lat,
                    lng: shared.lng,
                    speed: Math.round(spd * 3.6), // km/h
                    last_seen: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            },
            (err) => { console.error("Erreur GPS Radar:", err); },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
    },

    stopBroadcasting: async function () {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        // Se retirer de la base de données (Droit à l'oubli immédiat)
        if (typeof db !== "undefined" && window.session?.uid) {
            try {
                await db.collection("social_radar").doc(window.session.uid).delete();
            } catch(e) {
                console.error("Impossible de supprimer la trace radar", e);
            }
        }

        // Arrêter d'écouter les autres
        if (this.radarUnsubscribe) {
            this.radarUnsubscribe();
            this.radarUnsubscribe = null;
        }

        this.clearMarkers();
    },

    listenToCommunity: function () {
        if (typeof db === "undefined") return;

        // Uniquement les positions récentes, en nombre limité (avant : toute la collection)
        this.radarUnsubscribe = db.collection("social_radar")
            .where("last_seen", ">=", recentCutoff())
            .limit(MAX_SHARED_POSITIONS)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    const uid = change.doc.id;

                    // Ignorer sa propre position
                    if (uid === window.session.uid) return;

                    if (change.type === "added" || change.type === "modified") {
                        this.updateMarker(uid, data);
                    }
                    if (change.type === "removed") {
                        this.removeMarker(uid);
                    }
                });
            });
    },

    updateMarker: function (uid, data) {
        if (typeof window.map === "undefined") {
            // Si aucune carte (Leaflet/Mapbox) n'est instanciée, on log simplement
            console.log("📍 Radar Social Update:", data.username, "à", data.lat, data.lng, "-", data.speed, "km/h");
            return;
        }

        // Intégration théorique avec Leaflet
        /*
        if (this.friendsMarkers[uid]) {
            this.friendsMarkers[uid].setLatLng([data.lat, data.lng]);
            this.friendsMarkers[uid].setPopupContent(`<b>${data.username}</b><br>${data.speed} km/h`);
        } else {
            const marker = L.marker([data.lat, data.lng], { icon: L.icon({ iconUrl: 'assets/motorcycle-icon.png' }) })
                .bindPopup(`<b>${data.username}</b><br>${data.speed} km/h`)
                .addTo(window.map);
            this.friendsMarkers[uid] = marker;
        }
        */
    },

    removeMarker: function (uid) {
        if (this.friendsMarkers[uid] && typeof window.map !== "undefined") {
            // window.map.removeLayer(this.friendsMarkers[uid]);
            delete this.friendsMarkers[uid];
        }
    },

    clearMarkers: function () {
        for (const uid in this.friendsMarkers) {
            this.removeMarker(uid);
        }
    }
};
