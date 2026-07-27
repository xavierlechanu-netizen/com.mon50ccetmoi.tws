// --- ROADBOOKS & TRACÃ‰S ---
window.RoadbookSystem = {
  isRecording: false,
  currentPath: [],
  recordInterval: null,
  roadbookPolylines: {},

  init: function () {
    if (!window.session || !window.session.uid) return;

    this.listenToRoadbooks();
  },

  toggleRecording: function () {
    const btn = document.getElementById("roadbook-rec-btn");
    if (this.isRecording) {
      // STOP
      this.isRecording = false;
      clearInterval(this.recordInterval);
      if (btn) btn.innerHTML = `<i class="fa-solid fa-route"></i> REC Trace`;
      if (btn) btn.style.color = "#b700ff";
      if (btn) btn.style.border = "1px solid #b700ff";
      if (btn) btn.style.background = "none";

      if (this.currentPath.length > 5) {
        const title = prompt(
          "Enregistrement terminÃ©. Entrez un nom pour votre Roadbook (ex: Balade en VallÃ©e de Chevreuse) :",
        );
        if (title) {
          this.saveRoadbook(title);
        } else {
          this.currentPath = [];
        }
      } else {
        alert("TracÃ© trop court (moins de 5 points GPS), non sauvegardÃ©.");
        this.currentPath = [];
      }
    } else {
      // START
      this.isRecording = true;
      this.currentPath = [];
      if (btn) btn.innerHTML = `<i class="fa-solid fa-stop"></i> STOP REC`;
      if (btn) btn.style.color = "#fff";
      if (btn) btn.style.border = "2px solid #ff0055";
      if (btn) btn.style.background = "#ff0055";

      if (typeof speak === "function")
        speak("Enregistrement du tracÃ© activÃ©.");

      this.recordInterval = setInterval(() => {
        if (window.currentPosition) {
          this.currentPath.push({
            lat: window.currentPosition.lat,
            lng: window.currentPosition.lng,
          });
        }
      }, 5000); // Record point every 5 seconds
    }
  },

  saveRoadbook: async function (title) {
    try {
      await firebase.firestore().collection("roadbooks").add({
        title: title,
        author: window.session.username,
        authorUid: window.session.uid,
        path: this.currentPath,
        createdAt: Date.now(),
        rating: 0,
        votes: 0,
      });
      alert("Roadbook public sauvegardÃ© avec succÃ¨s sur la carte !");
      this.currentPath = [];
    } catch (e) {
      console.error(e);
      alert("Erreur de sauvegarde de la trace.");
    }
  },

  listenToRoadbooks: function () {
    if (typeof firebase === "undefined") return;

    firebase
      .firestore()
      .collection("roadbooks")
      .orderBy("createdAt", "desc")
      .limit(20)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const id = change.doc.id;

          if (change.type === "added" || change.type === "modified") {
            this.drawRoadbook(id, data);
          } else if (change.type === "removed") {
            this.removeRoadbook(id);
          }
        });
      });
  },

  drawRoadbook: function (id, data) {
    if (!map || !data.path || data.path.length === 0) return;

    this.removeRoadbook(id);

    const path = data.path.map((p) => new google.maps.LatLng(p.lat, p.lng));

    const polyline = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: "#b700ff",
      strokeOpacity: 0.6,
      strokeWeight: 4,
      map: map,
    });

    // Add info window on click
    const info = new google.maps.InfoWindow({
      content: `<div style="color:black; font-family:'Outfit';">
                        <h3 style="color:#b700ff; margin:0;">${data.title}</h3>
                        <p style="margin:5px 0 10px;">Par: ${data.author}</p>
                        <p style="margin:0;">Points: ${data.path.length}</p>
                      </div>`,
    });

    polyline.addListener("click", (event) => {
      info.setPosition(event.latLng);
      info.open(map);
    });

    this.roadbookPolylines[id] = polyline;
  },

  removeRoadbook: function (id) {
    if (this.roadbookPolylines[id]) {
      this.roadbookPolylines[id].setMap(null);
      delete this.roadbookPolylines[id];
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.RoadbookSystem.init();
  }, 4000);
});
