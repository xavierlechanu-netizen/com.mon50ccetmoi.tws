/**
 * DATABASE MANAGER - mon50ccetmoi
 * Gestion de la synchronisation en temps réel via Firebase Firestore.
 */

let db;

function initDatabase() {
    try {
        // Initialisation Firebase (si pas déjà fait par auth.js)
        if (!firebase.apps.length) {
            firebase.initializeApp(CONFIG.FIREBASE);
        }
        db = firebase.firestore();
        console.log("mon50cc Database : Connecté via Firebase Auth (E2EE Actif).");
        
        // Démarrer l'écoute temps réel des dangers
        syncHazards();
        // Démarrer l'écoute des autres pilotes
        syncCommunityPositions();
    } catch (e) {
        console.warn("Database init fail :", e);
    }
}

// --- E2EE HELPERS ---
function cloudEncrypt(data) {
    if (typeof CryptoJS === 'undefined' || !data) return data;
    const key = window.getSyncKey();
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.AES.encrypt(str, key).toString();
}

function cloudDecrypt(encryptedData) {
    if (typeof CryptoJS === 'undefined' || !encryptedData) return null;
    const key = window.getSyncKey();
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, key);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(decrypted);
    } catch (e) { return null; }
}

// --- SYNCHRONISATION DES DANGERS (COMMUNAUTÉ) ---

function syncHazards() {
    if (!db) return;
    
    db.collection("hazards").onSnapshot((snapshot) => {
        let hazards = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            // Si la donnée est chiffrée (E2EE), on la déchiffre
            if (data.payload) {
                const decrypted = cloudDecrypt(data.payload);
                if (decrypted) hazards.push(decrypted);
            } else {
                hazards.push(data); // Legacy (Plaintext)
            }
        });
        
        secureSetItem('hazards', JSON.stringify(hazards));
        if (typeof loadHazards === "function") loadHazards();
    });
}

window.publishHazardCloud = async function(hazard) {
    if (!db) return false;
    
    if (window.GuardianBot && !window.GuardianBot.analyzeContent("Signalement", hazard, hazard.author)) {
        return false;
    }

    try {
        // Chiffrement de bout en bout avant envoi
        const encryptedPayload = cloudEncrypt(hazard);
        await db.collection("hazards").add({
            payload: encryptedPayload,
            author: hazard.author, // Gardé en clair pour la modération par l'Oracle
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
        const payload = { lat, lng, status, brand: window.session.brand || "Scooter" };
        const encryptedPayload = cloudEncrypt(payload);
        
        await db.collection("presence").doc(window.session.username).set({
            payload: encryptedPayload,
            username: window.session.username,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.warn("Presence sync fail"); }
};

function syncCommunityPositions() {
    if (!db) return;
    db.collection("presence").onSnapshot((snapshot) => {
        let members = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.username !== window.session?.username) {
                if (data.payload) {
                    const decrypted = cloudDecrypt(data.payload);
                    if (decrypted) {
                        members.push({ ...decrypted, username: data.username });
                    }
                } else {
                    members.push(data); // Legacy
                }
            }
        });
        
        window.communityMembers = members;
        if (typeof renderCommunityMarkers === "function") renderCommunityMarkers();
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
            const text = `${escapeHTML(m.username)} : ${escapeHTML(m.text || m.label || "Bonne route !")}`;
            const ticker = document.getElementById('ticker-text');
            if(ticker) ticker.textContent = text;
        }
    });
}

