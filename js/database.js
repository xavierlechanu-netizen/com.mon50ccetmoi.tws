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
