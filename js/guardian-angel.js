/**
 * GUARDIAN ANGEL SYSTEM v2.0
 * The ultimate safety shield for mon50ccetmoi riders.
 */

window.isGuardianActive = false;
let guardianSessionId = null;
let safetyCheckTimer = null;
let lastUpdatePos = null;

window.toggleGuardianAngel = async function() {
    if (window.session && window.session.isGuest) {
        alert("L'Ange Gardien est réservé aux membres inscrits. Sécurisez vos rides maintenant ! 🛡️");
        return;
    }

    const btn = document.getElementById('btn-guardian-toggle');
    const halo = document.getElementById('guardian-halo');
    const statusText = document.getElementById('guardian-status');

    if (!window.isGuardianActive) {
        // ACTIVATION
        window.isGuardianActive = true;
        btn.classList.add('active');
        halo.classList.remove('hidden');
        if(statusText) statusText.textContent = "ON";
        
        await startGuardianSession();
        speak("Ange Gardien activé. Vous êtes sous protection.");
        vibrate([100, 50, 100]);
    } else {
        // DESACTIVATION
        window.isGuardianActive = false;
        btn.classList.remove('active');
        halo.classList.add('hidden');
        if(statusText) statusText.textContent = "OFF";
        
        stopGuardianSession();
        speak("Ange Gardien désactivé. Roulez prudemment.");
    }
};

async function startGuardianSession() {
    if (typeof db === "undefined" || !window.session) return;
    
    // Hardening: Fallback position if GPS not ready
    const pos = currentPosition || { lat: 48.8566, lng: 2.3522 };
    
    guardianSessionId = "guardian_" + window.session.uid + "_" + Date.now();
    
    const sessionData = {
        userId: window.session.uid,
        username: window.session.username || "Pilote Anonyme",
        startTime: firebase.firestore.FieldValue.serverTimestamp(),
        status: "SAFE",
        lastPos: pos,
        vMax: 0
    };

    try {
        await db.collection("guardian_sessions").doc(guardianSessionId).set(sessionData);
        console.log("Guardian Session Started:", guardianSessionId);
        
        // Share option
        const shareLink = `https://mon50ccetmoi.app/track?s=${guardianSessionId}`;
        if (navigator.share) {
            try {
                const confirmShare = confirm("Ange Gardien actif. Voulez-vous partager votre lien de suivi en temps réel avec un proche ?");
                if (confirmShare) {
                    await navigator.share({
                        title: 'Suis mon ride en direct !',
                        text: `Je roule avec mon50ccetmoi. Si j'ai un problème, tu seras alerté ici :`,
                        url: shareLink
                    });
                }
            } catch(shareErr) { console.warn("Share cancelled or failed"); }
        }
        
        startSafetyMonitoring();
    } catch (e) { 
        console.error("Guardian Start Fail:", e);
        alert("Erreur de synchronisation sécurité. Surveillance locale uniquement.");
        startSafetyMonitoring(); // On lance quand même le monitoring local
    }
}


function startSafetyMonitoring() {
    safetyCheckTimer = setInterval(async () => {
        if (!window.isGuardianActive || !currentPosition) return;
        
        const statusData = {
            lastPos: currentPosition,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
            vMax: window.session.vMax || 0,
            isOnline: navigator.onLine
        };

        // 1. GESTION OFFLINE / SYNC
        if (navigator.onLine) {
            try {
                await db.collection("guardian_sessions").doc(guardianSessionId).update(statusData);
                // Si on avait des alertes en attente localement, on les vide
                syncOfflineAlerts();
            } catch (e) { saveStatusLocally(statusData); }
        } else {
            console.warn("Ange Gardien : Mode Hors-Ligne actif. Surveillance locale uniquement.");
            saveStatusLocally(statusData);
        }

        // 2. Inactivity Check (Same logic, works offline)
        if (!window.isRiding) {
            if (!window.lastStopCheck) window.lastStopCheck = Date.now();
            const stopDuration = (Date.now() - window.lastStopCheck) / 1000;
            
            if (stopDuration > 180) { // 3 minutes
                triggerSafetyPrompt();
                window.lastStopCheck = Date.now();
            }
        } else {
            window.lastStopCheck = null;
        }
    }, 15000); 
}

