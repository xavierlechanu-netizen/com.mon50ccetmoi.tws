/**
 * DATABASE MANAGER - mon50ccetmoi
 * Gestion de la synchronisation en temps réel via Firebase Firestore.
 */

let db;

function initDatabase() {
    try {
        // Initialisation Firebase
        firebase.initializeApp(CONFIG.FIREBASE);
        db = firebase.firestore();
        console.log("mon50cc Database : Connexion Cloud établie.");
        
        // Démarrer l'écoute temps réel des dangers
        syncHazards();
        // Démarrer l'écoute des autres pilotes
        syncCommunityPositions();
        // Démarrer l'écoute des humeurs
        syncSocialTicker();
    } catch (e) {
        console.warn("Database init fail (Probablement clés non configurées) :", e);
    }
}

// --- SYNCHRONISATION DES DANGERS (COMMUNAUTÉ) ---

function syncHazards() {
    if (!db) return;
    
    // Écouter les changements sur la collection "hazards"
    db.collection("hazards").onSnapshot((snapshot) => {
        let hazards = [];
        snapshot.forEach((doc) => {
            hazards.push(doc.data());
        });
        
        // Sauvegarde locale pour le mode hors-ligne
        secureSetItem('hazards', JSON.stringify(hazards));
        
        // Rafraîchir les marqueurs sur la carte si l'app est lancée
        if (typeof loadHazards === "function") {
            loadHazards();
        }
    });
}

window.publishHazardCloud = async function(hazard) {
    if (!db) return false;
    try {
        await db.collection("hazards").add({
            ...hazard,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Cloud publish fail:", e);
        return false;
    }
};

// --- SYNCHRONISATION UTILISATEURS ---

// --- PARTAGE DE POSITION (COMMUNAUTÉ LIVE) ---

window.publishUserLocation = async function(lat, lng, status = "Riding") {
    if (!db || !window.session || window.session.isGuest) return;
    try {
        await db.collection("presence").doc(window.session.username).set({
            lat,
            lng,
            username: window.session.username,
            brand: window.session.brand || "Scooter",
            status: status,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.warn("Presence sync fail"); }
};

function syncCommunityPositions() {
    if (!db) return;
    // On écoute les positions actives depuis moins de 5 minutes
    db.collection("presence").onSnapshot((snapshot) => {
        let members = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            // Filtrer l'utilisateur actuel et les positions obsolètes
            if (data.username !== window.session?.username) {
                members.push(data);
            }
        });
        
        // Stockage tempo pour le rendu
        window.communityMembers = members;
        
        if (typeof renderCommunityMarkers === "function") {
            renderCommunityMarkers();
        }
    });
}

// --- SOCIAL TICKER SYNC ---

function syncSocialTicker() {
    if (!db) return;
    db.collection("moods").orderBy("timestamp", "desc").limit(5).onSnapshot((snapshot) => {
        let latest = [];
        snapshot.forEach(doc => latest.push(doc.data()));
        if(latest.length > 0) {
            const m = latest[0];
            const text = `${m.username} : ${m.text || m.label || "Bonne route !"}`;
            const ticker = document.getElementById('ticker-text');
            if(ticker) ticker.textContent = text;
        }
    });
}

window.publishMoodCloud = async function(mood) {
    if (!db || !window.session) return;
    try {
        await db.collection("moods").add({
            ...mood,
            username: window.session.username,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.error("Mood sync fail"); }
};

// --- SYSTÈME ANTI-FRAUDE SIGNALEMENT DGCCRF ---

window.reportStationAbuse = async function(stationId, stationInfo) {
    if (!db || !window.session || window.session.isGuest) {
        alert("Vous devez être membre certifié pour signaler un abus.");
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const reportPath = `reports_abuse/${stationId}_${today}`;
    
    try {
        const docRef = db.collection("reports_abuse").doc(`${stationId}_${today}`);
        const doc = await docRef.get();
        
        let count = 0;
        let reporters = [];
        
        if (doc.exists) {
            count = doc.data().count;
            reporters = doc.data().reporters || [];
        }
        
        // Un seul signalement par utilisateur par jour
        if (reporters.includes(window.session.username)) {
            alert("Vous avez déjà signalé cette station aujourd'hui.");
            return;
        }
        
        const newCount = count + 1;
        reporters.push(window.session.username);
        
        await docRef.set({
            stationId,
            stationInfo,
            count: newCount,
            reporters: reporters,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        if (newCount >= 10) {
            await triggerDGCCRFReport(stationId, stationInfo);
        }

        alert(`Signalement enregistré (${newCount}/10). Merci de votre vigilance.`);
    } catch (e) {
        console.error("Report fail:", e);
    }
};

async function triggerDGCCRFReport(id, info) {
    // 1. Blacklister la station sur Firebase
    await db.collection("blacklist_stations").doc(id).set({
        id,
        info,
        reason: "Prix non conformes (10+ signalements)",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // 2. Logique de transfert DGCCRF (Simulation API)
    console.warn("ALERTE DGCCRF : Station " + id + " transmise pour contrôle de fraude.");
    
    // Notification admin
    await db.collection("admin_alerts").add({
        type: "FRAUDE_PRIX",
        station: info,
        count: 10,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

window.getBlacklist = async function() {
    if (!db) return [];
    try {
        const snap = await db.collection("blacklist_stations").get();
        return snap.docs.map(doc => doc.id);
    } catch(e) { return []; }
};
