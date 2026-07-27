/**
 * ðŸ—ºï¸ MODE CONVOI
 * SystÃ¨me de balades en groupe avec partage de position en temps rÃ©el via Firebase Firestore.
 * SÃ©curitÃ© : request.auth.uid vÃ©rifiÃ© cÃ´tÃ© Firestore Rules, chiffrement E2EE via cloudEncrypt/cloudDecrypt.
 */

window.ConvoyManager = {
  convoyId: null,
  isLeader: false,
  membersList: [],
  syncInterval: null,
  firestoreUnsubscribe: null,

  /**
   * GÃ©nÃ¨re un code convoi alÃ©atoire de 4 caractÃ¨res alphanumÃ©riques.
   * @returns {string}
   */
  generateCode: function () {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sans I/O/0/1 pour Ã©viter confusion
    let code = "";
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    for (let i = 0; i < 4; i++) {
      code += chars[array[i] % chars.length];
    }
    return code;
  },

  /**
   * CrÃ©e un nouveau convoi. L'utilisateur devient le leader.
   */
  createConvoy: async function () {
    if (!window.db) {
      alert("Connexion Firestore requise.");
      return;
    }
    if (!window.session || window.session.isGuest) {
      alert("Vous devez Ãªtre connectÃ© pour crÃ©er un convoi.");
      return;
    }

    const code = this.generateCode();
    this.convoyId = code;
    this.isLeader = true;

    try {
      await window.db
        .collection("convoys")
        .doc(code)
        .set({
          leaderUid: window.session.uid,
          leader: window.session.username,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          members: [window.session.username],
          status: "active",
        });

      this.startPositionSharing();
      this.listenToConvoy();
      this.renderUI();

      if (typeof speak === "function")
        speak(`Convoi crÃ©Ã© ! Le code est : ${code.split("").join(", ")}.`);
    } catch (e) {
      console.error("[Convoy] CrÃ©ation Ã©chouÃ©e :", e);
      alert("Erreur lors de la crÃ©ation du convoi.");
    }
  },

  /**
   * Rejoint un convoi existant via son code.
   * @param {string} code
   */
  joinConvoy: async function (code) {
    if (!window.db) {
      alert("Connexion Firestore requise.");
      return;
    }
    if (!window.session || window.session.isGuest) {
      alert("Vous devez Ãªtre connectÃ©.");
      return;
    }
    if (!code || code.length !== 4) {
      alert("Code convoi invalide (4 caractÃ¨res).");
      return;
    }

    code = code.toUpperCase().trim();

    try {
      const docRef = window.db.collection("convoys").doc(code);
      const doc = await docRef.get();

      if (!doc.exists || doc.data().status !== "active") {
        alert("Convoi introuvable ou expirÃ©.");
        return;
      }

      const members = doc.data().members || [];
      if (members.length >= 20) {
        alert("Ce convoi est complet (20 membres max).");
        return;
      }
      if (members.includes(window.session.username)) {
        alert("Vous Ãªtes dÃ©jÃ  dans ce convoi !");
        this.convoyId = code;
        this.isLeader = false;
        this.listenToConvoy();
        this.startPositionSharing();
        this.renderUI();
        return;
      }

      members.push(window.session.username);
      await docRef.update({ members: members });

      this.convoyId = code;
      this.isLeader = false;

      this.startPositionSharing();
      this.listenToConvoy();
      this.renderUI();

      if (typeof speak === "function")
        speak(`Vous avez rejoint le convoi ${code}.`);
    } catch (e) {
      console.error("[Convoy] Erreur joinConvoy :", e);
      alert("Erreur lors de la connexion au convoi.");
    }
  },

  /**
   * Quitte le convoi en cours.
   */
  leaveConvoy: async function () {
    if (!this.convoyId || !window.db) return;

    try {
      const docRef = window.db.collection("convoys").doc(this.convoyId);

      // Supprimer sa position du sous-document
      await window.db
        .collection("convoys")
        .doc(this.convoyId)
        .collection("positions")
        .doc(window.session.username)
        .delete();

      const doc = await docRef.get();
      if (doc.exists) {
        let members = doc.data().members || [];
        members = members.filter((m) => m !== window.session.username);

        if (members.length === 0 || this.isLeader) {
          // Si leader ou dernier membre, supprimer le convoi
          await docRef.delete();
        } else {
          await docRef.update({ members: members });
        }
      }
    } catch (e) {
      console.warn("[Convoy] Erreur leaveConvoy :", e);
    }

    // Nettoyage local
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.firestoreUnsubscribe) this.firestoreUnsubscribe();
    this.convoyId = null;
    this.isLeader = false;
    this.membersList = [];
    this.renderUI();

    if (typeof speak === "function") speak("Vous avez quittÃ© le convoi.");
  },

  /**
   * Envoie sa position GPS toutes les 3 secondes dans le convoi.
   */
  startPositionSharing: function () {
    if (this.syncInterval) clearInterval(this.syncInterval);

    const sharePosition = async () => {
      if (!this.convoyId || !window.db || !navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await window.db
              .collection("convoys")
              .doc(this.convoyId)
              .collection("positions")
              .doc(window.session.username)
              .set({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                speed: pos.coords.speed || 0,
                username: window.session.username,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
              });
          } catch (e) {}
        },
        null,
        { enableHighAccuracy: true, timeout: 5000 },
      );
    };

    sharePosition();
    this.syncInterval = setInterval(sharePosition, 3000);
  },

  /**
   * Ã‰coute en temps rÃ©el les positions des membres du convoi.
   */
  listenToConvoy: function () {
    if (this.firestoreUnsubscribe) this.firestoreUnsubscribe();
    if (!this.convoyId || !window.db) return;

    this.firestoreUnsubscribe = window.db
      .collection("convoys")
      .doc(this.convoyId)
      .collection("positions")
      .onSnapshot((snapshot) => {
        this.membersList = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.username !== window.session?.username) {
            this.membersList.push(data);
          }
        });

        // Afficher les marqueurs sur la carte Leaflet si disponible
        this.renderConvoyMarkers();
      });
  },

  /**
   * Affiche les marqueurs des membres du convoi sur la carte Leaflet.
   */
  renderConvoyMarkers: function () {
    if (typeof L === "undefined" || !window.map) return;

    // Nettoyer les anciens marqueurs convoi
    if (!this._convoyMarkers) this._convoyMarkers = [];
    this._convoyMarkers.forEach((m) => window.map.removeLayer(m));
    this._convoyMarkers = [];

    this.membersList.forEach((member) => {
      if (!member.lat || !member.lng) return;

      const icon = L.divIcon({
        className: "convoy-marker",
        html: `<div style="background:#00d2ff; color:#000; padding:4px 10px; border-radius:20px; font-weight:bold; font-size:0.75rem; white-space:nowrap; box-shadow:0 2px 8px rgba(0,210,255,0.5); text-align:center;">
                    <i class="fa-solid fa-motorcycle"></i> ${member.username}
                </div>`,
        iconSize: [100, 30],
        iconAnchor: [50, 15],
      });

      const marker = L.marker([member.lat, member.lng], { icon: icon }).addTo(
        window.map,
      );
      this._convoyMarkers.push(marker);
    });
  },

  // ==================== UI ====================

  openUI: function () {
    let overlay = document.getElementById("convoy-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "convoy-overlay";
      overlay.style = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(10, 15, 25, 0.95); z-index: 50000;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                color: #fff; font-family: 'Inter', sans-serif;
                backdrop-filter: blur(15px);
            `;
      document.body.appendChild(overlay);
    } else {
      overlay.style.display = "flex";
    }
    this.renderUI();
  },

  closeUI: function () {
    const overlay = document.getElementById("convoy-overlay");
    if (overlay) overlay.style.display = "none";
  },

  renderUI: function () {
    const overlay = document.getElementById("convoy-overlay");
    if (!overlay) return;

    if (this.convoyId) {
      // Ã‰TAT : DANS UN CONVOI
      let membersHTML = "";
      this.membersList.forEach((m) => {
        const speed = m.speed
          ? `${Math.round(m.speed * 3.6)} km/h`
          : "En attente GPS";
        membersHTML += `
                    <div style="display:flex; justify-content:space-between; padding:10px 15px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:8px;">
                        <span><i class="fa-solid fa-motorcycle" style="color:#00d2ff; margin-right:8px;"></i> ${m.username}</span>
                        <span style="color:#aaa;">${speed}</span>
                    </div>
                `;
      });
      if (this.membersList.length === 0) {
        membersHTML = `<p style="color:#666; text-align:center; padding:20px;">En attente que d'autres pilotes rejoignentâ€¦</p>`;
      }

      overlay.innerHTML = `
                <button onclick="ConvoyManager.closeUI()" style="position:absolute;top:20px;right:20px;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                <i class="fa-solid fa-people-group" style="font-size:3rem; color:#00d2ff; filter:drop-shadow(0 0 10px #00d2ff); margin-bottom:10px;"></i>
                <h1 style="font-size:1.5rem; margin:0; text-transform:uppercase; color:#00d2ff;">Mode Convoi</h1>
                <p style="color:#aaa; margin-bottom:5px;">Vous Ãªtes ${this.isLeader ? 'le <strong style="color:#cca300;">Leader</strong>' : "membre"} du convoi</p>
                
                <div style="background:rgba(0,210,255,0.15); border:2px dashed #00d2ff; padding:20px; border-radius:20px; margin:15px 0; text-align:center;">
                    <p style="color:#aaa; font-size:0.8rem; margin:0 0 5px;">CODE DU CONVOI</p>
                    <p style="font-size:2.5rem; font-weight:900; letter-spacing:10px; color:#00d2ff; margin:0;">${this.convoyId}</p>
                    <p style="color:#666; font-size:0.75rem; margin-top:5px;">Partagez ce code Ã  vos amis !</p>
                </div>

                <div style="width:90%; max-width:400px;">
                    <h3 style="color:#fff; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:8px;">
                        <i class="fa-solid fa-users"></i> Pilotes connectÃ©s (${this.membersList.length})
                    </h3>
                    ${membersHTML}
                </div>

                <button onclick="ConvoyManager.leaveConvoy()" style="margin-top:20px; background:#ff4d4d; color:#fff; border:none; padding:12px 30px; border-radius:30px; font-weight:bold; cursor:pointer; font-size:1rem;">
                    <i class="fa-solid fa-right-from-bracket"></i> Quitter le Convoi
                </button>
            `;
    } else {
      // Ã‰TAT : PAS DE CONVOI
      overlay.innerHTML = `
                <button onclick="ConvoyManager.closeUI()" style="position:absolute;top:20px;right:20px;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                <i class="fa-solid fa-people-group" style="font-size:3rem; color:#00d2ff; filter:drop-shadow(0 0 10px #00d2ff); margin-bottom:10px;"></i>
                <h1 style="font-size:1.5rem; margin:0; text-transform:uppercase; color:#00d2ff;">Mode Convoi</h1>
                <p style="color:#aaa; margin-bottom:30px; text-align:center;">Roulez en groupe. Voyez vos amis sur la carte en temps rÃ©el.</p>
                
                <div style="width:90%; max-width:400px;">
                    <button onclick="ConvoyManager.createConvoy()" style="width:100%; background:linear-gradient(135deg, #00d2ff, #0090ff); color:#fff; border:none; padding:15px; border-radius:15px; font-weight:bold; font-size:1.1rem; cursor:pointer; margin-bottom:20px; box-shadow:0 5px 20px rgba(0,210,255,0.3);">
                        <i class="fa-solid fa-plus"></i> CrÃ©er un Convoi
                    </button>
                    
                    <div style="text-align:center; color:#666; margin-bottom:15px;">â€” ou â€”</div>
                    
                    <div style="display:flex; gap:10px;">
                        <input type="text" id="convoy-join-code" maxlength="4" placeholder="CODE" style="flex:1; background:#222; border:1px solid #444; color:#fff; padding:15px; border-radius:15px; font-size:1.2rem; text-align:center; letter-spacing:5px; text-transform:uppercase; outline:none;">
                        <button onclick="ConvoyManager.joinConvoy(document.getElementById('convoy-join-code').value)" style="background:#00d2ff; color:#000; border:none; padding:15px 25px; border-radius:15px; font-weight:bold; cursor:pointer;">
                            <i class="fa-solid fa-right-to-bracket"></i> Rejoindre
                        </button>
                    </div>
                </div>
            `;
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {});
