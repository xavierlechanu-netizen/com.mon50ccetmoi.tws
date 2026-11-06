import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

/**
 * GUARDIAN ANGEL SYSTEM v2.0
 * The ultimate safety shield for mon50ccetmoi riders.
 */

window.GuardianAngel = {
  isActive: false,
  sessionId: null,
  safetyCheckTimer: null,
  lastUpdatePos: null,
  lastOvertakeWarning: 0,

  init: function () {
    // 1. Crash Detection Listener
    window.addEventListener("devicemotion", (event) => {
      if (!this.isActive || this.crashCountdown) return;

      const acc = event.accelerationIncludingGravity;
      if (acc) {
        // Calculate total acceleration vector
        const gForce =
          Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z) / 9.81;

        // If G-Force > 5G (approx 50m/s^2), trigger Crash Detection
        if (gForce > 5.0) {
          this.detectCrash();
        }
      }
    });
  },

  toggle: async function () {
    if (!window.session) {
      alert("Veuillez vous connecter pour utiliser Guardian Angel.");
      return;
    }

    const btn = document.getElementById("btn-guardian-toggle");
    const halo = document.getElementById("guardian-halo");
    const statusText = document.getElementById("guardian-status");

    if (!this.isActive) {
      // ACTIVATION
      this.isActive = true;
      window.isGuardianActive = true; // Legacy support
      btn.classList.add("active");
      if (halo) halo.classList.remove("hidden");
      if (statusText) statusText.textContent = "ON";

      await this.startSession();
      speak("start_guardian"); // Utilise la clé du lexique
      vibrate([100, 50, 100]);
    } else {
      // DESACTIVATION
      this.isActive = false;
      window.isGuardianActive = false; // Legacy support
      btn.classList.remove("active");
      if (halo) halo.classList.add("hidden");
      if (statusText) statusText.textContent = "OFF";

      this.stopSession();
      speak("stop_guardian");
    }
  },

  startSession: async function () {
    if (typeof db === "undefined" || !window.session) return;

    const pos = currentPosition || { lat: 48.8566, lng: 2.3522 };
    this.sessionId = "guardian_" + window.session.uid + "_" + Date.now();

    const sessionData = {
      userId: window.session.uid,
      username: window.session.username || "Pilote Anonyme",
      startTime: firebase.firestore.FieldValue.serverTimestamp(),
      status: "SAFE",
      lastPos: pos,
      vMax: 0,
    };

    try {
      await db
        .collection("guardian_sessions")
        .doc(this.sessionId)
        .set(sessionData);

      if (navigator.share) {
        try {
          const confirmShare = confirm(
            "Ange Gardien actif. Voulez-vous partager votre lien de suivi en temps réel avec un proche ?",
          );
          if (confirmShare) {
            await navigator.share({
              title: "Suis mon ride en direct !",
              text: `Je roule avec mon50ccetmoi. Si j'ai un problème, tu seras alerté ici :`,
              url: `https://mon50ccetmoi.app/track?s=${this.sessionId}`,
            });
          }
        } catch (shareErr) {
          console.warn("Share cancelled");
        }
      }

      this.startMonitoring();
    } catch (e) {
      console.error("Guardian Start Fail:", e);
      this.startMonitoring();
    }
  },

  startMonitoring: function () {
    this.safetyCheckTimer = setInterval(async () => {
      if (!this.isActive || !currentPosition) return;

      const statusData = {
        lastPos: currentPosition,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
        vMax: window.session.vMax || 0,
        isOnline: navigator.onLine,
      };

      if (navigator.onLine) {
        try {
          await db
            .collection("guardian_sessions")
            .doc(this.sessionId)
            .update(statusData);
        } catch (e) {
          localStorage.setItem(
            "guardian_offline_buffer",
            JSON.stringify(statusData),
          );
        }
      } else {
        localStorage.setItem(
          "guardian_offline_buffer",
          JSON.stringify(statusData),
        );
      }

      // Inactivity Check
      if (!window.isRiding) {
        if (!this.lastStopCheck) this.lastStopCheck = Date.now();
        const stopDuration = (Date.now() - this.lastStopCheck) / 1000;
        if (stopDuration > 180) {
          this.triggerSafetyPrompt();
          this.lastStopCheck = Date.now();
        }
      } else {
        this.lastStopCheck = null;
      }
    }, 15000);
  },

  /**
   * NEW: Check for dangerous overtaking patterns
   * Triggered by rapid lean angle changes or high lean at speed.
   */
  checkOvertakingSafety: function (speed, leanAngle) {
    if (!this.isActive || speed < 35) return;

    // Pattern: High lean (>30°) while at relatively high speed for a 50cc
    if (Math.abs(leanAngle) > 30) {
      const now = Date.now();
      if (now - this.lastOvertakeWarning > 12000) {
        // Throttle warnings (12s)
        speak("danger_overtake");
        vibrate([200, 100, 200]);
        if (window.NeuralHUD)
          window.NeuralHUD.logToConsole("SAFETY_ALERT: DANGEROUS_OVERTAKE");
        this.lastOvertakeWarning = now;
      }
    }
  },

  triggerSafetyPrompt: function () {
    vibrate([500, 200, 500]);
    speak(
      "Alerte Ange Gardien. Vous êtes à l'arrêt depuis longtemps. Tout va bien ?",
    );

    const prompt = document.createElement("div");
    prompt.className = "safety-prompt-overlay";
    prompt.style =
      "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:20000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; padding:30px; text-align:center;";
    // eslint-disable-next-line no-restricted-syntax
prompt.innerHTML = `
            <i class="fa-solid fa-shield-halved" style="font-size:4rem; color:#00d2ff; margin-bottom:20px;"></i>
            <h2>Vérification de Sécurité</h2>
            <p>L'Ange Gardien détecte un arrêt prolongé.</p>
            <button id="btn-safety-ok" style="width:100%; padding:20px; background:#00d2ff; color:black; border:none; border-radius:15px; font-weight:bold; font-size:1.2rem; margin-top:20px;">JE VAIS BIEN ✅</button>
            <button id="btn-safety-sos" style="width:100%; padding:15px; background:#ff4444; color:white; border:none; border-radius:15px; font-weight:bold; margin-top:15px;">BESOIN D'AIDE 🆘</button>
        `;
    document.body.appendChild(prompt);

    const timer = setTimeout(() => {
      this.triggerSOS("Inactivité prolongée détectée.");
      prompt.remove();
    }, 30000);

    document.getElementById("btn-safety-ok").onclick = () => {
      clearTimeout(timer);
      prompt.remove();
      speak("Ravi de l'entendre. Bonne route.");
    };

    document.getElementById("btn-safety-sos").onclick = () => {
      clearTimeout(timer);
      this.triggerSOS("Demande d'aide manuelle.");
      prompt.remove();
    };
  },

  /**
   * NEW: CRASH DETECTION LOGIC
   */
  detectCrash: function () {
    if (this.crashCountdown) return;

    console.warn("CRASH DÉTECTÉ (>5G) !");
    vibrate([1000, 500, 1000, 500, 1000]);
    speak(
      "Alerte de collision majeure détectée. Appel des secours dans 15 secondes.",
    );

    const prompt = document.createElement("div");
    prompt.className = "crash-prompt-overlay";
    prompt.style =
      "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255, 0, 0, 0.95); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; padding:30px; text-align:center; animation: pulseRed 1s infinite;";
    // eslint-disable-next-line no-restricted-syntax
prompt.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="font-size:5rem; color:#fff; margin-bottom:20px;"></i>
            <h1 style="font-size:3rem; margin:0;">CRASH DÉTECTÉ</h1>
            <p style="font-size:1.2rem; font-weight:bold;">Envoi des secours dans <span id="crash-timer" style="font-size:2rem;">15</span>s</p>
            <button id="btn-crash-cancel" style="width:100%; padding:20px; background:#fff; color:red; border:none; border-radius:15px; font-weight:900; font-size:1.5rem; margin-top:40px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);">JE VAIS BIEN (ANNULER)</button>
        `;
    document.body.appendChild(prompt);

    let timeLeft = 15;
    this.crashCountdown = setInterval(() => {
      timeLeft--;
      const timerEl = document.getElementById("crash-timer");
      if (timerEl) timerEl.textContent = timeLeft;

      if (timeLeft <= 0) {
        clearInterval(this.crashCountdown);
        this.crashCountdown = null;
        prompt.remove();
        this.triggerSOS("Choc violent (>5G). Aucune réponse du pilote.");
      }
    }, 1000);

    document.getElementById("btn-crash-cancel").onclick = () => {
      clearInterval(this.crashCountdown);
      this.crashCountdown = null;
      prompt.remove();
      speak("Alerte de collision annulée. Restez prudent.");
    };
  },

  triggerSOS: async function (reason) {
    if (!this.sessionId || typeof db === "undefined" || !window.session) return;

    speak("ALERTE SOS LANÇÉE. Transfert des données aux secours.");
    if (typeof Hardware !== "undefined" && Hardware.vibratePattern) {
      Hardware.vibratePattern("sos");
    }

    const structural = window.Blackbox
      ? window.Blackbox.getStructuralScore()
      : "UNKNOWN";

    const sosData = {
        userId: window.session.uid,
        username: window.session.username,
        pos: currentPosition || { lat: "unknown", lng: "unknown" },
        reason: reason,
        deviceIntegrity: structural,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (navigator.onLine) {
      // Mettre à jour la session Guardian
      db.collection("guardian_sessions").doc(this.sessionId).update({
        status: "DANGER",
        alertReason: reason,
        deviceIntegrity: structural,
        alertTime: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // Extraction et Upload Exceptionnel de la Boîte Noire (URGENCE ABSOLUE)
      let bbReportId = null;
      if (window.Blackbox) {
          bbReportId = await window.Blackbox.saveToCloud("URGENCE_ABSOLUE_SOS");
      }

      // Appeler le serveur via Cloud Function (Passerelle SMS)
      try {
        const sendEmergencySOS = firebase.functions("europe-west1").httpsCallable("sendEmergencySOS");
        
        // On récupère les contacts de l'utilisateur
        const userDoc = await db.collection("users").doc(window.session.uid).get();
        const emergencyContacts = userDoc.exists ? userDoc.data().emergencyContacts || [] : [];

        await sendEmergencySOS({
            location: `https://www.openstreetmap.org/?mlat=${sosData.pos.lat}&mlon=${sosData.pos.lng}#map=17/${sosData.pos.lat}/${sosData.pos.lng}`,
            contacts: emergencyContacts,
            message: `URGENCE MON50CC: Crash détecté (${reason}). Pilote: ${window.session.username}.`,
            blackboxReportId: bbReportId
        });
        
        console.log("SOS envoyé via le Cloud (Passerelle SMS) avec succès !");
      } catch (err) {
        console.error("Échec de l'envoi SOS via le Cloud:", err);
      }
    } else {
        // Mode hors-ligne : On garde le fallback SMS si réseau 2G uniquement disponible
        const smsBody = encodeURIComponent(
          `URGENCE MON50CC ! ${reason} Position GPS: https://www.openstreetmap.org/?mlat=${sosData.pos.lat}&mlon=${sosData.pos.lng}#map=17/${sosData.pos.lat}/${sosData.pos.lng}`
        );
        window.location.href = `sms:?body=${smsBody}`;
    }
  },

  manageEmergencyContacts: async function () {
    if (!window.session || !window.session.uid) {
        return alert("Vous devez être connecté pour gérer vos contacts d'urgence.");
    }

    const userDoc = await db.collection("users").doc(window.session.uid).get();
    const contacts = userDoc.exists ? (userDoc.data().emergencyContacts || []) : [];

    const prompt = document.createElement("div");
    prompt.className = "emergency-contacts-overlay";
    prompt.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:20000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; padding:30px; text-align:center;";
    
    const updateUI = () => {
        let contactsHtml = contacts.map((c, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#222; padding:10px; margin-bottom:10px; border-radius:8px;">
                <div style="text-align:left;">
                    <strong style="color:#00d2ff;">${c.name}</strong><br>
                    <span style="color:#aaa;">${c.phone}</span>
                </div>
                <button data-action="window.GuardianAngel.removeContact(${i})" style="background:#ff4444; border:none; border-radius:5px; color:white; padding:5px 10px;">Supprimer</button>
            </div>
        `).join("");

        if (contacts.length === 0) contactsHtml = "<p style='color:#777;'>Aucun contact défini.</p>";

        // eslint-disable-next-line no-restricted-syntax
prompt.innerHTML = `
            <i class="fa-solid fa-address-book" style="font-size:3rem; color:#00d2ff; margin-bottom:15px;"></i>
            <h2>Vos Anges Gardiens</h2>
            <p style="margin-bottom:20px; font-size:0.9rem; color:#ccc;">Ces contacts recevront un SMS de détresse automatique avec votre localisation si un crash est détecté.</p>
            
            <div id="contacts-list" style="width:100%; max-width:400px; margin-bottom:20px;">
                ${contactsHtml}
            </div>

            ${contacts.length < 3 ? `
                <div style="width:100%; max-width:400px; background:#111; padding:15px; border-radius:8px; margin-bottom:20px;">
                    <input type="text" id="new-contact-name" placeholder="Nom du contact" style="width:100%; padding:10px; margin-bottom:10px; background:#333; color:white; border:none; border-radius:5px;">
                    <input type="tel" id="new-contact-phone" placeholder="Numéro de téléphone" style="width:100%; padding:10px; margin-bottom:10px; background:#333; color:white; border:none; border-radius:5px;">
                    <button id="btn-add-contact" style="width:100%; padding:10px; background:#00d2ff; color:black; border:none; border-radius:5px; font-weight:bold;">+ Ajouter</button>
                </div>
            ` : "<p style='color:#ffaa00; margin-bottom:20px;'>Maximum 3 contacts atteints.</p>"}

            <button id="btn-close-contacts" style="width:100%; max-width:400px; padding:15px; background:#333; color:white; border:none; border-radius:15px; font-weight:bold;">Fermer</button>
        `;

        const btnAdd = prompt.querySelector("#btn-add-contact");
        if (btnAdd) {
            btnAdd.onclick = async () => {
                const n = document.getElementById("new-contact-name").value.trim();
                const p = document.getElementById("new-contact-phone").value.trim();
                if (!n || !p) return alert("Veuillez remplir le nom et le numéro.");
                contacts.push({ name: n, phone: p });
                await db.collection("users").doc(window.session.uid).update({ emergencyContacts: contacts });
                updateUI();
            };
        }

        prompt.querySelector("#btn-close-contacts").onclick = () => {
            prompt.remove();
        };
    };

    window.GuardianAngel.removeContact = async (index) => {
        contacts.splice(index, 1);
        await db.collection("users").doc(window.session.uid).update({ emergencyContacts: contacts });
        updateUI();
    };

    updateUI();
    document.body.appendChild(prompt);
  },

  stopSession: function () {
    if (this.safetyCheckTimer) clearInterval(this.safetyCheckTimer);
    if (this.sessionId && navigator.onLine) {
      db.collection("guardian_sessions").doc(this.sessionId).update({
        status: "FINISHED",
        endTime: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    this.sessionId = null;
  },
};

window.toggleGuardianAngel = () => window.GuardianAngel.toggle();
window.triggerEmergencySOS = (r) => window.GuardianAngel.triggerSOS(r);
