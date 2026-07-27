// --- GARAGE MARKET (Troc et Vente de piÃ¨ces) ---
window.GarageMarket = {
  tradeMarkers: {},

  init: function () {
    if (!window.session || !window.session.uid) return;

    // Attendre que la carte soit prÃªte pour Ã©viter de perdre les marqueurs initiaux
    const checkDependencies = setInterval(() => {
      if (typeof map !== "undefined" && map) {
        clearInterval(checkDependencies);
        this.listenToTrades();
      }
    }, 500);
  },

  listenToTrades: function () {
    if (typeof firebase === "undefined") return;

    firebase
      .firestore()
      .collection("garage_trades")
      .where("isActive", "==", true)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const tradeId = change.doc.id;

          if (change.type === "added" || change.type === "modified") {
            this.drawTrade(tradeId, data);
          } else if (change.type === "removed") {
            this.removeTrade(tradeId);
          }
        });
      });
  },

  drawTrade: function (tradeId, data) {
    if (!map) return;

    this.removeTrade(tradeId);

    const isWTB = data.type === "WTB"; // Want to buy

    const m = new google.maps.Marker({
      position: { lat: data.lat, lng: data.lng },
      map: map,
      icon: {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        fillColor: isWTB ? "#ffaa00" : "#00d2ff", // Orange if searching, Blue if selling
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 1,
        scale: 6,
      },
      title: data.title,
    });

    const typeStr = isWTB ? "RECHERCHE" : "Ã€ VENDRE";
    const info = new google.maps.InfoWindow({
      content: `<div style="color:black; font-family:'Outfit', sans-serif; max-width:200px;">
                        <span style="font-size:0.7rem; background:${isWTB ? "#ffaa00" : "#00d2ff"}; color:white; padding:2px 5px; border-radius:3px;">${typeStr}</span>
                        <h3 style="margin:5px 0;">${data.title}</h3>
                        <p style="margin:0 0 10px 0; font-size:0.9rem;">${data.desc}</p>
                        <small>Par: ${data.author}</small><br>
                        <a href="mailto:contact@mon50ccetmoi.com?subject=Annonce_${tradeId}" style="display:inline-block; margin-top:10px; background:#111; color:white; padding:5px 10px; text-decoration:none; border-radius:5px; font-size:0.8rem;">Contacter</a>
                      </div>`,
    });

    m.addListener("click", () => info.open(map, m));
    this.tradeMarkers[tradeId] = m;
  },

  removeTrade: function (tradeId) {
    if (this.tradeMarkers[tradeId]) {
      this.tradeMarkers[tradeId].setMap(null);
      delete this.tradeMarkers[tradeId];
    }
  },

  showModal: function () {
    let modal = document.getElementById("market-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "market-modal";
      modal.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
            <div style="background:rgba(20,20,20,0.9); border:1px solid #ffaa00; border-radius:15px; padding:30px; width:90%; max-width:400px; text-align:center;">
                <h2 style="color:#ffaa00; margin-bottom:20px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-wrench"></i> Troc de Garage</h2>
                
                <select id="market-type" style="width:100%; padding:10px; margin-bottom:10px; background:#111; color:white; border:1px solid #333; border-radius:5px;">
                    <option value="WTS">Je vends une piÃ¨ce</option>
                    <option value="WTB">Je cherche une piÃ¨ce en urgence</option>
                </select>
                
                <input type="text" id="market-title" placeholder="Titre (ex: Gicleur 80, ClÃ© BTR...)" style="width:100%; padding:10px; margin-bottom:10px; background:#111; color:white; border:1px solid #333; border-radius:5px;">
                <textarea id="market-desc" placeholder="Description courte..." style="width:100%; padding:10px; margin-bottom:20px; background:#111; color:white; border:1px solid #333; border-radius:5px; height:80px;"></textarea>
                
                <button onclick="window.GarageMarket.postTrade()" style="width:100%; background:#ffaa00; border:none; color:#000; padding:12px; border-radius:20px; font-weight:bold; cursor:pointer; margin-bottom:10px;">Publier sur la carte</button>
                <button onclick="document.getElementById('market-modal').style.display='none'" style="width:100%; background:transparent; border:1px solid #aaa; color:#fff; padding:10px; border-radius:20px; cursor:pointer;">Annuler</button>
            </div>
        `;
    modal.style.display = "flex";
  },

  postTrade: async function () {
    if (!window.session || !window.currentPosition) {
      return alert("Le signal GPS est requis pour poster une annonce locale.");
    }
    const type = document.getElementById("market-type").value;
    const title = document.getElementById("market-title").value;
    const desc = document.getElementById("market-desc").value;

    if (!title) return alert("Le titre est obligatoire.");

    try {
      await firebase.firestore().collection("garage_trades").add({
        type: type,
        title: title,
        desc: desc,
        author: window.session.username,
        authorUid: window.session.uid,
        lat: window.currentPosition.lat,
        lng: window.currentPosition.lng,
        createdAt: Date.now(),
        isActive: true,
      });
      alert("Annonce gÃ©olocalisÃ©e publiÃ©e avec succÃ¨s !");
      document.getElementById("market-modal").style.display = "none";
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la publication de l'annonce.");
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.GarageMarket.init();
  }, 4000);
});
