// --- MODE CORTÈGE (Balade Synchro) ---
window.CortegeSystem = {
  sessionId: null,
  members: {}, // uid -> data (lat, lng, name, color)
  markers: {}, // uid -> google.maps.Marker
  maxDistanceWarning: 500, // mètres

  init: function () {
    if (!window.session || !window.session.uid) return;
  },

  createSession: async function () {
    if (!window.session) return;
    try {
      const joinCode = Math.floor(1000 + Math.random() * 9000).toString(); // Code à 4 chiffres

      const docRef = await firebase
        .firestore()
        .collection("cortege_sessions")
        .add({
          code: joinCode,
          leaderId: window.session.uid,
          leaderName: window.session.username,
          createdAt: Date.now(),
          isActive: true,
        });

      this.sessionId = docRef.id;
      alert(
        `Cortège créé ! Le code secret pour rejoindre est : ${joinCode}`,
      );
      this.startSharing();
      this.listenToMembers();
    } catch (e) {
      console.error(e);
      alert("Erreur de création de cortège.");
    }
  },

  joinSession: async function (code) {
    if (!window.session) return;
    try {
      const snap = await firebase
        .firestore()
        .collection("cortege_sessions")
        .where("code", "==", code)
        .where("isActive", "==", true)
        .limit(1)
        .get();

      if (snap.empty) {
        return alert("Cortège introuvable ou expiré avec ce code.");
      }

      this.sessionId = snap.docs[0].id;
      alert(`Cortège rejoint avec succès !`);
      this.startSharing();
      this.listenToMembers();
    } catch (e) {
      console.error(e);
    }
  },

  startSharing: function () {
    if (this.shareInterval) clearInterval(this.shareInterval);

    // Push GPS to session sub-collection every 5 seconds
    this.shareInterval = setInterval(() => {
      if (window.currentPosition && this.sessionId) {
        firebase
          .firestore()
          .collection("cortege_sessions")
          .doc(this.sessionId)
          .collection("members")
          .doc(window.session.uid)
          .set({
            lat: window.currentPosition.lat,
            lng: window.currentPosition.lng,
            name: window.session.username,
            lastUpdate: Date.now(),
          });
      }
    }, 5000);
  },

  listenToMembers: function () {
    if (!this.sessionId || typeof firebase === "undefined") return;

    firebase
      .firestore()
      .collection("cortege_sessions")
      .doc(this.sessionId)
      .collection("members")
      .onSnapshot((snap) => {
        snap.docChanges().forEach((change) => {
          const data = change.doc.data();
          const uid = change.doc.id;

          if (change.type === "added" || change.type === "modified") {
            const oldData = this.members[uid];
            this.members[uid] = data;
            this.updateMemberMarker(uid, data);

            // Check for new virtual hand signal
            if (
              data.lastSignal &&
              (!oldData ||
                !oldData.lastSignal ||
                oldData.lastSignal.time !== data.lastSignal.time)
            ) {
              if (uid !== window.session.uid) {
                this.handleNewSignal(data.name, data.lastSignal);
              }
            }
          } else if (change.type === "removed") {
            delete this.members[uid];
            if (this.markers[uid]) {
              this.markers[uid].setMap(null);
              delete this.markers[uid];
            }
          }
        });

        this.checkDistances();
      });
  },

  updateMemberMarker: function (uid, data) {
    if (!map || uid === window.session.uid) return; // Don't draw ourselves

    if (!this.markers[uid]) {
      this.markers[uid] = new google.maps.Marker({
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#00ffcc",
          fillOpacity: 1,
          scale: 7,
          strokeColor: "black",
          strokeWeight: 1,
        },
        title: data.name,
      });
      const info = new google.maps.InfoWindow({
        content: `<b>${data.name}</b>`,
      });
      this.markers[uid].addListener("click", () =>
        info.open(map, this.markers[uid]),
      );
    }
    this.markers[uid].setPosition({ lat: data.lat, lng: data.lng });
  },

  checkDistances: function () {
    if (!window.currentPosition || typeof google === "undefined") return;

    const myPos = new google.maps.LatLng(
      window.currentPosition.lat,
      window.currentPosition.lng,
    );

    for (const [uid, member] of Object.entries(this.members)) {
      if (uid === window.session.uid) continue;

      const memberPos = new google.maps.LatLng(member.lat, member.lng);
      const dist = google.maps.geometry.spherical.computeDistanceBetween(
        myPos,
        memberPos,
      );

      if (dist > this.maxDistanceWarning) {
        // Throttle warning (only once every 2 mins max per member)
        if (!member.lastWarned || Date.now() - member.lastWarned > 120000) {
          member.lastWarned = Date.now();
          if (typeof speak === "function") {
            speak(
              `Attention, ${member.name} est décroché à plus de 500 mètres derrière vous.`,
            );
          }
          console.warn(
            `[CortegeSystem] ${member.name} is too far! (${Math.round(dist)}m)`,
          );
        }
      }
    }
  },

  showModal: function () {
    if (this.sessionId) {
      this.showSignalsModal();
      return;
    }

    const code = prompt(
      "CORTÈGE : Entrez le code secret à 4 chiffres d'un ami pour le rejoindre, ou laissez le champ vide et cliquez sur OK pour CRÉER votre propre cortège :",
    );
    if (code === null) return;

    if (code.trim() !== "") {
      this.joinSession(code.trim());
    } else {
      this.createSession();
    }
  },

  showSignalsModal: function () {
    let modal = document.getElementById("cortege-signals-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "cortege-signals-modal";
      modal.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
            <div style="background:rgba(20,20,20,0.9); border:1px solid #00ffcc; border-radius:15px; padding:30px; width:90%; max-width:400px; text-align:center;">
                <h2 style="color:#00ffcc; margin-bottom:20px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-motorcycle"></i> Signaux Rapides</h2>
                <p style="color:#aaa; margin-bottom:20px; font-size:0.9rem;">Envoyez un signal au cortège. Tous les membres seront notifiés instantanément.</p>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
                    <button onclick="window.CortegeSystem.sendSignal('⛽', 'Besoin d\\'essence')" style="background:#111; color:#fff; border:1px solid #ffaa00; padding:15px; border-radius:10px; font-size:1.1rem; cursor:pointer; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-gas-pump" style="color:#ffaa00;"></i> Essence</button>
                    <button onclick="window.CortegeSystem.sendSignal('ðŸ“¸', 'Pause demandée')" style="background:#111; color:#fff; border:1px solid #00d2ff; padding:15px; border-radius:10px; font-size:1.1rem; cursor:pointer; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-camera" style="color:#00d2ff;"></i> Pause</button>
                    <button onclick="window.CortegeSystem.sendSignal('ðŸ”§', 'Problème technique')" style="background:#111; color:#fff; border:1px solid #ff0055; padding:15px; border-radius:10px; font-size:1.1rem; cursor:pointer; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-wrench" style="color:#ff0055;"></i> Meca</button>
                    <button onclick="window.CortegeSystem.sendSignal('ðŸ‘®', 'Danger signalé')" style="background:#111; color:#fff; border:1px solid #ffeb3b; padding:15px; border-radius:10px; font-size:1.1rem; cursor:pointer; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-triangle-exclamation" style="color:#ffeb3b;"></i> Danger</button>
                </div>
                
                <button onclick="document.getElementById('cortege-signals-modal').style.display='none'" style="width:100%; background:transparent; border:1px solid #aaa; color:#fff; padding:10px; border-radius:20px; cursor:pointer; font-family:'Outfit', sans-serif;">Fermer</button>
            </div>
        `;
    modal.style.display = "flex";
  },

  sendSignal: async function (icon, text) {
    if (!this.sessionId || !window.session) return;
    try {
      await firebase
        .firestore()
        .collection("cortege_sessions")
        .doc(this.sessionId)
        .collection("members")
        .doc(window.session.uid)
        .update({
          lastSignal: {
            icon: icon,
            text: text,
            time: Date.now(),
          },
        });
      document.getElementById("cortege-signals-modal").style.display = "none";
    } catch (e) {
      console.error("[CortegeSystem] Error sending signal", e);
    }
  },

  handleNewSignal: function (senderName, signal) {
    const toast = document.createElement("div");
    toast.style.cssText =
      "position:fixed;top:80px;left:50%;transform:translateX(-50%);background:rgba(0,255,204,0.9);color:#000;padding:15px 25px;border-radius:25px;z-index:99999;font-weight:bold;font-family:'Outfit', sans-serif;box-shadow:0 0 20px rgba(0,255,204,0.5);font-size:1.1rem;opacity:0;transition:opacity 0.3s;display:flex;align-items:center;gap:10px;";
    toast.innerHTML = `<span style="font-size:1.5rem;">${signal.icon}</span> <span><b>${escapeHTML(senderName)}</b> : ${escapeHTML(signal.text)}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "1";
    }, 100);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 500);
    }, 5000);

    if (typeof speak === "function") {
      speak(`Cortège. ${senderName} signale : ${signal.text}`);
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.CortegeSystem.init();
  }, 4000);
});
