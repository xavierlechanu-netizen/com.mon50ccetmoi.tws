// --- CREWS & TERRITORY WARS (Postal Code Based) ---
window.CrewSystem = {
    currentCrew: null,
    territories: {}, // zipcode -> { dominantCrewId, dominantCrewName, crewStats, color }

    init: async function() {
        if (!window.session || !window.session.uid) return;
        console.log("[CrewSystem] Initializing Tactical Territories...");
        await this.loadMyCrew();
        this.listenToTerritories();
    },

    loadMyCrew: async function() {
        if (!window.session.crewId) return;
        try {
            const doc = await firebase.firestore().collection("crews").doc(window.session.crewId).get();
            if (doc.exists) {
                this.currentCrew = { id: doc.id, ...doc.data() };
                this.updateUI();
                
                if (this.currentCrew.qgLat && this.currentCrew.qgLng) {
                    this.drawQG(this.currentCrew.qgLat, this.currentCrew.qgLng);
                }
            }
        } catch(e) {
            console.error("[CrewSystem] Error loading crew", e);
        }
    },

    createCrew: async function(name, color) {
        if (!window.session) return;
        if (!name || !color) return alert("Nom et couleur obligatoires.");
        try {
            const crewData = {
                name: name,
                color: color,
                leaderUid: window.session.uid,
                createdAt: Date.now(),
                members: [window.session.uid],
                totalKm: 0
            };
            const docRef = await firebase.firestore().collection("crews").add(crewData);
            
            // Update user profile
            await firebase.firestore().collection("users").doc(window.session.uid).update({ crewId: docRef.id });
            window.session.crewId = docRef.id;
            secureSetItem('session', JSON.stringify(window.session));
            
            await this.loadMyCrew();
            alert("Crew " + name + " fondé avec succès ! Vous pouvez maintenant capturer des zones.");
            
            // Close modal if open
            const modal = document.getElementById("crew-modal");
            if(modal) modal.style.display = "none";
        } catch(e) {
            console.error("[CrewSystem] Create Crew error", e);
            alert("Erreur: " + e.message);
        }
    },

    listenToTerritories: function() {
        if (typeof firebase === 'undefined') return;
        firebase.firestore().collection("territory_sectors").onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const data = change.doc.data();
                const zipCode = change.doc.id;
                
                if (change.type === "added" || change.type === "modified") {
                    
                    // Détection de la perte d'un territoire
                    if (change.type === "modified") {
                        const oldData = this.territories[zipCode];
                        if (oldData && this.currentCrew && 
                            oldData.dominantCrewId === this.currentCrew.id && 
                            data.dominantCrewId !== this.currentCrew.id) {
                            
                            console.warn(`[CrewSystem] Territory ${zipCode} lost to ${data.dominantCrewName}`);
                            
                            if (typeof speak === 'function') {
                                speak(`Alerte Crew ! Le gang ${data.dominantCrewName} vient de s'emparer du secteur ${zipCode}.`);
                            }
                            
                            // Affichage visuel (Notification ou Alert)
                            const modal = document.createElement('div');
                            modal.style.cssText = "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(255,0,85,0.95);color:white;padding:15px 25px;border-radius:15px;z-index:99999;border:1px solid #ff0055;box-shadow:0 0 20px rgba(255,0,85,0.6);text-align:center;font-weight:bold;opacity:0;transition:opacity 0.5s;";
                            modal.innerHTML = `<i class="fa-solid fa-skull"></i> ALERTE TERRITOIRE <br><small>Le code postal ${zipCode} est passé aux mains de ${data.dominantCrewName} !</small>`;
                            document.body.appendChild(modal);
                            
                            // Fade in
                            setTimeout(() => { modal.style.opacity = "1"; }, 100);
                            
                            // Fade out and remove
                            setTimeout(() => { 
                                modal.style.opacity = "0"; 
                                setTimeout(() => modal.remove(), 500);
                            }, 5000);
                        }
                    }

                    this.territories[zipCode] = data;
                    if (window.MapSystem && window.MapSystem.updateTerritoryLayer) {
                        window.MapSystem.updateTerritoryLayer(zipCode, data);
                    }
                }
            });
        });
    },

    addKmToTerritory: async function(zipCode, km) {
        if (!this.currentCrew || !zipCode) return;
        try {
            const sectorRef = firebase.firestore().collection("territory_sectors").doc(zipCode);
            await firebase.firestore().runTransaction(async (transaction) => {
                const doc = await transaction.get(sectorRef);
                if (!doc.exists) {
                    transaction.set(sectorRef, { 
                        dominantCrewId: this.currentCrew.id,
                        dominantCrewName: this.currentCrew.name,
                        color: this.currentCrew.color,
                        crewStats: { [this.currentCrew.id]: km }
                    });
                } else {
                    let data = doc.data();
                    let stats = data.crewStats || {};
                    stats[this.currentCrew.id] = (stats[this.currentCrew.id] || 0) + km;
                    
                    // Trouver le dominant
                    let maxKm = 0;
                    let dominantId = data.dominantCrewId;
                    let dominantName = data.dominantCrewName;
                    let dominantColor = data.color;

                    for (const [cId, cKm] of Object.entries(stats)) {
                        if (cKm > maxKm) {
                            maxKm = cKm;
                            dominantId = cId;
                            // Si c'est nous qui reprenons la tête, on met nos infos.
                            if (cId === this.currentCrew.id) {
                                dominantName = this.currentCrew.name;
                                dominantColor = this.currentCrew.color;
                            }
                        }
                    }

                    transaction.update(sectorRef, {
                        crewStats: stats,
                        dominantCrewId: dominantId,
                        dominantCrewName: dominantName,
                        color: dominantColor
                    });
                }
            });
            console.log(`[CrewSystem] Added ${km}km to sector ${zipCode}`);
        } catch(e) {
            console.error("[CrewSystem] Error updating territory", e);
        }
    },

    updateUI: function() {
        const btn = document.getElementById("crew-hud-btn");
        if (btn && this.currentCrew) {
            btn.innerHTML = `<i class="fa-solid fa-users"></i> ${this.currentCrew.name}`;
            btn.style.color = this.currentCrew.color;
            btn.style.borderColor = this.currentCrew.color;
            btn.style.boxShadow = `0 0 10px ${this.currentCrew.color}66`;
        }
    },
    
    drawQG: function(lat, lng) {
        if (!map || !this.currentCrew) return;
        
        if (this.qgMarker) {
            this.qgMarker.setMap(null);
        }
        
        this.qgMarker = new google.maps.Marker({
            position: { lat: lat, lng: lng },
            map: map,
            icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                fillColor: this.currentCrew.color,
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
                scale: 6
            },
            title: `QG: ${this.currentCrew.name}`
        });
        
        const info = new google.maps.InfoWindow({
            content: `<div style="color:black; font-family:'Outfit', sans-serif; text-align:center; padding:10px;">
                        <h3 style="margin:0; color:${this.currentCrew.color};"><i class="fa-solid fa-crown"></i> QG ${this.currentCrew.name}</h3>
                        <p style="margin:5px 0; font-size:0.9rem;">Point de Ralliement Secret</p>
                      </div>`
        });
        this.qgMarker.addListener("click", () => info.open(map, this.qgMarker));
    },

    setQG: async function() {
        if (!this.currentCrew || this.currentCrew.leaderUid !== window.session.uid) {
            return alert("Seul le leader du Crew peut définir le QG !");
        }
        if (!window.currentPosition) return alert("Le signal GPS est requis.");
        
        try {
            await firebase.firestore().collection("crews").doc(this.currentCrew.id).update({
                qgLat: window.currentPosition.lat,
                qgLng: window.currentPosition.lng
            });
            this.currentCrew.qgLat = window.currentPosition.lat;
            this.currentCrew.qgLng = window.currentPosition.lng;
            this.drawQG(window.currentPosition.lat, window.currentPosition.lng);
            alert("Le Quartier Général de votre Crew a été établi à votre position actuelle ! Il est désormais visible par tous vos membres.");
            
            const modal = document.getElementById("crew-modal");
            if (modal) modal.style.display = "none";
        } catch(e) {
            console.error("[CrewSystem] Error setting QG", e);
            alert("Erreur lors de la sauvegarde du QG.");
        }
    },
    
    showModal: function() {
        let modal = document.getElementById("crew-modal");
        if (!modal) {
            // Création de la modale si elle n'existe pas
            modal = document.createElement('div');
            modal.id = "crew-modal";
            modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
            document.body.appendChild(modal);
        }
        
        if (this.currentCrew) {
            modal.innerHTML = `
                <div style="background:rgba(20,20,20,0.9); border:1px solid ${this.currentCrew.color}; border-radius:15px; padding:30px; width:90%; max-width:400px; text-align:center;">
                    <h2 style="color:${this.currentCrew.color}; margin-bottom:20px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-crown"></i> ${this.currentCrew.name}</h2>
                    <p style="color:#aaa; margin-bottom:20px;">Vous êtes membre de ce Crew. Roulez dans différents codes postaux pour les capturer !</p>
                    
                    ${this.currentCrew.leaderUid === window.session.uid ? 
                        `<button onclick="window.CrewSystem.setQG()" style="width:100%; background:#111; border:1px solid ${this.currentCrew.color}; color:#fff; padding:12px; border-radius:10px; font-weight:bold; cursor:pointer; margin-bottom:15px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-map-pin"></i> Poser le QG ici</button>` 
                        : ''}

                    <button onclick="document.getElementById('crew-modal').style.display='none'" style="background:transparent; border:1px solid #aaa; color:#fff; padding:10px 20px; border-radius:20px; cursor:pointer; font-family:'Outfit', sans-serif;">Fermer</button>
                </div>
            `;
        } else {
            modal.innerHTML = `
                <div style="background:rgba(20,20,20,0.9); border:1px solid #00d2ff; border-radius:15px; padding:30px; width:90%; max-width:400px; text-align:center;">
                    <h2 style="color:#00d2ff; margin-bottom:20px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-flag"></i> Fonder un Crew</h2>
                    <p style="color:#aaa; margin-bottom:20px; font-size:0.9rem;">Créez votre gang, roulez dans votre ville et dominez les codes postaux sur la carte mondiale !</p>
                    <input type="text" id="crew-name-input" placeholder="Nom du Crew (ex: NightRiders)" style="width:100%; padding:10px; margin-bottom:15px; background:rgba(0,0,0,0.5); border:1px solid #333; color:#fff; border-radius:8px;">
                    <input type="color" id="crew-color-input" value="#ff0055" style="width:100%; height:40px; margin-bottom:20px; border:none; border-radius:8px; cursor:pointer;">
                    <button onclick="window.CrewSystem.createCrew(document.getElementById('crew-name-input').value, document.getElementById('crew-color-input').value)" style="width:100%; background:linear-gradient(135deg, #00d2ff, #0077ff); border:none; color:#fff; padding:12px; border-radius:20px; font-weight:bold; cursor:pointer; margin-bottom:10px;">Fonder le Crew</button>
                    <button onclick="document.getElementById('crew-modal').style.display='none'" style="width:100%; background:transparent; border:1px solid #aaa; color:#fff; padding:10px; border-radius:20px; cursor:pointer;">Annuler</button>
                </div>
            `;
        }
        modal.style.display = "flex";
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Wait for auth to be ready
    setTimeout(() => { window.CrewSystem.init(); }, 3000);
});
