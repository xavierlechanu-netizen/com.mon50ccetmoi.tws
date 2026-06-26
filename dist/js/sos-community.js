// --- S.O.S COMMUNAUTAIRE ---
window.SosSystem = {
    sosMarkers: {},
    alertDistance: 10000, // 10 km
    
    init: function() {
        if (!window.session || !window.session.uid) return;
        console.log("[SosSystem] Initializing...");
        
        // Prepare audio context for Siren
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        } catch(e) {}
        
        this.listenToAlerts();
    },

    playSiren: function() {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, this.audioCtx.currentTime + 0.3);
        osc.frequency.linearRampToValueAtTime(400, this.audioCtx.currentTime + 0.6);
        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        gainNode.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 1);
        osc.start(this.audioCtx.currentTime);
        osc.stop(this.audioCtx.currentTime + 1);
    },

    listenToAlerts: function() {
        if (typeof firebase === 'undefined') return;
        
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        firebase.firestore().collection("sos_alerts")
            .where("createdAt", ">", oneHourAgo)
            .where("isActive", "==", true)
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    const data = change.doc.data();
                    const alertId = change.doc.id;
                    
                    if (change.type === "added" || change.type === "modified") {
                        this.handleAlert(alertId, data);
                    } else if (change.type === "removed") {
                        this.removeAlert(alertId);
                    }
                });
            });
    },

    handleAlert: function(alertId, data) {
        if (!window.currentPosition || typeof google === 'undefined') return;
        
        // Check distance
        const myPos = new google.maps.LatLng(window.currentPosition.lat, window.currentPosition.lng);
        const sosPos = new google.maps.LatLng(data.lat, data.lng);
        const dist = google.maps.geometry.spherical.computeDistanceBetween(myPos, sosPos);
        
        if (dist <= this.alertDistance) {
            this.drawAlert(alertId, data);
            
            // Si c'est nouveau et que ce n'est pas nous, on prévient vocalement
            if (data.authorUid !== window.session.uid && !this.sosMarkers[alertId].warned) {
                this.sosMarkers[alertId].warned = true;
                const distKm = (dist/1000).toFixed(1);
                this.playSiren();
                if (typeof speak === 'function') {
                    setTimeout(() => speak(`Alerte SOS : Pilote en détresse à ${distKm} kilomètres.`), 1000);
                }
                alert(`🚨 SOS DÉTECTÉ 🚨\n\nUn pilote (${data.author}) a signalé une urgence : ${data.type}\nDistance : ${distKm} km.\nRegardez la carte !`);
            }
        }
    },

    drawAlert: function(alertId, data) {
        if (!map) return;
        
        if (this.sosMarkers[alertId]) {
            this.sosMarkers[alertId].marker.setPosition({lat: data.lat, lng: data.lng});
            return;
        }

        // Define GyrophareOverlay if not defined yet
        if (!this.GyrophareOverlay) {
            this.GyrophareOverlay = class extends google.maps.OverlayView {
                constructor(position, alertId, sosSystemInstance) {
                    super();
                    this.position = position;
                    this.alertId = alertId;
                    this.sosSystemInstance = sosSystemInstance;
                    this.div = document.createElement('div');
                    this.div.className = 'gyrophare-marker';
                    this.div.innerHTML = `
                        <div class="gyrophare-siren red"></div>
                        <div class="gyrophare-siren blue"></div>
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    `;
                }
                onAdd() {
                    this.getPanes().overlayMouseTarget.appendChild(this.div);
                    google.maps.event.addDomListener(this.div, 'click', () => {
                        google.maps.event.trigger(this, 'click');
                    });
                }
                draw() {
                    const projection = this.getProjection();
                    if (!projection) return;
                    const pos = projection.fromLatLngToDivPixel(this.position);
                    if (pos) {
                        this.div.style.left = pos.x + 'px';
                        this.div.style.top = pos.y + 'px';
                    }
                }
                onRemove() {
                    if (this.div.parentNode) this.div.parentNode.removeChild(this.div);
                }
                setPosition(pos) {
                    this.position = pos;
                    this.draw();
                }
            };
        }
        
        const pos = new google.maps.LatLng(data.lat, data.lng);
        const m = new this.GyrophareOverlay(pos, alertId, this);
        m.setMap(map);
        
        const info = new google.maps.InfoWindow({
            content: `<div style="color:red; font-family:'Outfit', sans-serif; text-align:center; padding:10px;">
                        <h3 style="margin:0; font-size:1.2rem;">🚨 S.O.S</h3>
                        <p style="margin:5px 0;"><b>Pilote :</b> ${data.author}</p>
                        <p style="margin:5px 0; color:#000;"><b>Problème :</b> ${data.type}</p>
                        ${data.authorUid === window.session.uid ? 
                            `<button onclick="window.SosSystem.resolveAlert('${alertId}')" style="background:green; color:white; border:none; padding:8px 15px; border-radius:20px; cursor:pointer; font-weight:bold; margin-top:10px;">Problème Résolu</button>` 
                            : ''
                        }
                      </div>`
        });
        
        m.addListener = function(eventName, handler) {
            google.maps.event.addListener(this, eventName, handler);
        };
        m.addListener("click", () => info.open(map, m));
        
        this.sosMarkers[alertId] = { marker: m, warned: false };
    },

    removeAlert: function(alertId) {
        if (this.sosMarkers[alertId]) {
            this.sosMarkers[alertId].marker.setMap(null);
            delete this.sosMarkers[alertId];
        }
    },
    
    showModal: function() {
        let modal = document.getElementById("sos-modal");
        if (!modal) {
            modal = document.createElement('div');
            modal.id = "sos-modal";
            modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div style="background:#111; border:2px solid #ff0000; border-radius:15px; padding:30px; width:90%; max-width:400px; text-align:center; color:white;">
                <h2 style="color:#ff0000; margin-bottom:20px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-triangle-exclamation"></i> LANCER UN S.O.S</h2>
                <p style="margin-bottom:20px;">Prévenez les pilotes autour de vous pour obtenir de l'aide.</p>
                <select id="sos-type" style="width:100%; padding:15px; margin-bottom:20px; background:#222; color:white; border:1px solid #ff0000; border-radius:10px; font-size:1.1rem;">
                    <option value="Panne d'essence">⛽ Panne d'essence</option>
                    <option value="Crevaison">🛞 Crevaison</option>
                    <option value="Casse Mécanique">🔧 Casse Mécanique (Courroie, Serrage...)</option>
                    <option value="Accident léger">🚑 Accident léger</option>
                </select>
                <button onclick="window.SosSystem.triggerAlert()" style="width:100%; background:#ff0000; color:white; border:none; padding:15px; border-radius:10px; font-weight:bold; font-size:1.2rem; cursor:pointer; margin-bottom:10px;">LANCER L'ALERTE</button>
                <button onclick="document.getElementById('sos-modal').style.display='none'" style="width:100%; background:transparent; color:#aaa; border:1px solid #aaa; padding:10px; border-radius:10px; cursor:pointer;">Annuler</button>
            </div>
        `;
        modal.style.display = "flex";
    },
    
    triggerAlert: async function() {
        if (!window.session || !window.currentPosition) return alert("Position GPS requise.");
        const type = document.getElementById('sos-type').value;
        
        try {
            await firebase.firestore().collection("sos_alerts").add({
                type: type,
                author: window.session.username,
                authorUid: window.session.uid,
                lat: window.currentPosition.lat,
                lng: window.currentPosition.lng,
                createdAt: Date.now(),
                isActive: true
            });
            alert("Alerte SOS envoyée ! Restez près de votre scooter, l'aide arrive.");
            document.getElementById('sos-modal').style.display = 'none';
            if (typeof speak === 'function') speak("Alerte de détresse envoyée à la communauté.");
        } catch(e) {
            console.error(e);
            alert("Erreur réseau SOS.");
        }
    },
    
    resolveAlert: async function(alertId) {
        try {
            await firebase.firestore().collection("sos_alerts").doc(alertId).update({ isActive: false });
            alert("S.O.S clôturé. Bon retour sur la route !");
        } catch(e) {
            console.error(e);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { window.SosSystem.init(); }, 4000);
});
