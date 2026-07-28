// --- LEADERBOARD (King of the Street) ---
window.Leaderboard = {
  topPilots: [],

  init: async function () {
    if (!window.session || !window.session.uid) return;

    await this.ensureDepartment();
    await this.fetchLeaderboard();
  },

  ensureDepartment: async function () {
    if (window.session.department) return; // Déjà calculé

    if (window.currentPosition && typeof google !== "undefined") {
      try {
        const geocoder = new google.maps.Geocoder();
        const response = await geocoder.geocode({
          location: {
            lat: window.currentPosition.lat,
            lng: window.currentPosition.lng,
          },
        });

        if (response.results[0]) {
          // Trouver le code postal ou le département
          const addressComponents = response.results[0].address_components;
          const postalCode = addressComponents.find((c) =>
            c.types.includes("postal_code"),
          );
          const adminArea = addressComponents.find((c) =>
            c.types.includes("administrative_area_level_2"),
          );

          let deptCode = "Inconnu";
          if (postalCode) {
            deptCode = postalCode.long_name.substring(0, 2);
          } else if (adminArea) {
            deptCode = adminArea.short_name;
          }

          window.session.department = deptCode;

          // Sauvegarder dans Firestore
          if (typeof firebase !== "undefined") {
            await firebase
              .firestore()
              .collection("users")
              .doc(window.session.uid)
              .update({
                department: deptCode,
              });
            secureSetItem("session", JSON.stringify(window.session));
          }
        }
      } catch (e) {
        console.warn("[Leaderboard] Erreur de reverse geocoding :", e);
        window.session.department = "Global";
      }
    } else {
      window.session.department = "Global";
    }
  },

  fetchLeaderboard: async function () {
    if (typeof firebase === "undefined") return;
    try {
      let query = firebase.firestore().collection("users");

      // Si on a un département valide, on filtre. Sinon, classement global
      if (
        window.session.department &&
        window.session.department !== "Global" &&
        window.session.department !== "Inconnu"
      ) {
        query = query.where("department", "==", window.session.department);
      }

      const snap = await query.orderBy("bvcPoints", "desc").limit(10).get();

      this.topPilots = [];
      snap.forEach((doc) => {
        const data = doc.data();
        this.topPilots.push({
          uid: doc.id,
          username: data.username || "Pilote Anonyme",
          points: data.bvcPoints || 0,
        });
      });

      // Si on est dans le top 3, on s'octroie une couronne (logique visuelle)
      this.checkMyCrown();
    } catch (e) {
      console.error("[Leaderboard] Error fetching top pilots", e);
    }
  },

  checkMyCrown: function () {
    if (!window.session) return;
    const myRank = this.topPilots.findIndex(
      (p) => p.uid === window.session.uid,
    );
    if (myRank === 0) {
      window.session.crown = "gold";
    } else if (myRank === 1) {
      window.session.crown = "silver";
    } else if (myRank === 2) {
      window.session.crown = "bronze";
    } else {
      window.session.crown = null;
    }
  },

  showModal: function () {
    let modal = document.getElementById("leaderboard-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "leaderboard-modal";
      modal.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
      document.body.appendChild(modal);
    }

    let htmlList = "";
    this.topPilots.forEach((p, index) => {
      let crownIcon = "";
      let color = "#fff";
      if (index === 0) {
        crownIcon = "ðŸ‘‘";
        color = "#ffd700";
      } else if (index === 1) {
        crownIcon = "ðŸ¥ˆ";
        color = "#c0c0c0";
      } else if (index === 2) {
        crownIcon = "ðŸ¥‰";
        color = "#cd7f32";
      }

      htmlList += `
                <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #333; color:${color}; font-weight:${index < 3 ? "bold" : "normal"};">
                    <span>${index + 1}. ${crownIcon} ${p.username}</span>
                    <span>${p.points} pts</span>
                </div>
            `;
    });

    modal.innerHTML = `
            <div style="background:#111; border:1px solid #ffd700; border-radius:15px; padding:30px; width:90%; max-width:400px; text-align:center;">
                <h2 style="color:#ffd700; margin-bottom:5px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-trophy"></i> King of the Street</h2>
                <p style="color:#aaa; font-size:0.9rem; margin-top:0; margin-bottom:20px; text-transform:uppercase;">
                    Ligue : ${window.session.department && window.session.department !== "Global" ? "Dép. " + window.session.department : "Mondiale"}
                </p>
                <div style="text-align:left; max-height:300px; overflow-y:auto; margin-bottom:20px; background:#000; border-radius:10px; padding:10px;">
                    ${htmlList || "<p style='color:#aaa;text-align:center;'>Aucun classement disponible.</p>"}
                </div>
                <button onclick="document.getElementById('leaderboard-modal').style.display='none'" style="width:100%; background:transparent; border:1px solid #aaa; color:#fff; padding:10px; border-radius:20px; cursor:pointer;">Fermer</button>
            </div>
        `;
    modal.style.display = "flex";
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.Leaderboard.init();
  }, 4000);
});
