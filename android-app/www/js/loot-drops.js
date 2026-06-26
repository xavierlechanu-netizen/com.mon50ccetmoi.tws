// --- LOOT DROPS (Chasse au Trésor) ---
window.LootSystem = {
    lootMarkers: {}, // id -> google.maps.Marker
    claimDistance: 50, // mètres

    init: function() {
        if (!window.session || !window.session.uid) return;
        console.log("[LootSystem] Initializing...");
        this.listenToLootDrops();
        
        // Timer de vérification de distance si on a le GPS
        setInterval(() => this.checkDistance(), 10000); // toutes les 10s
    },

    listenToLootDrops: function() {
        if (typeof firebase === 'undefined') return;
        
        const now = Date.now();
        // N'écoute que les loots actifs et non expirés
        firebase.firestore().collection("loot_drops")
            .where("expiresAt", ">", now)
            .where("isClaimed", "==", false)
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    const data = change.doc.data();
                    const lootId = change.doc.id;
                    
                    if (change.type === "added" || change.type === "modified") {
                        this.drawLoot(lootId, data);
                    } else if (change.type === "removed") {
                        this.removeLoot(lootId);
                    }
                });
            });
    },

    drawLoot: function(lootId, data) {
        if (!map) return;
        
        // Clean existing
        this.removeLoot(lootId);
        
        const m = new google.maps.Marker({
            position: { lat: data.lat, lng: data.lng },
            map: map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#ffd700', // Gold
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
                scale: 8
            },
            title: "Loot Drop"
        });
        
        const info = new google.maps.InfoWindow({
            content: `<div style="color:black; font-family:'Outfit', sans-serif;">
                        <h3 style="margin:0; color:#b700ff;"><i class="fa-solid fa-gift"></i> Butin Secret</h3>
                        <p style="margin:5px 0; font-size:0.9rem;">Approchez-vous à moins de 50m pour le réclamer !</p>
                      </div>`
        });
        
        m.addListener("click", () => info.open(map, m));
        
        this.lootMarkers[lootId] = m;
    },

    removeLoot: function(lootId) {
        if (this.lootMarkers[lootId]) {
            this.lootMarkers[lootId].setMap(null);
            delete this.lootMarkers[lootId];
        }
    },

    checkDistance: function() {
        if (!window.currentPosition || typeof google === 'undefined') return;
        
        const pos = new google.maps.LatLng(window.currentPosition.lat, window.currentPosition.lng);
        
        for (const [lootId, marker] of Object.entries(this.lootMarkers)) {
            const lootPos = marker.getPosition();
            const dist = google.maps.geometry.spherical.computeDistanceBetween(pos, lootPos);
            
            if (dist <= this.claimDistance) {
                this.claimLoot(lootId);
            }
        }
    },
    
    claimLoot: async function(lootId) {
        if (!window.session) return;
        
        try {
            // Transaction pour éviter double claim
            const docRef = firebase.firestore().collection("loot_drops").doc(lootId);
            await firebase.firestore().runTransaction(async (t) => {
                const doc = await t.get(docRef);
                if (!doc.exists) throw "Loot n'existe plus.";
                const data = doc.data();
                if (data.isClaimed) throw "Déjà réclamé.";
                if (data.expiresAt < Date.now()) throw "Loot expiré.";
                
                t.update(docRef, {
                    isClaimed: true,
                    claimedBy: window.session.uid,
                    claimedAt: Date.now()
                });
            });
            
            // Succès
            this.removeLoot(lootId);
            if (typeof speak === 'function') {
                speak("Félicitations, vous avez sécurisé un butin secret !");
            }
            
            // Gamification
            let pts = parseInt(localStorage.getItem('bvcPoints') || '0');
            localStorage.setItem('bvcPoints', pts + 10);
            
            alert("🎁 BUTIN RÉCUPÉRÉ !\n\nVous avez trouvé la caisse. +10 Points de Bonne Conduite BVC ajoutés !");
            
        } catch(e) {
            console.log("[LootSystem] Claim error:", e);
        }
    },
    
    // DEV ONLY: Fonction pour créer un faux drop autour de soi pour tester
    devSpawnLoot: function() {
        if (!window.currentPosition) return alert("Pas de GPS");
        
        // Spawn à 100-200m
        const offsetLat = (Math.random() - 0.5) * 0.005;
        const offsetLng = (Math.random() - 0.5) * 0.005;
        
        firebase.firestore().collection("loot_drops").add({
            lat: window.currentPosition.lat + offsetLat,
            lng: window.currentPosition.lng + offsetLng,
            isClaimed: false,
            expiresAt: Date.now() + (2 * 60 * 60 * 1000), // expire dans 2h
            createdBy: 'system'
        });
        console.log("Faux loot spawn.");
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { window.LootSystem.init(); }, 4000);
});
