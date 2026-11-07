import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { coarsePosition, recentCutoff, MAX_SHARED_POSITIONS } from './location-privacy.js';

/**
 * DATABASE MANAGER - mon50ccetmoi
 * Gestion de la synchronisation en temps réel via Firebase Firestore.
 */

// Alias local pour rétrocompatibilité (déjà importé depuis config.js)

function initDatabase() {
  try {
    // Initialisation Firebase (si pas déjà fait par auth.js)
    // Centralisé dans config.js
    // db est importé. Firebase 10 gère l'instance.

    // Connexion aux émulateurs en environnement local pour éviter de toucher à la production
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      try {
        db.useEmulator('localhost', 8080);
        if (typeof firebase.auth === 'function') {
          firebase.auth().useEmulator('http://localhost:9099');
        }
        console.log("[FIREBASE] Connecté aux émulateurs locaux (Firestore/Auth).");
      } catch (e) {
        console.warn("[FIREBASE] Émulateur déjà initialisé ou non disponible.", e);
      }
    }

    // Démarrer l'écoute temps réel des dangers
    syncHazards();
    // Démarrer l'écoute des autres pilotes
    syncCommunityPositions();
  } catch (e) {
    console.warn("Database init fail :", e);
  }
}



// --- SYNCHRONISATION DES DANGERS (COMMUNAUTÉ) ---

function syncHazards() {
  if (!db) return;

  // OWASP A11 & Anti-DoS: Limiter strictement aux dangers récents (4h) et max 50 documents
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

  const processSnapshot = (snapshot) => {
    const hazards = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.payload) {
        // Ignore legacy encrypted messages
        console.log("Ignored legacy encrypted hazard");
      } else {
        hazards.push(data);
      }
    });

    secureSetItem("hazards", JSON.stringify(hazards));
    if (typeof loadHazards === "function") loadHazards();
  };

  db.collection("hazards")
    .where("timestamp", ">=", fourHoursAgo)
    .limit(50)
    .onSnapshot(processSnapshot, (error) => {
      // Fallback gracieux si l'index composite n'est pas encore disponible
      if (error && error.code === 'failed-precondition') {
        db.collection("hazards").limit(50).onSnapshot(processSnapshot);
      }
    });
}

window.publishHazardCloud = async function (hazard) {
  if (!db) return false;

  if (
    window.GuardianBot &&
    !window.GuardianBot.analyzeContent("Signalement", hazard, hazard.author)
  ) {
    return false;
  }

  try {
    // On n'utilise plus cloudEncrypt pour les données publiques communautaires
    // car le E2EE partagé n'a aucun sens. Sécurisé via Firestore Rules.
    const uid = window.session && window.session.uid;
    const ref = await db.collection("hazards").add({
      ...hazard,
      geohash: hazard.geohash,
      ...(uid ? { authorUid: uid } : {}),
      author: hazard.author, // Gardé en clair pour la modération par l'Oracle
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    // 25 points, accordés par le serveur après vérification que ce danger existe bien
    if (uid && window.BVCManager) {
      window.BVCManager.add(25, "RADAR_HAZARD_REPORTED", { hazardId: ref.id });
    }
    return true;
  } catch (e) {
    console.error("Cloud publish fail:", e);
    return false;
  }
};

// --- SYNCHRONISATION UTILISATEURS ---

// --- PARTAGE DE POSITION (COMMUNAUTÉ LIVE) ---

window.publishUserLocation = async function (lat, lng, status = "Riding") {
  if (!db || !window.session) return;
  // Position arrondie à ~100 m : elle est visible par les autres membres (location-privacy.js)
  const shared = coarsePosition(lat, lng);
  if (!shared) return;
  try {
    const payload = {
      lat: shared.lat,
      lng: shared.lng,
      status,
      brand: window.session.brand || "Scooter",
    };
    // On n'utilise plus cloudEncrypt pour les positions publiques communautaires
    await db.collection("presence").doc(window.session.username).set({
      ...payload,
      username: window.session.username,
      lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn("Presence sync fail");
  }
};

function syncCommunityPositions() {
  if (!db) return;

  // Only listen to presence if user is authenticated (firestore.rules requires isSignedIn)
  if (typeof firebase !== "undefined" && firebase.auth()) {
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        // Membres actifs récemment, en nombre limité (avant : toute la collection, en continu)
        db.collection("presence")
          .where("lastUpdate", ">=", recentCutoff())
          .limit(MAX_SHARED_POSITIONS)
          .onSnapshot(
          (snapshot) => {
            const members = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              if (data.username !== window.session?.username) {
                if (data.payload) {
                  console.log("Ignored legacy encrypted presence");
                } else {
                  members.push(data); // Legacy
                }
              }
            });

            window.communityMembers = members;
            if (typeof renderCommunityMarkers === "function")
              renderCommunityMarkers();
          },
          (error) => {
            console.warn(
              "Presence sync error (expected if not logged in):",
              error,
            );
          },
        );
      }
    });
  }
}

