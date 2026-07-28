/* --- SQUAD RADAR / SOCIAL MAP --- */

window.ghostRiders = [];
window.isSocialRadarActive = false;
window.socialRadarUnsubscribe = null;

window.initSocialRadar = function () {
  if (!window.map || !window.currentPosition || !window.firebase) {
    // Retry later if map or firebase is not ready
    setTimeout(window.initSocialRadar, 2000);
    return;
  }

  const db = window.firebase.firestore();

  // Publier notre propre position sur Firestore (toutes les 10 secondes)
  setInterval(() => {
    if (
      window.isSocialRadarActive &&
      window.currentPosition &&
      window.session?.uid
    ) {
      db.collection("user_locations")
        .doc(window.session.uid)
        .set(
          {
            lat: window.currentPosition.lat,
            lng: window.currentPosition.lng,
            pseudo: window.session.pseudo || "Pilot_Unknown",
            vehicle: "50cc",
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
        .catch((err) => console.warn("SocialMap Publish Error:", err));
    }
  }, 10000);

  // Écouter les positions des autres utilisateurs
  window.socialRadarUnsubscribe = db
    .collection("user_locations")
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const uid = change.doc.id;

        // Ignorer notre propre marqueur
        if (window.session && uid === window.session.uid) return;

        if (change.type === "added" || change.type === "modified") {
          // Mettre à jour ou créer
          let existingRider = window.ghostRiders.find((r) => r.uid === uid);
          if (existingRider) {
            existingRider.marker.setPosition({ lat: data.lat, lng: data.lng });
          } else {
            // Créer un nouveau marqueur
            let marker = new google.maps.Marker({
              position: { lat: data.lat, lng: data.lng },
              map: window.isSocialRadarActive ? window.map : null,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#00d2ff",
                fillOpacity: 1,
                strokeColor: "#fff",
                strokeWeight: 2,
              },
              title: data.pseudo,
            });

            let infoWindow = new google.maps.InfoWindow({
              content: `
                                <div style="color: #000; padding: 5px; font-family: 'Inter', sans-serif;">
                                    <h3 style="margin: 0; font-size: 1.1rem; color: #ff0055;"><i class="fa-solid fa-user-astronaut"></i> ${data.pseudo}</h3>
                                    <p style="margin: 5px 0 0 0; font-size: 0.9rem; font-weight: bold;">${data.vehicle || "Moto"}</p>
                                </div>
                            `,
            });

            marker.addListener("click", () => {
              infoWindow.open(window.map, marker);
            });

            window.ghostRiders.push({ uid: uid, marker: marker });
          }
        }

        if (change.type === "removed") {
          let existingIndex = window.ghostRiders.findIndex(
            (r) => r.uid === uid,
          );
          if (existingIndex > -1) {
            window.ghostRiders[existingIndex].marker.setMap(null);
            window.ghostRiders.splice(existingIndex, 1);
          }
        }
      });
    });
};

window.toggleSocialRadar = function () {
  window.isSocialRadarActive = !window.isSocialRadarActive;
  const btn = document.getElementById("btn-social-radar");

  if (window.isSocialRadarActive) {
    if (btn) {
      btn.style.background = "#00d2ff";
      btn.style.color = "#000";
      btn.style.boxShadow = "0 0 30px #00d2ff";
    }

    if (window.ghostRiders.length === 0 && !window.socialRadarUnsubscribe) {
      window.initSocialRadar();
    }

    window.ghostRiders.forEach((ghost) => ghost.marker.setMap(window.map));

    if (typeof speak === "function") {
      speak("Radar Social activé. Connexion au réseau des pilotes en cours.");
    }
  } else {
    if (btn) {
      btn.style.background = "rgba(0,0,0,0.8)";
      btn.style.color = "#fff";
      btn.style.boxShadow = "0 0 15px #00d2ff";
    }

    window.ghostRiders.forEach((ghost) => ghost.marker.setMap(null));

    if (typeof speak === "function") {
      speak("Radar Social désactivé.");
    }
  }
};

// Auto-init attempts
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(window.initSocialRadar, 5000);
});
