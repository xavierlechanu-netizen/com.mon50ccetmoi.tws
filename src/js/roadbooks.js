import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { distanceMeters } from './geo-math.js';

/**
 * ROADBOOKS - Carnets de Route GPS
 * Enregistrement des trajets et partage communautaire.
 */

window.Roadbooks = {
    isRecording: false,
    currentTrace: [],
    watchId: null,
    startTime: null,
    distanceTotal: 0, // En mètres

    toggleRecording: function () {
        if (!window.session || !window.session.uid) {
            return alert("Connectez-vous pour enregistrer un Roadbook.");
        }

        const btn = document.getElementById("btn-roadbook-record");

        if (!this.isRecording) {
            // START RECORDING
            this.isRecording = true;
            this.currentTrace = [];
            this.distanceTotal = 0;
            this.startTime = Date.now();

            if (btn) {
                btn.classList.add("recording");
                // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Trace';
            }
            if (typeof speak === "function") speak("Enregistrement du Roadbook démarré.");

            this.startTrace();
        } else {
            // STOP RECORDING
            this.isRecording = false;
            if (btn) {
                btn.classList.remove("recording");
                // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = '<i class="fa-solid fa-route"></i> Rec Roadbook';
            }
            
            this.stopTrace();
            
            if (this.currentTrace.length > 2) {
                this.saveRoadbookPrompt();
            } else {
                alert("Trace trop courte pour être sauvegardée.");
            }
        }
    },

    startTrace: function () {
        if (!navigator.geolocation) return;

        this.watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                
                // Ajouter le point
                const newPoint = [lng, lat]; // Format GeoJSON [Lng, Lat]
                
                // Calcul de la distance
                if (this.currentTrace.length > 0) {
                    const lastPoint = this.currentTrace[this.currentTrace.length - 1];
                    this.distanceTotal += this.haversineDistance(lastPoint, newPoint);
                }

                this.currentTrace.push(newPoint);

                // Optionnel: Dessiner la ligne sur la carte en temps réel
                if (typeof window.map !== "undefined") {
                    // Logique Leaflet (L.polyline)
                }
            },
            (err) => { console.error("Erreur GPS Roadbook:", err); },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
    },

    stopTrace: function () {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    },

    saveRoadbookPrompt: async function () {
        const title = prompt("Nom du Roadbook ?", "Balade du " + new Date().toLocaleDateString());
        if (!title) return;

        const durationMinutes = Math.round((Date.now() - this.startTime) / 60000);
        const distanceKm = (this.distanceTotal / 1000).toFixed(2);

        const confirmShare = confirm("Voulez-vous rendre ce Roadbook public (Communauté) ?");

        const roadbookData = {
            userId: window.session.uid,
            username: window.session.username,
            title: title,
            distance_km: distanceKm,
            duration_min: durationMinutes,
            is_public: confirmShare,
            trace: {
                type: "LineString",
                coordinates: this.currentTrace
            },
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            const rbRef = await db.collection("roadbooks").add(roadbookData);
            if (confirmShare) {
                await db.collection("community_roadbooks").doc(rbRef.id).set(roadbookData);
            }
            if (typeof speak === "function") speak("Roadbook sauvegardé avec succès.");
            
            // Attribution de l'XP
            if (window.Gamification) {
                window.Gamification.awardXP(50); // 50 XP de base pour un Roadbook
            }

            this.currentTrace = [];
            this.distanceTotal = 0;
        } catch (e) {
            console.error("Erreur sauvegarde Roadbook:", e);
            alert("Erreur lors de la sauvegarde.");
        }
    },

    // Utilitaire pour calculer la distance entre 2 points (en mètres)
    haversineDistance: function (pt1, pt2) {
        return distanceMeters(pt1[1], pt1[0], pt2[1], pt2[0]); // points [lng, lat]
    }
};