function saveStatusLocally(data) {
    localStorage.setItem('guardian_offline_buffer', JSON.stringify(data));
}

async function syncOfflineAlerts() {
    const offlineAlert = localStorage.getItem('guardian_emergency_pending');
    if (offlineAlert && navigator.onLine) {
        const alertData = JSON.parse(offlineAlert);
        await triggerEmergencySOS(alertData.reason + " (Différé - Zone Blanche)");
        localStorage.removeItem('guardian_emergency_pending');
    }
}


function triggerSafetyPrompt() {
    vibrate([500, 200, 500]);
    speak("Alerte Ange Gardien. Vous êtes à l'arrêt depuis longtemps. Tout va bien ?");
    
    const prompt = document.createElement('div');
    prompt.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:20000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; padding:30px; text-align:center;";
    prompt.innerHTML = `
        <i class="fa-solid fa-shield-halved" style="font-size:4rem; color:#00d2ff; margin-bottom:20px;"></i>
        <h2>Vérification de Sécurité</h2>
        <p>L'Ange Gardien détecte un arrêt prolongé.</p>
        <button id="btn-safety-ok" style="width:100%; padding:20px; background:#00d2ff; color:black; border:none; border-radius:15px; font-weight:bold; font-size:1.2rem; margin-top:20px;">JE VAIS BIEN ✅</button>
        <button id="btn-safety-sos" style="width:100%; padding:15px; background:#ff4444; color:white; border:none; border-radius:15px; font-weight:bold; margin-top:15px;">BESOIN D'AIDE 🆘</button>
    `;
    document.body.appendChild(prompt);

    const timer = setTimeout(() => {
        triggerEmergencySOS("Inactivité prolongée détectée.");
        prompt.remove();
    }, 30000); // 30s to answer

    document.getElementById('btn-safety-ok').onclick = () => {
        clearTimeout(timer);
        prompt.remove();
        speak("Ravi de l'entendre. Bonne route.");
    };

    document.getElementById('btn-safety-sos').onclick = () => {
        clearTimeout(timer);
        triggerEmergencySOS("Demande d'aide manuelle via Ange Gardien.");
        prompt.remove();
    };
}

async function triggerEmergencySOS(reason) {
    if (!guardianSessionId) return;
    
    speak("ALERTE SOS LANÇÉE. Transfert de votre dossier médical aux secours.");
    if (typeof Hardware !== "undefined") {
        Hardware.vibratePattern('sos');
        Hardware.toggleFlashlightSOS(true);
    }

    // 0. Fetch Secure Medical Data (Quantum Phase)
    const medical = window.Wallet ? window.Wallet.getMedicalData() : null;
    const structural = window.Blackbox ? window.Blackbox.getStructuralScore() : "UNKNOWN";

    // GESTION OFFLINE
    if (!navigator.onLine) {
        localStorage.setItem('guardian_emergency_pending', JSON.stringify({ 
            reason: reason, 
            medical: medical,
            integrity: structural,
            time: Date.now() 
        }));
        console.warn("SOS mis en attente (Hors-ligne)");
        return;
    }

    // 1. Update Session with Health Info
    db.collection("guardian_sessions").doc(guardianSessionId).update({
        status: "DANGER",
        alertReason: reason,
        medicalData: medical,
        deviceIntegrity: structural,
        alertTime: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 2. Publish Community Alert
    db.collection("emergency_alerts").add({
        userId: window.session.uid,
        username: window.session.username,
        pos: currentPosition,
        reason: reason,
        medicalHint: medical ? "PASSEPORT_MEDICAL_ATTACHÉ" : "AUCUN_PASSEPORT",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function stopGuardianSession() {
    if (safetyCheckTimer) clearInterval(safetyCheckTimer);
    if (guardianSessionId) {
        db.collection("guardian_sessions").doc(guardianSessionId).update({
            status: "FINISHED",
            endTime: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    guardianSessionId = null;
}
