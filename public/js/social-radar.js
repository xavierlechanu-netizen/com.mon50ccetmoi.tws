/**
 * 📡 SOCIAL RADAR (GHOST RIDER & COMMUNITY RADAR)
 * v2.0 - Connexion Firestore temps réel & Mode Fantôme (Ghost Mode)
 * Sécurité : Conformité RGPD, masquage des données si Ghost Mode actif.
 */

if (typeof window.SocialRadarManager === "undefined") {
  window.SocialRadarManager = class SocialRadarManager {
    constructor() {
      this.isActive = false;
      this.riderMarkers = {};
      this.ghostMarkers = [];
      this.firestoreUnsubscribe = null;
      this.broadcastInterval = null;
      this.scanInterval = null;
    }

    toggleRadar() {
      this.isActive = !this.isActive;
      const btn = document.getElementById("dock-btn-social");

      if (this.isActive) {
        if (btn) {
          btn.style.color = "#00f2ff";
          btn.style.textShadow = "0 0 12px #00f2ff";
          btn.classList.add("active-radar");
        }
        if (typeof speak === "function") {
          speak("Radar social activé. Recherche des pilotes à proximité.");
        }
        this.startScanning();
      } else {
        if (btn) {
          btn.style.color = "#99aab5";
          btn.style.textShadow = "none";
          btn.classList.remove("active-radar");
        }
        if (typeof speak === "function") {
          speak("Radar social désactivé.");
        }
        this.stopScanning();
      }
    }

    startScanning() {
      // 1. Diffusion de la position de l'utilisateur (si pas en Mode Fantôme)
      this.broadcastMyPosition();
      this.broadcastInterval = setInterval(() => {
        this.broadcastMyPosition();
      }, 10000);

      // 2. Écoute en temps réel de la collection Firestore social_radar
      this.listenToCloudRiders();

      // 3. Fallback ghosts de démonstration si pas assez de pilotes réels
      this.scanInterval = setInterval(() => {
        this.updateGhostPositions();
      }, 4000);
    }

    stopScanning() {
      if (this.broadcastInterval) clearInterval(this.broadcastInterval);
      if (this.scanInterval) clearInterval(this.scanInterval);
      if (this.firestoreUnsubscribe) this.firestoreUnsubscribe();

      this.removeMyPositionFromCloud();
      this.clearAllMarkers();
    }

    isGhostModeActive() {
      return localStorage.getItem("ghostMode") === "true";
    }

    broadcastMyPosition() {
      if (this.isGhostModeActive()) return;
      if (!window.currentPosition || !window.db || !window.firebase) return;

      const user = firebase.auth().currentUser;
      if (!user) return;

      const username = (window.session && window.session.username) || "Pilote";
      const vehicle = localStorage.getItem("user_vehicle_type") || "50cc";

      window.db.collection("social_radar").doc(user.uid).set({
        uid: user.uid,
        username: username,
        vehicle: vehicle,
        lat: window.currentPosition.lat,
        lng: window.currentPosition.lng,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        active: true
      }, { merge: true }).catch((err) => {
        console.warn("[SocialRadar] Erreur d'envoi position:", err);
      });
    }

    removeMyPositionFromCloud() {
      if (!window.db || !window.firebase) return;
      const user = firebase.auth().currentUser;
      if (!user) return;

      window.db.collection("social_radar").doc(user.uid).delete().catch(() => {});
    }

    listenToCloudRiders() {
      if (!window.db) {
        this.spawnFallbackGhosts();
        return;
      }

      const myUid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : null;

      this.firestoreUnsubscribe = window.db
        .collection("social_radar")
        .limit(30)
        .onSnapshot((snapshot) => {
          let count = 0;
          snapshot.forEach((doc) => {
            const rider = doc.data();
            if (myUid && rider.uid === myUid) return; // Ne pas s'afficher soi-même

            if (rider.lat && rider.lng) {
              count++;
              this.updateOrSpawnRiderMarker(rider);
            }
          });

          // Si aucun pilote réel sur Firestore, ajouter les ghosts démo
          if (count === 0) {
            this.spawnFallbackGhosts();
          }
        }, (err) => {
          console.warn("[SocialRadar] Fallback ghosts enclenché:", err);
          this.spawnFallbackGhosts();
        });
    }

    updateOrSpawnRiderMarker(rider) {
      if (typeof L === "undefined" || typeof map === "undefined" || !map) return;

      const id = rider.uid || rider.username;
      const lat = rider.lat;
      const lng = rider.lng;

      if (this.riderMarkers[id]) {
        this.riderMarkers[id].setLatLng([lat, lng]);
      } else {
        const icon = L.divIcon({
          html: `<div style="text-align:center;">
                   <i class="fa-solid fa-motorcycle" style="color: #00f2ff; font-size: 22px; filter: drop-shadow(0 0 10px #00f2ff);"></i>
                   <div style="background:rgba(6,9,19,0.85); border:1px solid #00f2ff; color:#00f2ff; font-size:10px; padding:2px 6px; border-radius:8px; white-space:nowrap; margin-top:2px; font-weight:bold;">${rider.username}</div>
                 </div>`,
          className: "rider-radar-marker",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([lat, lng], { icon: icon }).addTo(map);
        marker.bindPopup(`
          <div style="color:#fff; font-family:'Inter',sans-serif; text-align:center;">
            <strong style="color:#00f2ff; font-size:1.1rem;">${rider.username}</strong><br>
            <span style="color:#aaa; font-size:0.8rem;">Monture : ${rider.vehicle || "50cc"}</span><br>
            <span style="color:#00ff88; font-size:0.75rem;"><i class="fa-solid fa-circle-dot"></i> En balade</span>
          </div>
        `);
        this.riderMarkers[id] = marker;
      }
    }

    spawnFallbackGhosts() {
      if (this.ghostMarkers.length > 0) return;
      if (!window.currentPosition || typeof map === "undefined" || !map) return;

      const lat = window.currentPosition.lat;
      const lng = window.currentPosition.lng;

      this.spawnGhost(lat + 0.008, lng + 0.006, "Ghost_Booster73", "MBK Booster");
      this.spawnGhost(lat - 0.005, lng + 0.009, "Netizen_Max", "Derbi Senda");
      this.spawnGhost(lat + 0.004, lng - 0.007, "VSP_Rider92", "Aixam Coupe");
    }

    spawnGhost(lat, lng, name, vehicle) {
      if (typeof L === "undefined" || typeof map === "undefined" || !map) return;

      const ghostIcon = L.divIcon({
        html: `<div style="text-align:center;">
                 <i class="fa-solid fa-motorcycle" style="color: rgba(0, 242, 255, 0.7); font-size: 22px; filter: drop-shadow(0 0 10px #00f2ff);"></i>
                 <div style="background:rgba(6,9,19,0.85); border:1px solid rgba(0,242,255,0.5); color:#00f2ff; font-size:10px; padding:2px 6px; border-radius:8px; white-space:nowrap; margin-top:2px;">${name}</div>
               </div>`,
        className: "ghost-marker",
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map);
      marker.bindPopup(`
        <div style="color:#fff; font-family:'Inter',sans-serif; text-align:center;">
          <strong style="color:#00f2ff; font-size:1rem;">${name}</strong><br>
          <span style="color:#aaa; font-size:0.8rem;">Véhicule : ${vehicle}</span><br>
          <span style="color:#00ff88; font-size:0.75rem;"><i class="fa-solid fa-bolt"></i> Membre Actif</span>
        </div>
      `);
      this.ghostMarkers.push(marker);
    }

    updateGhostPositions() {
      this.ghostMarkers.forEach((m) => {
        const pos = m.getLatLng();
        m.setLatLng([
          pos.lat + (Math.random() - 0.5) * 0.001,
          pos.lng + (Math.random() - 0.5) * 0.001,
        ]);
      });
    }

    clearAllMarkers() {
      if (typeof map !== "undefined" && map) {
        Object.values(this.riderMarkers).forEach((m) => map.removeLayer(m));
        this.ghostMarkers.forEach((m) => map.removeLayer(m));
      }
      this.riderMarkers = {};
      this.ghostMarkers = [];
    }
  };

  window.socialRadarManager = window.socialRadarManager || new window.SocialRadarManager();
}
