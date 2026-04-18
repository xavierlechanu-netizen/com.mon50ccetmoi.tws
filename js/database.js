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

window.syncUserToCloud = async function(user) {
    if (!db || !user || user.isGuest) return;
    try {
        await db.collection("users").doc(user.username).set({
            ...user,
            lastSeen: Date.now()
        }, { merge: true });
    } catch (e) {
        console.error("User sync fail:", e);
    }
};
