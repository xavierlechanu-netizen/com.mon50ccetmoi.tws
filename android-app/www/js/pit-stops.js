// --- PIT STOPS INTELLIGENCE ---
window.PitStopSystem = {
    markers: {},
    isFuelLow: false,
    
    init: function() {
        if (!window.session || !window.session.uid) return;
        console.log("[PitStopSystem] Initializing...");
        this.listenToPitStops();
        
        // Simuler la consommation OBD toutes les minutes
        setInterval(() => this.simulateOBDFuelCheck(), 60000);
    },
    
    listenToPitStops: function() {
        if (typeof firebase === 'undefined') return;
        
        firebase.firestore().collection("pit_stops")
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    const data = change.doc.data();
                    const id = change.doc.id;
                    
                    if (change.type === "added" || change.type === "modified") {
                        this.drawPitStop(id, data);
                    } else if (change.type === "removed") {
                        this.removePitStop(id);
                    }
                });
            });
    },
    
    drawPitStop: function(id, data) {
        if (!map) return;
        this.removePitStop(id);
        
        const isGas = data.type === 'gas';
        
        const m = new google.maps.Marker({
            position: { lat: data.lat, lng: data.lng },
            map: map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: isGas ? '#ff0055' : '#00d2ff',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
                scale: 6
            },
            title: data.name
        });
        
        const info = new google.maps.InfoWindow({
            content: `<div style="color:black; font-family:'Outfit';">
                        <h3 style="margin:0;">${isGas ? '⛽' : '🔧'} ${data.name}</h3>
                        <p style="margin:5px 0;">${data.desc || ''}</p>
                        <small>Ajouté par: ${data.author}</small><br>
                        <button onclick="window.calculateRoute(new google.maps.LatLng(${data.lat}, ${data.lng}))" style="margin-top:5px; background:#111; color:white; padding:5px 10px; border:none; border-radius:5px; cursor:pointer;">Y aller</button>
                      </div>`
        });
        
        m.addListener("click", () => info.open(map, m));
        this.markers[id] = m;
    },
    
    removePitStop: function(id) {
        if (this.markers[id]) {
            this.markers[id].setMap(null);
            delete this.markers[id];
        }
    },
    
    showModal: function() {
        let modal = document.getElementById("pitstop-modal");
        if (!modal) {
            modal = document.createElement('div');
            modal.id = "pitstop-modal";
            modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div style="background:#111; border:1px solid #ff0055; border-radius:15px; padding:30px; width:90%; max-width:400px; text-align:center;">
                <h2 style="color:#ff0055; margin-bottom:20px; font-family:'Outfit', sans-serif;">Ajouter un Point d'Intérêt</h2>
                
                <select id="pitstop-type" style="width:100%; padding:10px; margin-bottom:10px; background:#222; color:white; border:1px solid #333; border-radius:5px;">
                    <option value="gas">⛽ Station Service (Friendly 50cc)</option>
                    <option value="garage">🔧 Garage 2-Roues de confiance</option>
                </select>
                
                <input type="text" id="pitstop-name" placeholder="Nom du lieu (ex: Total Access)" style="width:100%; padding:10px; margin-bottom:10px; background:#222; color:white; border:1px solid #333; border-radius:5px;">
                <textarea id="pitstop-desc" placeholder="Détails (ex: SP98 pas cher, compresseur gratuit...)" style="width:100%; padding:10px; margin-bottom:20px; background:#222; color:white; border:1px solid #333; border-radius:5px; height:60px;"></textarea>
                
                <button onclick="window.PitStopSystem.addPitStop()" style="width:100%; background:#ff0055; border:none; color:white; padding:12px; border-radius:20px; font-weight:bold; cursor:pointer; margin-bottom:10px;">Enregistrer ma position</button>
                <button onclick="document.getElementById('pitstop-modal').style.display='none'" style="width:100%; background:transparent; border:1px solid #aaa; color:#fff; padding:10px; border-radius:20px; cursor:pointer;">Annuler</button>
            </div>
        `;
        modal.style.display = "flex";
    },
    
    addPitStop: async function() {
        if (!window.session || !window.currentPosition) return alert("Position GPS requise.");
        const type = document.getElementById('pitstop-type').value;
        const name = document.getElementById('pitstop-name').value;
        const desc = document.getElementById('pitstop-desc').value;
        
        if (!name) return alert("Nom obligatoire.");
        
        try {
            await firebase.firestore().collection("pit_stops").add({
                type: type,
                name: name,
                desc: desc,
                author: window.session.username,
                authorUid: window.session.uid,
                lat: window.currentPosition.lat,
                lng: window.currentPosition.lng,
                createdAt: Date.now()
            });
            alert("Pit Stop ajouté sur la carte globale !");
            document.getElementById('pitstop-modal').style.display = 'none';
        } catch(e) {
            console.error(e);
            alert("Erreur réseau.");
        }
    },
    
    // Simulateur d'OBD pour faire baisser l'essence et déclencher l'alerte
    simulateOBDFuelCheck: function() {
        if (window.obdFuelLevel === undefined) window.obdFuelLevel = 100;
        
        // Seulement si on roule vraiment (isRiding) ou si on force le check
        if (window.isRiding || window.forceOBDCheck) {
            window.obdFuelLevel -= 2; // Baisse de 2%
            if (window.obdFuelLevel < 0) window.obdFuelLevel = 0;
            
            if (window.obdFuelLevel <= 15 && !this.isFuelLow) {
                this.isFuelLow = true;
                if (typeof speak === 'function') {
                    speak("Alerte O B D. Niveau de carburant critique, inférieur à 15 pourcents. Voulez-vous que je vous guide vers la station la plus proche ?");
                }
                
                // On trouve la station la plus proche sur la carte
                let closestGas = null;
                let minDist = 9999999;
                
                if (window.currentPosition && typeof google !== 'undefined') {
                    const myPos = new google.maps.LatLng(window.currentPosition.lat, window.currentPosition.lng);
                    for (const [id, marker] of Object.entries(this.markers)) {
                        const dist = google.maps.geometry.spherical.computeDistanceBetween(myPos, marker.getPosition());
                        if (dist < minDist) {
                            minDist = dist;
                            closestGas = marker;
                        }
                    }
                }
                
                const uiHtml = `
                    <div id="fuel-alert" style="position:fixed; top:80px; left:50%; transform:translateX(-50%); background:rgba(255,165,0,0.95); color:black; padding:15px; border-radius:10px; z-index:99999; text-align:center; font-weight:bold; box-shadow:0 0 20px rgba(255,165,0,0.5);">
                        <i class="fa-solid fa-gas-pump"></i> CARBURANT CRITIQUE (${window.obdFuelLevel}%)<br>
                        ${closestGas ? `<button onclick="window.calculateRoute(new google.maps.LatLng(${closestGas.getPosition().lat()}, ${closestGas.getPosition().lng()})); document.getElementById('fuel-alert').remove();" style="margin-top:10px; padding:8px 15px; background:black; color:white; border:none; border-radius:5px; cursor:pointer;">Aller à la station la plus proche</button>` : '<div style="margin-top:10px;">Aucune station communautaire connue autour.</div>'}
                        <button onclick="document.getElementById('fuel-alert').remove();" style="margin-top:10px; padding:8px 15px; background:transparent; color:black; border:1px solid black; border-radius:5px; cursor:pointer;">Ignorer</button>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', uiHtml);
            }
        }
    },
    
    // Pour Dev : bouton pour forcer la baisse
    devDrainFuel: function() {
        window.forceOBDCheck = true;
        window.obdFuelLevel = 16;
        this.isFuelLow = false;
        this.simulateOBDFuelCheck();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { window.PitStopSystem.init(); }, 4000);
});