// --- SOCIAL TICKER SYNC ---

function syncSocialTicker() {
  if (!db) return;
  db.collection("moods")
    .orderBy("timestamp", "desc")
    .limit(5)
    .onSnapshot((snapshot) => {
      const latest = [];
      snapshot.forEach((doc) => latest.push(doc.data()));
      if (latest.length > 0) {
        const m = latest[0];
        const text = `${escapeHTML(m.username)} : ${escapeHTML(m.text || m.label || "Bonne route !")}`;
        const ticker = document.getElementById("ticker-text");
        if (ticker) ticker.textContent = text;
      }
    });
}

window.publishMoodCloud = async function (mood) {
  if (!db || !window.session) return;

  // BOT MODERATION
  if (
    window.GuardianBot &&
    !window.GuardianBot.analyzeContent("Humeur", mood, window.session.username)
  ) {
    return;
  }

  try {
    await db.collection("moods").add({
      ...mood,
      username: window.session.username,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error("Mood sync fail");
  }
};

// --- SIGNALEMENT DES STATIONS (prix non conformes) ---
// Corrigé le 7/11/2026 : rien n'est transmis automatiquement à la DGCCRF. Après 10 signalements,
// un dossier « à vérifier » est préparé pour l'administrateur, qui peut le déposer lui-même
// sur SignalConso (signal.conso.gouv.fr). Avant, l'app annonçait une plainte « transmise ».

window.reportStationAbuse = async function (
  stationId,
  stationInfo,
  photoData = null,
) {
  if (!db || !window.session) {
    alert("Vous devez être membre certifié pour signaler un abus.");
    return;
  }

  if (!photoData) {
    alert("Une preuve photo est obligatoire pour valider le signalement.");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
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

    await docRef.set(
      {
        stationId,
        stationInfo,
        count: newCount,
        reporters: reporters,
        photos: photos,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (newCount >= 10) {
      await triggerDGCCRFReport(stationId, stationInfo, photos);
    }

    alert(
      `Signalement avec preuve photo enregistré (${newCount}/10). Merci de votre vigilance.`,
    );
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
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // 2. Génération du Dossier Bot Anti-Fraude (Format SignalConso)
  const complaintDossier = {
    dossierId: `FRAUD-FR-${id}-${Date.now()}`,
    target: info,
    source: "mon50ccetmoi-bot-v20",
    platform: "à déposer manuellement sur SignalConso",
    evidenceCount: photos.length,
    hasPhotos: true,
    status: "A_VERIFIER",
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    metadata: {
      appVersion: CONFIG.VERSION,
      isAutomated: true,
    },
  };

  // Stocker le dossier officiel avec les liens vers les preuves
  await db
    .collection("complaints_official")
    .doc(complaintDossier.dossierId)
    .set({
      ...complaintDossier,
      evidence_samples: photos.slice(0, 3), // On garde les 3 premières preuves pour le dossier résumé
    });

  // 3. Logique Bot (Simulation Webhook ou Email Administratif)

  // Notification admin
  await db.collection("admin_alerts").add({
    type: "STATION_A_VERIFIER",
    station: info,
    dossierLink: complaintDossier.dossierId,
    hasVisualProof: true,
    message: "10 signalements avec photos : dossier à vérifier, puis à déposer sur SignalConso si fondé.",
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Optionnel: Si un Webhook Discord est configuré
  if (CONFIG.WEBHOOK_ADMIN) {
    try {
      fetch(CONFIG.WEBHOOK_ADMIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `🚨 **ALERTE FRAUDE BOT** 🚨\nLa station **${info}** a reçu 10 signalements. Un dossier est prêt à être vérifié (rien n'a été transmis).`,
        }),
      });
    } catch (e) {}
  }
}

window.getBlacklist = async function () {
  if (!db) return [];
  try {
    const snap = await db.collection("blacklist_stations").get();
    return snap.docs.map((doc) => doc.id);
  } catch (e) {
    return [];
  }
};

// --- SYSTÈME ÉVALUATION GARAGES (COMMUNAUTÉ) ---

// La moyenne est calculée par le serveur (fonction rateGarage) : un vote par
// membre et par garage, revoter remplace l'ancienne note.
window.evaluateGarage = async function (placeId, name, score) {
  if (!window.session || typeof firebase === "undefined" || !firebase.app) {
    alert("Vous devez être membre pour évaluer un garage.");
    return;
  }

  try {
    const rateGarage = firebase.app().functions("europe-west1").httpsCallable("rateGarage");
    const { data } = await rateGarage({ placeId, name, score: Number(score) });
    alert(
      data.updated
        ? `Votre note a été remplacée par ${data.yourScore}/5. Moyenne : ${data.avgRating}/5 (${data.count} avis).`
        : `Merci ! Votre évaluation a été prise en compte (${data.count}/1000 pour le Badge Pro).`,
    );
  } catch (e) {
    console.error("Eval fail", e);
    alert(e?.message || "Votre note n'a pas pu être enregistrée. Réessayez plus tard.");
  }
};

window.getGarageInternalInfo = async function (placeId) {
  if (!db) return null;
  try {
    const doc = await db.collection("garage_evaluations").doc(placeId).get();
    const data = doc.exists ? doc.data() : null;
    // Seules les moyennes calculées par le serveur sont fiables (les anciennes
    // étaient écrites par le navigateur et pouvaient être inventées).
    if (!data || data.v !== 2) return null;
    const count = Number(data.count);
    const avgRating = Number(data.avgRating);
    if (!Number.isFinite(count) || count < 1 || !Number.isFinite(avgRating)) return null;
    return { count, avgRating: avgRating.toFixed(1) };
  } catch (e) {
    return null;
  }
};

// --- ROADBOOKS CLOUD SHARING ---

window.publishRoadbookCloud = async function (roadbook) {
  if (!db || !window.session) return false;

  // BOT MODERATION
  if (
    window.GuardianBot &&
    !window.GuardianBot.analyzeContent(
      "Roadbook",
      roadbook,
      window.session.username,
    )
  ) {
    return false;
  }

  try {
    await db.collection("community_roadbooks").add({
      ...roadbook,
      author: window.session.username,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      reports: 0,
    });
    return true;
  } catch (e) {
    console.error("Roadbook cloud fail:", e);
    return false;
  }
};

// --- SYSTEME DE BAN (SANCTIONS ÉCHELONNÉES) ---
async function applyAbuseSanction(userId) {
  if (!userId || userId === "Anonyme") return;
  // On cherche par UID si possible, sinon par pseudo (legacy)
  let userRef = db.collection("users").doc(userId);
  let snap = await userRef.get();

  if (!snap.exists) {
    // Fallback: Recherche par pseudo
    const q = await db
      .collection("users")
      .where("username", "==", userId)
      .limit(1)
      .get();
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
    isPermanentlyBanned: isDefinitive,
  });

  // BLOCAGE IP GLOBAL (Si ban définitif)
  if (isDefinitive) {
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipRes.json();
      const currentIp = ipData.ip;
      await db.collection("banned_ips").doc(currentIp).set({
        userId,
        reason: "Bannissement définitif - Abus cumulés",
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {}
  }
  if (window.session && window.session.username === userId) {
    window.session.bannedUntil = banUntil;
    secureSetItem("session", JSON.stringify(window.session));
  }
  await db.collection("mod_logs").add({
    userId,
    type: "BAN_TEMPORAIRE",
    level: abuseLevel,
    until: new Date(banUntil).toLocaleString(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
window.isUserBanned = function () {
  if (!window.session) return false;
  const bannedUntil = window.session.bannedUntil || 0;
  return Date.now() < bannedUntil;
};

// --- Action Registry (ESM) ---
registerAction('initDatabase', initDatabase);

registerAction('syncHazards', syncHazards);
registerAction('syncCommunityPositions', syncCommunityPositions);
registerAction('syncSocialTicker', syncSocialTicker);
registerAction('triggerDGCCRFReport', triggerDGCCRFReport);
registerAction('applyAbuseSanction', applyAbuseSanction);
