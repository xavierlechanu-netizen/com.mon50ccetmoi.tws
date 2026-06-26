// --- MODE CORTÈGE (Balade Synchro) ---
window.CortegeSystem = {
    sessionId: null,
    members: {}, // uid -> data (lat, lng, name, color)
    markers: {}, // uid -> google.maps.Marker
    maxDistanceWarning: 500, // mètres

    init: function() {
        if (!window.session || !window.session.uid) return;
        console.log("[CortegeSystem] Ready");
    },

    createSession: async function() {
        if (!window.session) return;
        try {
            const joinCode = Math.floor(1000 + Math.random() * 9000).toString(); // Code à 4 chiffres
            
            const docRef = await firebase.firestore().collection("cortege_sessions").add({
                code: joinCode,
                leaderId: window.session.uid,
                leaderName: window.session.username,
                createdAt: Date.now(),
                isActive: true
            });
            
            this.sessionId = docRef.id;
            alert(`Cortège créé ! Le code secret pour rejoindre est : ${joinCode}`);
            this.startSharing();
            this.listenToMembers();
        } catch(e) {
            console.error(e);
            alert("Erreur de création de cortège.");
        }
    },

    joinSession: async function(code) {
        if (!window.session) return;
        try {
            const snap = await firebase.firestore().collection("cortege_sessions")
                .where("code", "==", code)
                .where("isActive", "==", true)
                .limit(1).get();
                
            if (snap.empty) {
                return alert("Cortège introuvable ou expiré avec ce code.");
            }
            
            this.sessionId = snap.docs[0].id;
            alert(`Cortège rejoint avec succès !`);
            this.startSharing();
            this.listenToMembers();
        } catch(e) {
            console.error(e);
        }
    },

    startSharing: function() {
        if (this.shareInterval) clearInterval(this.shareInterval);
        
        // Push GPS to session sub-collection every 5 seconds
        this.shareInterval = setInterval(() => {
            if (window.currentPosition && this.sessionId) {
                firebase.firestore().collection("cortege_sessions").doc(this.sessionId)
                    .collection("members").doc(window.session.uid).set({
                        lat: window.currentPosition.lat,
                        lng: window.currentPosition.lng,
                        name: window.session.username,
                        lastUpdate: Date.now()
                    });
            }
        }, 5000);
    },

    listenToMembers: function() {
        if (!this.sessionId || typeof firebase === 'undefined') return;
        
        firebase.firestore().collection("cortege_sessions").doc(this.sessionId)
            .collection("members").onSnapshot(snap => {
                snap.docChanges().forEach(change => {
                    const data = change.doc.data();
                    const uid = change.doc.id;
                    
                    if (change.type === "added" || change.type === "modified") {
                        this.members[uid] = data;
                        this.updateMemberMarker(uid, data);
                    } else if (change.type === "removed") {
                        delete this.members[uid];
                        if(this.markers[uid]) {
                            this.markers[uid].setMap(null);
                            delete this.markers[uid];
                        }
                    }
                });
                
                this.checkDistances();
            });
    },

    updateMemberMarker: function(uid, data) {
        if (!map || uid === window.session.uid) return; // Don't draw ourselves
        
        if (!this.markers[uid]) {
            this.markers[uid] = new google.maps.Marker({
                map: map,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#00ffcc',
                    fillOpacity: 1,
                    scale: 7,
                    strokeColor: 'black',
                    strokeWeight: 1
                },
                title: data.name
            });
            const info = new google.maps.InfoWindow({ content: `<b>${data.name}</b>` });
            this.markers[uid].addListener("click", () => info.open(map, this.markers[uid]));
        }
        this.markers[uid].setPosition({ lat: data.lat, lng: data.lng });
    },

    checkDistances: function() {
        if (!window.currentPosition || typeof google === 'undefined') return;
        
        const myPos = new google.maps.LatLng(window.currentPosition.lat, window.currentPosition.lng);
        
        for (const [uid, member] of Object.entries(this.members)) {
            if (uid === window.session.uid) continue;
            
            const memberPos = new google.maps.LatLng(member.lat, member.lng);
            const dist = google.maps.geometry.spherical.computeDistanceBetween(myPos, memberPos);
            
            if (dist > this.maxDistanceWarning) {
                // Throttle warning (only once every 2 mins max per member)
                if (!member.lastWarned || (Date.now() - member.lastWarned > 120000)) {
                    member.lastWarned = Date.now();
                    if (typeof speak === 'function') {
                        speak(`Attention, ${member.name} est décroché à plus de 500 mètres derrière vous.`);
                    }
                    console.warn(`[CortegeSystem] ${member.name} is too far! (${Math.round(dist)}m)`);
                }
            }
        }
    },
    
    showModal: function() {
        const code = prompt("CORTÈGE : Entrez le code secret à 4 chiffres d'un ami pour le rejoindre, ou laissez le champ vide et cliquez sur OK pour CRÉER votre propre cortège :");
        if (code === null) return;
        
        if (code.trim() !== "") {
            this.joinSession(code.trim());
        } else {
            this.createSession();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { window.CortegeSystem.init(); }, 4000);
});