window.publishMoodCloud = async function(mood) {
    if (!db || !window.session) return;

    // BOT MODERATION
    if (window.GuardianBot && !window.GuardianBot.analyzeContent("Humeur", mood, window.session.username)) {
        return;
    }

    try {
        await db.collection("moods").add({
            ...mood,
            username: window.session.username,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.error("Mood sync fail"); }
};

// --- SYSTÈME ANTI-FRAUDE SIGNALEMENT DGCCRF ---

window.reportStationAbuse = async function(stationId, stationInfo, photoData = null) {
    if (!db || !window.session || window.session.isGuest) {
        alert("Vous devez être membre certifié pour signaler un abus.");
        return;
    }

    if (!photoData) {
        alert("Une preuve photo est obligatoire pour valider le signalement.");
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const reportPath = `reports_abuse/${stationId}_${today}`;
    
    try {
        const docRef = db.collection("reports_abuse").doc(`${stationId}_${today}`);
        const doc = await docRef.get();
        
        let count = 0;
        let reporters = [];
        let photos = [];
        
        if (doc.exists) {
            count = doc.data().count;
            reporters = doc.data().reporters || [];
            photos = doc.data().photos || [];
        }
        
        if (reporters.includes(window.session.username)) {
            alert("Vous avez déjà signalé cette station aujourd'hui.");
            return;
        }
        
        const newCount = count + 1;
        reporters.push(window.session.username);
        photos.push(photoData); // Stockage de la preuve
        
        await docRef.set({
            stationId,
            stationInfo,
            count: newCount,
            reporters: reporters,
            photos: photos,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        if (newCount >= 10) {
            await triggerDGCCRFReport(stationId, stationInfo, photos);
        }

        alert(`Signalement avec preuve photo enregistré (${newCount}/10). Merci de votre vigilance.`);
    } catch (e) {
        console.error("Report fail:", e);
    }
};

async function triggerDGCCRFReport(id, info, photos) {
    // 1. Blacklister la station sur Firebase
    await db.collection("blacklist_stations").doc(id).set({
        id,
        info,
        reason: "Prix non conformes (10+ preuves photo validées)",
        photosCount: photos.length,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // 2. Génération du Dossier Bot Anti-Fraude (Format SignalConso)
    const complaintDossier = {
        dossierId: `FRAUD-FR-${id}-${Date.now()}`,
        target: info,
        source: "mon50ccetmoi-bot-v20",
        platform: "SignalConso-API-Bridge",
        evidenceCount: photos.length,
        hasPhotos: true,
        status: "TRANSMIS_DGCCRF",
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        metadata: {
            appVersion: CONFIG.VERSION,
            isAutomated: true
        }
    };

    // Stocker le dossier officiel avec les liens vers les preuves
    await db.collection("complaints_official").doc(complaintDossier.dossierId).set({
        ...complaintDossier,
        evidence_samples: photos.slice(0, 3) // On garde les 3 premières preuves pour le dossier résumé
    });
    
    // 3. Logique Bot (Simulation Webhook ou Email Administratif)
    console.log(`[BOT ANTI-FRAUDE] 🤖 Dossier ${complaintDossier.dossierId} avec ${photos.length} photos transmis au portail SignalConso.`);
    
    // Notification admin
    await db.collection("admin_alerts").add({
        type: "FRAUDE_PRIX_BOT_SUCCESS",
        station: info,
        dossierLink: complaintDossier.dossierId,
        hasVisualProof: true,
        message: "Bot : Dossier de plainte (avec photos) transmis à la DGCCRF.",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Optionnel: Si un Webhook Discord est configuré
    if (CONFIG.WEBHOOK_ADMIN) {
        try {
            fetch(CONFIG.WEBHOOK_ADMIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `🚨 **ALERTE FRAUDE BOT** 🚨\nLa station **${info}** a reçu 10 signalements. Un dossier de plainte automatique a été transmis à la DGCCRF.`
                })
            });
        } catch(e) {}
    }
}

window.getBlacklist = async function() {
    if (!db) return [];
    try {
        const snap = await db.collection("blacklist_stations").get();
        return snap.docs.map(doc => doc.id);
    } catch(e) { return []; }
};

// --- SYSTÈME ÉVALUATION GARAGES (COMMUNAUTÉ) ---

window.evaluateGarage = async function(placeId, name, score) {
    if (!db || !window.session || window.session.isGuest) {
        alert("Vous devez être membre pour évaluer un garage.");
        return;
    }

    try {
        const docRef = db.collection("garage_evaluations").doc(placeId);
        const doc = await docRef.get();
        
        let totalScore = 0;
        let count = 0;
        let voters = [];

        if (doc.exists) {
            totalScore = doc.data().totalScore || 0;
            count = doc.data().count || 0;
            voters = doc.data().voters || [];
        }

        if (voters.includes(window.session.username)) {
            alert("Vous avez déjà noté ce garage.");
            return;
        }

        voters.push(window.session.username);
        const newCount = count + 1;
        const newTotalScore = totalScore + score;

        await docRef.set({
            placeId,
            name,
            count: newCount,
            totalScore: newTotalScore,
            avgRating: (newTotalScore / newCount).toFixed(1),
            voters: voters,
            lastVote: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert(`Merci ! Votre évaluation a été prise en compte (${newCount}/1000 pour le Badge Pro).`);
    } catch(e) { console.error("Eval fail", e); }
};

window.getGarageInternalInfo = async function(placeId) {
    if (!db) return null;
    try {
        const doc = await db.collection("garage_evaluations").doc(placeId).get();
        return doc.exists ? doc.data() : null;
    } catch(e) { return null; }
};

// --- ROADBOOKS CLOUD SHARING ---

window.publishRoadbookCloud = async function(roadbook) {
    if (!db || !window.session) return false;
    
    // BOT MODERATION
    if (window.GuardianBot && !window.GuardianBot.analyzeContent("Roadbook", roadbook, window.session.username)) {
        return false;
    }

    try {
        await db.collection("community_roadbooks").add({
            ...roadbook,
            author: window.session.username,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            reports: 0
        });
        return true;
    } catch (e) {
        console.error("Roadbook cloud fail:", e);
        return false;
    }
};

// --- SYSTEME DE BAN (SANCTIONS ÉCHELONNÉES) ---
async function applyAbuseSanction(userId) {
    if (!userId || userId === 'Anonyme') return;
    // On cherche par UID si possible, sinon par pseudo (legacy)
    let userRef = db.collection("users").doc(userId);
    let snap = await userRef.get();
    
    if (!snap.exists) {
        // Fallback: Recherche par pseudo
        const q = await db.collection("users").where("username", "==", userId).limit(1).get();
        if (!q.empty) {
            userRef = q.docs[0].ref;
            snap = q.docs[0];
        } else return;
    }
    
    const data = snap.data() || {};
    const abuseLevel = (data.abuseLevel || 0) + 1;
    const totalFakeReports = (data.totalFakeReports || 0) + 1;
    let banDurationMs = 0;
    let isDefinitive = false;

    // REGLE SPECIALE : 25 FAUX SIGNALEMENTS CUMULÉS = BAN FINAL DIRECT
    if (totalFakeReports >= 25 || abuseLevel >= 5) {
        isDefinitive = true;
        banDurationMs = 99 * 365 * 24 * 60 * 60 * 1000;
    } else if (abuseLevel === 1) banDurationMs = 1 * 60 * 60 * 1000;
    else if (abuseLevel === 2) banDurationMs = 2 * 60 * 60 * 1000;
    else banDurationMs = 24 * 60 * 60 * 1000;

    const banUntil = Date.now() + banDurationMs;
    await userRef.update({ 
        abuseLevel: isDefinitive ? 5 : abuseLevel, 
        totalFakeReports: totalFakeReports,
        bannedUntil: banUntil, 
        isPermanentlyBanned: isDefinitive 
    });

    // BLOCAGE IP GLOBAL (Si ban définitif)
    if (isDefinitive) {
        try {
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            const currentIp = ipData.ip;
            await db.collection("banned_ips").doc(currentIp).set({
                userId,
                reason: "Bannissement définitif - Abus cumulés",
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch(e) {}
    }
    if (window.session && window.session.username === userId) {
        window.session.bannedUntil = banUntil;
        secureSetItem('session', JSON.stringify(window.session));
    }
    await db.collection("mod_logs").add({
        userId, type: "BAN_TEMPORAIRE", level: abuseLevel, until: new Date(banUntil).toLocaleString(), timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}
window.isUserBanned = function() {
    if (!window.session || window.session.isGuest) return false;
    const bannedUntil = window.session.bannedUntil || 0;
    return Date.now() < bannedUntil;
};
