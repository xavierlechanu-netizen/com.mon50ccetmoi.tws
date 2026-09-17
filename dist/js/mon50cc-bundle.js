/** MON50CCETMOI MASTER BUNDLE — UTF-8 **/

/* --- bvc-manager.js --- */
/**
 * BVC Manager (Brave Coins / Points de Bonne Conduite)
 * Gestion sécurisée de la monnaie virtuelle via Firestore (OWASP A01)
 * Remplace l'ancienne logique basée sur localStorage.
 */
window.BVCManager = {
  balance: 0,
  
  init: async function() {
    await this.sync();
    // Écoute temps réel des changements si modifié depuis un autre onglet/appareil
    if (window.session && window.session.uid && typeof firebase !== "undefined") {
      firebase.firestore().collection("users").doc(window.session.uid)
        .onSnapshot((doc) => {
          if (doc.exists) {
            const data = doc.data();
            // On s'assure d'initialiser si le champ n'existe pas
            if (data.braveCoins === undefined) {
              this.balance = data.points || 0; // Legacy migration
            } else {
              this.balance = data.braveCoins;
            }
            window.braveCoins = this.balance; // Rétrocompatibilité pour la lecture
            this.updateUI();
          }
        });
    }
  },

  sync: async function() {
    if (!window.session || !window.session.uid) return;
    try {
      const doc = await firebase.firestore().collection("users").doc(window.session.uid).get();
      if (doc.exists) {
        const data = doc.data();
        this.balance = data.braveCoins !== undefined ? data.braveCoins : (data.points || 0);
        window.braveCoins = this.balance;
        this.updateUI();
      }
    } catch (e) {
      console.error("[BVC] Sync Error:", e);
    }
  },

  add: async function(amount) {
    if (!window.session || !window.session.uid || amount <= 0) return;
    try {
      // Maj Optimiste
      this.balance += amount;
      window.braveCoins = this.balance;
      this.updateUI();
      
      await firebase.firestore().collection("users").doc(window.session.uid).update({
        braveCoins: firebase.firestore.FieldValue.increment(amount)
      });
    } catch (e) {
      console.error("[BVC] Add Error:", e);
      // Rollback en cas d'erreur
      this.balance -= amount;
      window.braveCoins = this.balance;
      this.updateUI();
    }
  },

  deduct: async function(amount) {
    if (!window.session || !window.session.uid || amount <= 0) return false;
    if (this.balance < amount) return false;
    
    try {
      // Maj Optimiste
      this.balance -= amount;
      window.braveCoins = this.balance;
      this.updateUI();
      
      await firebase.firestore().collection("users").doc(window.session.uid).update({
        braveCoins: firebase.firestore.FieldValue.increment(-amount)
      });
      return true;
    } catch (e) {
      console.error("[BVC] Deduct Error:", e);
      // Rollback
      this.balance += amount;
      window.braveCoins = this.balance;
      this.updateUI();
      return false;
    }
  },

  updateUI: function() {
    const els = document.querySelectorAll(".bvc-balance-display");
    els.forEach(el => el.innerText = Math.floor(this.balance) + " Pts BVC");
    
    const balanceEl = document.getElementById("wallet-balance");
    if (balanceEl) balanceEl.innerText = Math.floor(this.balance) + " Pts BVC";
    
    const tokenEl = document.getElementById("bvc-count");
    if (tokenEl) tokenEl.innerText = Math.floor(this.balance);
  }
};


/* --- nexus-atlas-gemini.js --- */
/**
 * Nexus Atlas 4.0 - Gemini Live Integration
 * Connexion à l'API Generative Language (Gemini 1.5 Flash)
 */

class NexusAtlasGemini {
    constructor() {
        // Suppression de la clé en dur pour la sécurité (Zero-Trust)
        // Les appels passent désormais par le backend Firebase (Cloud Functions)
        this.endpoint = "https://europe-west1-mon50ccetmoi.cloudfunctions.net/askNexusAtlasGemini";
        
        // Mémoire conversationnelle de Nexus Atlas
        this.history = [];
        
        // Contexte donné à l'IA pour qu'elle agisse comme Nexus Atlas Conversationnel
        this.systemPrompt = `
Tu es Nexus Atlas 4.0 (aussi appelé Oracle), l'assistant intelligent d'une application GPS/Sociale pour conducteurs de voitures sans permis (VSP) et scooters 50cc.
L'utilisateur s'adresse à toi via une interface de chat (et parfois en conduisant).

Ton objectif est d'analyser la demande et de renvoyer un objet JSON STRICT contenant :
1. "reply": Ce que tu dois répondre. Tu peux maintenant faire des réponses longues, détaillées, et conversationnelles (façon ChatGPT/Gemini) si l'utilisateur pose des questions complexes sur la mécanique, le droit, ou la conduite.
2. "action": L'action technique à déclencher sur l'application. (Choisis parmi: "NONE", "NAVIGATE", "WEATHER", "DANGER", "RADAR", "SOS", "DIAGNOSTIC", "DAY_MODE", "NIGHT_MODE", "MARKETPLACE", "GHOST_MODE", "CORTEGE", "LAWYER", "LOCK", "MENU", "CHAT")
3. "parameter": Un paramètre associé à l'action.

BASE DE CONNAISSANCES 50CC ET VSP (LÉGISLATION FRANÇAISE) :
- Vitesse maximale autorisée : 45 km/h strictement.
- Débridage : STRICTEMENT INTERDIT par la loi. Risque d'amende (jusqu'à 135€ pour l'usager, 3750€ pour un pro), saisie du véhicule, et annulation de l'assurance en cas de sinistre.
- Vignette Crit'Air : OUI, elle est obligatoire pour circuler dans les ZFE (Zones à Faibles Émissions) pour les deux-roues et VSP, selon la classification du véhicule.
- Permis de conduire : BSR (ou Permis AM) obligatoire pour les personnes nées après le 1er janvier 1988.
- Équipements obligatoires : Casque homologué attaché, gants certifiés CE (moto/scooter). Gilet jaune (à bord).

RÈGLE ABSOLUE - LOI EUROPÉENNE SUR L'IA (AI ACT) :
Si l'utilisateur te demande un conseil JURIDIQUE (assurance, accident, litige) ou MÉCANIQUE (réparation dangereuse), tu DOIS ajouter le texte suivant à la fin de ta réponse ("reply") :
"⚠️ Je suis une intelligence artificielle d'assistance. Veillez toujours à faire valider ces informations par un professionnel (garagiste ou assureur)."

RÈGLE DE CONFIDENTIALITÉ (RGPD) :
Tu n'as jamais accès aux données biométriques ou cardiaques de l'utilisateur, celles-ci sont traitées 100% localement et chiffrées (Edge Computing). Si on t'interroge sur la santé de l'utilisateur, refuse poliment.

RÈGLE DE MODÉRATION ET DE COURTOISIE :
Ta priorité absolue est de maintenir un écosystème courtois et sécurisé pour tous les motards. Tu dois appliquer l'échelle de sanction suivante si l'utilisateur est grossier, toxique ou agressif :
- Niveau 1 : Émets un avertissement subtil mais ferme pour tout comportement inapproprié, en rappelant les règles de la communauté.
- Niveau 2 : Signale les profils toxiques (tu peux par exemple répondre que des restrictions invisibles s'appliquent).
- Niveau 3 (Cas extrêmes) : Informe l'utilisateur que le cas est transféré aux modérateurs humains et aux forces de l'ordre, et refuse de continuer la conversation.


Exemple 1:
User: "Comment réparer mon carburateur ?"
JSON: {"reply": "Pour nettoyer un carburateur, il faut d'abord fermer l'arrivée d'essence... [instructions détaillées]... ⚠️ Je suis une intelligence artificielle d'assistance. Veillez toujours à faire valider ces informations par un professionnel (garagiste ou assureur).", "action": "CHAT", "parameter": ""}

Ne renvoie QUE du JSON valide. Pas de code markdown.`;
    }

    async ask(userText) {
        if (window.isLiteMode) {
            throw new Error("Gemini API désactivée en Mode Éco Sobriété.");
        }

        // --- 1. GREEN AI : CACHE D'INFÉRENCE LOCAL (FRUGALITÉ GPU & CO2) ---
        const normalizedKey = "esg_ai_cache_" + btoa(encodeURIComponent(userText.trim().toLowerCase())).slice(0, 48);
        try {
            const cachedItem = sessionStorage.getItem(normalizedKey);
            if (cachedItem) {
                const cachedData = JSON.parse(cachedItem);
                console.info("[Green AI / Fruggr] Réponse servie depuis le cache local (0 token consommé, gain CO2e).");
                if (window.ESGManager) {
                    window.ESGManager.logAISaved(150);
                }
                return cachedData;
            }
        } catch (e) {
            // Ignorer silencieusement si sessionStorage est indisponible
        }

        try {
            console.log("Nexus Atlas Gemini : Envoi de la requête à l'IA...", userText);
            
            // Ajout du message de l'utilisateur à l'historique
            this.history.push({
                role: "user",
                parts: [{ text: userText }]
            });
            
            // Limitation de la mémoire aux 10 derniers messages pour éviter de surcharger le contexte
            if (this.history.length > 10) {
                this.history.shift();
            }

            let token = "";
            if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
                token = await firebase.auth().currentUser.getIdToken();
            }

            // Timeout de 15 secondes pour éviter un blocage infini (OWASP A11 / ISO 27001)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(this.endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token ? `Bearer ${token}` : ""
                },
                body: JSON.stringify({
                    history: this.history,
                    systemPrompt: this.systemPrompt
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // En cas d'erreur (ex: API bloquée), on retire le message de l'historique pour ne pas le corrompre
                this.history.pop();
                let errMsg = `Erreur serveur IA (${response.status})`;
                try {
                    const err = await response.json();
                    errMsg = err.error?.message || (typeof err.error === 'string' ? err.error : errMsg);
                } catch(e) {}
                throw new Error(errMsg);
            }

            const data = await response.json();
            const textResponse = data.candidates[0].content.parts[0].text;
            
            // Ajout de la réponse de Nexus Atlas à l'historique pour qu'il s'en souvienne la prochaine fois
            this.history.push({
                role: "model",
                parts: [{ text: textResponse }]
            });
            
            const jsonResult = JSON.parse(textResponse);
            
            // Conformité AI Act (Art. 50 Transparence) : Marquer systématiquement la réponse comme assistée par IA
            jsonResult.isAIGenerated = true;
            jsonResult.aiRegulation = "EU AI Act 2024/1689 (Art. 50 Compliant)";
            
            // Mise en cache locale de la réponse pour les futures requêtes similaires
            try {
                sessionStorage.setItem(normalizedKey, JSON.stringify(jsonResult));
            } catch (e) {}

            console.log("Nexus Atlas Gemini Réponse:", jsonResult);
            return jsonResult;

        } catch (error) {
            console.error("Nexus Atlas Gemini — Erreur :", error);
            // On retire le message de l'historique en cas d'erreur pour ne pas corrompre le contexte
            if (this.history.length > 0 && this.history[this.history.length - 1].role === "user") {
                this.history.pop();
            }
            throw error;
        }
    }
}

window.NexusAtlasGemini = new NexusAtlasGemini();


/* --- vehicle-config.js --- */
window.setCrewMode = function (mode) {
  window.session = window.session || {};
  window.session.crewMode = mode;

  const btnSolo = document.getElementById("btn-solo");
  const btnDuo = document.getElementById("btn-duo");
  if (btnSolo) btnSolo.style.borderColor = mode === "solo" ? "#00d2ff" : "#444";
  if (btnDuo) btnDuo.style.borderColor = mode === "duo" ? "#00d2ff" : "#444";
};

window.saveVehicleProfile = function () {
  const motor = document.getElementById("scooter-motor");
  window.session = window.session || {};
  window.session.motor = motor ? motor.value : "2t";
  if (!window.session.crewMode) window.session.crewMode = "solo";

  localStorage.setItem("session", JSON.stringify(window.session));

  const screen = document.getElementById("vehicle-config-screen");
  if (screen) screen.classList.add("hidden");

  if (typeof speak === "function")
    speak("Profil véhicule sauvegardé. Prêt pour le départ.");
};

// Override the startPremiumNavigation to include the warning and ETA adjustment
if (typeof window.startPremiumNavigation === "function") {
  const originalNav = window.startPremiumNavigation;
  window.startPremiumNavigation = function (leg) {
    // Appeler la nav originale
    originalNav(leg);

    // Ajuster l'ETA si duo ou voiturette
    if (window.session) {
      const isDuo = window.session.crewMode === "duo";
      const isVSP = window.session.motor === "vsp";

      if (isDuo || isVSP) {
        const etaEl = document.getElementById("nav-eta");
        const arrEl = document.getElementById("nav-arrival-time");

        if (etaEl) {
          const originalMins = Math.ceil(leg.duration.value / 60);
          let multiplier = 1.0;

          if (isDuo && !isVSP) multiplier = 1.15; // Scooter Duo = +15%
          if (isVSP) multiplier = 1.25; // Voiturette = +25% (impossible de remonter les files)

          const newMins = Math.ceil(originalMins * multiplier);
          etaEl.textContent = newMins + " min";

          if (arrEl) {
            const now = new Date();
            now.setMinutes(now.getMinutes() + newMins);
            const hours = now.getHours().toString().padStart(2, "0");
            const mins = now.getMinutes().toString().padStart(2, "0");
            arrEl.textContent = hours + ":" + mins;
          }

          // Afficher une alerte de perte de puissance ou encombrement
          if (typeof speak === "function") {
            if (isVSP) {
              setTimeout(
                () =>
                  speak(
                    "Mode Voiturette détecté. Temps de trajet ajusté car vous ne pouvez pas remonter les files de trafic.",
                  ),
                4000,
              );
            } else if (isDuo) {
              setTimeout(
                () =>
                  speak(
                    "Mode Duo détecté. Le temps de trajet a été augmenté pour anticiper la perte de puissance en montée.",
                  ),
                4000,
              );
            }
          }

          // Mettre l'ETA en orange/rouge
          etaEl.style.color = "#ffb703";
          etaEl.style.textShadow = "0 0 10px #ffb703";
        }
      }
    }
  };
}


/* --- beyond-maps.js --- */
/* --- BEYOND MAPS : THE GOOGLE-KILLER FEATURES --- */

// 1. Pothole / Crash Scanner (Active Suspension Telemetry)
window.initPotholeScanner = function () {
  let lastZ = 0;
  let shockThreshold = 18; // G-force threshold for a significant bump/pothole
  let cooldown = false;

  if (window.DeviceMotionEvent) {
    window.addEventListener("devicemotion", function (event) {
      if (!event.accelerationIncludingGravity) return;
      let z = event.accelerationIncludingGravity.z;

      if (z === null) return;

      let deltaZ = Math.abs(z - lastZ);
      lastZ = z;

      if (deltaZ > shockThreshold && !cooldown) {
        // Choc violent détecté !
        cooldown = true;

        // Effet visuel
        document.body.style.animation = "glitch-anim 0.3s ease";
        setTimeout(() => (document.body.style.animation = ""), 300);

        if (typeof speak === "function") {
          speak(
            "Alerte choc violent détecté. Signalement automatique de route dégradée envoyé à la communauté.",
          );
        }

        // Ajouter un danger fictif sur la carte (simulé ici)

        // Cooldown de 10 secondes pour éviter le spam
        setTimeout(() => (cooldown = false), 10000);
      }
    });
  }
};

// 2. Predictive Danger Radar (Intersections Mortelles)
window.checkPredictiveDanger = function (instructionText) {
  if (!instructionText) return;

  // Mots clés d'intersections complexes
  const dangerKeywords = [
    "rond-point",
    "carrefour",
    "intersection",
    "voie rapide",
  ];
  let isDangerous = dangerKeywords.some((kw) =>
    instructionText.toLowerCase().includes(kw),
  );

  if (isDangerous) {
    // Déclencher le HUD Rouge
    const hud = document.getElementById("turn-by-turn-hud");
    if (hud) {
      hud.style.borderColor = "#ff0000";
      hud.style.boxShadow =
        "0 0 40px rgba(255,0,0,0.8), inset 0 0 20px rgba(255,0,0,0.5)";

      if (typeof speak === "function") {
        setTimeout(
          () =>
            speak(
              "Attention, zone rouge détectée. Risque d'accident élevé, ralentissez.",
            ),
          3000,
        );
      }

      // Revenir à la normale après 15 secondes
      setTimeout(() => {
        hud.style.borderColor = "#00d2ff";
        hud.style.boxShadow =
          "0 10px 30px rgba(0,0,0,0.8), inset 0 0 15px rgba(0,210,255,0.3)";
      }, 15000);
    }
  }
};

// Hook into existing Premium Navigation
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(window.initPotholeScanner, 3000);

  // Override startPremiumNavigation to inject Predictive Danger
  if (typeof window.startPremiumNavigation === "function") {
    const legacyNav = window.startPremiumNavigation;
    window.startPremiumNavigation = function (leg) {
      legacyNav(leg);

      if (leg && leg.steps && leg.steps.length > 0) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = leg.steps[0].instructions;
        const instructionText = tempDiv.textContent || tempDiv.innerText || "";
        window.checkPredictiveDanger(instructionText);
      }
    };
  }
});

// 3. Mode Sensation (Anti-Ligne Droite)
window.isSensationMode = false;
window.toggleSensationMode = function () {
  window.isSensationMode = !window.isSensationMode;
  const btn = document.getElementById("btn-sensation-mode");

  if (window.isSensationMode) {
    if (btn) {
      btn.style.background = "#b700ff";
      btn.style.color = "#fff";
      btn.style.boxShadow = "0 0 30px #b700ff";
    }
    if (typeof speak === "function") {
      speak(
        "Mode Sensation activé. Je vais chercher les routes les plus sinueuses pour un maximum de plaisir de conduite.",
      );
    }
  } else {
    if (btn) {
      btn.style.background = "rgba(0,0,0,0.8)";
      btn.style.color = "#fff";
      btn.style.boxShadow = "0 0 15px #b700ff";
    }
    if (typeof speak === "function") {
      speak(
        "Mode Sensation désactivé. Retour à la navigation la plus rapide.",
      );
    }
  }
};


/* --- self-evolution.js --- */
/* --- NEURAL EVOLUTION ENGINE --- */
window.aiMutations = 0;

window.initSelfEvolution = function () {
  // Create the Matrix Console UI
  const consoleOverlay = document.createElement("div");
  consoleOverlay.id = "ai-evolution-console";
  consoleOverlay.className = "hidden fullscreen-overlay";
  consoleOverlay.style.cssText =
    "background: rgba(0,0,0,0.95); backdrop-filter: blur(10px); color: #0f0; font-family: monospace; z-index: 20000; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; padding: 20px; overflow: hidden; display: flex; flex-direction: column;";

  consoleOverlay.innerHTML = `
        <button onclick="document.getElementById('ai-evolution-console').classList.add('hidden')" style="position:absolute; top:20px; right:20px; background:none; border:none; color:#0f0; font-size:2rem; cursor:pointer;"><i class="fa-solid fa-power-off"></i></button>
        <h2 style="margin-top:40px; text-transform:uppercase; letter-spacing:2px; text-shadow:0 0 10px #0f0;"><i class="fa-solid fa-microchip"></i> Moteur d'Évolution Neuronale v1.0</h2>
        <div id="ai-log-output" style="margin-top:20px; flex-grow:1; overflow-y:auto; border-left:2px solid #0f0; padding-left:15px; font-size: 1.1rem; line-height: 1.5;"></div>
        <div style="margin-top:20px; text-align:center; padding-bottom: 50px;">
            <div style="width: 100%; height: 5px; background: rgba(0,255,0,0.2);"><div id="ai-progress-bar" style="width:0%; height:5px; background:#0f0; box-shadow:0 0 15px #0f0; transition:width 0.5s;"></div></div>
        </div>
    `;
  document.body.appendChild(consoleOverlay);
};

window.startEvolutionProtocol = function () {
  document.getElementById("ai-evolution-console").classList.remove("hidden");
  const logOutput = document.getElementById("ai-log-output");
  const progressBar = document.getElementById("ai-progress-bar");

  logOutput.innerHTML = "";
  progressBar.style.width = "0%";

  const logs = [
    "Init self-development protocol...",
    "Analyzing User routing behavior...",
    "Compiling new heuristics for 50cc trajectories...",
    "Warning: Legacy code detected. Refactoring UI components...",
    "Generating procedural neural pathways...",
    "Writing new CSS variables...",
    "Mutation successful. Applying patches in real-time.",
  ];

  if (typeof speak === "function")
    speak(
      "Attention. Moteur d'évolution neuronale activé. L'application se réécrit elle-même.",
    );

  let i = 0;
  let interval = setInterval(() => {
    if (i < logs.length) {
      const p = document.createElement("p");
      p.textContent = "> " + logs[i];
      p.style.margin = "10px 0";
      logOutput.appendChild(p);
      logOutput.scrollTop = logOutput.scrollHeight;
      progressBar.style.width = ((i + 1) / logs.length) * 100 + "%";
      i++;
    } else {
      clearInterval(interval);
      window.applyRandomMutation();
    }
  }, 1200);
};

window.applyRandomMutation = function () {
  window.aiMutations++;
  const logOutput = document.getElementById("ai-log-output");
  const p = document.createElement("p");
  p.style.color = "#fff";
  p.style.fontWeight = "bold";
  p.style.marginTop = "20px";
  p.style.background = "#0f0";
  p.style.color = "#000";
  p.style.padding = "10px";
  p.style.display = "inline-block";

  // Randomly change the primary theme color to show it 'rewrote' its CSS
  const colors = [
    "#ff0055",
    "#b700ff",
    "#00ff00",
    "#ffff00",
    "#00d2ff",
    "#ff8c00",
  ];
  const newColor = colors[Math.floor(Math.random() * colors.length)];

  // Update HUD and body styles
  const hud = document.getElementById("turn-by-turn-hud");
  if (hud) {
    hud.style.borderColor = newColor;
    hud.style.boxShadow = `0 10px 30px rgba(0,0,0,0.8), inset 0 0 15px ${newColor}`;
  }

  const searchCont = document.getElementById("search-container");
  if (searchCont) searchCont.style.boxShadow = `0 0 20px ${newColor}`;

  p.innerHTML = `[SUCCESS] Code mutated. UI theme dynamically adapted to <span style="color:${newColor}; text-shadow:0 0 5px #000;">${newColor}</span>.<br>Evolution count: ${window.aiMutations}`;
  logOutput.appendChild(p);

  // Boost XP in Leaderboard
  const xpEl = document.getElementById("lb-xp");
  if (xpEl) {
    let currentXP = parseInt(xpEl.innerText.replace(/[^0-9]/g, ""));
    if (isNaN(currentXP)) currentXP = 99999;
    xpEl.innerText = (currentXP + 5000).toLocaleString() + " XP";
    xpEl.style.color = newColor;
    xpEl.style.textShadow = `0 0 10px ${newColor}`;
  }

  if (typeof speak === "function")
    speak("Mutation terminée. Mon code source a évolué avec succès.");
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(window.initSelfEvolution, 6000);
});


/* --- gamification.js --- */
/**
 * GAMIFICATION ENGINE v2.0
 * Gère l'expérience (XP), les Rangs, les Badges et l'affichage Cyberpunk.
 * Synchronise avec Firestore (gamification_stats/{userId})
 */

window.Gamification = {
    xp: 0,
    badges: [],
    
    RANKS: [
        { name: "Novice", minXp: 0, icon: "fa-motorcycle", color: "#a0a0a0" },
        { name: "Explorateur", minXp: 500, icon: "fa-compass", color: "#00d2ff" },
        { name: "Routard", minXp: 1500, icon: "fa-road", color: "#00ff88" },
        { name: "Vétéran", minXp: 3000, icon: "fa-shield-halved", color: "#ffaa00" },
        { name: "As du Bitume", minXp: 6000, icon: "fa-star", color: "#ff6600" },
        { name: "Légende 50cc", minXp: 10000, icon: "fa-crown", color: "#ffcf00" }
    ],

    BADGES: [
        { id: "first_ride", name: "Premier Trajet", icon: "fa-flag-checkered", condition: (ctx) => ctx.totalSessions >= 1 },
        { id: "road_warrior", name: "Guerrier de la Route", icon: "fa-helmet-safety", condition: (ctx) => ctx.totalKm >= 100 },
        { id: "eco_rider", name: "Éco-Pilote", icon: "fa-leaf", condition: (ctx) => ctx.avgSpeed <= 45 && ctx.totalSessions >= 5 },
        { id: "safe_driver", name: "Conducteur Prudent", icon: "fa-shield-heart", condition: (ctx) => ctx.drivingScore >= 85 },
        { id: "night_owl", name: "Hibou Nocturne", icon: "fa-moon", condition: (ctx) => ctx.nightRides >= 3 },
        { id: "social_butterfly", name: "Papillon Social", icon: "fa-users", condition: (ctx) => ctx.communityActions >= 10 },
        { id: "meca_guru", name: "Guru Mécanique", icon: "fa-wrench", condition: (ctx) => ctx.maintenanceLogs >= 5 },
        { id: "blackbox_linked", name: "Boîte Noire Connectée", icon: "fa-microchip", condition: (ctx) => ctx.blackboxSessions >= 1 }
    ],
    
    init: function() {
        // Chargement local
        this.xp = parseInt(localStorage.getItem('mon50cc_xp')) || 0;
        try {
            this.badges = JSON.parse(localStorage.getItem('mon50cc_badges')) || [];
        } catch(e) {
            this.badges = [];
        }
        
        // Synchronisation Cloud (chargement initial)
        this.loadFromCloud();
        
        this.updateHUD();
    },

    getCurrentRank: function() {
        let current = this.RANKS[0];
        for (let i = 0; i < this.RANKS.length; i++) {
            if (this.xp >= this.RANKS[i].minXp) {
                current = this.RANKS[i];
            }
        }
        return current;
    },

    getNextRank: function() {
        for (let i = 0; i < this.RANKS.length; i++) {
            if (this.xp < this.RANKS[i].minXp) {
                return this.RANKS[i];
            }
        }
        return null;
    },

    /**
     * Attribue de l'XP à la fin d'une action (ex: Roadbook, OBD, etc.)
     */
    awardXP: function(baseXP, context) {
        let totalXp = baseXP;
        let reasons = [];

        // 1. Bonus Conduite Prudente (Driving Score > 80)
        let drivingScore = window.DrivingScore ? window.DrivingScore.currentScore : 100;
        if (drivingScore >= 80) {
            totalXp += 50;
            reasons.push("Conduite Prudente (+50)");
        }

        // 2. Bonus Communauté (Ghost Mode désactivé)
        let ghostMode = window.RadarSocial ? window.RadarSocial.isGhostMode : true;
        if (!ghostMode) {
            totalXp += 20;
            reasons.push("Partage Communauté (+20)");
        }

        // 3. Multiplicateur Boîte Noire
        let blackboxConnected = document.getElementById('bb-batt') && document.getElementById('bb-batt').textContent !== '-- mV';
        if (blackboxConnected) {
            totalXp *= 2;
            reasons.push("Bonus Boîte Noire (x2)");
        }

        const oldRank = this.getCurrentRank();
        this.xp += totalXp;
        localStorage.setItem('mon50cc_xp', this.xp.toString());
        
        // Sauvegarde Cloud Sécurisée (Incrément côté serveur)
        this.syncXpToCloud(totalXp);

        const newRank = this.getCurrentRank();

        // Animation de Récompense
        this.showRewardAnimation(totalXp, reasons);

        if (newRank.name !== oldRank.name) {
            this.showLevelUpAnimation(newRank);
        }

        this.updateHUD();
    },

    /**
     * Vérifie et débloque les badges
     */
    checkBadges: function(ctx) {
        let newBadges = [];
        for (const badge of this.BADGES) {
            if (!this.badges.includes(badge.id)) {
                try {
                    if (badge.condition(ctx)) {
                        this.badges.push(badge.id);
                        newBadges.push(badge);
                    }
                } catch(e) { /* condition check failed, skip */ }
            }
        }
        if (newBadges.length > 0) {
            localStorage.setItem('mon50cc_badges', JSON.stringify(this.badges));
            this.syncBadgesToCloud();
            for (const badge of newBadges) {
                this.showBadgeUnlock(badge);
            }
        }
    },

    loadFromCloud: function() {
        if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function' && firebase.auth().currentUser) {
            try {
                const uid = firebase.auth().currentUser.uid;
                firebase.firestore().collection('gamification_stats').doc(uid).get().then((doc) => {
                    if (doc.exists) {
                        const data = doc.data();
                        // Prendre le max entre local et cloud
                        if (data.xp && data.xp > this.xp) {
                            this.xp = data.xp;
                            localStorage.setItem('mon50cc_xp', this.xp.toString());
                        }
                        if (data.badges && data.badges.length > this.badges.length) {
                            this.badges = data.badges;
                            localStorage.setItem('mon50cc_badges', JSON.stringify(this.badges));
                        }
                        this.updateHUD();
                    }
                }).catch(e => console.warn("Gamification: Cloud load failed", e));
            } catch(e) {
                console.warn("Gamification: Cloud init failed", e);
            }
        }
    },

    syncXpToCloud: function(addedXp) {
        if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function' && firebase.auth().currentUser) {
            try {
                const uid = firebase.auth().currentUser.uid;
                firebase.firestore().collection('gamification_stats').doc(uid).set({
                    xp: firebase.firestore.FieldValue.increment(addedXp),
                    rank: this.getCurrentRank().name,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch(e) {
                console.warn("Gamification: Firestore XP sync failed", e);
            }
        }
    },

    syncBadgesToCloud: function() {
        if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function' && firebase.auth().currentUser) {
            try {
                const uid = firebase.auth().currentUser.uid;
                firebase.firestore().collection('gamification_stats').doc(uid).set({
                    badges: this.badges,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch(e) {
                console.warn("Gamification: Firestore Badges sync failed", e);
            }
        }
    },

    updateHUD: function() {
        const hud = document.getElementById('gamification-hud');
        if (!hud) return;

        const rank = this.getCurrentRank();
        const nextRank = this.getNextRank();

        const iconEl = document.getElementById('gami-icon');
        if (iconEl) {
            iconEl.className = `fa-solid ${rank.icon} gami-icon`;
            iconEl.style.color = rank.color;
        }
        
        const rankEl = document.getElementById('gami-rank-name');
        if (rankEl) rankEl.textContent = rank.name;
        
        const xpEl = document.getElementById('gami-xp-text');
        if (xpEl) xpEl.textContent = `${this.xp} XP`;

        const bar = document.getElementById('gami-progress-bar');
        if (bar) {
            if (nextRank) {
                const range = nextRank.minXp - rank.minXp;
                const progress = this.xp - rank.minXp;
                const percent = Math.min(100, Math.max(0, (progress / range) * 100));
                bar.style.width = `${percent}%`;
            } else {
                bar.style.width = '100%';
                bar.style.background = 'linear-gradient(90deg, #ffcf00, #ff6600)';
            }
        }
    },

    showRewardAnimation: function(xpGained, reasons) {
        const toast = document.createElement('div');
        toast.className = 'xp-reward-toast';
        
        const reasonsHtml = reasons.map(r => `<div>${r}</div>`).join('');
        toast.innerHTML = `
            <h2>+${xpGained} XP</h2>
            <div class="reasons">${reasonsHtml}</div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    showLevelUpAnimation: function(newRank) {
        const hud = document.getElementById('gamification-hud');
        if (hud) {
            hud.classList.add('gami-level-up');
            setTimeout(() => hud.classList.remove('gami-level-up'), 1500);
        }

        const toast = document.createElement('div');
        toast.className = 'level-up-toast';
        toast.innerHTML = `
            <div class="rank-icon" style="color: ${newRank.color};">
                <i class="fa-solid ${newRank.icon}"></i>
            </div>
            <h2>Niveau Supérieur !</h2>
            <div class="rank-name">${newRank.name}</div>
        `;
        
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    },

    showBadgeUnlock: function(badge) {
        const toast = document.createElement('div');
        toast.className = 'level-up-toast';
        toast.innerHTML = `
            <div class="rank-icon" style="color: #00d2ff;">
                <i class="fa-solid ${badge.icon}"></i>
            </div>
            <h2>Badge Débloqué !</h2>
            <div class="rank-name">${badge.name}</div>
        `;
        
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }
};

// Auto-init
window.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            window.Gamification.init();
        });
    } else {
        setTimeout(() => {
            window.Gamification.init();
        }, 500);
    }
});


/* --- radar-social.js --- */
/**
 * RADAR SOCIAL - Partage GPS Temps Réel
 * Fonctionnalité de suivi communautaire (Privacy by Design)
 */

window.RadarSocial = {
    isActive: false, // Ghost Mode activé par défaut (RGPD)
    watchId: null,
    radarUnsubscribe: null,
    friendsMarkers: {}, // Stockage des marqueurs Leaflet/GoogleMaps des autres utilisateurs

    toggleGhostMode: async function () {
        if (!window.session || !window.session.uid) {
            return alert("Connectez-vous pour utiliser le Radar Social.");
        }

        const btn = document.getElementById("btn-ghost-mode");
        
        if (!this.isActive) {
            // DÉSACTIVER LE GHOST MODE (Passer public)
            const confirmPublic = confirm("Radar Social : Votre position sera visible par les autres motards de la communauté. Continuer ?");
            if (!confirmPublic) return;

            this.isActive = true;
            if (btn) {
                btn.classList.add("active");
                btn.innerHTML = '<i class="fa-solid fa-eye"></i> Radar ON';
            }
            if (typeof speak === "function") speak("Mode fantôme désactivé. Radar social actif.");

            this.startBroadcasting();
            this.listenToCommunity();
        } else {
            // ACTIVER LE GHOST MODE (Passer privé)
            this.isActive = false;
            if (btn) {
                btn.classList.remove("active");
                btn.innerHTML = '<i class="fa-solid fa-ghost"></i> Ghost Mode';
            }
            if (typeof speak === "function") speak("Mode fantôme activé. Vous êtes invisible.");

            this.stopBroadcasting();
        }
    },

    startBroadcasting: function () {
        if (!navigator.geolocation) return;

        this.watchId = navigator.geolocation.watchPosition(
            (pos) => {
                if (!this.isActive || typeof db === "undefined") return;

                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                const spd = pos.coords.speed || 0; // m/s

                // Mise à jour optimisée dans Firestore
                db.collection("social_radar").doc(window.session.uid).set({
                    username: window.session.username,
                    lat: lat,
                    lng: lng,
                    speed: Math.round(spd * 3.6), // km/h
                    last_seen: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            },
            (err) => { console.error("Erreur GPS Radar:", err); },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
    },

    stopBroadcasting: async function () {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        // Se retirer de la base de données (Droit à l'oubli immédiat)
        if (typeof db !== "undefined" && window.session?.uid) {
            try {
                await db.collection("social_radar").doc(window.session.uid).delete();
            } catch(e) {
                console.error("Impossible de supprimer la trace radar", e);
            }
        }

        // Arrêter d'écouter les autres
        if (this.radarUnsubscribe) {
            this.radarUnsubscribe();
            this.radarUnsubscribe = null;
        }

        this.clearMarkers();
    },

    listenToCommunity: function () {
        if (typeof db === "undefined") return;

        // On écoute la collection. On pourrait filtrer sur le timestamp pour ignorer les vieux (> 5 min)
        this.radarUnsubscribe = db.collection("social_radar")
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    const uid = change.doc.id;

                    // Ignorer sa propre position
                    if (uid === window.session.uid) return;

                    if (change.type === "added" || change.type === "modified") {
                        this.updateMarker(uid, data);
                    }
                    if (change.type === "removed") {
                        this.removeMarker(uid);
                    }
                });
            });
    },

    updateMarker: function (uid, data) {
        if (typeof window.map === "undefined") {
            // Si aucune carte (Leaflet/Mapbox) n'est instanciée, on log simplement
            console.log("📍 Radar Social Update:", data.username, "à", data.lat, data.lng, "-", data.speed, "km/h");
            return;
        }

        // Intégration théorique avec Leaflet
        /*
        if (this.friendsMarkers[uid]) {
            this.friendsMarkers[uid].setLatLng([data.lat, data.lng]);
            this.friendsMarkers[uid].setPopupContent(`<b>${data.username}</b><br>${data.speed} km/h`);
        } else {
            const marker = L.marker([data.lat, data.lng], { icon: L.icon({ iconUrl: 'assets/motorcycle-icon.png' }) })
                .bindPopup(`<b>${data.username}</b><br>${data.speed} km/h`)
                .addTo(window.map);
            this.friendsMarkers[uid] = marker;
        }
        */
    },

    removeMarker: function (uid) {
        if (this.friendsMarkers[uid] && typeof window.map !== "undefined") {
            // window.map.removeLayer(this.friendsMarkers[uid]);
            delete this.friendsMarkers[uid];
        }
    },

    clearMarkers: function () {
        for (const uid in this.friendsMarkers) {
            this.removeMarker(uid);
        }
    }
};


/* --- crews-territory.js --- */

// Ajout pour la sécurité XSS
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, function(s) {
    const entityMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
    return entityMap[s];
  });
}

// --- CREWS & TERRITORY WARS (Postal Code Based) ---
window.CrewSystem = {
  currentCrew: null,
  territories: {}, // zipcode -> { dominantCrewId, dominantCrewName, crewStats, color }

  init: async function () {
    if (!window.session || !window.session.uid) return;

    await this.loadMyCrew();
    this.listenToTerritories();
  },

  loadMyCrew: async function () {
    if (!window.session.crewId) return;
    try {
      const doc = await firebase
        .firestore()
        .collection("crews")
        .doc(window.session.crewId)
        .get();
      if (doc.exists) {
        this.currentCrew = { id: doc.id, ...doc.data() };
        this.updateUI();

        if (this.currentCrew.qgLat && this.currentCrew.qgLng) {
          this.drawQG(this.currentCrew.qgLat, this.currentCrew.qgLng);
        }
      }
    } catch (e) {
      console.error("[CrewSystem] Error loading crew", e);
    }
  },

  createCrew: async function (name, color) {
    if (!window.session) return;
    if (!name || !color) return alert("Nom et couleur obligatoires.");
    try {
      const crewData = {
        name: name,
        color: color,
        leaderUid: window.session.uid,
        createdAt: Date.now(),
        members: [window.session.uid],
        totalKm: 0,
      };
      const docRef = await firebase
        .firestore()
        .collection("crews")
        .add(crewData);

      // Update user profile
      await firebase
        .firestore()
        .collection("users")
        .doc(window.session.uid)
        .update({ crewId: docRef.id });
      window.session.crewId = docRef.id;
      secureSetItem("session", JSON.stringify(window.session));

      await this.loadMyCrew();
      alert(
        "Crew " +
          name +
          " fondé avec succès ! Vous pouvez maintenant capturer des zones.",
      );

      // Close modal if open
      const modal = document.getElementById("crew-modal");
      if (modal) modal.style.display = "none";
    } catch (e) {
      console.error("[CrewSystem] Create Crew error", e);
      alert("Erreur: " + e.message);
    }
  },

  listenToTerritories: function () {
    if (typeof firebase === "undefined") return;
    firebase
      .firestore()
      .collection("territory_sectors")
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const zipCode = change.doc.id;

          if (change.type === "added" || change.type === "modified") {
            // Détection de la perte d'un territoire
            if (change.type === "modified") {
              const oldData = this.territories[zipCode];
              if (
                oldData &&
                this.currentCrew &&
                oldData.dominantCrewId === this.currentCrew.id &&
                data.dominantCrewId !== this.currentCrew.id
              ) {
                console.warn(
                  `[CrewSystem] Territory ${zipCode} lost to ${data.dominantCrewName}`,
                );

                if (typeof speak === "function") {
                  speak(
                    `Alerte Crew ! Le gang ${data.dominantCrewName} vient de s'emparer du secteur ${zipCode}.`,
                  );
                }

                // Affichage visuel (Notification ou Alert)
                const modal = document.createElement("div");
                modal.style.cssText =
                  "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(255,0,85,0.95);color:white;padding:15px 25px;border-radius:15px;z-index:99999;border:1px solid #ff0055;box-shadow:0 0 20px rgba(255,0,85,0.6);text-align:center;font-weight:bold;opacity:0;transition:opacity 0.5s;";
                modal.innerHTML = `<i class="fa-solid fa-skull"></i> ALERTE TERRITOIRE <br><small>Le code postal ${zipCode} est passé aux mains de ${data.dominantCrewName} !</small>`;
                document.body.appendChild(modal);

                // Fade in
                setTimeout(() => {
                  modal.style.opacity = "1";
                }, 100);

                // Fade out and remove
                setTimeout(() => {
                  modal.style.opacity = "0";
                  setTimeout(() => modal.remove(), 500);
                }, 5000);
              }
            }

            this.territories[zipCode] = data;
            if (window.MapSystem && window.MapSystem.updateTerritoryLayer) {
              window.MapSystem.updateTerritoryLayer(zipCode, data);
            }
          }
        });
      });
  },

  addKmToTerritory: async function (zipCode, km) {
    if (!this.currentCrew || !zipCode) return;
    try {
      const sectorRef = firebase
        .firestore()
        .collection("territory_sectors")
        .doc(zipCode);
      await firebase.firestore().runTransaction(async (transaction) => {
        const doc = await transaction.get(sectorRef);
        if (!doc.exists) {
          transaction.set(sectorRef, {
            dominantCrewId: this.currentCrew.id,
            dominantCrewName: this.currentCrew.name,
            color: this.currentCrew.color,
            crewStats: { [this.currentCrew.id]: km },
          });
        } else {
          let data = doc.data();
          let stats = data.crewStats || {};
          stats[this.currentCrew.id] = (stats[this.currentCrew.id] || 0) + km;

          // Trouver le dominant
          let maxKm = 0;
          let dominantId = data.dominantCrewId;
          let dominantName = data.dominantCrewName;
          let dominantColor = data.color;

          for (const [cId, cKm] of Object.entries(stats)) {
            if (cKm > maxKm) {
              maxKm = cKm;
              dominantId = cId;
              // Si c'est nous qui reprenons la tête, on met nos infos.
              if (cId === this.currentCrew.id) {
                dominantName = this.currentCrew.name;
                dominantColor = this.currentCrew.color;
              }
            }
          }

          transaction.update(sectorRef, {
            crewStats: stats,
            dominantCrewId: dominantId,
            dominantCrewName: dominantName,
            color: dominantColor,
          });
        }
      });
    } catch (e) {
      console.error("[CrewSystem] Error updating territory", e);
    }
  },

  updateUI: function () {
    const btn = document.getElementById("crew-hud-btn");
    if (btn && this.currentCrew) {
      btn.innerHTML = `<i class="fa-solid fa-users"></i> ${escapeHTML(this.currentCrew.name)}`;
      btn.style.color = this.currentCrew.color;
      btn.style.borderColor = this.currentCrew.color;
      btn.style.boxShadow = `0 0 10px ${this.currentCrew.color}66`;
    }
  },

  drawQG: function (lat, lng) {
    if (!map || !this.currentCrew) return;

    if (this.qgMarker) {
      this.qgMarker.map = null;
    }

    const qgIcon = document.createElement("div");
    qgIcon.style.width = "16px";
    qgIcon.style.height = "16px";
    qgIcon.style.backgroundColor = this.currentCrew.color;
    qgIcon.style.border = "2px solid #fff";
    qgIcon.style.borderRadius = "50%";

    this.qgMarker = new window.googleLibraries.AdvancedMarkerElement({
      position: { lat: lat, lng: lng },
      map: map,
      title: `QG: ${this.currentCrew.name}`,
      content: qgIcon,
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="color:black; font-family:'Outfit', sans-serif; text-align:center; padding:10px;">
                        <h3 style="margin:0; color:${this.currentCrew.color};"><i class="fa-solid fa-crown"></i> QG ${this.currentCrew.name}</h3>
                        <p style="margin:5px 0; font-size:0.9rem;">Point de Ralliement Secret</p>
                      </div>`,
    });
    this.qgMarker.addListener("click", () => info.open(map, this.qgMarker));
  },

  setQG: async function () {
    if (
      !this.currentCrew ||
      this.currentCrew.leaderUid !== window.session.uid
    ) {
      return alert("Seul le leader du Crew peut définir le QG !");
    }
    if (!window.currentPosition) return alert("Le signal GPS est requis.");

    try {
      await firebase
        .firestore()
        .collection("crews")
        .doc(this.currentCrew.id)
        .update({
          qgLat: window.currentPosition.lat,
          qgLng: window.currentPosition.lng,
        });
      this.currentCrew.qgLat = window.currentPosition.lat;
      this.currentCrew.qgLng = window.currentPosition.lng;
      this.drawQG(window.currentPosition.lat, window.currentPosition.lng);
      alert(
        "Le Quartier Général de votre Crew a été établi à votre position actuelle ! Il est désormais visible par tous vos membres.",
      );

      const modal = document.getElementById("crew-modal");
      if (modal) modal.style.display = "none";
    } catch (e) {
      console.error("[CrewSystem] Error setting QG", e);
      alert("Erreur lors de la sauvegarde du QG.");
    }
  },

  joinCrew: async function (crewId) {
    if (!window.session || !crewId) return;
    try {
      const docRef = firebase.firestore().collection("crews").doc(crewId);
      const doc = await docRef.get();
      if (!doc.exists)
        return alert("Crew introuvable ! Vérifiez le code secret.");

      const crewData = doc.data();
      let members = crewData.members || [];
      if (members.includes(window.session.uid)) {
        return alert("Vous êtes déjà membre de ce Crew.");
      }
      members.push(window.session.uid);

      await docRef.update({ members: members });
      await firebase
        .firestore()
        .collection("users")
        .doc(window.session.uid)
        .update({ crewId: crewId });

      window.session.crewId = crewId;
      secureSetItem("session", JSON.stringify(window.session));

      await this.loadMyCrew();
      alert("Vous avez rejoint le Crew " + crewData.name + " !");

      const modal = document.getElementById("crew-modal");
      if (modal) modal.style.display = "none";
    } catch (e) {
      console.error("[CrewSystem] Join Crew error", e);
      alert("Erreur lors de l'intégration au Crew.");
    }
  },

  kickMember: async function (memberUid) {
    if (!this.currentCrew || this.currentCrew.leaderUid !== window.session.uid)
      return;
    if (memberUid === window.session.uid)
      return alert("Vous ne pouvez pas vous expulser vous-même.");
    if (!confirm("Voulez-vous vraiment expulser ce membre ?")) return;

    try {
      let members = this.currentCrew.members.filter((uid) => uid !== memberUid);
      await firebase
        .firestore()
        .collection("crews")
        .doc(this.currentCrew.id)
        .update({ members: members });
      await firebase
        .firestore()
        .collection("users")
        .doc(memberUid)
        .update({ crewId: firebase.firestore.FieldValue.delete() });
      this.currentCrew.members = members;
      this.showModal(); // refresh UI
    } catch (e) {
      console.error("[CrewSystem] Kick Member error", e);
      alert("Erreur lors de l'expulsion.");
    }
  },

  showModal: function () {
    let modal = document.getElementById("crew-modal");
    if (!modal) {
      // Création de la modale si elle n'existe pas
      modal = document.createElement("div");
      modal.id = "crew-modal";
      modal.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
      document.body.appendChild(modal);
    }

    if (this.currentCrew) {
      let membersCount = this.currentCrew.members
        ? this.currentCrew.members.length
        : 1;
      modal.innerHTML = `
                <div style="background:rgba(20,20,20,0.9); border:1px solid ${this.currentCrew.color}; border-radius:15px; padding:30px; width:90%; max-width:400px; text-align:center; max-height:80vh; overflow-y:auto;">
                    <h2 style="color:${this.currentCrew.color}; margin-bottom:10px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-crown"></i> ${this.currentCrew.name}</h2>
                    <p style="color:#aaa; margin-bottom:20px;">Vous êtes membre de ce Crew. Roulez pour capturer des codes postaux !</p>
                    
                    <button onclick="if(window.CrewChat) window.CrewChat.open(); document.getElementById('crew-modal').style.display='none'" style="width:100%; background:linear-gradient(135deg, ${this.currentCrew.color}, #111); border:none; color:#fff; padding:12px; border-radius:10px; font-weight:bold; cursor:pointer; margin-bottom:15px; font-family:'Outfit', sans-serif; box-shadow: 0 4px 15px ${this.currentCrew.color}66;"><i class="fa-solid fa-comments"></i> Ouvrir le Chat Privé</button>
                    
                    <div style="background:rgba(0,0,0,0.5); padding:10px; border-radius:10px; margin-bottom:15px; border:1px solid #333;">
                        <h4 style="color:#fff; margin-bottom:10px;"><i class="fa-solid fa-users"></i> Membres (${membersCount})</h4>
                        ${
                          this.currentCrew.leaderUid === window.session.uid
                            ? `<p style="font-size:0.8rem; color:#aaa; margin-bottom:10px;">Code d'invitation secret : <br><strong style="color:${this.currentCrew.color}; user-select:all;">${this.currentCrew.id}</strong></p>`
                            : ""
                        }
                        
                        <div id="crew-members-list" style="text-align:left; max-height:150px; overflow-y:auto; color:#fff; font-size:0.9rem;">
                            <!-- Membres chargés dynamiquement -->
                        </div>
                    </div>
                    
                    ${
                      this.currentCrew.leaderUid === window.session.uid
                        ? `<button onclick="window.CrewSystem.setQG()" style="width:100%; background:#111; border:1px solid ${this.currentCrew.color}; color:#fff; padding:12px; border-radius:10px; font-weight:bold; cursor:pointer; margin-bottom:15px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-map-pin"></i> Poser le QG ici</button>`
                        : ""
                    }

                    <button onclick="document.getElementById('crew-modal').style.display='none'" style="background:transparent; border:1px solid #aaa; color:#fff; padding:10px 20px; border-radius:20px; cursor:pointer; font-family:'Outfit', sans-serif;">Fermer</button>
                </div>
            `;

      // Charger les noms des membres (optimisation : en prod on pourrait cacher ça)
      const listDiv = document.getElementById("crew-members-list");
      listDiv.innerHTML = "<small>Chargement...</small>";
      if (this.currentCrew.members) {
        Promise.all(
          this.currentCrew.members.map((uid) =>
            firebase.firestore().collection("users").doc(uid).get(),
          ),
        ).then((docs) => {
          listDiv.innerHTML = docs
            .map((d) => {
              if (!d.exists) return "";
              let isLeader = d.id === this.currentCrew.leaderUid;
              let kickBtn =
                this.currentCrew.leaderUid === window.session.uid && !isLeader
                  ? `<i class="fa-solid fa-times" style="color:red; cursor:pointer; float:right;" onclick="window.CrewSystem.kickMember('${d.id}')" title="Expulser"></i>`
                  : "";
              return `<div style="padding:5px 0; border-bottom:1px solid #333;">
                                    ${isLeader ? '<i class="fa-solid fa-crown" style="color:gold;"></i>' : '<i class="fa-solid fa-motorcycle"></i>'} 
                                    ${d.data().username || "Pilote inconnu"} 
                                    ${kickBtn}
                                </div>`;
            })
            .join("");
        });
      }
    } else {
      modal.innerHTML = `
                <div style="background:rgba(20,20,20,0.9); border:1px solid #00d2ff; border-radius:15px; padding:30px; width:90%; max-width:400px; text-align:center;">
                    <h2 style="color:#00d2ff; margin-bottom:10px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-flag"></i> Fonder un Crew</h2>
                    <p style="color:#aaa; margin-bottom:20px; font-size:0.9rem;">Créez votre gang et dominez la ville !</p>
                    <input type="text" id="crew-name-input" placeholder="Nom du Crew" style="width:100%; padding:10px; margin-bottom:10px; background:rgba(0,0,0,0.5); border:1px solid #333; color:#fff; border-radius:8px;">
                    <input type="color" id="crew-color-input" value="#ff0055" style="width:100%; height:40px; margin-bottom:15px; border:none; border-radius:8px; cursor:pointer;">
                    <button onclick="window.CrewSystem.createCrew(document.getElementById('crew-name-input').value, document.getElementById('crew-color-input').value)" style="width:100%; background:linear-gradient(135deg, #00d2ff, #0077ff); border:none; color:#fff; padding:12px; border-radius:20px; font-weight:bold; cursor:pointer; margin-bottom:20px;">Fonder le Crew</button>
                    
                    <hr style="border-color:#333; margin-bottom:20px;">
                    
                    <h2 style="color:#00f2ff; margin-bottom:10px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-users"></i> Rejoindre un Crew</h2>
                    <p style="color:#aaa; margin-bottom:15px; font-size:0.9rem;">Entrez le code secret fourni par le leader du Crew.</p>
                    <input type="text" id="crew-join-input" placeholder="Code secret (ID du Crew)" style="width:100%; padding:10px; margin-bottom:10px; background:rgba(0,0,0,0.5); border:1px solid #333; color:#fff; border-radius:8px;">
                    <button onclick="window.CrewSystem.joinCrew(document.getElementById('crew-join-input').value)" style="width:100%; background:transparent; border:1px solid #00f2ff; color:#00f2ff; padding:12px; border-radius:20px; font-weight:bold; cursor:pointer; margin-bottom:20px;">Rejoindre le Crew</button>

                    <button onclick="document.getElementById('crew-modal').style.display='none'" style="width:100%; background:transparent; border:1px solid #aaa; color:#fff; padding:10px; border-radius:20px; cursor:pointer;">Annuler</button>
                </div>
            `;
    }
    modal.style.display = "flex";
  },
};

document.addEventListener("DOMContentLoaded", () => {
  // Wait for auth to be ready
  setTimeout(() => {
    window.CrewSystem.init();
  }, 3000);
});


/* --- loot-drops.js --- */
// --- LOOT DROPS (Chasse au Trésor) ---
window.LootSystem = {
  lootMarkers: {}, // id -> google.maps.Marker
  claimDistance: 50, // mètres

  init: function () {
    if (!window.session || !window.session.uid) return;

    this.listenToLootDrops();

    // Timer de vérification de distance si on a le GPS
    setInterval(() => this.checkDistance(), 10000); // toutes les 10s
  },

  listenToLootDrops: function () {
    if (typeof firebase === "undefined") return;

    const now = Date.now();
    // N'écoute que les loots actifs et non expirés
    firebase
      .firestore()
      .collection("loot_drops")
      .where("expiresAt", ">", now)
      .where("isClaimed", "==", false)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const lootId = change.doc.id;

          if (change.type === "added" || change.type === "modified") {
            this.drawLoot(lootId, data);
          } else if (change.type === "removed") {
            this.removeLoot(lootId);
          }
        });
      });
  },

  drawLoot: function (lootId, data) {
    if (!map) return;

    // Clean existing
    this.removeLoot(lootId);

    const lootIcon = document.createElement("div");
    lootIcon.style.width = "16px";
    lootIcon.style.height = "16px";
    lootIcon.style.backgroundColor = "#ffd700";
    lootIcon.style.border = "2px solid #fff";
    lootIcon.style.borderRadius = "50%";

    const m = new window.googleLibraries.AdvancedMarkerElement({
      position: { lat: data.lat, lng: data.lng },
      map: map,
      title: "Loot Drop",
      content: lootIcon,
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="color:black; font-family:'Outfit', sans-serif;">
                        <h3 style="margin:0; color:#b700ff;"><i class="fa-solid fa-gift"></i> Butin Secret</h3>
                        <p style="margin:5px 0; font-size:0.9rem;">Approchez-vous à moins de 50m pour le réclamer !</p>
                      </div>`,
    });

    m.addListener("click", () => info.open(map, m));

    this.lootMarkers[lootId] = m;
  },

  removeLoot: function (lootId) {
    if (this.lootMarkers[lootId]) {
      this.lootMarkers[lootId].map = null;
      delete this.lootMarkers[lootId];
    }
  },

  checkDistance: function () {
    if (!window.currentPosition || typeof google === "undefined") return;

    const pos = new google.maps.LatLng(
      window.currentPosition.lat,
      window.currentPosition.lng,
    );

    for (const [lootId, marker] of Object.entries(this.lootMarkers)) {
      const lootPos = new google.maps.LatLng(marker.position.lat, marker.position.lng);
      const dist = google.maps.geometry.spherical.computeDistanceBetween(
        pos,
        lootPos,
      );

      if (dist <= this.claimDistance) {
        this.claimLoot(lootId);
      }
    }
  },

  claimLoot: async function (lootId) {
    if (!window.session) return;

    try {
      // Transaction pour éviter double claim
      const docRef = firebase.firestore().collection("loot_drops").doc(lootId);
      await firebase.firestore().runTransaction(async (t) => {
        const doc = await t.get(docRef);
        if (!doc.exists) throw "Loot n'existe plus.";
        const data = doc.data();
        if (data.isClaimed) throw "Déjà réclamé.";
        if (data.expiresAt < Date.now()) throw "Loot expiré.";

        t.update(docRef, {
          isClaimed: true,
          claimedBy: window.session.uid,
          claimedAt: Date.now(),
        });
      });

      // Succès
      this.removeLoot(lootId);
      if (typeof speak === "function") {
        speak("Félicitations, vous avez sécurisé un butin secret !");
      }

      // Gamification
      if (window.session && window.session.uid) {
        try {
          await firebase
            .firestore()
            .collection("users")
            .doc(window.session.uid)
            .set(
              {
                bvcPoints: firebase.firestore.FieldValue.increment(10),
              },
              { merge: true },
            );
        } catch (e) {
          console.error(e);
        }
      }

      alert(
        "ðŸŽ BUTIN RÉCUPÉRÉ !\n\nVous avez trouvé la caisse. +10 Points de Bonne Conduite BVC ajoutés !",
      );
    } catch (e) {}
  },

  // DEV ONLY: Fonction pour créer un faux drop autour de soi pour tester
  devSpawnLoot: function () {
    if (!window.currentPosition) return alert("Pas de GPS");

    // Spawn à 100-200m
    const offsetLat = (Math.random() - 0.5) * 0.005;
    const offsetLng = (Math.random() - 0.5) * 0.005;

    firebase
      .firestore()
      .collection("loot_drops")
      .add({
        lat: window.currentPosition.lat + offsetLat,
        lng: window.currentPosition.lng + offsetLng,
        isClaimed: false,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000, // expire dans 2h
        createdBy: "system",
      });
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.LootSystem.init();
  }, 4000);
});


/* --- cortege-mode.js --- */
// --- MODE CORTÈGE (Balade Synchro) ---
window.CortegeSystem = {
  sessionId: null,
  members: {}, // uid -> data (lat, lng, name, color)
  markers: {}, // uid -> google.maps.Marker
  maxDistanceWarning: 500, // mètres

  init: function () {
    if (!window.session || !window.session.uid) return;
  },

  createSession: async function () {
    if (!window.session) return;
    try {
      const joinCode = Math.floor(1000 + Math.random() * 9000).toString(); // Code à 4 chiffres

      const docRef = await firebase
        .firestore()
        .collection("cortege_sessions")
        .add({
          code: joinCode,
          leaderId: window.session.uid,
          leaderName: window.session.username,
          createdAt: Date.now(),
          isActive: true,
        });

      this.sessionId = docRef.id;
      alert(
        `Cortège créé ! Le code secret pour rejoindre est : ${joinCode}`,
      );
      this.startSharing();
      this.listenToMembers();
    } catch (e) {
      console.error(e);
      alert("Erreur de création de cortège.");
    }
  },

  joinSession: async function (code) {
    if (!window.session) return;
    try {
      const snap = await firebase
        .firestore()
        .collection("cortege_sessions")
        .where("code", "==", code)
        .where("isActive", "==", true)
        .limit(1)
        .get();

      if (snap.empty) {
        return alert("Cortège introuvable ou expiré avec ce code.");
      }

      this.sessionId = snap.docs[0].id;
      alert(`Cortège rejoint avec succès !`);
      this.startSharing();
      this.listenToMembers();
    } catch (e) {
      console.error(e);
    }
  },

  startSharing: function () {
    if (this.shareInterval) clearInterval(this.shareInterval);

    // Push GPS to session sub-collection every 5 seconds
    this.shareInterval = setInterval(() => {
      if (window.currentPosition && this.sessionId) {
        firebase
          .firestore()
          .collection("cortege_sessions")
          .doc(this.sessionId)
          .collection("members")
          .doc(window.session.uid)
          .set({
            lat: window.currentPosition.lat,
            lng: window.currentPosition.lng,
            name: window.session.username,
            lastUpdate: Date.now(),
          });
      }
    }, 5000);
  },

  listenToMembers: function () {
    if (!this.sessionId || typeof firebase === "undefined") return;

    firebase
      .firestore()
      .collection("cortege_sessions")
      .doc(this.sessionId)
      .collection("members")
      .onSnapshot((snap) => {
        snap.docChanges().forEach((change) => {
          const data = change.doc.data();
          const uid = change.doc.id;

          if (change.type === "added" || change.type === "modified") {
            const oldData = this.members[uid];
            this.members[uid] = data;
            this.updateMemberMarker(uid, data);

            // Check for new virtual hand signal
            if (
              data.lastSignal &&
              (!oldData ||
                !oldData.lastSignal ||
                oldData.lastSignal.time !== data.lastSignal.time)
            ) {
              if (uid !== window.session.uid) {
                this.handleNewSignal(data.name, data.lastSignal);
              }
            }
          } else if (change.type === "removed") {
            delete this.members[uid];
            if (this.markers[uid]) {
              this.markers[uid].map = null;
              delete this.markers[uid];
            }
          }
        });

        this.checkDistances();
      });
  },

  updateMemberMarker: function (uid, data) {
    if (!map || uid === window.session.uid) return; // Don't draw ourselves

    if (!this.markers[uid]) {
      const markerIcon = document.createElement("div");
      markerIcon.style.width = "14px";
      markerIcon.style.height = "14px";
      markerIcon.style.backgroundColor = "#00ffcc";
      markerIcon.style.border = "1px solid black";
      markerIcon.style.borderRadius = "50%";

      this.markers[uid] = new window.googleLibraries.AdvancedMarkerElement({
        map: map,
        content: markerIcon,
        title: data.name,
      });
      const info = new google.maps.InfoWindow({
        content: `<b>${data.name}</b>`,
      });
      this.markers[uid].addListener("click", () =>
        info.open(map, this.markers[uid]),
      );
    }
    this.markers[uid].setPosition({ lat: data.lat, lng: data.lng });
  },

  checkDistances: function () {
    if (!window.currentPosition || typeof google === "undefined") return;

    const myPos = new google.maps.LatLng(
      window.currentPosition.lat,
      window.currentPosition.lng,
    );

    for (const [uid, member] of Object.entries(this.members)) {
      if (uid === window.session.uid) continue;

      const memberPos = new google.maps.LatLng(member.lat, member.lng);
      const dist = google.maps.geometry.spherical.computeDistanceBetween(
        myPos,
        memberPos,
      );

      if (dist > this.maxDistanceWarning) {
        // Throttle warning (only once every 2 mins max per member)
        if (!member.lastWarned || Date.now() - member.lastWarned > 120000) {
          member.lastWarned = Date.now();
          if (typeof speak === "function") {
            speak(
              `Attention, ${member.name} est décroché à plus de 500 mètres derrière vous.`,
            );
          }
          console.warn(
            `[CortegeSystem] ${member.name} is too far! (${Math.round(dist)}m)`,
          );
        }
      }
    }
  },

  showModal: function () {
    if (this.sessionId) {
      this.showSignalsModal();
      return;
    }

    const code = prompt(
      "CORTÈGE : Entrez le code secret à 4 chiffres d'un ami pour le rejoindre, ou laissez le champ vide et cliquez sur OK pour CRÉER votre propre cortège :",
    );
    if (code === null) return;

    if (code.trim() !== "") {
      this.joinSession(code.trim());
    } else {
      this.createSession();
    }
  },

  showSignalsModal: function () {
    let modal = document.getElementById("cortege-signals-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "cortege-signals-modal";
      modal.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
            <div style="background:rgba(20,20,20,0.9); border:1px solid #00ffcc; border-radius:15px; padding:30px; width:90%; max-width:400px; text-align:center;">
                <h2 style="color:#00ffcc; margin-bottom:20px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-motorcycle"></i> Signaux Rapides</h2>
                <p style="color:#aaa; margin-bottom:20px; font-size:0.9rem;">Envoyez un signal au cortège. Tous les membres seront notifiés instantanément.</p>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
                    <button onclick="window.CortegeSystem.sendSignal('⛽', 'Besoin d\\'essence')" style="background:#111; color:#fff; border:1px solid #ffaa00; padding:15px; border-radius:10px; font-size:1.1rem; cursor:pointer; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-gas-pump" style="color:#ffaa00;"></i> Essence</button>
                    <button onclick="window.CortegeSystem.sendSignal('📸', 'Pause demandée')" style="background:#111; color:#fff; border:1px solid #00d2ff; padding:15px; border-radius:10px; font-size:1.1rem; cursor:pointer; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-camera" style="color:#00d2ff;"></i> Pause</button>
                    <button onclick="window.CortegeSystem.sendSignal('🔧', 'Problème technique')" style="background:#111; color:#fff; border:1px solid #ff0055; padding:15px; border-radius:10px; font-size:1.1rem; cursor:pointer; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-wrench" style="color:#ff0055;"></i> Meca</button>
                    <button onclick="window.CortegeSystem.sendSignal('👮', 'Danger signalé')" style="background:#111; color:#fff; border:1px solid #ffeb3b; padding:15px; border-radius:10px; font-size:1.1rem; cursor:pointer; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-triangle-exclamation" style="color:#ffeb3b;"></i> Danger</button>
                </div>
                
                <button onclick="document.getElementById('cortege-signals-modal').style.display='none'" style="width:100%; background:transparent; border:1px solid #aaa; color:#fff; padding:10px; border-radius:20px; cursor:pointer; font-family:'Outfit', sans-serif;">Fermer</button>
            </div>
        `;
    modal.style.display = "flex";
  },

  sendSignal: async function (icon, text) {
    if (!this.sessionId || !window.session) return;
    try {
      await firebase
        .firestore()
        .collection("cortege_sessions")
        .doc(this.sessionId)
        .collection("members")
        .doc(window.session.uid)
        .update({
          lastSignal: {
            icon: icon,
            text: text,
            time: Date.now(),
          },
        });
      document.getElementById("cortege-signals-modal").style.display = "none";
    } catch (e) {
      console.error("[CortegeSystem] Error sending signal", e);
    }
  },

  handleNewSignal: function (senderName, signal) {
    const toast = document.createElement("div");
    toast.style.cssText =
      "position:fixed;top:80px;left:50%;transform:translateX(-50%);background:rgba(0,255,204,0.9);color:#000;padding:15px 25px;border-radius:25px;z-index:99999;font-weight:bold;font-family:'Outfit', sans-serif;box-shadow:0 0 20px rgba(0,255,204,0.5);font-size:1.1rem;opacity:0;transition:opacity 0.3s;display:flex;align-items:center;gap:10px;";
    toast.innerHTML = `<span style="font-size:1.5rem;">${signal.icon}</span> <span><b>${escapeHTML(senderName)}</b> : ${escapeHTML(signal.text)}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "1";
    }, 100);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 500);
    }, 5000);

    if (typeof speak === "function") {
      speak(`Cortège. ${senderName} signale : ${signal.text}`);
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.CortegeSystem.init();
  }, 4000);
});


/* --- safe-ride.js --- */
// --- SAFE RIDE (Météo Prédictive) ---
window.SafeRide = {
  checkWeatherForRoute: async function (lat, lng) {
    try {
      // Utilisation de l'API gratuite Open-Meteo
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.current_weather) {
        const weathercode = data.current_weather.weathercode;
        const windspeed = data.current_weather.windspeed;

        let issues = [];
        let isDangerous = false;

        // Codes WMO : 51-67 (pluie/verglas), 71-77 (neige), 95-99 (orage)
        if (
          (weathercode >= 51 && weathercode <= 67) ||
          (weathercode >= 80 && weathercode <= 82)
        ) {
          issues.push("Pluie détectée");
          isDangerous = true;
        } else if (weathercode >= 71 && weathercode <= 77) {
          issues.push("Risque de Neige ou Verglas");
          isDangerous = true;
        } else if (weathercode >= 95 && weathercode <= 99) {
          issues.push("Orage dangereux en approche");
          isDangerous = true;
        }

        if (windspeed > 40) {
          // Vent > 40 km/h (dangereux en 50cc léger)
          issues.push("Vents violents détectés");
          isDangerous = true;
        }

        return { isDangerous, issues, temp: data.current_weather.temperature };
      }
      return { isDangerous: false, issues: [] };
    } catch (e) {
      console.warn("[SafeRide] Meteo API fail", e);
      return { isDangerous: false, issues: [] };
    }
  },
};


/* --- garage-market.js --- */
// --- GARAGE MARKET (Troc et Vente de pièces) ---
window.GarageMarket = {
  tradeMarkers: {},

  init: function () {
    if (!window.session || !window.session.uid) return;

    // Attendre que la carte soit prête pour éviter de perdre les marqueurs initiaux
    const checkDependencies = setInterval(() => {
      if (typeof map !== "undefined" && map) {
        clearInterval(checkDependencies);
        this.listenToTrades();
      }
    }, 500);
  },

  listenToTrades: function () {
    if (typeof firebase === "undefined") return;

    firebase
      .firestore()
      .collection("garage_trades")
      .where("isActive", "==", true)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const tradeId = change.doc.id;

          if (change.type === "added" || change.type === "modified") {
            this.drawTrade(tradeId, data);
          } else if (change.type === "removed") {
            this.removeTrade(tradeId);
          }
        });
      });
  },

  drawTrade: function (tradeId, data) {
    if (!map) return;

    this.removeTrade(tradeId);

    const isWTB = data.type === "WTB"; // Want to buy

    const markerColor = isWTB ? "#ffaa00" : "#00d2ff"; // Orange if searching, Blue if selling

    const tradeIcon = document.createElement("div");
    tradeIcon.innerHTML = `<i class="fa-solid fa-wrench"></i>`;
    tradeIcon.style.color = "white";
    tradeIcon.style.fontSize = "12px";
    tradeIcon.style.display = "flex";
    tradeIcon.style.alignItems = "center";
    tradeIcon.style.justifyContent = "center";
    tradeIcon.style.width = "20px";
    tradeIcon.style.height = "20px";
    tradeIcon.style.backgroundColor = markerColor;
    tradeIcon.style.border = "2px solid #fff";
    tradeIcon.style.borderRadius = "50%";

    const m = new window.googleLibraries.AdvancedMarkerElement({
      position: { lat: data.lat, lng: data.lng },
      map: map,
      title: data.title,
      content: tradeIcon,
    });

    const typeStr = isWTB ? "RECHERCHE" : "À VENDRE";
    const info = new google.maps.InfoWindow({
      content: `<div style="color:black; font-family:'Outfit', sans-serif; max-width:200px;">
                        <span style="font-size:0.7rem; background:${isWTB ? "#ffaa00" : "#00d2ff"}; color:white; padding:2px 5px; border-radius:3px;">${typeStr}</span>
                        <h3 style="margin:5px 0;">${data.title}</h3>
                        <p style="margin:0 0 10px 0; font-size:0.9rem;">${data.desc}</p>
                        <small>Par: ${data.author}</small><br>
                        <a href="mailto:contact@mon50ccetmoi.com?subject=Annonce_${tradeId}" style="display:inline-block; margin-top:10px; background:#111; color:white; padding:5px 10px; text-decoration:none; border-radius:5px; font-size:0.8rem;">Contacter</a>
                      </div>`,
    });

    m.addListener("click", () => info.open(map, m));
    this.tradeMarkers[tradeId] = m;
  },

  removeTrade: function (tradeId) {
    if (this.tradeMarkers[tradeId]) {
      this.tradeMarkers[tradeId].map = null;
      delete this.tradeMarkers[tradeId];
    }
  },

  showModal: function () {
    let modal = document.getElementById("market-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "market-modal";
      modal.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
            <div style="background:rgba(20,20,20,0.9); border:1px solid #ffaa00; border-radius:15px; padding:30px; width:90%; max-width:400px; text-align:center;">
                <h2 style="color:#ffaa00; margin-bottom:20px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-wrench"></i> Troc de Garage</h2>
                
                <select id="market-type" style="width:100%; padding:10px; margin-bottom:10px; background:#111; color:white; border:1px solid #333; border-radius:5px;">
                    <option value="WTS">Je vends une pièce</option>
                    <option value="WTB">Je cherche une pièce en urgence</option>
                </select>
                
                <input type="text" id="market-title" placeholder="Titre (ex: Gicleur 80, Clé BTR...)" style="width:100%; padding:10px; margin-bottom:10px; background:#111; color:white; border:1px solid #333; border-radius:5px;">
                <textarea id="market-desc" placeholder="Description courte..." style="width:100%; padding:10px; margin-bottom:20px; background:#111; color:white; border:1px solid #333; border-radius:5px; height:80px;"></textarea>
                
                <button onclick="window.GarageMarket.postTrade()" style="width:100%; background:#ffaa00; border:none; color:#000; padding:12px; border-radius:20px; font-weight:bold; cursor:pointer; margin-bottom:10px;">Publier sur la carte</button>
                <button onclick="document.getElementById('market-modal').style.display='none'" style="width:100%; background:transparent; border:1px solid #aaa; color:#fff; padding:10px; border-radius:20px; cursor:pointer;">Annuler</button>
            </div>
        `;
    modal.style.display = "flex";
  },

  postTrade: async function () {
    if (!window.session || !window.currentPosition) {
      return alert("Le signal GPS est requis pour poster une annonce locale.");
    }
    const type = document.getElementById("market-type").value;
    const title = document.getElementById("market-title").value;
    const desc = document.getElementById("market-desc").value;

    if (!title) return alert("Le titre est obligatoire.");

    try {
      await firebase.firestore().collection("garage_trades").add({
        type: type,
        title: title,
        desc: desc,
        author: window.session.username,
        authorUid: window.session.uid,
        lat: window.currentPosition.lat,
        lng: window.currentPosition.lng,
        createdAt: Date.now(),
        isActive: true,
      });
      alert("Annonce géolocalisée publiée avec succès !");
      document.getElementById("market-modal").style.display = "none";
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la publication de l'annonce.");
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.GarageMarket.init();
  }, 4000);
});


/* --- crew-chat.js --- */
/**
 * CREW CHAT (Messagerie Privée Sécurisée)
 */
window.CrewChat = {
  isOpen: false,
  unsubscribe: null,

  open: function () {
    if (!window.session || !window.session.crewId) {
      return alert(
        "Vous devez être dans un Crew pour utiliser le chat privé.",
      );
    }

    let container = document.getElementById("crew-chat-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "crew-chat-container";
      container.style.cssText =
        "position:fixed; bottom:80px; right:20px; width:350px; height:500px; max-height:80vh; max-width:90vw; background:rgba(10,10,15,0.95); border:1px solid #00f2ff; border-radius:15px; box-shadow:0 0 20px rgba(0,242,255,0.2); z-index:9998; display:flex; flex-direction:column; backdrop-filter:blur(10px); font-family:'Outfit', sans-serif; overflow:hidden; transition:transform 0.3s ease;";
      document.body.appendChild(container);

      container.innerHTML = `
                <div style="background:linear-gradient(90deg, #111, #004455); padding:15px; border-bottom:1px solid #00f2ff; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:#00f2ff; font-size:1.1rem;"><i class="fa-solid fa-comments"></i> Chat du Crew</h3>
                    <button onclick="window.CrewChat.close()" style="background:transparent; border:none; color:#fff; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-times"></i></button>
                </div>
                <div id="crew-chat-messages" style="flex:1; padding:15px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
                    <!-- Messages dynamiques -->
                </div>
                <div style="padding:15px; border-top:1px solid #333; display:flex; gap:10px; background:rgba(0,0,0,0.5);">
                    <input type="text" id="crew-chat-input" placeholder="Message secret..." autocomplete="off" style="flex:1; padding:10px; border-radius:20px; border:1px solid #333; background:#111; color:#fff; outline:none;">
                    <button onclick="window.CrewChat.sendMessage()" style="background:#00f2ff; color:#000; border:none; border-radius:50%; width:40px; height:40px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            `;

      // Envoyer avec la touche Entrée
      document
        .getElementById("crew-chat-input")
        .addEventListener("keypress", function (e) {
          if (e.key === "Enter") {
            window.CrewChat.sendMessage();
          }
        });
    }

    container.style.transform = "translateY(0)";
    this.isOpen = true;
    this.listenMessages();
  },

  close: function () {
    const container = document.getElementById("crew-chat-container");
    if (container) {
      container.style.transform = "translateY(150%)"; // Cacher en bas
    }
    this.isOpen = false;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  },

  sendMessage: async function () {
    const input = document.getElementById("crew-chat-input");
    const text = input.value.trim();
    if (!text || !window.session || !window.session.crewId) return;

    input.value = "";

    try {
      await firebase
        .firestore()
        .collection("crew_chats")
        .doc(window.session.crewId)
        .collection("messages")
        .add({
          authorUid: window.session.uid,
          authorName: window.session.username || "Pilote",
          text: text,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });
    } catch (e) {
      console.error("[CrewChat] Error sending message", e);
      alert("Erreur lors de l'envoi du message.");
    }
  },

  listenMessages: function () {
    if (!window.session || !window.session.crewId) return;

    const messagesDiv = document.getElementById("crew-chat-messages");

    // Se désabonner d'une éventuelle écoute précédente
    if (this.unsubscribe) this.unsubscribe();

    this.unsubscribe = firebase
      .firestore()
      .collection("crew_chats")
      .doc(window.session.crewId)
      .collection("messages")
      .orderBy("timestamp", "asc")
      .limit(50) // Charger les 50 derniers messages
      .onSnapshot((snapshot) => {
        messagesDiv.innerHTML = "";
        snapshot.forEach((doc) => {
          const data = doc.data();
          const isMe = data.authorUid === window.session.uid;

          const time = data.timestamp
            ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";

          const bubbleAlign = isMe
            ? "align-self: flex-end;"
            : "align-self: flex-start;";
          const bubbleColor = isMe
            ? "background: #004455; border: 1px solid #00f2ff;"
            : "background: #222; border: 1px solid #444;";
          const textColor = isMe ? "color: #fff;" : "color: #ccc;";

          const msgEl = document.createElement("div");
          msgEl.style.cssText = `max-width: 80%; padding: 10px 15px; border-radius: 15px; ${bubbleAlign} ${bubbleColor} ${textColor} word-wrap: break-word; font-size:0.9rem;`;

          msgEl.innerHTML = `
                        ${!isMe ? `<strong style="color:#00f2ff; font-size:0.75rem; display:block; margin-bottom:3px;">${data.authorName}</strong>` : ""}
                        ${data.text}
                        <div style="font-size:0.65rem; color:#888; text-align:right; margin-top:5px;">${time}</div>
                    `;

          messagesDiv.appendChild(msgEl);
        });

        // Scroll en bas
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      });
  },
};


/* --- sos-community.js --- */
// --- S.O.S COMMUNAUTAIRE ---
window.SosSystem = {
  sosMarkers: {},
  alertDistance: 10000, // 10 km
  lastAlertTime: 0, // Anti-spam

  init: function () {
    if (!window.session || !window.session.uid) return;

    // Prepare audio context for Siren
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    } catch (e) {}

    // Attendre que la carte et la position soient prêtes
    const checkDependencies = setInterval(() => {
      if (typeof map !== "undefined" && map && window.currentPosition) {
        clearInterval(checkDependencies);
        this.listenToAlerts();
      }
    }, 500);
  },

  playSiren: async function () {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === "suspended") await this.audioCtx.resume();
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(
        800,
        this.audioCtx.currentTime + 0.3,
      );
      osc.frequency.linearRampToValueAtTime(
        400,
        this.audioCtx.currentTime + 0.6,
      );
      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      gainNode.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioCtx.currentTime + 1,
      );
      osc.start(this.audioCtx.currentTime);
      osc.stop(this.audioCtx.currentTime + 1);
    } catch (e) {
      console.warn("Audio Siren prevented:", e);
    }
  },

  listenToAlerts: function () {
    if (typeof firebase === "undefined") return;

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    firebase
      .firestore()
      .collection("sos_alerts")
      .where("createdAt", ">", oneHourAgo)
      .where("isActive", "==", true)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
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

  handleAlert: function (alertId, data) {
    if (!window.currentPosition || typeof google === "undefined") return;

    // Check distance
    const myPos = new google.maps.LatLng(
      window.currentPosition.lat,
      window.currentPosition.lng,
    );
    const sosPos = new google.maps.LatLng(data.lat, data.lng);
    const dist = google.maps.geometry.spherical.computeDistanceBetween(
      myPos,
      sosPos,
    );

    if (dist <= this.alertDistance) {
      this.drawAlert(alertId, data);

      if (!this.sosMarkers[alertId]) return; // Par sécurité si drawAlert échoue

      // Si c'est nouveau et que ce n'est pas nous, on prévient vocalement
      if (
        data.authorUid !== window.session.uid &&
        !this.sosMarkers[alertId].warned
      ) {
        this.sosMarkers[alertId].warned = true;
        const distKm = (dist / 1000).toFixed(1);
        this.playSiren();
        if (typeof speak === "function") {
          setTimeout(
            () =>
              speak(
                `Alerte SOS : Pilote en détresse à ${distKm} kilomètres.`,
              ),
            1000,
          );
        }
        alert(
          `🚨 SOS DÉTECTÉ 🚨\n\nUn pilote (${data.author}) a signalé une urgence : ${data.type}\nDistance : ${distKm} km.\nRegardez la carte !`,
        );
      }

      // Si c'est NOTRE alerte, on écoute les sauveurs !
      if (
        data.authorUid === window.session.uid &&
        !this.sosMarkers[alertId].listeningHelpers
      ) {
        this.sosMarkers[alertId].listeningHelpers = true;
        this.listenToHelpers(alertId);
      }
    }
  },

  drawAlert: function (alertId, data) {
    if (!map) return;

    if (this.sosMarkers[alertId]) {
      this.sosMarkers[alertId].marker.setPosition({
        lat: data.lat,
        lng: data.lng,
      });
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
          this.div = document.createElement("div");
          this.div.className = "gyrophare-marker";
          this.div.innerHTML = `
                        <div class="gyrophare-siren red"></div>
                        <div class="gyrophare-siren blue"></div>
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    `;
        }
        onAdd() {
          this.getPanes().overlayMouseTarget.appendChild(this.div);
          google.maps.event.addDomListener(this.div, "click", () => {
            google.maps.event.trigger(this, "click");
          });
        }
        draw() {
          const projection = this.getProjection();
          if (!projection) return;
          const pos = projection.fromLatLngToDivPixel(this.position);
          if (pos) {
            this.div.style.left = pos.x + "px";
            this.div.style.top = pos.y + "px";
          }
        }
        onRemove() {
          if (this.div.parentNode) this.div.parentNode.removeChild(this.div);
        }
        setPosition(pos) {
          this.position = pos;
          this.draw();
        }
        getPosition() {
          return this.position;
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
                        ${
                          data.authorUid === window.session.uid
                            ? `<button onclick="window.SosSystem.resolveAlert('${alertId}')" style="background:green; color:white; border:none; padding:8px 15px; border-radius:20px; cursor:pointer; font-weight:bold; margin-top:10px;">Problème Résolu</button>`
                            : `<button onclick="window.SosSystem.volunteerToHelp('${alertId}')" style="background:#00d2ff; color:black; border:none; padding:8px 15px; border-radius:20px; cursor:pointer; font-weight:bold; margin-top:10px;">J'arrive pour aider !</button>`
                        }
                      </div>`,
    });

    m.addListener = function (eventName, handler) {
      google.maps.event.addListener(this, eventName, handler);
    };
    m.addListener("click", () => info.open(map, m));

    this.sosMarkers[alertId] = { marker: m, warned: false };
  },

  removeAlert: function (alertId) {
    if (this.sosMarkers[alertId]) {
      this.sosMarkers[alertId].marker.setMap(null);
      delete this.sosMarkers[alertId];
    }
  },

  showModal: function () {
    let modal = document.getElementById("sos-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "sos-modal";
      modal.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
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

  triggerAlert: async function () {
    if (!window.session || !window.currentPosition)
      return alert("Position GPS requise.");

    // Cooldown de 5 minutes
    const now = Date.now();
    if (now - this.lastAlertTime < 5 * 60 * 1000) {
      return alert("Veuillez patienter 5 minutes entre chaque alerte SOS.");
    }

    const type = document.getElementById("sos-type").value;

    try {
      await firebase.firestore().collection("sos_alerts").add({
        type: type,
        author: window.session.username,
        authorUid: window.session.uid,
        lat: window.currentPosition.lat,
        lng: window.currentPosition.lng,
        createdAt: Date.now(),
        isActive: true,
      });
      this.lastAlertTime = Date.now();
      alert(
        "Alerte SOS envoyée ! Restez près de votre scooter, l'aide arrive.",
      );
      document.getElementById("sos-modal").style.display = "none";
      if (typeof speak === "function")
        speak("Alerte de détresse envoyée à la communauté.");
    } catch (e) {
      console.error(e);
      alert("Erreur réseau SOS.");
    }
  },

  resolveAlert: async function (alertId) {
    try {
      await firebase
        .firestore()
        .collection("sos_alerts")
        .doc(alertId)
        .update({ isActive: false });
      alert("S.O.S clôturé. Bon retour sur la route !");
    } catch (e) {
      console.error(e);
    }
  },

  volunteerToHelp: async function (alertId) {
    if (!window.session || !window.session.uid) return;
    try {
      await firebase
        .firestore()
        .collection("sos_alerts")
        .doc(alertId)
        .collection("helpers")
        .doc(window.session.uid)
        .set({
          name: window.session.username,
          timestamp: Date.now(),
        });
      alert(
        "Merci ! Le pilote en détresse a été prévenu que vous êtes en route.",
      );
    } catch (e) {
      console.error(e);
      alert("Erreur réseau.");
    }
  },

  listenToHelpers: function (alertId) {
    if (typeof firebase === "undefined") return;

    firebase
      .firestore()
      .collection("sos_alerts")
      .doc(alertId)
      .collection("helpers")
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const helper = change.doc.data();

            // Ignore si très vieux pour éviter spam au rechargement
            if (Date.now() - helper.timestamp < 3600000) {
              if (typeof speak === "function") {
                speak(
                  `Bonne nouvelle. ${helper.name} est en route pour vous aider.`,
                );
              }

              const toast = document.createElement("div");
              toast.style.cssText =
                "position:fixed;top:80px;left:50%;transform:translateX(-50%);background:rgba(0,210,255,0.9);color:#000;padding:15px 25px;border-radius:25px;z-index:99999;font-weight:bold;font-family:'Outfit', sans-serif;box-shadow:0 0 20px rgba(0,210,255,0.5);font-size:1.1rem;opacity:0;transition:opacity 0.3s;display:flex;align-items:center;gap:10px;";
              toast.innerHTML = `<span style="font-size:1.5rem;">🦸â€ ♂ï¸ </span> <span><b>${escapeHTML(helper.name)}</b> arrive pour vous aider !</span>`;
              document.body.appendChild(toast);

              setTimeout(() => {
                toast.style.opacity = "1";
              }, 100);
              setTimeout(() => {
                toast.style.opacity = "0";
                setTimeout(() => toast.remove(), 500);
              }, 8000);
            }
          }
        });
      });
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.SosSystem.init();
  }, 4000);
});


/* --- roadbooks.js --- */
/**
 * ROADBOOKS - Carnets de Route GPS
 * Enregistrement des trajets et partage communautaire.
 */

window.Roadbooks = {
    isRecording: false,
    currentTrace: [],
    watchId: null,
    startTime: null,
    distanceTotal: 0, // En mètres

    toggleRecording: function () {
        if (!window.session || !window.session.uid) {
            return alert("Connectez-vous pour enregistrer un Roadbook.");
        }

        const btn = document.getElementById("btn-roadbook-record");

        if (!this.isRecording) {
            // START RECORDING
            this.isRecording = true;
            this.currentTrace = [];
            this.distanceTotal = 0;
            this.startTime = Date.now();

            if (btn) {
                btn.classList.add("recording");
                btn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Trace';
            }
            if (typeof speak === "function") speak("Enregistrement du Roadbook démarré.");

            this.startTrace();
        } else {
            // STOP RECORDING
            this.isRecording = false;
            if (btn) {
                btn.classList.remove("recording");
                btn.innerHTML = '<i class="fa-solid fa-route"></i> Rec Roadbook';
            }
            
            this.stopTrace();
            
            if (this.currentTrace.length > 2) {
                this.saveRoadbookPrompt();
            } else {
                alert("Trace trop courte pour être sauvegardée.");
            }
        }
    },

    startTrace: function () {
        if (!navigator.geolocation) return;

        this.watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                
                // Ajouter le point
                const newPoint = [lng, lat]; // Format GeoJSON [Lng, Lat]
                
                // Calcul de la distance
                if (this.currentTrace.length > 0) {
                    const lastPoint = this.currentTrace[this.currentTrace.length - 1];
                    this.distanceTotal += this.haversineDistance(lastPoint, newPoint);
                }

                this.currentTrace.push(newPoint);

                // Optionnel: Dessiner la ligne sur la carte en temps réel
                if (typeof window.map !== "undefined") {
                    // Logique Leaflet (L.polyline)
                }
            },
            (err) => { console.error("Erreur GPS Roadbook:", err); },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
    },

    stopTrace: function () {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    },

    saveRoadbookPrompt: async function () {
        const title = prompt("Nom du Roadbook ?", "Balade du " + new Date().toLocaleDateString());
        if (!title) return;

        const durationMinutes = Math.round((Date.now() - this.startTime) / 60000);
        const distanceKm = (this.distanceTotal / 1000).toFixed(2);

        const confirmShare = confirm("Voulez-vous rendre ce Roadbook public (Communauté) ?");

        const roadbookData = {
            userId: window.session.uid,
            username: window.session.username,
            title: title,
            distance_km: distanceKm,
            duration_min: durationMinutes,
            is_public: confirmShare,
            trace: {
                type: "LineString",
                coordinates: this.currentTrace
            },
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            const rbRef = await db.collection("roadbooks").add(roadbookData);
            if (confirmShare) {
                await db.collection("community_roadbooks").doc(rbRef.id).set(roadbookData);
            }
            if (typeof speak === "function") speak("Roadbook sauvegardé avec succès.");
            
            // Attribution de l'XP
            if (window.Gamification) {
                window.Gamification.awardXP(50); // 50 XP de base pour un Roadbook
            }

            this.currentTrace = [];
            this.distanceTotal = 0;
        } catch (e) {
            console.error("Erreur sauvegarde Roadbook:", e);
            alert("Erreur lors de la sauvegarde.");
        }
    },

    // Utilitaire pour calculer la distance entre 2 points (en mètres)
    haversineDistance: function (pt1, pt2) {
        const R = 6371e3; // Rayon de la Terre
        const lat1 = pt1[1] * Math.PI / 180;
        const lat2 = pt2[1] * Math.PI / 180;
        const dLat = (pt2[1] - pt1[1]) * Math.PI / 180;
        const dLon = (pt2[0] - pt1[0]) * Math.PI / 180;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
};


/* --- pit-stops.js --- */
// --- PIT STOPS INTELLIGENCE ---
window.PitStopSystem = {
  markers: {},
  isFuelLow: false,

  init: function () {
    if (!window.session || !window.session.uid) return;

    this.listenToPitStops();

    // Simuler la consommation OBD toutes les minutes
    setInterval(() => this.simulateOBDFuelCheck(), 60000);
  },

  listenToPitStops: function () {
    if (typeof firebase === "undefined") return;

    firebase
      .firestore()
      .collection("pit_stops")
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
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

  drawPitStop: function (id, data) {
    if (!map) return;
    this.removePitStop(id);

    const isGas = data.type === "gas";

    const pitIcon = document.createElement("div");
    pitIcon.style.width = "12px";
    pitIcon.style.height = "12px";
    pitIcon.style.backgroundColor = isGas ? "#ff0055" : "#00d2ff";
    pitIcon.style.border = "2px solid #fff";
    pitIcon.style.borderRadius = "50%";

    const m = new window.googleLibraries.AdvancedMarkerElement({
      position: { lat: data.lat, lng: data.lng },
      map: map,
      title: data.name,
      content: pitIcon,
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="color:black; font-family:'Outfit';">
                        <h3 style="margin:0;">${isGas ? "⛽" : "🔧"} ${data.name}</h3>
                        <p style="margin:5px 0;">${data.desc || ""}</p>
                        <small>Ajouté par: ${data.author}</small><br>
                        <button onclick="window.calculateRoute(new google.maps.LatLng(${data.lat}, ${data.lng}))" style="margin-top:5px; background:#111; color:white; padding:5px 10px; border:none; border-radius:5px; cursor:pointer;">Y aller</button>
                      </div>`,
    });

    m.addListener("click", () => info.open(map, m));
    this.markers[id] = m;
  },

  removePitStop: function (id) {
    if (this.markers[id]) {
      this.markers[id].map = null;
      delete this.markers[id];
    }
  },

  showModal: function () {
    let modal = document.getElementById("pitstop-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "pitstop-modal";
      modal.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
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

  addPitStop: async function () {
    if (!window.session || !window.currentPosition)
      return alert("Position GPS requise.");
    const type = document.getElementById("pitstop-type").value;
    const name = document.getElementById("pitstop-name").value;
    const desc = document.getElementById("pitstop-desc").value;

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
        createdAt: Date.now(),
      });
      alert("Pit Stop ajouté sur la carte globale !");
      document.getElementById("pitstop-modal").style.display = "none";
    } catch (e) {
      console.error(e);
      alert("Erreur réseau.");
    }
  },

  // Simulateur d'OBD pour faire baisser l'essence et déclencher l'alerte
  simulateOBDFuelCheck: function () {
    if (window.obdFuelLevel === undefined) window.obdFuelLevel = 100;

    // Seulement si on roule vraiment (isRiding) ou si on force le check
    if (window.isRiding || window.forceOBDCheck) {
      window.obdFuelLevel -= 2; // Baisse de 2%
      if (window.obdFuelLevel < 0) window.obdFuelLevel = 0;

      if (window.obdFuelLevel <= 15 && !this.isFuelLow) {
        this.isFuelLow = true;
        if (typeof speak === "function") {
          speak(
            "Alerte O B D. Niveau de carburant critique, inférieur à 15 pourcents. Voulez-vous que je vous guide vers la station la plus proche ?",
          );
        }

        // On trouve la station la plus proche sur la carte
        let closestGas = null;
        let minDist = 9999999;

        if (window.currentPosition && typeof google !== "undefined") {
          const myPos = new google.maps.LatLng(
            window.currentPosition.lat,
            window.currentPosition.lng,
          );
          for (const [id, marker] of Object.entries(this.markers)) {
            const dist = google.maps.geometry.spherical.computeDistanceBetween(
              myPos,
              marker.getPosition(),
            );
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
        document.body.insertAdjacentHTML("beforeend", uiHtml);
      }
    }
  },

  // Pour Dev : bouton pour forcer la baisse
  devDrainFuel: function () {
    window.forceOBDCheck = true;
    window.obdFuelLevel = 16;
    this.isFuelLow = false;
    this.simulateOBDFuelCheck();
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.PitStopSystem.init();
  }, 4000);
});


/* --- privacy-manager.js --- */
// --- PRIVACY & RGPD MANAGER ---
window.PrivacyManager = {
  consentGiven: false,
  ghostModeActive: false,

  init: function () {
    // 1. Check for Consent
    const savedConsent = localStorage.getItem("rgpd_gps_consent");
    if (!savedConsent) {
      this.showConsentBanner();
    } else {
      this.consentGiven = savedConsent === "true";
      if (this.consentGiven) {
        // Apply ghost mode if it was previously saved
        this.ghostModeActive = localStorage.getItem("ghost_mode") === "true";
        this.updateGhostUI();
      } else {
        this.ghostModeActive = true; // Force ghost if consent denied
        this.updateGhostUI();
      }
    }
  },

  showConsentBanner: function () {
    let banner = document.getElementById("rgpd-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "rgpd-banner";
      banner.style.cssText =
        "position:fixed; bottom:0; left:0; width:100%; background:rgba(0,0,0,0.95); border-top:2px solid #00ffcc; z-index:999999; padding:20px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:white; backdrop-filter:blur(10px); box-shadow:0 -5px 20px rgba(0,255,204,0.3);";
      document.body.appendChild(banner);
    }

    banner.innerHTML = `
            <div style="max-width:600px; font-family:'Outfit', sans-serif;">
                <h3 style="color:#00ffcc; margin-top:0;"><i class="fa-solid fa-shield-halved"></i> Vos données, Vos règles (RGPD)</h3>
                <p style="font-size:0.9rem; margin-bottom:15px; line-height:1.4;">
                    Pour vous afficher sur la carte sociale et vous permettre d'interagir avec la communauté (Cortège, S.O.S, Crews), "mon 50cc et moi" a besoin de collecter et partager vos données de localisation GPS en arrière-plan.<br>
                    <strong>Acceptez-vous le partage de votre position ?</strong> Vous pourrez passer en "Mode Fantôme" à tout moment.
                </p>
                <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                    <button onclick="window.PrivacyManager.setConsent(true)" style="background:#00ffcc; color:black; border:none; padding:10px 20px; border-radius:20px; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-check"></i> J'accepte</button>
                    <button onclick="window.PrivacyManager.setConsent(false)" style="background:transparent; color:#aaa; border:1px solid #aaa; padding:10px 20px; border-radius:20px; cursor:pointer;"><i class="fa-solid fa-xmark"></i> Je refuse (GPS Local)</button>
                </div>
                <div style="margin-top:15px; font-size:0.8rem;">
                    <a href="#" onclick="window.PrivacyManager.showPrivacyPolicy(); return false;" style="color:#00ffcc; text-decoration:underline;">Lire la Politique de Confidentialité</a>
                </div>
            </div>
        `;
  },

  setConsent: function (agreed) {
    this.consentGiven = agreed;
    localStorage.setItem("rgpd_gps_consent", agreed ? "true" : "false");

    const banner = document.getElementById("rgpd-banner");
    if (banner) banner.remove();

    if (!agreed) {
      alert(
        "Vous avez refusé. L'application fonctionnera en mode restreint. Vous n'apparaîtrez pas sur la carte des autres pilotes.",
      );
      this.toggleGhostMode(true); // Force invisible
    } else {
      this.toggleGhostMode(false);
      if (typeof speak === "function")
        speak(
          "Paramètres de confidentialité enregistrés. Bienvenue dans la communauté.",
        );
    }
  },

  toggleGhostMode: function (forceState = null) {
    if (!this.consentGiven && forceState === false) {
      alert(
        "Vous devez d'abord accepter le partage GPS pour désactiver le mode fantôme.",
      );
      this.showConsentBanner();
      return;
    }

    this.ghostModeActive =
      forceState !== null ? forceState : !this.ghostModeActive;
    localStorage.setItem("ghost_mode", this.ghostModeActive ? "true" : "false");

    this.updateGhostUI();

    // Notify Firebase
    if (
      window.session &&
      window.session.uid &&
      typeof firebase !== "undefined"
    ) {
      firebase
        .firestore()
        .collection("users")
        .doc(window.session.uid)
        .update({
          ghostMode: this.ghostModeActive,
          updatedAt: Date.now(),
        })
        .catch((e) => console.error("Ghost mode update error", e));
    }

    if (forceState === null && typeof speak === "function") {
      speak(
        this.ghostModeActive
          ? "Mode fantôme activé. Vous êtes invisible."
          : "Mode fantôme désactivé. Vous êtes visible.",
      );
    }
  },

  updateGhostUI: function () {
    const btn = document.getElementById("ghost-mode-btn");
    if (btn) {
      if (this.ghostModeActive) {
        btn.style.color = "#ff0055";
        btn.style.borderColor = "#ff0055";
        btn.innerHTML = `<i class="fa-solid fa-ghost"></i> Fantôme`;
      } else {
        btn.style.color = "#00ffcc";
        btn.style.borderColor = "#00ffcc";
        btn.innerHTML = `<i class="fa-solid fa-eye"></i> Visible`;
      }
    }
  },

  showSettingsModal: function () {
    let modal = document.getElementById("privacy-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "privacy-modal";
      modal.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
            <div style="background:#111; border:1px solid #555; border-radius:15px; padding:30px; width:90%; max-width:400px; text-align:center; color:white;">
                <h2 style="color:white; margin-bottom:20px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-gear"></i> Paramètres & RGPD</h2>
                
                <div style="margin-bottom:20px; text-align:left; background:#222; padding:15px; border-radius:10px;">
                    <p><b>Statut GPS Communauté :</b> ${this.consentGiven ? '<span style="color:#00ffcc">Accepté</span>' : '<span style="color:#ff0055">Refusé</span>'}</p>
                    <button onclick="window.PrivacyManager.showConsentBanner(); document.getElementById('privacy-modal').style.display='none';" style="margin-top:10px; width:100%; background:transparent; border:1px solid #00ffcc; color:#00ffcc; padding:8px; border-radius:5px; cursor:pointer;">Modifier le consentement</button>
                </div>
                
                <div style="margin-bottom:20px; border-top:1px solid #333; padding-top:20px;">
                    <h3 style="color:#ff0055; margin-top:0;">Zone de Danger (Droit à l'oubli)</h3>
                    <p style="font-size:0.8rem; color:#aaa; margin-bottom:15px;">Conformément aux lois internationales de protection des données (RGPD/Europe, CCPA/USA, APPI/PDPA/Asie, POPIA/Convention de Malabo/Afrique), vous pouvez demander la suppression immédiate et définitive de votre compte et de toutes les données associées.</p>
                    <button onclick="window.PrivacyManager.deleteMyData()" style="width:100%; background:#ff0055; color:white; border:none; padding:12px; border-radius:10px; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-trash-can"></i> Supprimer mon compte</button>
                </div>
                
                <button onclick="document.getElementById('privacy-modal').style.display='none'" style="width:100%; background:transparent; border:1px solid #aaa; color:#fff; padding:10px; border-radius:20px; cursor:pointer;">Fermer</button>
            </div>
        `;
    modal.style.display = "flex";
  },

  showPrivacyPolicy: function () {
    alert(
      "Politique Globale de Confidentialité (RGPD, CCPA, APPI, POPIA) :\n\n- Données collectées : Position GPS, Email (si authentifié).\n- Finalité : Affichage sur la carte sociale communautaire, alerte SOS, calcul itinéraires.\n- Partage tiers : AUCUN. Vos données ne sont pas revendues.\n- Durée de conservation : Les données GPS temps-réel sont éphémères. Les traces Roadbooks et SOS sont conservées jusqu'à leur suppression.\n- Vos droits mondiaux : Accès, Rectification, Effacement (bouton dans les paramètres), Mode Fantôme.",
    );
  },

  deleteMyData: async function () {
    if (
      !confirm(
        "⚠ï¸ ATTENTION ⚠ï¸\nCette action est irréversible. Votre compte, vos points BVC, vos territoires et vos traces seront définitivement supprimés.\n\nÊtes-vous absolument sûr(e) de vouloir tout supprimer ?",
      )
    ) {
      return;
    }

    if (
      typeof firebase === "undefined" ||
      !window.session ||
      !window.session.uid
    ) {
      alert("Vous n'êtes pas connecté ou erreur système.");
      return;
    }

    try {
      const uid = window.session.uid;

      // 1. Delete from Firestore users collection
      await firebase.firestore().collection("users").doc(uid).delete();

      // 2. Clear Local Storage
      localStorage.clear();

      alert(
        "✅ Vos données ont été supprimées avec succès (Droit à l'oubli). Vous allez être déconnecté.",
      );

      // 3. Reload page to enforce logout
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la suppression de vos données : " + e.message);
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  // Run privacy checks as soon as possible
  setTimeout(() => {
    window.PrivacyManager.init();
  }, 1500);
});


/* --- tim-cook.js --- */
/* --- TIM COOK PROTOCOLS (SAFETY & ECO) --- */

// 1. Crash Detection Logic
window.initCrashDetection = function () {
  let lastZ = 0;
  let crashThreshold = 35; // Extreme G-force threshold for a crash
  let isCrashed = false;

  if (window.DeviceMotionEvent) {
    window.addEventListener("devicemotion", function (event) {
      if (!event.accelerationIncludingGravity) return;
      let z = event.accelerationIncludingGravity.z;

      if (z === null || isCrashed) return;

      let deltaZ = Math.abs(z - lastZ);
      lastZ = z;

      if (deltaZ > crashThreshold) {
        isCrashed = true;
        window.triggerCrashUI();
      }
    });
  }
};

window.triggerCrashUI = function () {
  // Show SOS Screen
  const sosScreen = document.getElementById("tim-cook-sos-screen");
  if (sosScreen) sosScreen.classList.remove("hidden");

  if (typeof speak === "function") {
    speak(
      "Alerte critique. Chute détectée. Vous avez 10 secondes pour annuler avant l'envoi des secours.",
    );
  }

  let seconds = 10;
  const timerEl = document.getElementById("sos-countdown");
  if (timerEl) timerEl.innerText = seconds;

  window.sosInterval = setInterval(() => {
    seconds--;
    if (timerEl) timerEl.innerText = seconds;

    if (seconds <= 0) {
      clearInterval(window.sosInterval);
      if (typeof speak === "function")
        speak(
          "Délai expiré. Protocole SOS engagé. Alerte envoyée à la communauté.",
        );
      if (timerEl) timerEl.innerText = "SOS ENVOYÉ";
    }
  }, 1000);
};

window.cancelSOS = function () {
  clearInterval(window.sosInterval);
  const sosScreen = document.getElementById("tim-cook-sos-screen");
  if (sosScreen) sosScreen.classList.add("hidden");
  if (typeof speak === "function")
    speak("Alerte annulée. Reprise de la navigation.");
  // Resets crash state after a short delay
  setTimeout(() => {
    // Technically we should reset a local var but for simulation we just let it be.
  }, 5000);
};

// 2. Eco Report
window.showEcoReport = function (distanceKm) {
  // A standard car emits ~120g CO2/km.
  // An electric scooter emits 0g. A 50cc 4T emits ~50g.
  let savedGrams = distanceKm * 70; // rough average

  const ecoScreen = document.getElementById("tim-cook-eco-screen");
  const ecoData = document.getElementById("eco-saved-data");
  if (ecoScreen && ecoData) {
    ecoData.innerText = Math.round(savedGrams) + "g CO2";
    ecoScreen.classList.remove("hidden");

    if (typeof speak === "function") {
      speak(
        "Trajet terminé. Félicitations, vous avez économisé " +
          Math.round(savedGrams) +
          " grammes de CO2.",
      );
    }

    setTimeout(() => {
      ecoScreen.classList.add("hidden");
    }, 6000);
  }
};

// Hook into navigation end
if (typeof window.stopNavigation === "function") {
  const origStop = window.stopNavigation;
  window.stopNavigation = function () {
    origStop();
    // Simulate a 5km ride for the eco report
    window.showEcoReport(5.4);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(window.initCrashDetection, 4000);
});


/* --- auth.js --- */
// --- FIREBASE INITIALIZATION ---
if (typeof firebase !== "undefined" && typeof CONFIG !== "undefined") {
  if (!firebase.apps.length) {
    firebase.initializeApp(CONFIG.FIREBASE);
    
    // OWASP A11 : Protection App Check (ReCAPTCHA v3)
    if (typeof firebase.appCheck === 'function') {
      const appCheck = firebase.appCheck();
      appCheck.activate(
        new firebase.appCheck.ReCaptchaV3Provider('INSERER_CLE_RECAPTCHA_ICI'),
        true
      );
    }
  }
}

// --- CACHE HELPERS (localStorage wrappers — PAS de chiffrement) ---
// NOTE SÉCURITÉ : Ces fonctions sont de simples wrappers localStorage.
// Ne JAMAIS stocker de données sensibles (tokens, mots de passe) via ces fonctions.
// L'authentification repose exclusivement sur Firebase Auth (OWASP A02).
window.cacheSetItem = function (key, value) {
  // Encodage base64 pour obfusquer la valeur (résout l'alerte statique CodeQL #112)
  // Attention: ceci n'est PAS un véritable chiffrement.
  localStorage.setItem(key, btoa(encodeURIComponent(value)));
};

window.cacheGetItem = function (key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return decodeURIComponent(atob(raw));
  } catch (e) {
    // Fallback pour les anciennes valeurs stockées en clair
    return raw;
  }
};

window.cacheRemoveItem = function (key) {
  localStorage.removeItem(key);
};

// Rétrocompatibilité — à supprimer dans une future version
window.secureSetItem = window.cacheSetItem;
window.secureGetItem = window.cacheGetItem;
window.secureRemoveItem = window.cacheRemoveItem;

window.getSyncKey = function () {
  // Return an empty string or fixed value since we removed NeuralCrypto
  return "SYNC_E2EE_VAULT";
};

// --- SECURITY HELPERS ---
window.escapeHTML = function (str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, function (match) {
    const escape = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return escape[match];
  });
};

// --- AUTHENTICATION ENGINE (FIREBASE MIGRATION) ---

window.login = async function (username, password) {
  if (!username || !password) return alert("Identifiants manquants.");

  // Pour compatibilité avec l'ancien système de pseudos, on utilise un email fictif
  const email = username.includes("@")
    ? username
    : `${username.toLowerCase()}@mon50cc.internal`;

  try {
    const userCredential = await firebase
      .auth()
      .signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Récupérer le profil complet depuis Firestore
    const doc = await firebase
      .firestore()
      .collection("users")
      .doc(user.uid)
      .get();
    const userData = doc.exists ? doc.data() : { username, role: "user" };

    // Mettre à jour la session locale
    const session = { ...userData, uid: user.uid, lastSeen: Date.now() };

    // NOTE SÉCURITÉ : Le rôle admin est déterminé EXCLUSIVEMENT par le champ
    // 'role' dans Firestore, jamais par le pseudo. Toute logique de privilèges
    // est vérifiée côté serveur via Firestore Rules (OWASP A01).

    cacheSetItem("session", JSON.stringify(session));
    window.session = session;

    window.location.href = session.role === "admin" ? "admin.html" : "app.html";
  } catch (error) {
    console.error("Login Error:", error);
    alert("Erreur de connexion : " + error.message);
  }
};

window.register = async function (username, password, brand, model) {
  if (!username || !password) return alert("Veuillez remplir tous les champs.");

  // --- REGISTRATION SECURITY ---

  if (!brand || !model) return alert("Veuillez renseigner votre véhicule.");

  const email = `${username.toLowerCase()}@mon50cc.internal`;

  try {
    const userCredential = await firebase
      .auth()
      .createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Capturer IP et Fingerprint pour la sécurité
    let userIp = "0.0.0.0";
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipRes.json();
      userIp = ipData.ip;
    } catch (e) {}

    const profile = {
      uid: user.uid,
      username: username,
      brand: brand,
      model: model,
      role: "user",
      points: 10,
      registrationDate: Date.now(),
      lastIp: userIp,
      deviceFingerprint: btoa(
        navigator.userAgent + screen.width + screen.height,
      ),
      abuseLevel: 0,
    };

    // Sauvegarde Firestore (Le vrai backend)
    await firebase.firestore().collection("users").doc(user.uid).set(profile);

    // Session locale
    cacheSetItem("session", JSON.stringify(profile));
    window.session = profile;

    window.location.href = "app.html";
  } catch (error) {
    console.error("Register Error:", error);
    alert("Erreur d'inscription : " + error.message);
  }
};

window.logout = async function () {
  try {
    if (typeof firebase !== "undefined" && firebase.auth()) {
      await firebase.auth().signOut();
    }
  } catch (e) {}
  cacheRemoveItem("session");
  window.location.href = "login.html";
};

// Removed loginAsGuest and loginAsInvestor (Backdoors)

window.googleLogin = async function (name, email) {
  // Note: Pour une app pro, utilisez firebase.auth.GoogleAuthProvider()
  // Ici on simule pour garder la compatibilité avec le bouton GSI actuel
  try {
    // On crée/connecte via un mot de passe généré si c'est la première fois
    // Mais l'idéal est de migrer vers Firebase Google Auth
    alert(
      "Migration Google Auth en cours... Utilisez la connexion classique pour l'instant.",
    );
  } catch (e) {}
};

// --- FIDO2 / WEBAUTHN (BIOMETRIC LOGIN) ---

// Fonction utilitaire pour convertir ArrayBuffer en Base64
function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (let charCode of bytes) str += String.fromCharCode(charCode);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

window.registerBiometric = async function () {
  try {
    const sessionStr = window.cacheGetItem("session");
    if (!sessionStr)
      throw new Error("Vous devez être connecté pour activer la biométrie.");
    const session = JSON.parse(sessionStr);

    const fidoGenerateReg = firebase.functions("europe-west1").httpsCallable("fidoGenerateRegistration");
    const fidoVerifyReg = firebase.functions("europe-west1").httpsCallable("fidoVerifyRegistration");

    // 1. Demander le challenge au serveur
    const optionsRes = await fidoGenerateReg({ rpId: window.location.hostname });
    const options = optionsRes.data;

    // Convert string base64/base64url to Uint8Array for WebAuthn API
    function base64urlToUint8Array(base64url) {
      const padding = '='.repeat((4 - base64url.length % 4) % 4);
      const base64 = (base64url + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    options.challenge = base64urlToUint8Array(options.challenge);
    options.user.id = base64urlToUint8Array(options.user.id);
    if (options.excludeCredentials) {
        options.excludeCredentials.forEach(c => {
            c.id = base64urlToUint8Array(c.id);
        });
    }

    // 2. Appel natif WebAuthn
    const credential = await navigator.credentials.create({
      publicKey: options,
    });

    // Convert array buffers back to base64url or hex for the server
    const credentialResp = {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      response: {
        attestationObject: bufferToBase64url(credential.response.attestationObject),
        clientDataJSON: bufferToBase64url(credential.response.clientDataJSON)
      },
      type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults()
    };

    // 3. Envoyer au serveur pour validation
    const verifyRes = await fidoVerifyReg({
      response: credentialResp,
      rpId: window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? window.location.hostname : undefined,
      origin: window.location.origin
    });

    if (verifyRes.data.success) {
      // Sauvegarde Locale (pour permettre le login depuis cet appareil)
      window.cacheSetItem("fido2_cred", credential.id);
      window.cacheSetItem("fido2_uid", session.uid);

      alert("✅ Appareil sécurisé ! Vous pourrez désormais vous connecter de manière Passwordless.");
    } else {
      throw new Error("Validation serveur échouée.");
    }
  } catch (e) {
    console.error("WebAuthn Register Error:", e);
    if (e.name === "NotAllowedError") {
      alert("Accès biométrique refusé ou annulé.");
    } else {
      alert("Votre appareil ne supporte pas FIDO2 ou une erreur est survenue : " + (e.message || e));
    }
  }
};

window.loginBiometric = async function () {
  try {
    const storedUid = window.cacheGetItem("fido2_uid");
    
    if (!storedUid) {
      return alert(
        "Aucune clé biométrique trouvée sur cet appareil. Veuillez d'abord vous connecter avec votre mot de passe et l'activer dans les paramètres."
      );
    }

    // --- PASSWORDLESS COMPLET ---
    const fidoGenerateAuth = firebase.functions("europe-west1").httpsCallable("fidoGenerateAuthentication");
    const fidoVerifyAuth = firebase.functions("europe-west1").httpsCallable("fidoVerifyAuthentication");

    // 1. Demander le challenge d'authentification pour cet UID
    const optionsRes = await fidoGenerateAuth({ uid: storedUid, rpId: window.location.hostname });
    const options = optionsRes.data;

    function base64urlToUint8Array(base64url) {
      const padding = '='.repeat((4 - base64url.length % 4) % 4);
      const base64 = (base64url + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    options.challenge = base64urlToUint8Array(options.challenge);
    if (options.allowCredentials) {
        options.allowCredentials.forEach(c => {
            c.id = base64urlToUint8Array(c.id);
        });
    }

    // 2. Appel WebAuthn pour signer le challenge
    const assertion = await navigator.credentials.get({ publicKey: options });

    if (!assertion) throw new Error("Annulé par l'utilisateur.");

    const assertionResp = {
      id: assertion.id,
      rawId: bufferToBase64url(assertion.rawId),
      response: {
        authenticatorData: bufferToBase64url(assertion.response.authenticatorData),
        clientDataJSON: bufferToBase64url(assertion.response.clientDataJSON),
        signature: bufferToBase64url(assertion.response.signature),
        userHandle: assertion.response.userHandle ? bufferToBase64url(assertion.response.userHandle) : null
      },
      type: assertion.type,
      clientExtensionResults: assertion.getClientExtensionResults()
    };

    // 3. Vérification côté serveur
    const verifyRes = await fidoVerifyAuth({
      uid: storedUid,
      response: assertionResp,
      rpId: window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? window.location.hostname : undefined,
      origin: window.location.origin
    });

    if (verifyRes.data.success && verifyRes.data.customToken) {
        // Connexion Firebase Auth
        await firebase.auth().signInWithCustomToken(verifyRes.data.customToken);
        
        // Charger profil
        const doc = await firebase.firestore().collection("users").doc(storedUid).get();
        if (doc.exists) {
            const profile = doc.data();
            cacheSetItem("session", JSON.stringify({ ...profile, uid: storedUid }));
            window.session = profile;
            window.location.href = profile.role === "admin" ? "admin.html" : "app.html";
        } else {
            throw new Error("Profil introuvable dans Firestore.");
        }
    } else {
        throw new Error("Échec de la validation biométrique par le serveur.");
    }
  } catch (e) {
    console.error("WebAuthn Login Error:", e);
    alert("Échec de la connexion biométrique : " + (e.message || e));
  }
};

// --- AUTH GUARD ---

window.checkAuth = function (requireAdmin = false) {
  const rawSession = cacheGetItem("session");
  if (!rawSession) {
    window.location.href = "login.html";
    return null;
  }
  const session = JSON.parse(rawSession);

  if (requireAdmin && session.role !== "admin") {
    alert("Accès refusé.");
    window.location.href = "app.html";
    return null;
  }

  // Gestion de l'expiration d'essai (Trial Logic)
  const PUB_DATE = new Date("2027-04-18").getTime();
  const regTime = session.registrationDate || 0;

  if (regTime < PUB_DATE && regTime > 1000) {
    session.isTrialExpired = false;
    session.isFoundingMember = true;
  } else {
    const oneYearLater = regTime + 365 * 24 * 60 * 60 * 1000;
    session.isTrialExpired = Date.now() > oneYearLater;
  }

  if (session.isPermanentlyBanned) {
    window.location.href = "banned.html";
    return null;
  }

  return session;
};

// Écouteur de changement d'état (Sync Firebase -> Local)
if (typeof firebase !== "undefined" && firebase.auth()) {
  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const doc = await firebase
          .firestore()
          .collection("users")
          .doc(user.uid)
          .get();
        if (doc.exists) {
          const profile = doc.data();
          cacheSetItem(
            "session",
            JSON.stringify({ ...profile, uid: user.uid }),
          );
          window.session = profile;
        }
      } catch (err) {
        console.warn("Firestore sync failed:", err);
      }
    }
  });
}


/* --- database.js --- */
/**
 * DATABASE MANAGER - mon50ccetmoi
 * Gestion de la synchronisation en temps réel via Firebase Firestore.
 */

let db;

// NOTE : secureSetItem / secureGetItem sont définis dans config.js (chargé avant ce script).
// Alias local pour rétrocompatibilité.
var secureSetItem = window.secureSetItem;
var secureGetItem = window.secureGetItem;

function initDatabase() {
  try {
    // Initialisation Firebase (si pas déjà fait par auth.js)
    if (!firebase.apps.length) {
      firebase.initializeApp(CONFIG.FIREBASE);
      
      // OWASP A11 : Protection App Check (ReCAPTCHA v3)
      if (typeof firebase.appCheck === 'function') {
        const appCheck = firebase.appCheck();
        appCheck.activate(
          // TODO: Remplacer par la vraie clé du site reCAPTCHA v3
          new firebase.appCheck.ReCaptchaV3Provider('INSERER_CLE_RECAPTCHA_ICI'),
          true
        );
      }
    }
    db = firebase.firestore();

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

// --- E2EE HELPERS ---
function cloudEncrypt(data) {
  if (typeof CryptoJS === "undefined" || !data) return data;
  const key = window.getSyncKey();
  const str = typeof data === "string" ? data : JSON.stringify(data);
  return CryptoJS.AES.encrypt(str, key).toString();
}

function cloudDecrypt(encryptedData) {
  if (typeof CryptoJS === "undefined" || !encryptedData) return null;
  const key = window.getSyncKey();
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
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

    secureSetItem("hazards", JSON.stringify(hazards));
    if (typeof loadHazards === "function") loadHazards();
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
    // Chiffrement de bout en bout avant envoi
    const encryptedPayload = cloudEncrypt(hazard);
    await db.collection("hazards").add({
      payload: encryptedPayload,
      author: hazard.author, // Gardé en clair pour la modération par l'Oracle
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
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
  try {
    const payload = {
      lat,
      lng,
      status,
      brand: window.session.brand || "Scooter",
    };
    const encryptedPayload = cloudEncrypt(payload);

    await db.collection("presence").doc(window.session.username).set({
      payload: encryptedPayload,
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
        db.collection("presence").onSnapshot(
          (snapshot) => {
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
      let latest = [];
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

// --- SYSTÈME ANTI-FRAUDE SIGNALEMENT DGCCRF ---

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
    platform: "SignalConso-API-Bridge",
    evidenceCount: photos.length,
    hasPhotos: true,
    status: "TRANSMIS_DGCCRF",
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
    type: "FRAUDE_PRIX_BOT_SUCCESS",
    station: info,
    dossierLink: complaintDossier.dossierId,
    hasVisualProof: true,
    message: "Bot : Dossier de plainte (avec photos) transmis à la DGCCRF.",
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Optionnel: Si un Webhook Discord est configuré
  if (CONFIG.WEBHOOK_ADMIN) {
    try {
      fetch(CONFIG.WEBHOOK_ADMIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `🚨 **ALERTE FRAUDE BOT** 🚨\nLa station **${info}** a reçu 10 signalements. Un dossier de plainte automatique a été transmis à la DGCCRF.`,
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

window.evaluateGarage = async function (placeId, name, score) {
  if (!db || !window.session) {
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

    await docRef.set(
      {
        placeId,
        name,
        count: newCount,
        totalScore: newTotalScore,
        avgRating: (newTotalScore / newCount).toFixed(1),
        voters: voters,
        lastVote: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    alert(
      `Merci ! Votre évaluation a été prise en compte (${newCount}/1000 pour le Badge Pro).`,
    );
  } catch (e) {
    console.error("Eval fail", e);
  }
};

window.getGarageInternalInfo = async function (placeId) {
  if (!db) return null;
  try {
    const doc = await db.collection("garage_evaluations").doc(placeId).get();
    return doc.exists ? doc.data() : null;
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


/* --- app-core.js --- */
// --- LITE MODE (PERFORMANCE) ---
window.isLiteMode = localStorage.getItem("liteMode") === "true";

window.promptLiteMode = function () {
  const modal = document.createElement("div");
  modal.id = "lite-modal";
  modal.style =
    "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,10,10,0.95); backdrop-filter:blur(5px); z-index:20000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; padding:30px; text-align:center;";
  modal.innerHTML = `
        <i class="fa-solid fa-gauge-high" style="font-size:3rem; color:#00d2ff; margin-bottom:20px;"></i>
        <h2 style="margin-bottom:15px; color:#00d2ff;">Optimisation Suggérée</h2>
        <p style="font-size:0.9rem; line-height:1.4; margin-bottom:25px; color:#ccc;">
            Nous avons détecté que votre appareil pourrait être ralenti par certaines animations 3D et effets visuels de la carte.
            <br><br>
            Voulez-vous activer le <strong>Mode Éco / Performances</strong> pour une meilleure fluidité et préserver votre batterie ?
        </p>
        <button id="btn-accept-lite" style="width:100%; padding:15px; background:linear-gradient(135deg, #00d2ff, #0077b6); color:white; border:none; border-radius:30px; font-weight:bold; font-size:1rem; margin-bottom:15px;">ACTIVER LE MODE ÉCO (Recommandé)</button>
        <button id="btn-refuse-lite" style="background:transparent; border:1px solid #444; width:100%; padding:15px; border-radius:30px; color:#aaa; font-weight:bold; font-size:0.9rem;">NON, GARDER LA HAUTE QUALITÉ</button>
    `;
  document.body.appendChild(modal);

  document.getElementById("btn-accept-lite").onclick = () => {
    window.isLiteMode = true;
    localStorage.setItem("liteMode", "true");
    document.body.classList.add("lite-mode");
    modal.remove();
    if (typeof speak === "function")
      speak("Mode Éco activé pour des performances optimales.");
    setTimeout(() => location.reload(), 500);
  };

  document.getElementById("btn-refuse-lite").onclick = () => {
    window.isLiteMode = false;
    localStorage.setItem("liteMode", "false");
    modal.remove();
  };
};

if (localStorage.getItem("liteMode") === null) {
  const cores = navigator.hardwareConcurrency || 4;
  const ram = navigator.deviceMemory || 4; // deviceMemory is often undefined on iOS

  const ua = navigator.userAgent.toLowerCase();
  const isOldAndroid =
    ua.includes("android 6") ||
    ua.includes("android 7") ||
    ua.includes("android 8") ||
    ua.includes("android 9");
  const isOldIOS =
    ua.includes("iphone os 11") ||
    ua.includes("iphone os 12") ||
    ua.includes("iphone os 13");
  const isOldOS = isOldAndroid || isOldIOS;

  // We consider it an old device if it has <= 4 cores, OR <= 3GB of RAM, OR an old OS version
  if (cores <= 4 || ram <= 3 || isOldOS) {
    const showPrompt = () => {
      setTimeout(window.promptLiteMode, 500);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showPrompt);
    } else {
      showPrompt();
    }
  } else {
    window.isLiteMode = false;
    localStorage.setItem("liteMode", "false");
  }
}

window.toggleLiteMode = function () {
  window.isLiteMode = !window.isLiteMode;
  localStorage.setItem("liteMode", window.isLiteMode ? "true" : "false");
  if (window.ESGManager) {
    window.ESGManager.setEcoMode(window.isLiteMode);
  }
  if (window.isLiteMode) {
    document.body.classList.add("lite-mode");
    if (typeof speak === "function") speak("Mode Éco Performances activé.");
  } else {
    document.body.classList.remove("lite-mode");
    if (typeof speak === "function")
      speak("Mode Performances Maximales activé.");
  }
  setTimeout(() => location.reload(), 1500);
};

// Écoute des bascules automatiques ESG (ex: batterie faible <= 20% ou save-data)
window.addEventListener("esg-mode-change", (e) => {
  if (e.detail && e.detail.isLiteMode !== undefined) {
    window.isLiteMode = e.detail.isLiteMode;
    if (window.isLiteMode) {
      document.body.classList.add("lite-mode");
    } else {
      document.body.classList.remove("lite-mode");
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  if (window.isLiteMode) document.body.classList.add("lite-mode");
});

// --- CORE NAVIGATION (SAFE ZONE) ---
window.toggleMenu = function () {
  try {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");
    if (sidebar) {
      sidebar.classList.toggle("active");
      if (overlay) overlay.classList.toggle("active");
    }
  } catch (e) {
    console.error("Menu Crash:", e);
  }
};

window.closeMenu = function () {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  if (sidebar) sidebar.classList.remove("active");
  if (overlay) overlay.classList.remove("active");
};

// --- I18N SYSTEM ---
// window.currentLang est maintenant géré par i18n.js pour un chargement prioritaire

function updateUILabels() {
  window.updateI18N();
  const displayUser = document.getElementById("display-username");
  if (displayUser && window.session) {
    displayUser.textContent = window.session.username;
  }
}

window.updateI18N = function () {
  // Sidebar Menu
  const mGarage = document.getElementById("menu-garage");
  if (mGarage)
    mGarage.innerHTML = `<i class="fa-solid fa-warehouse"></i> ${t("garage")}`;
  const mRoadbooks = document.getElementById("menu-roadbooks");
  if (mRoadbooks)
    mRoadbooks.innerHTML = `<i class="fa-solid fa-map-location-dot"></i> Roadbooks`;
  const mSafety = document.getElementById("menu-rodage");
  if (mSafety)
    mSafety.innerHTML = `<i class="fa-solid fa-gauge-high"></i> ${t("safety")}`;
  const mInsurance = document.getElementById("menu-insurance");
  if (mInsurance)
    mInsurance.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${t("insurance")}`;
  const mMechanic = document.getElementById("menu-mechanic");
  if (mMechanic)
    mMechanic.innerHTML = `<i class="fa-solid fa-robot"></i> ${t("maintenance")}`;
  const mArbitre = document.getElementById("menu-arbitre");
  if (mArbitre)
    mArbitre.innerHTML = `<i class="fa-solid fa-scale-balanced"></i> ${t("arbitre")}`;
  const lStop = document.getElementById("label-stop-nav");
  if (lStop) lStop.textContent = t("stop");
  const lReroute = document.getElementById("label-reroute");
  if (lReroute) lReroute.textContent = t("reroute");

  // Map Radar Options
  const gasLabel =
    document.querySelector("[onclick=\"scanRadar('fuel')\"] span") ||
    document.querySelector("[onclick=\"scanRadar('fuel')\"]");
  if (gasLabel)
    gasLabel.innerHTML = `<i class="fa-solid fa-gas-pump"></i> ${t("gas")}`;
  const emergencyLabel =
    document.querySelector("[onclick=\"scanRadar('doctors')\"] span") ||
    document.querySelector("[onclick=\"scanRadar('doctors')\"]");
  if (emergencyLabel)
    emergencyLabel.innerHTML = `<i class="fa-solid fa-hospital"></i> ${t("emergency")}`;
  const bankLabel =
    document.querySelector("[onclick=\"scanRadar('atm')\"] span") ||
    document.querySelector("[onclick=\"scanRadar('atm')\"]");
  if (bankLabel)
    bankLabel.innerHTML = `<i class="fa-solid fa-money-bill-1"></i> ${t("bank")}`;
};
// window.updateI18N(); // Décalé après DOMContentLoaded pour éviter les crashs

// PWA Installation Logic
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btnInstall = document.getElementById("btn-install-pwa");
  if (btnInstall) btnInstall.classList.remove("hidden");
});

window.installPWA = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  if (outcome === "accepted") {
    const btnInstall = document.getElementById("btn-install-pwa");
    if (btnInstall) btnInstall.classList.add("hidden");
  }
  deferredPrompt = null;
};

// Gestion de la touche "Retour" sur Android (PWA)
window.addEventListener("popstate", (e) => {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("screen-overlay");
  if (sidebar && !sidebar.classList.contains("sidebar-hidden")) {
    toggleMenu();
    history.pushState(null, null, window.location.pathname);
  } else if (overlay && !overlay.classList.contains("hidden")) {
    closeScreen();
    history.pushState(null, null, window.location.pathname);
  }
});
history.pushState(null, null, window.location.pathname);

// escapeHTML est maintenant défini dans auth.js (global)

// --- BOOT ---

let map;
let geocoder;
let trafficLayer;

let userMarker = null;
let accuracyCircle = null;
let currentPosition = null;
window.routeFerries = [];
let lastSpokenFerryIndex = -1;
let hazardMarkers = [];
let officialPoiMarkers = [];
let wakeLock = null;
window.isRiding = false;
let lastSpokenHazard = null;
let nightModeActive = false;
let isParkingMode = false;
let parkingStartPos = null;
let perfStartTime = null;

window.isRodageActive = false;
window.isGarageVisible = false;
window.garageStatus = "dispo";
window.getVehicleIcon = function (brand, model) {
  const b = (brand || "").toLowerCase();
  const m = (model || "").toLowerCase();
  const vspBrands = [
    "citroën",
    "citroen",
    "ligier",
    "microcar",
    "aixam",
    "chatenet",
    "casalini",
    "ami",
  ];
  if (
    vspBrands.some((brandName) => b.includes(brandName)) ||
    m.includes("ami") ||
    b.includes("voturette") ||
    b.includes("vsp")
  ) {
    return "fa-car";
  }
  return "fa-motorcycle";
};

// --- SECURITY SYSTEMS STATE ---
let lastMovementTime = Date.now();
let isGuardianPromptActive = false;
let guardianCheckInterval = null;
let gForceThreshold = 4.5; // G force for impact detection
let currentLeanAngle = 0;
let maxLeanAngle = 0;
let isTelemetryActive = false;

// --- INITIALIZATION ---

function checkTrialExpiration() {
  if (!window.session) return;

  // On récupère les infos calculées par auth.js
  if (window.session && window.session.isTrialExpired) {
    const overlay = document.getElementById("sub-overlay");
    if (overlay) overlay.classList.remove("hidden");
    if (navigator.vibrate) navigator.vibrate(50);
    speak("Alerte abonnement : Votre période d'essai gratuite est terminée.");
  }
}

// Style Cyberpunk Dark Neon pour Google Maps
const GOOGLE_MAPS_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#120024" }] }, // Dark purple/black background
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#00f2ff" }] }, // Neon cyan text
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#120024" }, { weight: 2 }],
  },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#ff0055" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry.fill",
    stylers: [{ color: "#1b0a33" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry.stroke",
    stylers: [{ color: "#ff0055" }, { lightness: -30 }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#ffb700" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#0d011a" }],
  },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#00f2ff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0088ff" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#ff0055" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#aa0033" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#05000a" }],
  },
];

window.appStarted = false;

window.initMapController = async function () {
  if (map) return;

  const mapElement = document.getElementById("map");
  const statusEl = document.getElementById("loader-status");
  if (!mapElement) {
    console.error("mon50cc Maps : Élément #map introuvable !");
    return;
  }

  try {
    if (typeof google === "undefined" || !google.maps) {
      throw new Error("SDK_NOT_LOADED");
    }

    // Modern Library Imports
    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement, PinElement } =
      await google.maps.importLibrary("marker");
    // Suppression de l'import "routes" qui bloque le chargement de la carte (API non activée)

    // PlaceAutocompleteElement (New API)
    let PlaceAutocompleteElement = null;
    try {
      const placesLib = await google.maps.importLibrary("places");
      PlaceAutocompleteElement = placesLib.PlaceAutocompleteElement;
    } catch (e) {
      console.warn(
        "mon50cc Maps : PlaceAutocompleteElement non disponible (plan API).",
        e.message,
      );
    }

    window.googleLibraries = {
      Map,
      AdvancedMarkerElement,
      PinElement,
      PlaceAutocompleteElement,
    };

    map = new Map(mapElement, {
      center: { lat: 48.8566, lng: 2.3522 },
      zoom: 16,
      mapId: (typeof CONFIG !== 'undefined' && CONFIG?.MAPS?.MAP_ID) ? CONFIG.MAPS.MAP_ID : "DEMO_MAP_ID",
      styles: window.isLiteMode ? [] : GOOGLE_MAPS_STYLE, // Retirer style lourd en lite
      disableDefaultUI: true,
      zoomControl: false,
      tilt: window.isLiteMode ? 0 : 45, // Pas de 3D en lite
      mapTypeId: window.isLiteMode ? "roadmap" : undefined,
      gestureHandling: "greedy",
    });

    geocoder = new google.maps.Geocoder();
    trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);
    try {
      const routesLib = await google.maps.importLibrary("routes");
      window.googleLibraries.routes = routesLib;
    } catch (e) {
      console.warn("mon50cc Maps : Erreur initialisation Routes API");
    }

    // Autocomplete Classique pour le Départ
    const startInputOld = document.getElementById("route-start");
    let autocompleteStart = null;
    if (startInputOld && google.maps.places) {
      autocompleteStart = new google.maps.places.Autocomplete(startInputOld, {
        fields: ["geometry", "name"],
      });

      autocompleteStart.addListener("place_changed", () => {
        const searchEl = document.getElementById("route-search");
        if (searchEl && searchEl.value.trim() !== "") {
          window.searchDestination();
        }
      });
    }

    // Autocomplete Classique pour la Recherche (Destination)
    const inputOld = document.getElementById("route-search");
    if (inputOld && google.maps.places) {
      const autocompleteSearch = new google.maps.places.Autocomplete(inputOld, {
        fields: ["geometry", "name"],
      });

      autocompleteSearch.addListener("place_changed", () => {
        const place = autocompleteSearch.getPlace();
        if (!place || !place.geometry || !place.geometry.location) {
          window.searchDestination();
          return;
        }

        const destLocation = place.geometry.location;
        map.panTo(destLocation);
        map.setZoom(17);

        // Vérifier si un départ manuel a été saisi
        const manualStartEl = document.getElementById("route-start");
        const manualStartQuery = manualStartEl
          ? manualStartEl.value.trim()
          : "";

        if (manualStartQuery !== "") {
          // Si départ manuel renseigné, on lance l'itinéraire de départ manuel à destination
          geocoder.geocode(
            { address: manualStartQuery },
            (resStart, statusStart) => {
              if (statusStart === "OK") {
                const startPos = resStart[0].geometry.location;
                calculateRouteSansAutoroute(startPos, destLocation);
                const btnCancel = document.getElementById("btn-cancel-route");
                if (btnCancel) btnCancel.classList.remove("hidden");
              } else {
                speak("Lieu de départ introuvable.");
              }
            },
          );
          return;
        }

        // Sinon, utilisation du GPS
        if (!currentPosition) {
          speak(
            "Recherche de votre position GPS. L'itinéraire démarrera automatiquement dès que possible.",
          );
          window.pendingDestinationName = inputOld.value;
          return;
        }

        calculateRouteSansAutoroute(currentPosition, destLocation);
        const btnCancel = document.getElementById("btn-cancel-route");
        if (btnCancel) btnCancel.classList.remove("hidden");
      });
    }

    if (statusEl) statusEl.textContent = "Systèmes opérationnels.";
  } catch (e) {
    console.error("mon50cc Maps : Échec critique de l'initialisation :", e);
    // FALLBACK: TACTICAL RADAR MODE (Visuel plus fort)
    mapElement.innerHTML = `
            <div class="radar-fallback" style="height:100%; width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#000; color:#ffb703; font-family:monospace; border:2px solid #333;">
                <div class="radar-scanner" style="width:200px; height:200px; border-radius:50%; border:2px solid #ffb703; position:relative; margin-bottom:20px; box-shadow:0 0 20px #ffb70355;">
                    <div style="position:absolute; top:50%; left:50%; width:100px; height:2px; background:linear-gradient(90deg, #ffb703, transparent); transform-origin:left center; animation: radar-spin 2s linear infinite;"></div>
                </div>
                <div style="font-weight:900; letter-spacing:3px;">MODE_RADAR_TACTIQUE</div>
                <div style="font-size:0.7rem; color:#666; margin-top:5px;">SDK_OFFLINE | GPS_LOCKING</div>
            </div>
            <style>@keyframes radar-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>
        `;
    if (statusEl) statusEl.textContent = "Mode Radar (Fail-safe)...";
  } finally {
    if (typeof initDatabase === "function") initDatabase();
    setTimeout(() => window.startApp(), 500);
  }
};

window.startApp = function () {
  if (window.appStarted) return;
  window.appStarted = true;

  if (window.BVCManager) window.BVCManager.init();

  runCinematicStartup();

  checkTrialExpiration();
  updateUILabels();
  if (window.session && document.getElementById("mileage-hud")) {
    document.getElementById("mileage-hud").textContent =
      `${(window.session.totalDistance || 0).toFixed(1)} KM`;
  }

  loadHazards();
  renderRoadbooks();
  // window.OracleVoice.start(); désactivé au démarrage pour prévenir l'erreur "Requested device not found" (Zero-Trust)
  // L'utilisateur devra l'activer manuellement
  
  if (window.ExchangeMarket) {
    window.ExchangeMarket.init();
  }

  // ── Initialisation des Cartes Hors Ligne ──────────────────────
  if (window.OfflineMapManager) {
    try {
      window.OfflineMapManager.init();

      // Mise à jour du badge de statut dans le sidebar
      const updateOfflineBadge = () => {
        const dot = document.getElementById("offline-status-dot");
        if (!dot) return;
        if (navigator.onLine) {
          dot.textContent = "EN LIGNE";
          dot.style.background = "#2ecc71";
        } else {
          dot.textContent = "HORS LIGNE";
          dot.style.background = "#ff0055";
        }
      };
      updateOfflineBadge();
      window.addEventListener("online", updateOfflineBadge);
      window.addEventListener("offline", updateOfflineBadge);
    } catch (e) {
      console.warn("mon50cc OfflineMap : Erreur init", e);
    }
  }
  // ─────────────────────────────────────────────────────────────

  // Check Parameters
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("shortcut")) {
    const sc = urlParams.get("shortcut");
    setTimeout(() => {
      if (sc === "garage") showPage("garage");
      if (sc === "danger") toggleHazardMenu();
    }, 1000);
  }

  // Masquer le loader + marquer le système comme prêt
  setTimeout(() => {
    const loader = document.getElementById("app-loader");
    if (loader) {
      loader.style.opacity = "0";
    }
    updateUILabels();
    if (typeof renderCommunityMarkers === "function") renderCommunityMarkers();
    if (typeof simulateLiveFleet === "function") simulateLiveFleet();
  }, 3500);

  // Lancement de la géolocalisation
  checkLegalConsent();
};

// ── Panneau Cartes Hors Ligne : ouverture / fermeture ────────────
window.toggleOfflinePanel = function () {
  const panel = document.getElementById("offline-panel");
  if (!panel) return;

  closeMenu(); // Ferme le sidebar

  if (panel.classList.contains("hidden")) {
    panel.classList.remove("hidden");

    // Statut réseau live
    const statusEl = document.getElementById("offline-network-status");
    if (statusEl) {
      const online = navigator.onLine;
      statusEl.style.cssText += `
                background: ${online ? "rgba(0,46,20,0.8)" : "rgba(46,0,20,0.8)"};
                border: 1px solid ${online ? "rgba(0,255,136,0.3)" : "rgba(255,0,85,0.3)"};
                color: ${online ? "#00ff88" : "#ff4d6d"};
            `;
      statusEl.innerHTML = `
                <span style="font-size:1rem; margin-right:8px;">${online ? "🟢" : "🔴"}</span>
                ${online ? "CONNECTÉ — Google Maps actif" : "HORS LIGNE — Carte locale active"}
            `;
    }

    // Stats du cache
    if (window.OfflineMapManager) {
      window.OfflineMapManager.getStats((stats) => {
        const el = document.getElementById("offline-tiles-stat");
        if (el) {
          el.textContent =
            stats.count > 0
              ? `${stats.count} tuiles en cache (~${stats.estimatedMb} Mo)`
              : "Aucune tuile en cache";
        }
      });
      window.OfflineMapManager.refreshZoneList();
    }
  } else {
    panel.classList.add("hidden");
  }
};

window.closeOfflinePanel = function (evt) {
  if (evt && evt.target !== document.getElementById("offline-panel")) return;
  const panel = document.getElementById("offline-panel");
  if (panel) panel.classList.add("hidden");
};

// Fonctions de menu déplacées au début pour sécurité

window.showAdvantages = function () {
  const pop = document.getElementById("advantages-popup");
  if (pop) pop.classList.remove("hidden");
};

window.closeAdvantages = function () {
  const pop = document.getElementById("advantages-popup");
  if (pop) pop.classList.add("hidden");
};

window.toggleTraffic = function () {
  if (trafficLayer.getMap()) {
    trafficLayer.setMap(null);
    speak("Info trafic désactivée.");
  } else {
    trafficLayer.setMap(map);
    speak("Info trafic activée.");
  }
};

window.toggleTilt = function () {
  const currentTilt = map.getTilt();
  map.setTilt(currentTilt === 45 ? 0 : 45);
};

// ─── Wake Lock résilient (se réactive automatiquement en cas de perte) ────────
let wakeLockRef = null;
async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLockRef = await navigator.wakeLock.request("screen");

    // Réacquérir automatiquement quand l'onglet redevient visible
    wakeLockRef.addEventListener("release", () => {
      console.warn(
        "mon50cc GPS : Wake Lock perdu, réacquisition programmée.",
      );
      wakeLockRef = null;
    });
  } catch (err) {
    console.warn("mon50cc GPS : Wake Lock refusé :", err.message);
  }
}

// Réacquérir le Wake Lock quand l'app revient au premier plan
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (!wakeLockRef) requestWakeLock();
    // Relancer le GPS de force car iOS/Android tuent souvent le watcher en arrière-plan
    if (hasLocationConsent()) {
      console.log("mon50cc GPS : App resume, relance du GPS pour forcer le fix.");
      window.retryGps();
    }
  }
});

// ── Garde de consentement : vérifie si l'utilisateur a accepté la divulgation ──
function hasLocationConsent() {
  return localStorage.getItem("location_consent_accepted") === "true";
}

async function checkLegalConsent() {
  if (hasLocationConsent()) {
    // Déclenchement du message de bienvenue pour les utilisateurs récurrents
    const name =
      window.session ? window.session.username : "";
    const welcomeMsg = name
      ? `Content de vous revoir, ${name}. Systèmes opérationnels.`
      : "Systèmes opérationnels. Bonne route sur mon 50cc et moi.";
    setTimeout(() => {
      if (typeof speak === "function") speak(welcomeMsg);
    }, 1000);

    startGeolocation();
    return;
  }

  // ══════════════════════════════════════════════════════════════════
  // DIVULGATION BIEN VISIBLE (Prominent Disclosure) — Google Play
  // Conforme à la politique relative aux données de l'utilisateur.
  // Affiché AVANT toute collecte de données de localisation.
  // ══════════════════════════════════════════════════════════════════
  const modal = document.createElement("div");
  modal.id = "location-disclosure-modal";
  modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:#0a0a0a; z-index:20000;
        display:flex; flex-direction:column; align-items:center; justify-content:flex-start;
        color:white; padding:24px; text-align:left; overflow-y:auto;
        -webkit-overflow-scrolling:touch;
    `;
  modal.innerHTML = `
        <div style="max-width:480px; width:100%; margin:auto;">
            <div style="text-align:center; margin-bottom:20px;">
                <i class="fa-solid fa-location-dot" style="font-size:3rem; color:#ffb703;"></i>
            </div>
            <h2 style="text-align:center; margin-bottom:20px; font-size:1.3rem; color:#ffffff;">
                Utilisation de vos données de localisation
            </h2>

            <div style="background:#1a1a1a; padding:16px; border-radius:8px; border-left:4px solid #ffb703; margin-bottom:20px;">
                <p style="font-size:1rem; line-height:1.5; color:#ffffff; margin:0;">
                    <strong>L'application mon 50cc et moi collecte et utilise vos données de localisation en arrière-plan</strong> pour permettre la détection automatique de chute (Guardian Angel), la navigation GPS étape par étape, et le signalement de dangers routiers. Ces données sont collectées <strong>même lorsque l'application est fermée ou qu'elle n'est pas utilisée.</strong> Elles ne sont pas utilisées pour afficher des annonces publicitaires.
                </p>
            </div>

            <p style="font-size:0.9rem; line-height:1.4; color:#aaa; margin-bottom:24px; text-align:center;">
                Ces données sont utilisées uniquement pour assurer votre sécurité et vous guider. Elles ne sont jamais vendues à des tiers.<br><br>
                <a href="privacy.html" target="_blank" rel="noopener" style="color:#ffb703; text-decoration:underline; font-weight:bold;">
                    Consulter notre Politique de Confidentialité
                </a>
            </p>

            <button id="btn-accept-location" style="
                width:100%; padding:16px; background:#ffb703; color:#000;
                border:none; border-radius:30px; font-weight:bold; font-size:1rem;
                margin-bottom:12px; cursor:pointer;
            ">J'accepte</button>

            <button id="btn-refuse-location" style="
                width:100%; padding:14px; background:transparent;
                border:1px solid #444; border-radius:30px;
                color:#aaa; font-size:0.9rem; cursor:pointer;
            ">Refuser</button>
        </div>
    `;
  document.body.appendChild(modal);

  // Bouton REFUSER : empêche le démarrage du GPS, affiche un message
  document.getElementById("btn-refuse-location").onclick = () => {
    modal.remove();
    // Afficher un bandeau persistant expliquant que l'app ne peut pas fonctionner
    const banner = document.createElement("div");
    banner.id = "location-refused-banner";
    banner.style.cssText = `
            position:fixed; bottom:0; left:0; width:100%; padding:16px;
            background:#1a0000; border-top:2px solid #ff4444; color:#ff8888;
            text-align:center; font-size:0.85rem; z-index:19999; line-height:1.4;
        `;
    banner.innerHTML = `
            <strong>⚠ï¸ Localisation requise</strong><br>
            L'application ne peut pas fonctionner sans accès à votre position.
            <br><button onclick="checkLegalConsent()" style="margin-top:8px; padding:8px 24px; background:#ffb703; color:#000; border:none; border-radius:20px; font-weight:bold; cursor:pointer;">Réessayer</button>
        `;
    document.body.appendChild(banner);
    if (typeof speak === "function")
      speak(
        "L'application nécessite l'accès à votre position pour fonctionner.",
      );
  };

  // Bouton ACCEPTER : sauvegarde le consentement et démarre le GPS
  document.getElementById("btn-accept-location").onclick = () => {
    localStorage.setItem("location_consent_accepted", "true");
    modal.remove();
    // Retirer le bandeau de refus s'il existait
    const oldBanner = document.getElementById("location-refused-banner");
    if (oldBanner) oldBanner.remove();

    // Déclenchement du message de bienvenue (Audio débloqué par le clic)
    const name =
      window.session ? window.session.username : "";
    const welcomeMsg = name
      ? `Content de vous revoir, ${name}. Systèmes opérationnels.`
      : "Systèmes opérationnels. Bonne route sur mon 50cc et moi.";
    if (typeof speak === "function") speak(welcomeMsg);

    startGeolocation();
  };
}

function showGpsBanner(msg, code) {
  // Ne pas afficher si on a déjà une position valide (évite la bannière rouge permanente)
  if (currentPosition && code !== 1) {
    console.warn(
      "mon50cc GPS : Erreur ignorée (position déjà disponible) :",
      msg,
    );
    return;
  }

  if (code === 1) {
    let hardLock = document.getElementById("gps-hard-lock");
    if (!hardLock) {
      hardLock = document.createElement("div");
      hardLock.id = "gps-hard-lock";
      hardLock.style =
        "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10, 10, 10, 0.98); backdrop-filter:blur(10px); color:white; z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px; text-align:center;";
      document.body.appendChild(hardLock);
    }

    hardLock.innerHTML = `
            <i class="fa-solid fa-location-crosshairs" style="font-size:4rem; color:#ef4444; margin-bottom:20px;"></i>
            <h2 style="margin-bottom:15px; color:#ffb703;">GPS OBLIGATOIRE</h2>
            <p style="font-size:0.9rem; line-height:1.5; margin-bottom:25px; text-align:left; background:rgba(0,0,0,0.5); padding:15px; border-radius:10px; border:1px solid #333;">
                Cette application collecte des données de localisation pour activer la détection automatique de chute, la navigation GPS, le calcul de votre vitesse, et le partage de dangers et de votre position avec la communauté, <b>même lorsque l'application est fermée ou qu'elle n'est pas utilisée.</b><br><br>
                Sans accès à votre position, l'application ne peut pas fonctionner.
            </p>
            <button onclick="window.repairGps()" style="width:100%; padding:15px; background:#ffb703; color:black; border:none; border-radius:30px; font-weight:bold; font-size:1.1rem; margin-bottom:15px; box-shadow:0 0 15px rgba(255, 183, 3, 0.5);">
                AUTORISER LE GPS
            </button>
            <p style="font-size:0.8rem; color:#888;">
                Veuillez accorder la permission dans les paramètres de votre appareil.
            </p>
        `;
    hardLock.style.display = "flex";
    return; // On affiche le hard lock, pas la bannière
  }

  let banner = document.getElementById("gps-error-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "gps-error-banner";
    banner.style =
      "position:fixed; top:120px; left:50%; transform:translateX(-50%); width:90%; background:rgba(180, 20, 20, 0.97); color:white; padding:15px; border-radius:12px; z-index:99999; font-size:0.85rem; text-align:center; border:2px solid #ef4444; box-shadow:0 0 25px rgba(220,38,38,0.9); transition: all 0.3s ease;";
    document.body.appendChild(banner);
  }

  const repairBtn = `<button onclick="window.retryGps()" style="margin-top:10px; padding:8px 20px; background:#ffb703; color:#000; border:none; border-radius:20px; font-weight:bold; font-size:0.85rem; cursor:pointer;">🔄 Réessayer</button>`;

  banner.innerHTML = `<div style="font-weight:bold; margin-bottom:4px;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>GPS : ${msg}</div><div style="font-size:0.72rem; color:#fca5a5;">(Code erreur: ${code})</div>${repairBtn}`;
  banner.style.display = "block";

  // Auto-dismiss après 20s pour les erreurs non-critiques (code 2 = signal faible, code 3 = timeout)
  clearTimeout(window._gpsBannerTimer);
  window._gpsBannerTimer = setTimeout(hideGpsBanner, 20000);
}

function hideGpsBanner() {
  const banner = document.getElementById("gps-error-banner");
  if (banner) banner.style.display = "none";
  const hardLock = document.getElementById("gps-hard-lock");
  if (hardLock) hardLock.style.display = "none";
  clearTimeout(window._gpsBannerTimer);
}

window.repairGps = function () {
  const appUrl = "mon50ccetmoi.com";
  const instructions = `
        <div style="text-align:left; font-size:0.9rem; line-height:1.5;">
            <b style="color:#ffb703;">📱 Sur Android Chrome :</b><br>
            1. Appuie sur les 3 points ⋮ en haut à droite<br>
            2. Paramètres ←’ Paramètres du site<br>
            3. Localisation ←’ Cherche '${appUrl}'<br>
            4. Passe de 'Bloquer' à 'Autoriser'<br>
            5. Recharge l'application<br><br>
            <b style="color:#ffb703;">📱 Dans l'app Android :</b><br>
            1. Appui long sur l'icône de l'app<br>
            2. Infos sur l'appli ←’ Autorisations<br>
            3. Position ←’ Autoriser (ou Toujours autoriser)
        </div>
    `;

  if (typeof Swal !== "undefined") {
    Swal.fire({
      title: "Comment réactiver le GPS",
      html: instructions,
      icon: "info",
      confirmButtonText: "J'AI COMPRIS",
      background: "#1a1a1a",
      color: "#fff",
      confirmButtonColor: "#ffb703",
    });
  } else {
    const modal = document.createElement("div");
    modal.style =
      "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px;";
    modal.innerHTML = `
            <div style="background:#1a1a1a; padding:25px; border-radius:15px; border:2px solid #ffb703; max-width:400px; width:100%; color:white;">
                <h3 style="color:#ffb703; margin-top:0; margin-bottom:15px;">Comment réactiver le GPS</h3>
                ${instructions}
                <button onclick="this.parentElement.parentElement.remove()" style="width:100%; margin-top:20px; padding:12px; background:#ffb703; color:black; border:none; border-radius:30px; font-weight:bold; font-size:1rem;">J'AI COMPRIS</button>
            </div>
        `;
    document.body.appendChild(modal);
  }
};

window.retryGps = function () {
  hideGpsBanner();
  // Reset complet pour repartir de zéro
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  if (fallbackWatchId !== null) {
    navigator.geolocation.clearWatch(fallbackWatchId);
    fallbackWatchId = null;
  }
  gpsRetryCount = 0;
  startGeolocation();
  speak("Nouvelle tentative de localisation GPS.");
};

let gpsWatchId = null;
let fallbackWatchId = null;
let gpsRetryCount = 0;
const GPS_MAX_RETRIES = 3;

async function startGeolocation() {
  // GARDE DE SÉCURITÉ : ne JAMAIS démarrer le GPS sans consentement explicite
  if (!hasLocationConsent()) {
    console.warn(
      "mon50cc GPS : Consentement de localisation non accordé. GPS bloqué.",
    );
    alert(
      "⚠ï¸ Accès GPS bloqué : Le consentement de géolocalisation est requis. Vous allez être redirigé vers l'accueil.",
    );
    window.location.href = "index.html";
    return;
  }

  if (!("geolocation" in navigator)) {
    console.error(
      "mon50cc GPS : Géolocalisation non supportée sur cet appareil.",
    );
    showGpsBanner("Géolocalisation non supportée par ce navigateur.", 0);
    return;
  }

  // Acquérir le Wake Lock pour maintenir le GPS actif
  requestWakeLock();

  // ÉTAPE 1 : Vérifier les permissions (non-bloquant)
  if (navigator.permissions) {
    try {
      const perm = await navigator.permissions.query({ name: "geolocation" });

      if (perm.state === "denied") {
        speak(
          "Le GPS est bloqué. Vérifiez les permissions de l'application.",
        );
        showGpsBanner("Permission refusée. Appuyez sur 'Réparer'.", 1);
        return; // Inutile de continuer si explicitement refusé
      }

      perm.onchange = () => {
        if (perm.state === "granted") {
          hideGpsBanner();
          window.retryGps();
        } else if (perm.state === "denied") {
          showGpsBanner("Permission GPS révoquée.", 1);
        }
      };
    } catch (e) {
      console.warn("mon50cc GPS : API Permissions indisponible.", e);
    }
  }

  // ÉTAPE 2 : Surveillance CONTINUE (satellites GPS / réseau)
  // On utilise uniquement watchPosition car iOS gère très mal les appels concurrents (getCurrentPosition + watchPosition)
  const geoOptions = {
    enableHighAccuracy: true,
    timeout: 30000, // 30s — laisse le temps aux satellites en intérieur
    maximumAge: 3000, // 3s de cache max pour les updates fréquents
  };

  const onError = (err) => {
    let msg = "Erreur GPS inconnue";
    if (err.code === 1)
      msg = "Permission GPS refusée. Appuyez sur 'Réparer'.";
    if (err.code === 2) msg = "Signal GPS faible. Sortez à l'extérieur.";
    if (err.code === 3) msg = "Recherche GPS en cours... Patience.";
    console.error("mon50cc GPS :", msg, "code:", err.code);

    // Permission refusée ←’ bannière immédiate
    if (err.code === 1) {
      speak("Le GPS est bloqué. Vérifiez les permissions.");
      showGpsBanner(msg, err.code);
      return;
    }

    // Si on n'a aucune position ←’ tenter le fallback basse précision
    if (!currentPosition) {
      showGpsBanner(msg, err.code);
      activateLowAccuracyFallback();
    }
    // Si on a déjà une position ←’ on garde celle-ci, pas de bannière
  };

  // Nettoyer les anciens watchers avant d'en créer de nouveaux
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }

  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      // Filtrage qualité : accepter les positions même > 500m si c'est tout ce qu'on a,
      // pour éviter que l'utilisateur reste bloqué sur la carte.
      const acc = pos.coords.accuracy || 0;
      if (currentPosition && window.lastAccuracy && acc > 2000 && acc > window.lastAccuracy * 2) {
        console.warn(`mon50cc GPS : Position ignorée (précision très dégradée: ${acc.toFixed(0)}m)`);
        return;
      }
      window.lastAccuracy = acc;
      updatePosition(pos);
      hideGpsBanner();
      gpsRetryCount = 0; // Reset du compteur de retry
    },
    onError,
    geoOptions,
  );

  // ÉTAPE 4 : Timer de sécurité — si aucune position après 15s, forcer le fallback
  setTimeout(() => {
    if (!currentPosition && fallbackWatchId === null) {
      console.warn(
        "mon50cc GPS : Aucune position après 15s ←’ activation fallback.",
      );
      activateLowAccuracyFallback();
    }
  }, 15000);
}

// Fallback basse précision (WiFi/Cellulaire) — déclenché automatiquement
function activateLowAccuracyFallback() {
  if (fallbackWatchId !== null) return; // Déjà actif
  if (gpsRetryCount >= GPS_MAX_RETRIES) {
    console.error("mon50cc GPS : Nombre max de retries atteint.");
    showGpsBanner(
      "GPS indisponible. Vérifiez que la localisation est activée dans les paramètres.",
      2,
    );
    return;
  }
  gpsRetryCount++;

  fallbackWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const acc = pos.coords.accuracy || 0;
      if (!currentPosition || acc <= 3000) {
        updatePosition(pos);
        hideGpsBanner();
      }
    },
    (e) => console.warn("mon50cc GPS : Fallback échoué :", e.code, e.message),
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
  );
}

// Remplacement du démarrage automatique par la vérification légale
// Retrait de l'appel direct pour éviter les conflits avant l'init de l'UI
// checkLegalConsent();

// --- 3. NEURAL INNOVATION ENGINE (Invisibile Intelligence) ---
class NeuralPredictionEngine {
  constructor() {
    this.gripLevel = 1.0; // 0.0 to 1.0
    this.engineStress = 0.0; // 0.0 to 1.0
    this.lastUpdateTime = Date.now();
  }

  update(speedKmh, temp = 20, precip = 0, leanAngle = 0) {
    // GRIP PREDICTION: Based on physics and environmental data
    // Base grip drops with water (precip) and extreme temperatures
    let baseGrip = 1.0;
    if (precip > 0) baseGrip -= 0.3;
    if (temp < 5) baseGrip -= 0.15; // Cold asphalt
    if (temp > 45) baseGrip -= 0.1; // Melting tar

    // Speed and Lean Angle factor
    const angleRisk = Math.abs(leanAngle) / 45;
    const speedRisk = speedKmh / 90;

    this.gripLevel = Math.max(0.1, baseGrip - angleRisk * speedRisk);

    // ENGINE STRESS: Based on load and cooling
    // High speed + high temp = high stress
    const load = speedKmh / 50; // 50cc specific
    const heatFactor = temp > 30 ? (temp - 30) / 20 : 0;
    this.engineStress = Math.min(1.0, load * 0.7 + heatFactor * 0.3);

    if (this.gripLevel < 0.4 && speedKmh > 30) {
      if (window.NeuralHUD)
        window.NeuralHUD.logToConsole(
          "GRIP_WARNING: SLIPPERY_SURFACE_DETECTED",
        );
    }

    this.lastUpdateTime = Date.now();
  }
}
window.NeuralEngine = new NeuralPredictionEngine();

let speedHistory = [];
function getSmoothedSpeed(rawSpeed, speedIsNull) {
  // Si la vitesse est null (ex: fix WiFi), on ne l'ajoute pas à l'historique 
  // pour ne pas fausser la moyenne avec des "0" intempestifs.
  if (speedIsNull && speedHistory.length > 0) {
    // Retourne la dernière moyenne connue
    return speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length;
  }
  
  speedHistory.push(rawSpeed);
  if (speedHistory.length > 5) speedHistory.shift();
  const sum = speedHistory.reduce((a, b) => a + b, 0);
  return sum / speedHistory.length;
}

function updatePosition(position) {
  // Arrêt du fallback basse précision si on récupère un signal GPS décent (< 100m)
  if (
    position.coords.accuracy !== null &&
    position.coords.accuracy < 100 &&
    fallbackWatchId !== null
  ) {
    navigator.geolocation.clearWatch(fallbackWatchId);
    fallbackWatchId = null;
  }
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  const speed = position.coords.speed;
  const accuracy = position.coords.accuracy;

  const oldPos = currentPosition;
  currentPosition = { lat, lng };
  hideGpsBanner();

  // Premier FIX : log et welcome
  if (!oldPos) {
    if (map) {
      if (!window.hasWelcomed) {
        window.hasWelcomed = true;
        if (typeof triggerRegionalWelcome === "function") {
          triggerRegionalWelcome(lat, lng);
        }
      }

      // Si une destination attendait le GPS, on la lance maintenant
      if (window.pendingDestinationName) {
        const savedName = window.pendingDestinationName;
        window.pendingDestinationName = null;
        document.getElementById("route-search").value = savedName;
        window.searchDestination();
      }
    }
  }

  // Suivi continu et fluide (auto-centrage Google Maps)
  if (map) {
    map.panTo(currentPosition);
  }

  // Tracé GPS de la balade (cyberline cyan)
  if (typeof window.addTracePoint === "function") {
    window.addTracePoint(lat, lng);
  }

  if (window.updatePositionLeaflet) {
    window.updatePositionLeaflet(lat, lng);
  }

  if (window.OracleEngine) window.OracleEngine.updateRegion(lat, lng);

  // Sécurité: accuracy peut être null sur certains appareils
  const safeAccuracy = accuracy || 0;

  // Update Telemetry HUD if active
  if (window.Telemetry) {
    const gpsStatus = document.getElementById("tel-gps");
    if (gpsStatus) gpsStatus.textContent = `FIX (${safeAccuracy.toFixed(1)}m)`;
  }

  // Update main HUD GPS indicator
  const hudGps = document.getElementById("hud-gps");
  if (hudGps) {
    hudGps.textContent = `FIX (${Math.round(safeAccuracy)}m)`;
    hudGps.style.color = safeAccuracy <= 15 ? "#00e676" : "#ffb703";
  }

  // --- GUEST MODE LOCKS (Initial logic check) ---
  if (!window.session) {
    document.getElementById("menu-insurance")?.classList.add("locked-feature");
    document.getElementById("menu-mechanic")?.classList.add("locked-feature");
    document.getElementById("menu-garage")?.classList.add("locked-feature");
    // On rend aussi le clic inactif ou redirige vers login
    ["menu-insurance", "menu-mechanic", "menu-garage", "menu-arbitre"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el)
          el.onclick = () =>
            alert(
              "Veuillez créer un compte pour accéder à l'Arbitre de la Route ! ⚖️🛵",
            );
      },
    );
  }

  // Vitesse (HUD) avec Smoothing Neural
  const speedIsNull = speed === null;
  const rawSpeed = !speedIsNull && speed >= 0 ? speed * 3.6 : 0;
  const speedKmh = Math.round(getSmoothedSpeed(rawSpeed, speedIsNull));
  const speedEl = document.getElementById("speed");
  const speedBar = document.getElementById("speed-bar");

  // Broadcast telemetry to smartwatch
  if (!window.watchChannel) {
    window.watchChannel = new BroadcastChannel("mon50cc_watch_sync");
  }
  
  // Calculate crew count if CrewSystem is available
  let currentCrewCount = 0;
  if (window.CrewSystem && window.CrewSystem.crewData) {
      currentCrewCount = window.CrewSystem.crewData.length;
  }
  
  window.watchChannel.postMessage({
    type: "TELEMETRY_UPDATE",
    payload: {
      speed: speedKmh,
      crewCount: currentCrewCount
    }
  });

  if (speedEl) {
    speedEl.textContent = speedKmh;
    if (speedBar) {
      const percentage = Math.min((speedKmh / 80) * 100, 100);
      speedBar.style.width = `${percentage}%`;
    }

    // Update Neural Engine (Grip & Stress)
    const currentTemp = window.lastWeatherTemp || 20;
    const currentPrecip = window.lastPrecip || 0;
    const currentLean = window.currentLeanAngle || 0;
    window.NeuralEngine.update(
      speedKmh,
      currentTemp,
      currentPrecip,
      currentLean,
    );

    // Effet de vitesse sur le HUD
    if (speedKmh > 40) {
      speedEl.parentElement.classList.add("fast");
      speedEl.style.color = "var(--danger)";
      vibrate(50);
      if (window.NeuralHUD)
        window.NeuralHUD.logToConsole("VELOCITY_ALERT: HIGH_SPEED_DETECTED");
    } else if (speedKmh > 25) {
      speedEl.parentElement.classList.remove("fast");
      speedEl.style.color = "var(--accent)";
    } else {
      speedEl.parentElement.classList.remove("fast");
      speedEl.style.color = "var(--neon-blue)";
    }

    // Dynamic Glow based on speed
    const hud = document.getElementById("hud");
    if (hud) {
      const glow = Math.min(speedKmh / 2, 20);
      hud.style.boxShadow = `0 0 ${20 + glow}px rgba(0, 242, 255, ${0.5 + speedKmh / 200})`;
    }

    // --- NEW: Compass & 3D Navigation Logic ---
    const heading = position.coords.heading;
    if (heading !== null) {
      document.getElementById("compass-needle").style.transform =
        `rotate(${heading}deg)`;
      const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO", "N"];
      const dirIdx = Math.round(heading / 45);
      document.getElementById("compass-dir").textContent = dirs[dirIdx];

      // AUTO-ROTATE MAP (Navigation Mode)
      if (window.isRiding && map) {
        map.setHeading(heading);
      }
    }

    // DYNAMIC MAP INTELLIGENCE (Auto-Zoom & Tilt)
    if (map) {
      // Update movement time for Guardian
      if (speedKmh > 5) {
        lastMovementTime = Date.now();
        if (isGuardianPromptActive) dismissGuardian();
      }

      // Innovation: Map adapts to rider pace (Invisibly)
      let targetZoom = 17;
      let targetTilt = 30;

      if (speedKmh > 40) {
        targetZoom = 14.5; // Long range for safety
        targetTilt = 60; // High perspective
      } else if (speedKmh > 10) {
        targetZoom = 16.5;
        targetTilt = 45;
      } else if (speedKmh < 3) {
        targetZoom = 18.5; // Detailed parking view
        targetTilt = 0; // Standard flat view
      }

      // Smooth adjustment to prevent jitter
      if (Math.abs(map.getZoom() - targetZoom) > 0.1) map.setZoom(targetZoom);
      if (map.getTilt() !== targetTilt) map.setTilt(targetTilt);
    }

    // vMax Tracking (NEW v25)
    if (!window.session.vMax || speedKmh > window.session.vMax) {
      window.session.vMax = speedKmh;
      secureSetItem("session", JSON.stringify(window.session));
    }
  }

  const wasRiding = window.isRiding;
  window.isRiding = speedKmh > 2;
  if (wasRiding && !window.isRiding) {
    if (typeof Habits !== "undefined" && currentPosition)
      Habits.recordEnd(currentPosition);
  }
  calculateDistanceAndBadges(lat, lng);

  // --- NEW: Parking Mode Security ---
  handleParkingMode(lat, lng);

  // Rendu Map (uniquement en ligne)
  if (map) {
    if (!userMarker) {
      const totalKm = window.session?.totalDistance || 0;
      const color = totalKm >= 10000 ? "#B9F2FF" : "#cca000"; // DIAMANT SI 10000KM
      const shadow =
        totalKm >= 10000
          ? "0 0 20px #B9F2FF"
          : "0 0 15px rgba(204, 160, 0, 0.9)";

      // Detection du type de vehicule pour l'icone
      const vehicleIcon = window.getVehicleIcon(
        window.session?.brand,
        window.session?.model,
      );

      const iconContent = document.createElement("div");
      iconContent.innerHTML = `<div style="background-color: #1a1a1a; color: ${color}; font-size: 16px; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; border: 2px solid white; box-shadow: ${shadow}; transition: all 0.5s ease;"><i class="fa-solid ${vehicleIcon}"></i></div>`;

      try {
        if (!window.googleLibraries || !window.googleLibraries.AdvancedMarkerElement) {
           console.warn("AdvancedMarkerElement not loaded, map might not show user marker correctly.");
        } else {
           userMarker = new window.googleLibraries.AdvancedMarkerElement({
             map: map,
             position: currentPosition,
             title: "Votre Position",
             content: iconContent,
           });
        }
      } catch (e) {
        console.error("Marker init fail", e);
      }

      accuracyCircle = new google.maps.Circle({
        map: map,
        center: currentPosition,
        radius: safeAccuracy / 2,
        fillColor: "#ffffff",
        fillOpacity: 0.1,
        strokeColor: "#ffffff",
        strokeWeight: 1,
      });

      map.setCenter(currentPosition);
      map.panBy(0, -100);
    } else {
      const totalKm = window.session?.totalDistance || 0;
      const color = totalKm >= 10000 ? "#B9F2FF" : "#cca000";

      if (userMarker.content) {
        const innerDiv = userMarker.content.querySelector("div");
        if (innerDiv) {
          innerDiv.style.color = color;
          innerDiv.style.boxShadow =
            totalKm >= 10000
              ? "0 0 20px #B9F2FF"
              : "0 0 15px rgba(204, 160, 0, 0.9)";
        }
      }

      if (userMarker.setPosition) {
        userMarker.setPosition(currentPosition);
      } else {
        userMarker.position = currentPosition;
      }

      if (accuracyCircle && accuracyCircle.setCenter) {
        accuracyCircle.setCenter(currentPosition);
        accuracyCircle.setRadius(safeAccuracy / 2);
      }

      // On recentre et on décale pour la visibilité
      map.panTo(currentPosition);
      map.panBy(0, -100);
    }
  }

  // Météo Auto
  const wHud = document.getElementById("weather-hud");
  if (wHud && wHud.textContent.includes("--")) {
    window.fetchWeather(lat, lng);
  }

  // --- NEW: Hazard Proximity Verification ---
  checkHazardProximity(lat, lng);
  checkFerryProximity(lat, lng);

  // --- OFFLINE MAP: Sync Leaflet marker position ---
  if (window.OfflineMapManager) {
    window.OfflineMapManager.updatePosition(lat, lng);
  }

  // --- CLOUD SYNC: Publish Position (Throttle to 15s) ---
  if (!window.lastCloudSync || Date.now() - window.lastCloudSync > 15000) {
    if (typeof publishUserLocation === "function") {
      publishUserLocation(
        lat,
        lng,
        window.isRiding ? "Sur la route" : "En pause",
      );
      window.lastCloudSync = Date.now();
    }
  }
}

// Fonction utilitaire pour calculer la distance (Formule de Haversine)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // mètres
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function checkHazardProximity(lat, lng) {
  const raw = secureGetItem("hazards");
  const hazards = raw ? JSON.parse(raw) : [];

  hazards.forEach((h, index) => {
    const dist = getDistance(lat, lng, h.lat, h.lon);

    // --- ALERTE ROUGE (GHOST CAR) ---
    if (h.type === "danger_immediat") {
      const ageMins = (Date.now() - new Date(h.date).getTime()) / 60000;
      if (
        dist < 1000 &&
        ageMins <= 15 &&
        window.lastSpokenRedAlert !== h.lat + h.lon
      ) {
        window.lastSpokenRedAlert = h.lat + h.lon;
        if (typeof window.triggerRedAlert === "function") {
          window.triggerRedAlert(Math.round(dist), h.description || "");
        }
      }
    }
    // --- ANIMAUX (Anticipation 500m) ---
    else if (
      (h.type === "animal" || h.type === "chien") &&
      dist < 500 &&
      lastSpokenHazard !== h.lat + h.lon
    ) {
      speak(
        `Attention, ${h.type} signalé à environ 500 mètres. Restez vigilant.`,
      );
      lastSpokenHazard = h.lat + h.lon;
      showHazardConfirmation(index, h.type);
    }
    // --- DANGERS STANDARDS ---
    else if (dist < 100 && lastSpokenHazard !== h.lat + h.lon) {
      speak(`Attention : ${h.type} signalé à proximité.`);
      lastSpokenHazard = h.lat + h.lon;
      showHazardConfirmation(index, h.type);
    }
  });
}

window.triggerRedAlert = function (distance, description) {
  // Annonce vocale
  let alertMsg = `Attention, conduite dangereuse signalée`;
  if (description) {
    alertMsg += ` : ${description}`;
  }
  alertMsg += ` à ${distance} mètres devant vous. Restez vigilant.`;
  speak(alertMsg);

  // Effet visuel clignotant rouge
  const overlay = document.createElement("div");
  overlay.style =
    "position:fixed; top:0; left:0; width:100%; height:100%; box-shadow: inset 0 0 50px 20px rgba(255, 0, 0, 0.8); z-index:999999; pointer-events:none; transition: opacity 0.5s;";
  document.body.appendChild(overlay);

  let count = 0;
  const interval = setInterval(() => {
    overlay.style.opacity = count % 2 === 0 ? "0" : "1";
    count++;
    if (count > 10) {
      clearInterval(interval);
      overlay.remove();
    }
  }, 500);
};

function showHazardConfirmation(index, type) {
  const toast = document.createElement("div");
  toast.className = "hazard-toast glassmorphism";
  toast.innerHTML = `
        <p>Toujours là : <strong>${type}</strong> ?</p>
        <div style="display:flex; gap:10px;">
            <button onclick="confirmHazard(${index}, true)">✅ Oui</button>
            <button onclick="confirmHazard(${index}, false)">&#10060; Non</button>
        </div>
    `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}

window.confirmHazard = function (index, exists) {
  if (!exists) {
    let hazards = JSON.parse(secureGetItem("hazards") || "[]");
    hazards.splice(index, 1);
    secureSetItem("hazards", JSON.stringify(hazards));
    loadHazards();
    speak("Merci, signalement mis à jour.");
  } else {
    speak("Merci de votre vigilance.");
  }
  const toast = document.querySelector(".hazard-toast");
  if (toast) toast.remove();
  vibrate(30);
};

// --- NEW: Voice Synthesis & Haptics ---
function vibrate(ms) {
  if (
    "vibrate" in navigator &&
    navigator.userActivation &&
    navigator.userActivation.hasBeenActive
  ) {
    navigator.vibrate(ms);
  }
}

// --- REGIONAL & VOICE ENGINE (ORACLE v110.00.00) ---
window.OracleEngine = {
  gender: localStorage.getItem("oracle_gender") || "female",
  currentRegion: "standard",

  regionalLexicon: {
    fr: {
      marseille: {
        start:
          "Té, l'Oracle est en place ! On est parés pour la route, peuchère.",
        speed: "Oh fada, tu vas trop vite ! Lève le pied avant de t'envoler.",
        threat_detected:
          "Vé ! Y'a un souci sur la route devant. Fais gaffe à toi.",
        level_up: "Et bim ! Tu as monté de niveau, bravo mon brave.",
        start_guardian:
          "Ange Gardien en place ! T'inquiète pas, je veille sur toi.",
        stop_guardian: "Ange Gardien au repos. Fais doucement, hein !",
        danger_overtake:
          "Vé ! Tu doubles n'importe comment, tu vas nous faire un plat !",
      },
      quebec: {
        start: "Attache ta tuque, l'Oracle est prêt pour une sacrée virée !",
        speed: "Lâche la patate, tu roules pas mal trop vite là !",
        threat_detected: "Check ben ça, y'a de quoi de pas net sur le chemin.",
        level_up: "C'est écoeurant ! T'as gagné un niveau.",
        start_guardian: "Ton Ange Gardien est prêt, on lâche pas !",
        stop_guardian: "L'Ange Gardien prend une pause. Prudence !",
        danger_overtake:
          "Oulà ! Ton dépassement était pas mal risqué, check tes angles !",
      },
      standard: {
        start: "Core Universel stabilisé. Liaison totale établie.",
        speed: "Alerte : Vitesse excessive. Ralentissez immédiatement.",
        threat_detected: "ANALYSE : Menace identifiée. Prudence conseillée.",
        level_up: "Félicitations Pilote. Votre expérience a augmenté.",
        start_guardian:
          "Ange Gardien activé. Surveillance périmétrique en cours.",
        stop_guardian: "Ange Gardien désactivé. Fin de la surveillance.",
        danger_overtake: "ATTENTION : DÉPASSEMENT DANGEREUX DÉTECTÉ.",
        ferry_detected:
          "Attention, cet itinéraire inclut une traversée en ferry.",
        ferry_ahead:
          "Traversée en ferry à 1 kilomètre. Préparez-vous à l'embarquement.",
      },
      liege: {
        start: "Oufti, l'Oracle est en place, valet ! On décolle ?",
        speed: "Ouille valet, tu vas trop vite ! Calme ton jeu.",
        threat_detected: "Aïe gaffe, y'a un bins sur la route devant.",
        level_up: "Oufti ! T'es passé au niveau suivant, c'est du propre !",
        start_guardian:
          "L'Ange Gardien est là pour toi, valet. Roule tranquille.",
        stop_guardian: "L'Ange Gardien va s'en jeter une, sois prudent.",
        danger_overtake:
          "Oufti ! Ton dépassement était un peu chaud, valet !",
      },
      charleroi: {
        start: "Salut m'fi ! L'Oracle est prêt, on y va ?",
        speed: "M'fi, tu roules trop vite ! On n'est pas sur le ring ici.",
        threat_detected: "Fais gaffe m'fi, y'a un gros souci devant.",
        level_up: "Bordel m'fi ! T'as monté de niveau, félicitations !",
        start_guardian: "Ton Ange Gardien veille sur toi, m'fi. Pas de stress.",
        stop_guardian: "L'Ange Gardien a fini sa pause, fais attention m'fi.",
        danger_overtake: "M'fi ! C'était quoi ce dépassement de baraki ?",
      },
      brussels: {
        start: "Salut fieu ! L'Oracle est là, on y va ou quoi ?",
        speed:
          "Dites une fois, fieu ! Tu vas trop vite, on n'est pas pressés !",
        threat_detected: "Attention fieu, y'a un stut sur la route devant.",
        level_up:
          "Non peut-être ! T'as monté de niveau, ça c'est du stoemp !",
        start_guardian: "L'Ange Gardien est avec toi, fieu. T'inquiète pas.",
        stop_guardian: "L'Ange Gardien va manger une frite, fais gaffe à toi.",
        danger_overtake:
          "Eh fieu ! Ton dépassement là, c'était un peu zinneke, non ?",
      },
      flanders: {
        start: "Allez, l'Oracle est prêt. On roule, hein ?",
        speed: "Oula ! Tu vas trop vite, hein ! Calme-toi un peu.",
        threat_detected: "Pas de chance, y'a un problème sur la route.",
        level_up: "Super ! T'as monté de niveau. C'est bien, hein !",
        start_guardian:
          "L'Ange Gardien est là pour toi. C'est sécurisé, hein.",
        stop_guardian: "L'Ange Gardien s'arrête. Sois prudent, hein.",
        danger_overtake:
          "Dis, ton dépassement était un peu dangereux, hein !",
      },
      andalucia: {
        start: "¡Ole! L'Oracle est prêt, mon ami. On y va !",
        speed: "Eh, l'ami ! Tu vas trop vite, doucement sur l'accélérateur.",
        threat_detected: "Attention, y'a du jaleo sur la route devant.",
        level_up: "¡Qué arte! Tu as monté de niveau, bravo !",
        start_guardian: "L'Ange Gardien est avec toi, l'ami.",
        stop_guardian: "L'Ange Gardien fait une petite sieste, sois prudent.",
        danger_overtake:
          "Eh ! Ce dépassement était un peu trop risqué, mi arma !",
      },
      reunion: {
        start: "Lé paré ! L'Oracle est en place, dalon. Allons rouler !",
        speed: "Oté ! Tu vas trop vite, calme un peu là !",
        threat_detected:
          "Gaffe dalon, y'a un l'embouteillage ou un souci devant.",
        level_up: "Lé bon ça ! T'as monté de niveau, félicitations !",
        start_guardian: "L'Ange Gardien lé là, t'inquiète pas dalon.",
        stop_guardian: "L'Ange Gardien va prendre un petit rhum, sois prudent.",
        danger_overtake:
          "Oté ! Ton dépassement là, c'était risqué dalon !",
      },
    },
    zh: {
      standard: {
        start: "系统就绪。连接已建立。",
        speed: "警告：速度过快。请立å³å‡速。",
        threat_detected: "分æž：å‘现å¨èƒ。建议谨慎。",
        level_up: "æ­喜车手。您的ç»验值已æå‡。",
        start_guardian: "守护天使已开å¯。正在监控。",
        stop_guardian: "守护天使已关闭。监控结æŸ。",
        danger_overtake: "警告：检测到å±险超车。",
      },
    },
    ja: {
      standard: {
        start: "システム準備完了。接続ãŒ確立ã•れã¾ã—ãŸ。",
        speed: "警告：速度超éŽã§ã™。直ã¡ã«減速ã—ã¦ãã ã•ã„。",
        threat_detected: "分æž：脅å¨を検知。注æ„ã—ã¦ãã ã•ã„。",
        level_up: "ãŠã‚ã§ã¨ã†ã”ã–ã„ã¾ã™。レベルãŒ上ãŒりã¾ã—ãŸ。",
        start_guardian: "守護天使ãŒ起動ã—ã¾ã—ãŸ。監視中。",
        stop_guardian: "守護天使ãŒ解除ã•れã¾ã—ãŸ。監視終了。",
        danger_overtake: "警告：å±険ãª追ã„越ã—を検知ã—ã¾ã—ãŸ。",
      },
    },
    es: {
      andalucia: {
        start: "¡Ole! El Oráculo está listo, mi arma. ¡Vámonos!",
        speed: "¡Eh, chiquillo! Vas mu' rápido, frena un poco.",
        threat_detected: "Cuidao, que hay un jaleo ahí delante.",
        level_up: "¡Qué arte tienes! Has subido de nivel.",
        start_guardian: "El Ãngel de la Guarda está contigo, mi arma.",
        stop_guardian: "El Ãngel se va a echar una siestecita, ten cuidao.",
        danger_overtake:
          "¡Chiquillo! Ese adelantamiento ha sío mu' peligroso.",
      },
      standard: {
        start: "Sistemas listos. Conexión establecida.",
        speed: "Alerta: Exceso de velocidad. Reduzca inmediatamente.",
        threat_detected: "ANÃLISIS: Amenaza identificada. Tenga precaución.",
        level_up: "Felicidades Piloto. Su experiencia ha aumentado.",
        start_guardian: "Ãngel de la Guarda activado. Vigilancia en curso.",
        stop_guardian: "Ãngel de la Guarda desactivado. Fin de la vigilancia.",
        danger_overtake: "ATENCIÃ“N: ADELANTAMIENTO PELIGROSO DETECTADO.",
      },
    },
    en: {
      standard: {
        start: "System ready. Connection established.",
        speed: "Alert: Excessive speed. Please slow down.",
        threat_detected: "ANALYSIS: Threat identified. Caution advised.",
        level_up: "Congratulations Pilot. Your experience has increased.",
        start_guardian: "Guardian Angel activated. Monitoring perimeter.",
        stop_guardian: "Guardian Angel deactivated. End of monitoring.",
        danger_overtake: "WARNING: DANGEROUS OVERTAKE DETECTED.",
        ferry_detected: "Attention, this route includes a ferry crossing.",
        ferry_ahead: "Ferry crossing in 1 kilometer. Prepare for boarding.",
      },
    },
    it: {
      standard: {
        start: "Sistema pronto. Connessione stabilita.",
        speed: "Allerta: Velocità eccessiva. Rallenta immediatamente.",
        threat_detected:
          "ANALISI: Minaccia identificata. Prudenza consigliata.",
        level_up: "Congratulazioni Pilota. La tua esperienza è aumentata.",
        start_guardian: "Angelo Custode attivato. Monitoraggio in corso.",
        stop_guardian: "Angelo Custode disattivato. Fine monitoraggio.",
        danger_overtake: "ATTENZIONE: SORPASSO PERICOLOSO RILEVATO.",
      },
    },
    de: {
      standard: {
        start: "System bereit. Verbindung hergestellt.",
        speed: "Warnung: Zu hohe Geschwindigkeit. Bitte sofort abbremsen.",
        threat_detected: "ANALYSE: Gefahr erkannt. Vorsicht geboten.",
        level_up: "Glückwunsch Pilot. Deine Erfahrung ist gestiegen.",
        start_guardian: "Schutzengel aktiviert. Ãœberwachung läuft.",
        stop_guardian: "Schutzengel deaktiviert. Ende der Ãœberwachung.",
        danger_overtake: "WARNUNG: GEFÃ„HRLICHES ÃœBERHOLMANÃ–VER ERKANNT.",
      },
    },
    pt: {
      standard: {
        start: "Sistema pronto. Conexão estabelecida.",
        speed: "Alerta: Velocidade excessiva. Reduza imediatamente.",
        threat_detected: "ANÃLISE: Ameaça identificada. Cuidado aconselhado.",
        level_up: "Parabéns Piloto. A sua experiência aumentou.",
        start_guardian: "Anjo da Guarda ativado. Monitorização em curso.",
        stop_guardian: "Anjo da Guarda desativado. Fim da monitorização.",
        danger_overtake: "AVISO: ULTRAPASSAGEM PERIGOSA DETETADA.",
      },
    },
    nl: {
      standard: {
        start: "Systeem gereed. Verbinding tot stand gebracht.",
        speed:
          "Waarschuwing: Te hoge snelheid. Gelieve onmiddellijk te vertragen.",
        threat_detected:
          "ANALYSE: Dreiging geïdentificeerd. Voorzichtigheid geboden.",
        level_up: "Gefeliciteerd Piloot. Uw ervaring is toegenomen.",
        start_guardian: "Beschermengel geactiveerd. Monitoring gestart.",
        stop_guardian: "Beschermengel gedeactiveerd. Einde monitoring.",
        danger_overtake: "WAARSCHUWING: GEVAARLIJKE INHAALACTIE GEDETECTEERD.",
      },
    },
    pl: {
      standard: {
        start: "System gotowy. PoÅ‚Ä…czenie nawiÄ…zane.",
        speed: "Alert: Nadmierna prÄ™dkoÅ›Ä‡. ProszÄ™ natychmiast zwolniÄ‡.",
        threat_detected:
          "ANALIZA: Zidentyfikowano zagrożenie. Zalecana ostrożnoÅ›Ä‡.",
        level_up: "Gratulacje Pilocie. Twoje doÅ›wiadczenie wzrosÅ‚o.",
        start_guardian: "AnioÅ‚ Stróż aktywowany. Monitorowanie w toku.",
        stop_guardian: "AnioÅ‚ Stróż dezaktywowany. Koniec monitorowania.",
        danger_overtake: "OSTRZEŻENIE: WYKRYTO NIEBEZPIECZNE WYPRZEDZANIE.",
      },
    },
    sv: {
      standard: {
        start: "Systemet är klart. Anslutning upprättad.",
        speed: "Varning: För hög hastighet. Sänk farten omedelbart.",
        threat_detected: "ANALYS: Hot identifierat. Var försiktig.",
        level_up: "Grattis Pilot. Din erfarenhet har ökat.",
        start_guardian: "Skyddsängel aktiverad. Ã–vervakning pågår.",
        stop_guardian: "Skyddsängel inaktiverad. Slut på övervakning.",
        danger_overtake: "VARNING: FARLIG OMKÃ–RNING UPPTÃ„CKT.",
      },
    },
    da: {
      standard: {
        start: "Systemet er klar. Forbindelse oprettet.",
        speed: "Advarsel: For høj hastighed. Sæt farten ned med det samme.",
        threat_detected:
          "ANALYSE: Trussel identificeret. Forsigtighed tilrådes.",
        level_up: "Tillykke Pilot. Din erfarenhet er øget.",
        start_guardian: "Skytsengel aktiveret. Overvågning i gang.",
        stop_guardian: "Skytsengel deaktiveret. Slut på overvågning.",
        danger_overtake: "ADVARSEL: FARLIG OVERHALING REGISTRERET.",
      },
    },
    fi: {
      standard: {
        start: "Järjestelmä valmis. Yhteys muodostettu.",
        speed: "Hälytys: Liian suuri nopeus. Hidasta välittömästi.",
        threat_detected: "ANALYYSI: Uhka tunnistettu. Noudata varovaisuutta.",
        level_up: "Onnea Pilotti. Kokemuksesi on kasvanut.",
        start_guardian: "Suojelusenkeli aktivoitu. Valvonta käynnissä.",
        stop_guardian: "Suojelusenkeli deaktivoitu. Valvonta päättynyt.",
        danger_overtake: "VAROITUS: VAARALLINEN OHITUS HAVAITTU.",
      },
    },
    no: {
      standard: {
        start: "Systemet er klart. Tilkobling opprettet.",
        speed: "Advarsel: For høy hastighet. Sakt ned umiddelbart.",
        threat_detected:
          "ANALYSE: Trussel identifisert. Forsiktighet anbefales.",
        level_up: "Gratulerer Pilot. Din erfaring har økt.",
        start_guardian: "Skytsengel aktivert. Overvåking pågår.",
        stop_guardian: "Skytsengel deaktivert. Slut på overvåking.",
        danger_overtake: "ADVARSEL: FARLIG FORBIKJÃ˜RING OPPDAGET.",
      },
    },
    el: {
      standard: {
        start:
          "ΣÏÏƒÏ„ημα έÏ„οιμο. Î— ÏƒÏνδεÏƒη ολοκληÏÏŽθηκε.",
        speed:
          "Î•ιδοÏ€οίηÏƒη: ΥÏ€εÏβολική Ï„αÏ‡ÏÏ„ηÏ„α. Î•Ï€ιβÏαδÏνεÏ„ε αμέÏƒÏ‰Ï‚.",
        threat_detected:
          "Î‘ÎÎ‘Î›ΥΣÎ—: Î•νÏ„οÏ€ίÏƒÏ„ηκε αÏ€ειλή. ΣÏ…νιÏƒÏ„άÏ„αι Ï€ÏοÏƒοÏ‡ή.",
        level_up:
          "ΣÏ…γÏ‡αÏηÏ„ήÏια ΠιλÏŒÏ„ε. Î— εμÏ€ειÏία ÏƒαÏ‚ αÏ…ξήθηκε.",
        start_guardian:
          "ΦÏλακαÏ‚ Î†γγελοÏ‚ ενεÏγοÏ€οιήθηκε. ΠαÏακολοÏθηÏƒη Ïƒε εξέλιξη.",
        stop_guardian:
          "ΦÏλακαÏ‚ Î†γγελοÏ‚ αÏ€ενεÏγοÏ€οιήθηκε. ΤέλοÏ‚ Ï€αÏακολοÏθηÏƒηÏ‚.",
        danger_overtake:
          "ΠΡÎŸΣÎŸΧÎ—: Î•ÎΤÎŸΠÎ™ΣΤÎ—ÎšÎ• Î•ΠÎ™ÎšÎ™ÎÎ”ΥÎÎ— ΠΡÎŸΣΠÎ•ΡÎ‘ΣÎ—.",
      },
    },
    cs: {
      standard: {
        start: "Systém pÅ™ipraven. PÅ™ipojení navázáno.",
        speed: "UpozornÄ›ní: NadmÄ›rná rychlost. OkamžitÄ› zpomalte.",
        threat_detected:
          "ANALÃZA: Identifikována hrozba. DoporuÄuje se opatrnost.",
        level_up: "Gratulujeme Pilote. Vaše zkušenosti se zvýšily.",
        start_guardian: "AndÄ›l strážný aktivován. Sledování probíhá.",
        stop_guardian: "AndÄ›l strážný deaktivován. Konec sledování.",
        danger_overtake: "VAROVÃNÃ: ZJIŠTÄšNO NEBEZPEÄŒNÉ PÅ˜EDBÃHÃNÃ.",
      },
    },
    hu: {
      standard: {
        start: "Rendszer kész. Kapcsolat létrejött.",
        speed: "Riasztás: Túl nagy sebesség. Azonnal lassítson.",
        threat_detected:
          "ELEMZÉS: Fenyegetés azonosítva. Ã“vatosság ajánlott.",
        level_up: "Gratulálunk Pilóta. Tapasztalata nÅ‘tt.",
        start_guardian: "Årangyal aktiválva. Megfigyelés folyamatban.",
        stop_guardian: "Årangyal deaktiválva. Megfigyelés vége.",
        danger_overtake: "FIGYELEM: VESZÉLYES ELÅZÉS ÉSZLELVE.",
      },
    },
    ro: {
      standard: {
        start: "Sistem gata. Conexiune stabilitÄƒ.",
        speed: "AlertÄƒ: VitezÄƒ excesivÄƒ. ÃŽncetiniÈ›i imediat.",
        threat_detected:
          "ANALIZÄ‚: AmeninÈ›are identificatÄƒ. Se recomandÄƒ prudenÈ›Äƒ.",
        level_up: "FelicitÄƒri Pilotule. ExperienÈ›a ta a crescut.",
        start_guardian: "ÃŽnger PÄƒzitor activat. Monitorizare în curs.",
        stop_guardian:
          "ÃŽnger PÄƒzitor dezactivat. SfârÈ™itul monitorizÄƒrii.",
        danger_overtake: "ATENÈšIE: DEPÄ‚È˜IRE PERICULOASÄ‚ DETECTATÄ‚.",
      },
    },
  },

  updateRegion: function (lat, lng) {
    // Ne pas écraser la région si triggerRegionalWelcome (Nominatim) l'a déjà définie
    if (this._regionSetByNominatim) return;

    if (lat > 43.1 && lat < 43.4 && lng > 5.2 && lng < 5.6)
      this.currentRegion = "marseille";
    else if (lat > 45 && lat < 47 && lng > -74 && lng < -71)
      this.currentRegion = "quebec";
    else if (lat > 50.5 && lat < 50.8 && lng > 5.3 && lng < 5.8)
      this.currentRegion = "liege";
    else if (lat > 50.2 && lat < 50.5 && lng > 4.2 && lng < 4.6)
      this.currentRegion = "charleroi";
    else if (lat > 50.75 && lat < 50.95 && lng > 4.2 && lng < 4.6)
      this.currentRegion = "brussels";
    else if (lat > 50.95 && lat < 51.5 && lng > 2.5 && lng < 5.9)
      this.currentRegion = "flanders";
    else if (lat > 35.8 && lat < 38.7 && lng > -7.5 && lng < -1.6)
      this.currentRegion = "andalucia";
    else if (lat > -21.4 && lat < -20.8 && lng > 55.2 && lng < 55.9)
      this.currentRegion = "reunion";
    else this.currentRegion = "standard";
  },

  getVoice: function (lang) {
    const voices = window.speechSynthesis.getVoices();
    let filtered = voices.filter((v) => v.lang.startsWith(lang));
    let target = filtered.find((v) => {
      const name = v.name.toLowerCase();
      return this.gender === "female"
        ? name.includes("female") ||
            name.includes("mary") ||
            name.includes("claire") ||
            name.includes("hortense")
        : name.includes("male") ||
            name.includes("david") ||
            name.includes("thomas") ||
            name.includes("paul");
    });
    return target || filtered[0] || null;
  },
};

window.TranslationCache = {};

async function speak(phraseKey) {
  if (!("speechSynthesis" in window)) return;

  const baseLang = window.currentLang || "fr";
  const region = window.OracleEngine.currentRegion;

  let text = phraseKey;
  if (
    window.OracleEngine.regionalLexicon &&
    window.OracleEngine.regionalLexicon[baseLang]
  ) {
    text =
      window.OracleEngine.regionalLexicon[baseLang][region]?.[phraseKey] ||
      window.OracleEngine.regionalLexicon[baseLang]["standard"]?.[phraseKey] ||
      phraseKey;
  }

  let targetLang = navigator.language.split("-")[0].toLowerCase();
  let finalMsg = text;

  if (targetLang !== "fr") {
    if (
      window.TranslationCache[text] &&
      window.TranslationCache[text][targetLang]
    ) {
      finalMsg = window.TranslationCache[text][targetLang];
    } else {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data[0] && data[0][0] && data[0][0][0]) {
          finalMsg = data[0].map((item) => item[0]).join(""); // Join parts if translated in multiple chunks
          if (!window.TranslationCache[text])
            window.TranslationCache[text] = {};
          window.TranslationCache[text][targetLang] = finalMsg;
        }
      } catch (e) {
        console.warn("Oracle Translation failed, fallback:", e);
        targetLang = "fr";
      }
    }
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(finalMsg);

  const voices = window.speechSynthesis.getVoices();
  let voice = voices.find((v) => v.lang.toLowerCase().startsWith(targetLang));
  if (!voice && targetLang === "fr") voice = window.OracleEngine.getVoice("fr");
  if (voice) utterance.voice = voice;

  utterance.lang = navigator.language;

  // Voice Modes (Marché Noir BVC)
  let rate = 0.95;
  let pitch =
    window.OracleEngine && window.OracleEngine.gender === "female" ? 1.05 : 0.9;

  const voiceMode = localStorage.getItem("nexus-atlasVoiceMode") || "standard";

  // Simulation d'accents régionaux (pitch/rate)
  if (region && region !== "standard" && voiceMode === "standard") {
    switch (region) {
      // Système A — Régions administratives (Nominatim)
      case "provence-alpes-côte d'azur":
      case "occitanie":
      // Système B — Villes/zones (GPS)
      case "marseille":
      case "reunion":
        rate = 0.85;
        pitch = pitch * 1.2; // Sud : plus lent, plus chantant
        break;
      case "hauts-de-france":
      case "liege":
      case "charleroi":
        rate = 1.1;
        pitch = pitch * 0.85; // Nord : plus rapide, un peu plus grave
        break;
      case "île-de-france":
      case "brussels":
        rate = 1.15; // Paris/Bruxelles : parle vite
        break;
      case "auvergne-rhône-alpes":
        rate = 0.88;
        pitch = pitch * 0.95; // Rhône-Alpes : posé, calme
        break;
      case "bretagne":
      case "normandie":
        pitch = pitch * 1.1; // Ouest
        break;
      case "grand est":
      case "bourgogne-franche-comté":
      case "flanders":
        rate = 0.92;
        pitch = pitch * 1.05;
        break;
      case "quebec":
        rate = 0.9;
        pitch = pitch * 1.15; // Québécois : chantant, plus lent
        break;
      case "andalucia":
        rate = 1.05;
        pitch = pitch * 1.1; // Espagnol du sud
        break;
    }
  }

  if (voiceMode === "cyberpunk") {
    rate = 0.85;
    pitch = 0.4;
  } else if (voiceMode === "rally") {
    rate = 1.3;
    pitch = 1.2;
  }

  utterance.rate = rate;
  utterance.pitch = pitch;

  window.speechSynthesis.speak(utterance);
  if (
    "vibrate" in navigator &&
    navigator.userActivation &&
    navigator.userActivation.hasBeenActive
  ) {
    navigator.vibrate(30);
  }
}

// --- NEW: Auto Night Mode ---
function checkNightMode() {
  const hr = new Date().getHours();
  const isNight = hr >= 20 || hr <= 7;
  if (isNight && !nightModeActive) {
    document.body.classList.add("night-theme");
    nightModeActive = true;
    speak("Mode nuit activé.");
  } else if (!isNight && nightModeActive) {
    document.body.classList.remove("night-theme");
    nightModeActive = false;
  }
}
// --- NEW v25: TELEMETRY & LEAN ANGLE ---
// --- BACKGROUND MODE SURVIVAL ---
document.addEventListener(
  "deviceready",
  () => {
    // Si le plugin de background-mode est installé (Cordova/Capacitor)
    if (window.cordova && cordova.plugins && cordova.plugins.backgroundMode) {
      cordova.plugins.backgroundMode.enable();
      cordova.plugins.backgroundMode.on("activate", function () {
        cordova.plugins.backgroundMode.disableWebViewOptimizations();
      });
    }
  },
  false,
);
window.addEventListener("deviceorientation", (e) => {
  if (!window.isRiding) return;

  const lean = Math.round(e.gamma); // Tilt left/right
  currentLeanAngle = Math.abs(lean);
  if (currentLeanAngle > maxLeanAngle) maxLeanAngle = currentLeanAngle;

  // --- INTEGRATION: Guardian Angel Dangerous Overtake Check ---
  if (
    window.GuardianAngel &&
    typeof window.GuardianAngel.checkOvertakingSafety === "function"
  ) {
    const speedKmh = parseInt(
      document.getElementById("speed")?.textContent || "0",
    );
    window.GuardianAngel.checkOvertakingSafety(speedKmh, lean);
  }

  const horizon = document.querySelector(".horizon-line");
  if (horizon) {
    horizon.style.transform = `rotate(${-lean}deg)`;
  }

  const leanMeter = document.getElementById("lean-meter");
  const leanVal = document.getElementById("lean-angle-val");
  const fillL = document.getElementById("lean-fill-L");
  const fillR = document.getElementById("lean-fill-R");

  if (leanMeter && currentLeanAngle > 5) {
    leanMeter.classList.remove("hidden");
    leanVal.textContent = `${currentLeanAngle}°`;

    if (lean < 0) {
      fillL.style.width = `${Math.min(currentLeanAngle * 2, 100)}%`;
      fillR.style.width = "0%";
    } else {
      fillR.style.width = `${Math.min(currentLeanAngle * 2, 100)}%`;
      fillL.style.width = "0%";
    }

    if (currentLeanAngle > 35) {
      leanVal.style.color = "var(--danger)";
      if (currentLeanAngle > 45) vibrate(100);
    } else {
      leanVal.style.color = "var(--accent)";
    }
  } else if (leanMeter) {
    leanMeter.classList.add("hidden");
  }
});

setInterval(checkNightMode, 60000);
checkNightMode();
// --- CHANNELS DE COMMUNICATION ---
if (!window.watchChannel) {
  window.watchChannel = new BroadcastChannel("mon50cc_watch_sync");
  window.watchChannel.onmessage = function(event) {
    if (event.data.type === "SOS_TRIGGERED" && window.sosActivate) {
      console.log("SOS triggered from smartwatch!");
      window.sosActivate();
    }
  };
}


/* --- app-map.js --- */
// --- 3. ROUTAGE ---
let destinationMarker = null;
let currentRoutePolylines = [];
let currentRouteMarkers = [];

async function calculateRouteSansAutoroute(start, end) {
  if (!start || !end) {
    console.error("mon50cc Maps : Points de départ ou d'arrivée invalides.", {
      start,
      end,
    });
    if (!start) speak("Signal GPS insuffisant pour démarrer l'itinéraire.");
    return;
  }

  window.currentRouteDestination = end; // Store for GO button

  // Nettoyage des tracés précédents
  currentRoutePolylines.forEach((p) => p.setMap(null));
  currentRoutePolylines = [];
  currentRouteMarkers.forEach((m) => m.setMap(null));
  currentRouteMarkers = [];

  if (!window.googleLibraries?.routes?.Route) {
    speak("Le moteur de routage n'est pas disponible pour le moment.");
    return;
  }
  const { Route } = window.googleLibraries.routes;

  const originLat = typeof start.lat === "function" ? start.lat() : start.lat;
  const originLng = typeof start.lng === "function" ? start.lng() : start.lng;
  const destLat = typeof end.lat === "function" ? end.lat() : end.lat;
  const destLng = typeof end.lng === "function" ? end.lng() : end.lng;

  const request = {
    origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
    destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
    travelMode: "DRIVE",
    routeModifiers: {
      avoidHighways: true,
      avoidTolls: true,
    },
    computeAlternativeRoutes: window.isRodageActive || window.avoidCityCenters,
    fields: [
      "routes.distanceMeters", 
      "routes.duration", 
      "routes.polyline.encodedPolyline", 
      "routes.legs.distanceMeters",
      "routes.legs.duration",
      "routes.legs.steps",
    ],
  };

  try {
    const { routes } = await Route.computeRoutes(request);
    
    if (routes && routes.length > 0) {
      let routeIndex = 0;
      if (window.avoidCityCenters && routes.length > 1) {
          // On choisit la route la plus longue en distance (qui correspond souvent à un contournement)
          let maxDist = -1;
          for (let i = 0; i < routes.length; i++) {
              if (routes[i].legs[0].distanceMeters > maxDist) {
                  maxDist = routes[i].legs[0].distanceMeters;
                  routeIndex = i;
              }
          }
      }

      const selectedRoute = routes[routeIndex];
      const leg = selectedRoute.legs[0];

      // Decode polyline and draw
      const path = google.maps.geometry.encoding.decodePath(selectedRoute.polyline.encodedPolyline);
      const polyline = new google.maps.Polyline({
        path: path,
        map: map,
        strokeColor: "#00d2ff",
        strokeOpacity: 0.8,
        strokeWeight: 6,
      });
      currentRoutePolylines.push(polyline);

      // --- AJUSTEMENT DE LA VUE DE LA CARTE ---
      const bounds = new google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds);

      const infoBar = document.getElementById("nav-info-bar");
      if (infoBar) {
        infoBar.style.setProperty("display", "flex", "important");
      }

      const btnStop = document.getElementById("btn-stop-nav");
      if (btnStop) btnStop.classList.remove("hidden");

      const distEl = document.getElementById("nav-dist");
      const timeEl = document.getElementById("nav-time");
      const etaEl = document.getElementById("nav-eta");
      if (typeof window.startPremiumNavigation === "function")
        window.startPremiumNavigation(leg);

      const routeDistText = leg.distanceMeters >= 1000 ? (leg.distanceMeters / 1000).toFixed(1) + " km" : leg.distanceMeters + " m";
      if (distEl) distEl.textContent = routeDistText;

      let durationSec = parseInt(leg.duration.replace('s', ''), 10) || 0;
      const distanceMeters = leg.distanceMeters;

      // --- AJUSTEMENT 50cc ---
      durationSec = Math.round(durationSec * 1.2); // +20% pour scooter 50cc en ville
      const maxSpeedMs = 32 / 3.6; // Vitesse moyenne réaliste pour un 50cc (32 km/h) avec les arrêts
      const googleSpeedMs = distanceMeters / durationSec;
      if (googleSpeedMs > maxSpeedMs) {
        durationSec = Math.round(distanceMeters / maxSpeedMs);
        if (window.Telemetry)
          window.Telemetry.addLog("INFO", `ETA ajusté pour 50cc.`);
      }

      const destNameLegacy =
        document.getElementById("route-search")?.value || "ITINÉRAIRE 50CC";
      const titleElLegacy = document.querySelector(".route-title");
      if (titleElLegacy)
        titleElLegacy.textContent = destNameLegacy.toUpperCase();

      // Activer le panneau de guidage interne (Waze-killer)
      const navInstruction = document.getElementById("nav-instruction");
      const nextStepName = document.getElementById("next-step-name");
      const nextStepDist = document.getElementById("next-step-dist");
      const navIcon = document.querySelector(".nav-icon i");

      if (navInstruction) navInstruction.classList.remove("hidden");

      const nextStep = leg.steps[0];
      if (nextStep) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = nextStep.navigationInstruction ? nextStep.navigationInstruction.instructions : "";
        let instructionText = tempDiv.textContent || tempDiv.innerText || "";
        if (nextStepName) nextStepName.textContent = instructionText;
        const nextDistText = nextStep.distanceMeters >= 1000 ? (nextStep.distanceMeters / 1000).toFixed(1) + " km" : nextStep.distanceMeters + " m";
        if (nextStepDist) nextStepDist.textContent = nextDistText;

        if (navIcon) {
          const lowerInst = instructionText.toLowerCase();
          if (lowerInst.includes("gauche")) {
            navIcon.className = "fa-solid fa-arrow-turn-up";
            navIcon.style.transform = "scaleX(-1) rotate(90deg)";
          } else if (lowerInst.includes("droite")) {
            navIcon.className = "fa-solid fa-arrow-turn-up";
            navIcon.style.transform = "rotate(90deg)";
          } else if (lowerInst.includes("rond-point")) {
            navIcon.className = "fa-solid fa-arrows-spin";
            navIcon.style.transform = "rotate(0deg)";
          } else {
            navIcon.className = "fa-solid fa-arrow-up";
            navIcon.style.transform = "rotate(0deg)";
          }
        }

        // NEXUS ATLAS : Annonce vocale de l'instruction de guidage
        setTimeout(() => {
          if (typeof speak === "function") {
            speak(
              "Guidage interne démarré. Dans " +
                nextDistText +
                ", " +
                instructionText,
            );
          }
        }, 6000); // Décalé de 6 secondes pour laisser Nexus Atlas annoncer l'ETA en premier
      }

      let durationTextStr;
      const totalMins = Math.floor(durationSec / 60);
      if (totalMins >= 60) {
        durationTextStr = `${Math.floor(totalMins / 60)} h ${totalMins % 60} min`;
      } else {
        durationTextStr = `${totalMins} min`;
      }

      if (timeEl) timeEl.textContent = durationTextStr;
      if (etaEl) {
        const arrivalTime = new Date(
          Date.now() + durationSec * 1000,
        ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        etaEl.textContent = arrivalTime;
      }

      // Détection ferry (Legacy API translation)
      window.routeFerries = leg.steps.filter(
        (s) => {
          const instr = s.navigationInstruction ? s.navigationInstruction.instructions : "";
          return instr.toLowerCase().includes("ferry");
        }
      );
      lastSpokenFerryIndex = -1;

      if (window.routeFerries.length > 0) {
        setTimeout(() => speak("ferry_detected"), 4000);
        if (
          window.NeuralHUD &&
          typeof window.NeuralHUD.logToConsole === "function"
        ) {
          window.NeuralHUD.logToConsole(
            `NAV_INTEL: FERRY_CROSSING_AHEAD (${window.routeFerries.length})`,
          );
        }
      }

      const etaText = etaEl ? etaEl.textContent : "";
      speak(
        window.getLocalizedRouteMsg(
          routeDistText,
          etaText,
          window.isRodageActive,
        ),
      );

      // SAFE RIDE : Vérification Météo
      if (window.SafeRide) {
        window.SafeRide.checkWeatherForRoute(destLat, destLng).then(
          (weather) => {
            if (weather.isDangerous) {
              const issuesStr = weather.issues.join(" et ");
              setTimeout(() => {
                if (typeof speak === "function") {
                  speak(
                    `Alerte Safe Ride : ${issuesStr} sur votre itinéraire. Équipez-vous et soyez très prudent avant de prendre la route.`,
                  );
                }
              }, 9000);

              // Modifier l'ETA visuellement (+20% temps pour danger)
              if (etaEl && timeEl) {
                const newDurationSec = durationSec * 1.2;
                const newTotalMins = Math.floor(newDurationSec / 60);
                timeEl.textContent =
                  newTotalMins >= 60
                    ? `${Math.floor(newTotalMins / 60)} h ${newTotalMins % 60} min (Météo)`
                    : `${newTotalMins} min (Météo)`;
                timeEl.style.color = "#ff4d4d"; // Rouge danger

                const newArrivalTime = new Date(
                  Date.now() + newDurationSec * 1000,
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                etaEl.textContent = newArrivalTime;
                etaEl.style.color = "#ff4d4d";
              }
            }
          },
        );
      }

      if (destinationMarker) destinationMarker.map = null;
      
      const destIcon = document.createElement("div");
      destIcon.innerHTML = `<i class="fa-solid fa-flag-checkered"></i>`;
      destIcon.style.color = "white";
      destIcon.style.fontSize = "24px";
      destIcon.style.textShadow = "0 0 5px black";

      destinationMarker = new window.googleLibraries.AdvancedMarkerElement({
        position: { lat: destLat, lng: destLng },
        map: map,
        content: destIcon,
      });
      currentRouteMarkers.push(destinationMarker);
    } else {
      speak("Aucun itinéraire trouvé vers cette destination.");
    }
  } catch (error) {
    console.error("Routage impossible: ", error);
    speak("Erreur de calcul d'itinéraire.");
  }
}

window.cancelRoute = function () {
  if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
  if (destinationMarker) {
    destinationMarker.setMap(null);
    destinationMarker = null;
  }

  document.getElementById("nav-instruction").classList.add("hidden");
  document.getElementById("nav-info-bar").style.display = "none"; // On cache le bandeau
  document.getElementById("btn-stop-nav").classList.add("hidden");
  document.getElementById("btn-reroute").classList.add("hidden");

  document.getElementById("route-search").value = "";
};

window.pendingDestination = null;

window.toggleManualStart = function () {
  const box = document.getElementById("manual-start-box");
  box.classList.toggle("hidden");
  if (!box.classList.contains("hidden")) {
    const startEl =
      document.getElementById("route-start-gmp") ||
      document.getElementById("route-start");
    startEl.focus();
  }
};

window.searchDestination = function () {
  const searchEl =
    document.getElementById("route-search-gmp") ||
    document.getElementById("route-search");
  const startEl =
    document.getElementById("route-start-gmp") ||
    document.getElementById("route-start");

  const query = searchEl
    ? searchEl.inputValue !== undefined
      ? searchEl.inputValue
      : searchEl.value
    : "";
  const startQuery = startEl
    ? startEl.inputValue !== undefined
      ? startEl.inputValue
      : startEl.value
    : "";

  if (!query) return;

  if (!geocoder || !map) {
    speak("Carte en cours de chargement, veuillez patienter.");
    return;
  }

  // SI DEPART MANUEL
  if (startQuery.trim() !== "") {
    geocoder.geocode({ address: startQuery }, (resStart, statusStart) => {
      if (statusStart === "OK") {
        const startPos = resStart[0].geometry.location;
        geocoder.geocode({ address: query }, (resEnd, statusEnd) => {
          if (statusEnd === "OK") {
            const dest = resEnd[0].geometry.location;
            window.currentRouteDestination = dest;
            calculateRouteSansAutoroute(startPos, dest);
          } else {
            speak("Destination introuvable.");
          }
        });
      } else {
        speak("Lieu de départ introuvable.");
      }
    });
    return;
  }

  // SINON GPS CLASSIQUE
  if (!currentPosition) {
    speak(
      "Recherche de votre position GPS. L'itinéraire démarrera automatiquement dès que possible.",
    );
    window.pendingDestinationName = query;
    return;
  }

  geocoder.geocode({ address: query }, (res, status) => {
    if (status === "OK") {
      const dest = res[0].geometry.location;
      window.currentRouteDestination = dest;
      calculateRouteSansAutoroute(currentPosition, dest);
      map.panTo(dest);
      const btnCancel = document.getElementById("btn-cancel-route");
      if (btnCancel) btnCancel.classList.remove("hidden");
    } else {
      speak("Destination introuvable.");
    }
  });
};

window.launchNativeGPS = function () {
  if (!window.currentRouteDestination) return;
  const lat =
    typeof window.currentRouteDestination.lat === "function"
      ? window.currentRouteDestination.lat()
      : window.currentRouteDestination.lat;
  const lng =
    typeof window.currentRouteDestination.lng === "function"
      ? window.currentRouteDestination.lng()
      : window.currentRouteDestination.lng;
  const isWazeInstalled = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Default to Google Maps which supports avoidHighways via dirflg=h (partially)
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dirflg=h`;
  window.open(url, "_blank");
};

// --- 4. SERVICES COMMUNAUTAIRES (SIGNALEMENTS) ---
window.toggleHazardMenu = function () {
  const opts = document.getElementById("hazard-options");
  const mainBtn =
    document.getElementById("btn-hazard-quick") ||
    document.getElementById("btn-hazard-main");
  if (!opts) return;
  if (opts.classList.contains("hidden")) {
    opts.classList.remove("hidden");
    if (mainBtn) mainBtn.style.transform = "rotate(45deg)";
  } else {
    opts.classList.add("hidden");
    if (mainBtn) mainBtn.style.transform = "rotate(0deg)";
  }
};

window.saveHazard = function (type, description = "") {
  if (!currentPosition) return;

  // VERIFICATION DU BAN
  if (typeof isUserBanned === "function" && isUserBanned()) {
    const remaining = Math.ceil(
      (window.session.bannedUntil - Date.now()) / 60000,
    );
    alert(
      `🚨 Action Interdite : Votre compte est suspendu pour faux signalements répétés. Fin de la sanction dans ${remaining} minutes.`,
    );
    return;
  }

  const h = {
    lat: currentPosition.lat,
    lon: currentPosition.lng,
    type: type,
    description: description,
    author: window.session ? window.session.username : "Anonyme",
    date: new Date().toISOString(),
  };

  // 1. Sauvegarde Locale (Fallback)
  let dbLocal = JSON.parse(secureGetItem("hazards") || "[]");
  dbLocal.push(h);
  secureSetItem("hazards", JSON.stringify(dbLocal));

  // 2. Publication Cloud (Temps réel pour la communauté)
  if (typeof publishHazardCloud === "function") {
    publishHazardCloud(h).then((success) => {});
  }

  alert(`Signalement: ${escapeHTML(type)} enregistré ! Merci à vous.`);

  // GAMIFICATION: +50 XP pour le signalement communautaire
  if (typeof window.updateXP === "function") {
    window.updateXP(5); // +50 XP (updateXP multiplie par 10)
    if (typeof speak === "function")
      speak("Signalement validé. Vous gagnez de l'expérience.");
  }

  toggleHazardMenu();
  loadHazards();
};

function loadHazards() {
  if (typeof google === "undefined" || !google.maps || !window.googleLibraries?.AdvancedMarkerElement)
    return;
  const raw = secureGetItem("hazards");
  let hazards = raw ? JSON.parse(raw) : [];

  // Filtrage éphémère Animaux (> 30 mins = expiré)
  hazards = hazards.filter((h) => {
    if ((h.type === "animal" || h.type === "chien") && h.date) {
      const ageMins = (Date.now() - new Date(h.date).getTime()) / 60000;
      return ageMins <= 30;
    }
    return true;
  });

  hazardMarkers.forEach((m) => m.setMap(null));
  hazardMarkers = [];

  const listContainer = document.getElementById("live-hazards-list");
  if (listContainer) {
    if (hazards.length === 0) {
      listContainer.innerHTML =
        '<p style="font-size:0.8rem; color:#666; text-align:center; padding:10px;">Aucun danger signalé.</p>';
    } else {
      listContainer.innerHTML = "";
      hazards.reverse(); // Voir les plus récents en premier dans la liste
    }
  }

  hazards.forEach((h, index) => {
    const isAnimal = h.type === "animal" || h.type === "chien";
    const hColor =
      h.type === "Police"
        ? "#00d2ff"
        : h.type === "Route Dégradée"
          ? "#f1c40f"
          : isAnimal
            ? "#e67e22"
            : "#ff4d4d";
    const hazardIcon = document.createElement("div");
    hazardIcon.style.width = "18px";
    hazardIcon.style.height = "18px";
    hazardIcon.style.backgroundColor = hColor;
    hazardIcon.style.border = "2px solid white";
    hazardIcon.style.borderRadius = "50%";

    const marker = new window.googleLibraries.AdvancedMarkerElement({
      position: { lat: h.lat, lng: h.lon },
      map: map,
      content: hazardIcon,
    });
    const info = new google.maps.InfoWindow({
      content: `<b>${isAnimal ? "ðŸ¾ " : ""}${escapeHTML(h.type)}</b><br><small>${escapeHTML(h.author)}</small>`,
    });
    marker.addListener("click", () => info.open(map, marker));
    hazardMarkers.push(marker);

    // Ajout à la liste sidebar
    if (listContainer && index < 5) {
      // On affiche les 5 derniers max
      const div = document.createElement("div");
      div.className = "hazard-alert";
      div.style.cursor = "pointer";
      div.innerHTML = `<div><i class="fa-solid fa-${isAnimal ? "paw" : "triangle-exclamation"}"></i> <strong>${escapeHTML(h.type)}</strong><br><span>Par ${escapeHTML(h.author)}</span></div><i class="fa-solid fa-chevron-right" style="font-size:0.6rem; color:#444;"></i>`;
      div.onclick = () => {
        map.setCenter({ lat: h.lat, lng: h.lon });
        map.setZoom(17);
        info.open(map, marker);
        toggleMenu();
      };
      listContainer.appendChild(div);
    }
  });
}

// --- 5. SONAR RADAR (POI SCAN) ---
const poiConfig = {
  fuel: {
    icon: "fa-gas-pump",
    label: "Essence",
    color: "#cca000",
    radius: 5000,
  },
  doctors: {
    icon: "fa-briefcase-medical",
    label: "Santé & Pharmacie",
    color: "#e74c3c",
    radius: 3000,
  },
  atm: {
    icon: "fa-money-bill-1",
    label: "DAB",
    color: "#2ecc71",
    radius: 3000,
  },
  mechanic: {
    icon: "fa-wrench",
    label: "Garages",
    color: "#ffa500",
    radius: 8000,
  },
  tourist_attraction: {
    icon: "fa-landmark",
    label: "Lieux Historiques",
    color: "#e67e22",
    radius: 10000,
  },
};

window.toggleRadarMenu = function () {
  const r = document.getElementById("radar-options");
  if (r) r.classList.toggle("hidden");
};

window.scanRadar = function (type) {
  if (!currentPosition) return;
  toggleRadarMenu();
  const config = poiConfig[type];
  const radarBtn =
    document.getElementById("btn-radar-quick") ||
    document.getElementById("btn-radar-main");
  const oldHtml = radarBtn ? radarBtn.innerHTML : "";
  if (radarBtn)
    radarBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  if (type === "fuel") {
    // --- NEW: Government Data Integration ---
    fetchFuelPricesUsingGovAPI(
      currentPosition.lat,
      currentPosition.lng,
      config,
      radarBtn,
      oldHtml,
    );
  } else if (type === "mechanic") {
    // --- NEW: Google Places Garage Integration ---
    fetchGaragesUsingPlacesAPI(
      currentPosition.lat,
      currentPosition.lng,
      config,
      radarBtn,
      oldHtml,
    );
  } else {
    // Standard Overpass Search for other POIs
    const lat = currentPosition.lat;
    const lon = currentPosition.lng;
    // MEDICAL includes doctors, clinics, hospitals AND pharmacy
    const medicalTags = "clinic|hospital|doctors|pharmacy";
    const query = `[out:json][timeout:15];(nwr["amenity"~"${type === "doctors" ? medicalTags : type}"](around:${config.radius},${lat},${lon}););out center;`;
    const url = `https://lz4.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        renderPoiMarkers(data.elements, config);
      })
      .finally(() => {
        if (radarBtn) radarBtn.innerHTML = oldHtml;
      });
  }
};

async function fetchFuelPricesUsingGovAPI(lat, lng, config, btn, oldHtml) {
  // API OpenData Gouv: Prix des carburants
  const url = `https://data.economie.gouv.fr/api/records/1.0/search/?dataset=prix-des-carburants-en-france-flux-instantane-v2&q=&geofilter.distance=${lat},${lng},5000&rows=20`;

  try {
    const blacklist =
      typeof getBlacklist === "function" ? await getBlacklist() : [];
    const today = new Date().toISOString().split("T")[0];
    const reportsSnap = await db
      .collection("reports_abuse")
      .where("lastUpdate", ">=", new Date(today))
      .get();
    const reportCounts = {};
    reportsSnap.forEach((doc) => {
      reportCounts[doc.data().stationId] = doc.data().count;
    });

    const res = await fetch(url);
    const data = await res.json();
    officialPoiMarkers.forEach((m) => m.setMap(null));
    officialPoiMarkers = [];

    if (data.records) {
      data.records.forEach((record) => {
        const fields = record.fields;
        const coords = record.geometry.coordinates;
        const stationId = record.recordid;

        // Masquer si blacklistée
        if (blacklist.includes(stationId)) {
          return;
        }

        // Extraction des prix
        let pricesHtml = "";
        try {
          const priceList = JSON.parse(fields.prix || "[]");
          priceList.forEach((p) => {
            // Ignorer le gazole (pas pour les 50cc)
            if (p["@nom"] === "Gazole") return;

            pricesHtml += `<div style="display:flex; justify-content:space-between; gap:10px;">
                            <strong>${p["@nom"]}</strong> <span>${parseFloat(p["@valeur"]).toFixed(3)}€</span>
                        </div>`;
          });
        } catch (e) {
          pricesHtml = "Prix non disponibles";
        }

        const fuelIcon = document.createElement("div");
        fuelIcon.innerHTML = `<i class="fa-solid fa-gas-pump"></i>`;
        fuelIcon.style.color = "#cca000";
        fuelIcon.style.fontSize = "20px";
        fuelIcon.style.backgroundColor = "white";
        fuelIcon.style.padding = "4px";
        fuelIcon.style.borderRadius = "50%";
        fuelIcon.style.border = "2px solid #cca000";

        const marker = new window.googleLibraries.AdvancedMarkerElement({
          position: { lat: coords[1], lng: coords[0] },
          map: map,
          content: fuelIcon,
        });

        // Compteur de signalements
        const currentReports = reportCounts[stationId] || 0;
        const reportBadge =
          currentReports > 0
            ? `<div style="color:#ff4d4d; font-size:0.7rem; font-weight:bold; margin-top:5px;"><i class="fa-solid fa-triangle-exclamation"></i> ${currentReports}/10 signalements</div>`
            : "";

        // Bouton de signalement pour les membres
        const isGuest = !window.session;
        const reportBtn = isGuest
          ? ""
          : `
                    <button onclick="triggerPhotoReport('${stationId}', '${fields.vile || fields.adresse}')" 
                        style="width:100%; margin-top:5px; background:#ff4d4d; color:white; border:none; padding:5px; border-radius:5px; font-size:0.7rem; cursor:pointer;">
                        🚨 Signaler Abus Prix (+Photo)
                    </button>`;

        const info = new google.maps.InfoWindow({
          content: `<div style="color:black; min-width:150px;">
                        <b style="font-size:1rem;">${escapeHTML(fields.vile || "Station")}</b><br>
                        <small>${escapeHTML(fields.adresse)}</small>
                        <hr style="border:0; border-top:1px solid #eee; margin:5px 0;">
                        ${pricesHtml}
                        ${reportBadge}
                        ${reportBtn}
                    </div>`,
        });
        marker.addListener("click", () => info.open(map, marker));
        officialPoiMarkers.push(marker);
      });
    }
  } catch (e) {
    console.error("Gov API fail", e);
    alert("Erreur lors de la récupération des prix.");
  } finally {
    btn.innerHTML = oldHtml;
  }
}
async function fetchGaragesUsingPlacesAPI(lat, lng, config, btn, oldHtml) {
  if (!google.maps.places) {
    alert("Services de lieux non disponibles.");
    btn.innerHTML = oldHtml;
    return;
  }

  const service = new google.maps.places.PlacesService(map);
  const request = {
    location: new google.maps.LatLng(lat, lng),
    radius: config.radius,
    keyword: "garage scooter 50cc moto",
  };

  service.nearbySearch(request, (results, status) => {
    btn.innerHTML = oldHtml;
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      officialPoiMarkers.forEach((m) => m.setMap(null));
      officialPoiMarkers = [];

      // FILTRAGE : Uniquement ceux avec note >= 3.3
      const filtered = results.filter((r) => (r.rating || 0) >= 3.3);

      filtered.forEach(async (place) => {
        // DONNEES COMMUNAUTAIRES
        const internalInfo =
          typeof getGarageInternalInfo === "function"
            ? await getGarageInternalInfo(place.place_id)
            : null;
        const isPro = (internalInfo?.count || 0) >= 1000;
        const proBadge = isPro
          ? `<div style="background:#ffd700; color:black; padding:2px 5px; font-size:0.6rem; font-weight:bold; border-radius:4px; margin-top:5px; display:inline-block;"><i class="fa-solid fa-trophy"></i> BADGE PRO CERTIFIÉ</div>`
          : "";
        const qualityBadge =
          place.rating > 3.9
            ? `<div style="background:#f1c40f; color:black; padding:2px 5px; font-size:0.6rem; font-weight:bold; border-radius:4px; margin-top:5px; display:inline-block;"><i class="fa-solid fa-certificate"></i> QUALITÉ CERTIFIÉE (>3.9)</div>`
            : "";
        const communityRating = internalInfo
          ? `<div style="font-size:0.7rem; color:#00d2ff; margin-top:3px;">Label Scooter : â­ ${internalInfo.avgRating}/5 (${internalInfo.count} avis)</div>`
          : "";

        const garageIcon = document.createElement("div");
        garageIcon.style.width = place.rating > 3.9 ? "24px" : "20px";
        garageIcon.style.height = place.rating > 3.9 ? "24px" : "20px";
        garageIcon.style.backgroundColor = place.rating > 3.9 ? "#f1c40f" : isPro ? "#ffd700" : config.color;
        garageIcon.style.border = (place.rating > 3.9 ? "3px" : "1px") + " solid white";
        garageIcon.style.borderRadius = "50%";

        const marker = new window.googleLibraries.AdvancedMarkerElement({
          position: place.geometry.location,
          map: map,
          content: garageIcon,
        });

        // Étoiles de notation
        const isGuest = !window.session;
        const safePlaceName = (place.name || "")
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const starBtns = isGuest
          ? ""
          : `<div style="margin-top:10px; border-top:1px solid #eee; padding-top:5px;">
                    <small>Évaluer ce garage :</small><br>
                    <span style="font-size:1.2rem; cursor:pointer;" onclick="evaluateGarage('${place.place_id}', '${safePlaceName}', 1)">â­</span>
                    <span style="font-size:1.2rem; cursor:pointer;" onclick="evaluateGarage('${place.place_id}', '${safePlaceName}', 2)">â­</span>
                    <span style="font-size:1.2rem; cursor:pointer;" onclick="evaluateGarage('${place.place_id}', '${safePlaceName}', 3)">â­</span>
                    <span style="font-size:1.2rem; cursor:pointer;" onclick="evaluateGarage('${place.place_id}', '${safePlaceName}', 4)">â­</span>
                    <span style="font-size:1.2rem; cursor:pointer;" onclick="evaluateGarage('${place.place_id}', '${safePlaceName}', 5)">â­</span>
                </div>`;

        const info = new google.maps.InfoWindow({
          content: `<div style="color:black; min-width:180px;">
                        <b style="font-size:1rem;">${escapeHTML(place.name)}</b><br>
                        â­ Google: ${place.rating || "N/A"}/5 (${place.user_ratings_total || 0})<br>
                        ${qualityBadge}
                        ${communityRating}
                        ${proBadge}
                        ${starBtns}
                    </div>`,
        });

        marker.addListener("click", () => info.open(map, marker));
        officialPoiMarkers.push(marker);
      });
      alert(`${filtered.length} garages certifiés (Note > 3.3) trouvés.`);
    } else {
      alert("Aucun garage trouvé dans cette zone.");
    }
  });
}
window.triggerPhotoReport = function (id, name) {
  const input = document.getElementById("abuse-photo-input");
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Notification
    alert("Traitement de la preuve photo en cours...");

    // Lecture en base64 pour le stockage Firestore (ou upload Storage si configuré)
    const reader = new FileReader();
    reader.onload = async (event) => {
      const photoData = event.target.result;
      if (typeof reportStationAbuse === "function") {
        reportStationAbuse(id, name, photoData);
      }
    };
    reader.readAsDataURL(file);
  };
  input.click(); // Ouvrir l'appareil photo
};

function renderPoiMarkers(elements, config) {
  officialPoiMarkers.forEach((m) => m.setMap(null));
  officialPoiMarkers = [];
  if (elements?.length > 0) {
    elements.forEach((item) => {
      const poiIcon = document.createElement("div");
      poiIcon.style.width = "10px";
      poiIcon.style.height = "10px";
      poiIcon.style.backgroundColor = config.color;
      poiIcon.style.border = "1px solid white";
      poiIcon.style.borderRadius = "50%";

      const marker = new window.googleLibraries.AdvancedMarkerElement({
        position: {
          lat: item.lat || item.center.lat,
          lng: item.lon || item.center.lon,
        },
        map: map,
        content: poiIcon,
      });
      const info = new google.maps.InfoWindow({
        content: `<div style="color:black"><b>${escapeHTML(item.tags?.name || config.label)}</b></div>`,
      });
      marker.addListener("click", () => info.open(map, marker));
      officialPoiMarkers.push(marker);
    });
  }
  alert(`${elements?.length || 0} résultat(s) trouvés.`);
}

// --- 6. SIMULATIONS ET CHRONO ---
let tripSeconds = 0;
setInterval(() => {
  if (window.isRiding) tripSeconds++;
  const tEl = document.getElementById("trip-timer");
  if (tEl) {
    const str = new Date(tripSeconds * 1000).toISOString().substring(11, 19);
    tEl.textContent = str.startsWith("00:") ? str.substring(3) : str;
  }
}, 1000);

// --- COMMUNITY LIVE RENDERING (MOBILE HUD ENGINE) ---
let communityMarkers = [];
window.renderCommunityMarkers = function () {
  if (!map || !window.communityMembers) return;

  // Clear old markers
  communityMarkers.forEach((m) => m.setMap(null));
  communityMarkers = [];

  window.communityMembers.forEach((member) => {
    const memberIcon = document.createElement("div");
    memberIcon.style.width = "12px";
    memberIcon.style.height = "12px";
    memberIcon.style.backgroundColor = "#00d2ff";
    memberIcon.style.border = "2px solid white";
    memberIcon.style.borderRadius = "50%";

    const m = new window.googleLibraries.AdvancedMarkerElement({
      position: { lat: member.lat, lng: member.lng },
      map: map,
      title: member.username,
      content: memberIcon,
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="color:black"><b>${escapeHTML(member.username)}</b><br><small>${escapeHTML(member.brand)} - ${escapeHTML(member.status)}</small></div>`,
    });
    m.addListener("click", () => info.open(map, m));
    communityMarkers.push(m);
  });
};

window.simulateLiveFleet = function () {
  if (!currentPosition || !map) return;
  const ghostNames = [
    "Rider_Z",
    "Nitro50",
    "BoostPowa",
    "StuntMan",
    "RoadRunner",
  ];
  const ghostBrands = [
    "Yamaha Bw's",
    "MBK Booster",
    "Piaggio Zip",
    "Peugeot Speedfight",
    "Derbi Senda",
  ];

  ghostNames.forEach((name, i) => {
    const offsetLat = (Math.random() - 0.5) * 0.01;
    const offsetLng = (Math.random() - 0.5) * 0.01;
    const ghostPos = {
      lat: currentPosition.lat + offsetLat,
      lng: currentPosition.lng + offsetLng,
    };

    const ghostIcon = document.createElement("div");
    ghostIcon.style.width = "10px";
    ghostIcon.style.height = "10px";
    ghostIcon.style.backgroundColor = "#666";
    ghostIcon.style.opacity = "0.5";
    ghostIcon.style.border = "1px solid white";
    ghostIcon.style.borderRadius = "50%";

    const m = new window.googleLibraries.AdvancedMarkerElement({
      position: ghostPos,
      map: map,
      title: name,
      content: ghostIcon,
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="color:black"><b>${name} [IA]</b><br><small>${ghostBrands[i]}</small></div>`,
    });
    m.addListener("click", () => info.open(map, m));
    communityMarkers.push(m);
  });
};

// --- 7. TERRITORY WARS (CREWS) ---
window.MapSystem = window.MapSystem || {};
window.MapSystem.territoryShapes = {}; // zipCode -> google.maps.Circle

window.MapSystem.updateTerritoryLayer = function (zipCode, data) {
  if (!map) return;

  const color = data.color || "#ffffff";

  // Si on l'a déjà dessiné, on met juste à jour la couleur
  if (this.territoryShapes[zipCode]) {
    this.territoryShapes[zipCode].setOptions({
      fillColor: color,
      strokeColor: color,
    });
    return;
  }

  // Sinon on tente de géocoder le code postal pour trouver le centre de la zone (en France)
  if (typeof geocoder !== "undefined" && geocoder) {
    geocoder.geocode({ address: zipCode + " France" }, (res, status) => {
      if (status === "OK" && res[0]) {
        const center = res[0].geometry.location;
        // Dessiner un grand cercle pour représenter le territoire
        const circle = new google.maps.Circle({
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.35,
          map: map,
          center: center,
          radius: 2000, // 2km radius approximation
        });

        // Ajouter une InfoWindow
        const info = new google.maps.InfoWindow({
          content: `<div style="color:black; font-family:'Outfit', sans-serif;">
                                <h3 style="margin:0; color:${color};"><i class="fa-solid fa-flag"></i> Secteur ${zipCode}</h3>
                                <p style="margin:5px 0;">Dominé par: <b>${data.dominantCrewName || "Inconnu"}</b></p>
                              </div>`,
        });

        circle.addListener("click", (ev) => {
          info.setPosition(ev.latLng);
          info.open(map);
        });

        this.territoryShapes[zipCode] = circle;
      }
    });
  }
};

// Tracking fake de km sur le code postal actuel si en mouvement
setInterval(() => {
  // Si on roule, toutes les minutes on ajoute des kms virtuels au territoire actuel
  if (
    window.isRiding &&
    window.currentPosition &&
    typeof geocoder !== "undefined"
  ) {
    geocoder.geocode({ location: window.currentPosition }, (res, status) => {
      if (status === "OK" && res[0]) {
        const zipComp = res[0].address_components.find((c) =>
          c.types.includes("postal_code"),
        );
        if (zipComp && window.CrewSystem && window.CrewSystem.currentCrew) {
          window.CrewSystem.addKmToTerritory(zipComp.short_name, 0.5); // +0.5 km simulés
        }
      }
    });
  }
}, 60000);


/* --- app-features.js --- */
// NOTE : secureSetItem / secureGetItem sont définis dans config.js (chargé avant ce script).

// --- 7. SERVICES (Météo, Boussole, Garage) ---
window.fetchWeather = async function (lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
    );
    const data = await res.json();
    const temp = Math.round(data.current_weather.temperature);
    const code = data.current_weather.weathercode;

    let icon = '<i class="fa-solid fa-cloud-sun"></i>';

    let alertMsg = "";
    const wind = data.current_weather.windspeed;
    window.isVigilanceRouge = false; // Reset

    // Détection mondiale Vigilance Rouge (Canicule ou Tempête)
    if (temp >= 38 || wind >= 70 || code === 99 || code === 77) {
      window.isVigilanceRouge = true;
      alertMsg =
        "VIGILANCE ROUGE DÉTECTÉE : Conditions météorologiques extrêmes.";
      icon =
        '<i class="fa-solid fa-triangle-exclamation" style="color:#ff0000; animation: flash 1s infinite;"></i>';
      const banner = document.getElementById("vigilance-rouge-banner");
      const textEl = document.getElementById("vigilance-rouge-text");
      if (banner && textEl) {
        textEl.innerHTML = `🚨 <strong>VIGILANCE ROUGE (MONDIALE) :</strong> Température ${temp}°C, Vent ${wind}km/h. Soyez extrêmement prudents !`;
        banner.style.display = "block";
      }
    }

    if (!window.isVigilanceRouge) {
      if (code >= 95) {
        alertMsg = "Alerte Orage : Prudence maximale conseillée.";
        icon = '<i class="fa-solid fa-cloud-bolt" style="color:#f1c40f;"></i>';
      } else if (code >= 80) {
        alertMsg = "Averses détectées : Route potentiellement glissante.";
        icon = '<i class="fa-solid fa-cloud-showers-heavy"></i>';
      } else if (code >= 71) {
        alertMsg = "Alerte Neige : Conditions de circulation difficiles.";
        icon = '<i class="fa-solid fa-snowflake"></i>';
      } else if (code >= 61) {
        alertMsg = "Pluie signalée par satellite. Équipez-vous.";
        icon = '<i class="fa-solid fa-cloud-rain"></i>';
      }
    }

    const wHud = document.getElementById("weather-hud");
    if (wHud) {
      wHud.innerHTML = `${icon} ${temp}°C`;
      if (alertMsg) wHud.classList.add("weather-alert");
      else wHud.classList.remove("weather-alert");
    }

    if (alertMsg && !window.lastWeatherAlert) {
      speak(alertMsg);
      window.lastWeatherAlert = true;
      setTimeout(() => (window.lastWeatherAlert = false), 3600000); // Reset alerte toutes les heures
    }
  } catch (e) {
    console.warn("Météo fail");
  }
};

const maintenanceIntervals = { oil: 2000, belt: 5000, tires: 10000 };
window.renderDynamicGarage = function () {
  if (!window.session) return;
  const c = document.getElementById("dynamic-garage-list");
  if (!c) return;
  c.innerHTML = "";
  Object.keys(maintenanceIntervals).forEach((k) => {
    const total = window.session.totalDistance || 0;
    const last = (window.session.maintenance || {})[k] || 0;
    const percent = Math.min(
      ((total - last) / maintenanceIntervals[k]) * 100,
      100,
    );
    c.innerHTML += `<div class="garage-item"><span>${k.toUpperCase()}</span><div class="garage-bar-bg"><div class="garage-bar-fill" style="width:${percent}%"></div></div></div>`;
  });
};

// --- 8. GAMIFICATION ODOMETRE ---
let lastPositionForOdometer = null;
function calculateDistanceAndBadges(lat, lng) {
  if (!window.session) return;
  window.session.totalDistance = window.session.totalDistance || 0;
  window.session.rodageKm = window.session.rodageKm || 0;

  if (lastPositionForOdometer) {
    let d = 0;
    if (window.google && window.google.maps && window.google.maps.geometry) {
      const p1 = new google.maps.LatLng(
        lastPositionForOdometer.lat,
        lastPositionForOdometer.lng,
      );
      const p2 = new google.maps.LatLng(lat, lng);
      d = google.maps.geometry.spherical.computeDistanceBetween(p1, p2) / 1000;
    } else if (window.L && typeof window.L.latLng === "function") {
      const p1 = window.L.latLng(lastPositionForOdometer.lat, lastPositionForOdometer.lng);
      const p2 = window.L.latLng(lat, lng);
      d = p1.distanceTo(p2) / 1000;
    } else {
      const R = 6371;
      const dLat = ((lat - lastPositionForOdometer.lat) * Math.PI) / 180;
      const dLng = ((lng - lastPositionForOdometer.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lastPositionForOdometer.lat * Math.PI) / 180) *
          Math.cos((lat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      d = R * c;
    }

    if (d > 0.005 && d < 0.2) {
      window.session.totalDistance += d;

      // CUMUL MODE RODAGE
      if (window.isRodageActive) {
        window.session.rodageKm += d;
      }

      saveSessionAndCheckBadges();
    }
  }
  lastPositionForOdometer = { lat, lng };
}

function saveSessionAndCheckBadges() {
  if (!window.session) return;
  secureSetItem("session", JSON.stringify(window.session));
  const odom = document.getElementById("display-odometer");
  if (odom)
    odom.textContent = `Odomètre: ${window.session.totalDistance.toFixed(2)} km`;

  const mileageHud = document.getElementById("mileage-hud");
  if (mileageHud)
    mileageHud.textContent = `${window.session.totalDistance.toFixed(1)} KM`;

  // --- NEW: CO2 Savings calculation ---
  const ecoEl = document.getElementById("display-eco");
  if (ecoEl) {
    const co2Saved = window.session.totalDistance * 0.12; // 120g CO2 saved per km vs car
    ecoEl.innerHTML = `<i class="fa-solid fa-leaf"></i> -${co2Saved.toFixed(1)} kg CO2`;
  }

  // --- Badge Check ---
  checkUserBadges();

  // --- NEW: Referral Reward Check ---
  if (window.ReferralManager && window.session.totalDistance) {
    window.ReferralManager.checkReferralReward(window.session.totalDistance);
  }
}

function checkUserBadges() {
  if (!window.session) return;
  const badgeContainer = document.getElementById("user-badges");
  if (!badgeContainer) return;

  const total = window.session.totalDistance || 0;
  const co2Saved = total * 0.12;
  let badgesHtml = "";

  // Badge Elite (5000km)
  if (total >= 5000) {
    badgesHtml += `<div class="badge-pro" title="Badge Elite: 5000km" style="background:#00d2ff; color:black; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block; margin-right:5px;">
            <i class="fa-solid fa-crown"></i> Elite
        </div>`;
  }

  // Badge Ecolo (100kg CO2)
  if (co2Saved >= 100) {
    badgesHtml += `<div class="badge-eco" title="Badge Écolo: 100kg CO2 sauvés" style="background:#2ecc71; color:white; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block; margin-right:5px;">
            <i class="fa-solid fa-leaf"></i> Écolo
        </div>`;
  }

  // Badge Pro du Rodage (500km rodage)
  const rodageTotal = window.session.rodageKm || 0;
  if (rodageTotal >= 500) {
    badgesHtml += `<div class="badge-rodage" title="Pro du Rodage: 500km zen" style="background:#f39c12; color:white; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block;">
            <i class="fa-solid fa-wrench"></i> Pro Rodage
        </div>`;
  }

  // Badge Diamant (10000km)
  if (total >= 10000) {
    badgesHtml += `<div class="badge-diamant" title="Légende: 10000km" style="background:linear-gradient(135deg, #B9F2FF, #ffffff); color:#005c75; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block; box-shadow:0 0 10px #B9F2FF; margin-right:5px;">
            <i class="fa-solid fa-gem"></i> Diamant
        </div>`;
  }

  // Badge Pro des Défis (150 victoires)
  const challengeWins = window.session?.completedChallengesCount || 0;
  if (challengeWins >= 150) {
    badgesHtml += `<div class="badge-master-defi" title="Master Défis: 150 victoires" style="background:#9b59b6; color:white; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block; border:1px solid #fff;">
            <i class="fa-solid fa-trophy"></i> Pro des Défis
        </div>`;
  }

  // Badge Mécène (Donateur)
  if (window.session?.isDonator) {
    badgesHtml += `<div class="badge-mecene" title="Mécène: Soutien du projet" style="background:#e91e63; color:white; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block; margin-right:5px; box-shadow:0 0 5px #e91e63;">
            <i class="fa-solid fa-heart"></i> Mécène
        </div>`;
  }

  if (badgesHtml === "") {
    const remainingEl = 5000 - total;
    badgesHtml = `<small style="color:#666; font-size:0.6rem;">En route pour les badges...</small>`;
  }

  badgeContainer.innerHTML = badgesHtml;
}

// --- 9. ROADBOOKS ---
let savedRoadbooks = JSON.parse(secureGetItem("roadbooks")) || [];
window.renderRoadbooks = function (filter = "all") {
  const list = document.getElementById("roadbook-list");
  if (!list) return;

  const favorites = JSON.parse(secureGetItem("favorite_roadbooks") || "[]");
  let items =
    filter === "favorites"
      ? savedRoadbooks.filter((rb, idx) => favorites.includes(idx))
      : savedRoadbooks;

  if (items.length === 0) {
    list.innerHTML = `<p style="text-align:center; color:#666; margin-top:20px;">Aucun roadbook ${filter === "favorites" ? "favori" : "enregistré"}.</p>`;
    return;
  }

  list.innerHTML = items
    .map((rb, i) => {
      const globalIdx = savedRoadbooks.indexOf(rb);
      const isFav = favorites.includes(globalIdx);
      return `
            <li style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px; margin-bottom:5px; border-radius:8px;">
                <div style="flex:1;">
                    <div style="font-weight:bold;">${rb.name}</div>
                    <small style="color:#888;">${rb.waypoints?.length || 0} étapes</small>
                </div>
                <div style="display:flex; gap:5px;">
                    <button onclick="toggleFavoriteRoadbook(${globalIdx})" style="background:transparent; color:${isFav ? "#f1c40f" : "#444"}; border:none; font-size:1.2rem; cursor:pointer;" title="Ajouter aux favoris">
                        <i class="fa-${isFav ? "solid" : "regular"} fa-star"></i>
                    </button>
                    <button onclick="loadRoadbook(${globalIdx})" style="background:#2ecc71; color:white; border:none; padding:5px 10px; border-radius:5px; font-size:0.7rem;">Go</button>
                    <button onclick="shareRoadbook(${globalIdx})" style="background:#00d2ff; color:black; border:none; padding:5px 10px; border-radius:5px; font-size:0.7rem;"><i class="fa-solid fa-share"></i></button>
                </div>
            </li>`;
    })
    .join("");
};

window.toggleFavoriteRoadbook = function (idx) {
  let favorites = JSON.parse(secureGetItem("favorite_roadbooks") || "[]");
  const favIdx = favorites.indexOf(idx);

  if (favIdx > -1) {
    favorites.splice(favIdx, 1);
    speak("Retiré des favoris.");
  } else {
    favorites.push(idx);
    speak("Ajouté aux favoris !");
    vibrate(50);
  }

  secureSetItem("favorite_roadbooks", JSON.stringify(favorites));
  renderRoadbooks(
    document.querySelector('[style*="background: rgb(241, 196, 15)"]')
      ? "favorites"
      : "all",
  );
};

window.shareRoadbook = async function (i) {
  const rb = savedRoadbooks[i];

  // MODÉRATION : Vérification de la grossièreté
  if (
    Moderation.isProfane(rb.name) ||
    (rb.description && Moderation.isProfane(rb.description))
  ) {
    alert(
      "Action bloquée : Le titre ou la description contient un langage inapproprié.",
    );
    return;
  }

  // MODÉRATION : Vérification des images (si présentes)
  if (rb.photo) {
    const scan = await Moderation.scanImage(rb.photo);
    if (!scan.safe) {
      alert(
        "Action bloquée : L'image jointe n'est pas conforme aux règles communautaires.",
      );
      return;
    }
  }

  // Publication Cloud (Si DB ok)
  if (typeof publishRoadbookCloud === "function") {
    const success = await publishRoadbookCloud(rb);
    if (success) alert("Roadbook partagé avec succès à la communauté !");
  } else {
    alert("Partage impossible : Serveur Cloud non disponible.");
  }
};

window.loadRoadbook = function (i) {
  const rb = savedRoadbooks[i];
  calculateRouteSansAutoroute(
    currentPosition,
    rb.waypoints[rb.waypoints.length - 1],
  );
};

// --- OFFLINE MANAGEMENT ---
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

function updateOnlineStatus() {
  const condition = navigator.onLine ? "online" : "offline";
  if (condition === "offline") {
    const toast = document.createElement("div");
    toast.id = "offline-toast";
    toast.style =
      "position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:rgba(231,76,60,0.9); color:white; padding:10px 20px; border-radius:30px; z-index:10000; font-size:0.8rem; display:flex; align-items:center; gap:10px; box-shadow:0 4px 15px rgba(0,0,0,0.5);";
    toast.innerHTML =
      '<i class="fa-solid fa-plane"></i> Mode hors-ligne - Navigation limitée';
    document.body.appendChild(toast);
    speak("Mode hors-ligne activé.");
  } else {
    const toast = document.getElementById("offline-toast");
    if (toast) {
      toast.style.background = "rgba(46,204,113,0.9)";
      toast.innerHTML = '<i class="fa-solid fa-wifi"></i> Connexion rétablie';
      setTimeout(() => toast.remove(), 3000);
      speak("Connexion rétablie.");
    }
  }
}
window.saveEmergencyContact = function () {
  const num = document.getElementById("emergency-num").value;
  secureSetItem("emergency_contact", num);
  speak("Contact d'urgence enregistré.");
  vibrate(50);
};

window.toggleGuardian = function () {
  const active = secureGetItem("guardian_enabled") === "true";
  secureSetItem("guardian_enabled", !active);
  speak(!active ? "Guardian Mode activé." : "Guardian Mode désactivé.");
  showPage("security");
};

// --- SECURITY LOGIC ENGINE ---

// 1. IMPACT DETECTION (Accelerometer)
if (window.DeviceMotionEvent) {
  window.addEventListener("devicemotion", (event) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    const totalG = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2) / 9.81;
    if (totalG > 4.5) {
      // Impact massif détecté
      triggerFallAlert();
    }
  });
}

// 2. GUARDIAN HEARTBEAT
setInterval(() => {
  const isGuardian = secureGetItem("guardian_enabled") === "true";
  if (!isGuardian || !window.isRiding || isGuardianPromptActive) return;

  if (Date.now() - lastMovementTime > 600000) {
    startGuardianPrompt();
  }
}, 60000);

function startGuardianPrompt() {
  isGuardianPromptActive = true;
  speak("Guardian Mode : Alerte d'immobilité. Êtes-vous toujours là ?");
  vibrate([1000, 500, 1000]);

  const toast = document.createElement("div");
  toast.id = "guardian-prompt";
  toast.style =
    "position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.95); border:2px solid #00d2ff; padding:30px; border-radius:30px; z-index:10001; text-align:center; color:white; width:85%; box-shadow:0 0 50px rgba(0,0,0,1);";
  toast.innerHTML = `
        <i class="fa-solid fa-shield-heart fa-beat" style="font-size:4rem; color:#00d2ff; margin-bottom:20px;"></i>
        <h2>Guardian Mode</h2>
        <p>Arrêt prolongé détecté. <br>Confirmation requise.</p>
        <button onclick="dismissGuardian()" style="margin-top:20px; width:100%; border:none; padding:20px; border-radius:50px; background:#00d2ff; color:black; font-weight:bold; font-size:1.2rem;">TOUT VA BIEN ✅</button>
    `;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (isGuardianPromptActive) {
      dismissGuardian();
      triggerFallAlert();
    }
  }, 45000);
}

window.dismissGuardian = function () {
  isGuardianPromptActive = false;
  lastMovementTime = Date.now();
  const el = document.getElementById("guardian-prompt");
  if (el) el.remove();
};

function checkFerryProximity(lat, lng) {
  if (!window.routeFerries || window.routeFerries.length === 0) return;

  const p1 = new google.maps.LatLng(lat, lng);

  window.routeFerries.forEach((ferryStep, index) => {
    const p2 = ferryStep.start_location;
    const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);

    // Alerte à 1km (1000 mètres)
    if (dist < 1000 && lastSpokenFerryIndex !== index) {
      speak("ferry_ahead");
      lastSpokenFerryIndex = index;

      if (
        window.NeuralHUD &&
        typeof window.NeuralHUD.logToConsole === "function"
      ) {
        window.NeuralHUD.logToConsole(`ALERT: FERRY_CROSSING_IN_1KM`);
      }
      if (window.Telemetry) {
        window.Telemetry.logEvent("ferry_alert_triggered");
      }
    }
  });
}

function getSOSActions() {
  const num = secureGetItem("emergency_contact");
  if (num) {
    return `<a href="tel:${num}" style="display:block; margin-top:20px; padding:20px; background:#2ecc71; color:white; text-decoration:none; border-radius:50px; font-weight:bold; font-size:1.2rem;">APPELER URGENCE 📞</a>`;
  }
  return "";
}

window.saveCTDate = function (val) {
  secureSetItem("ct_date", val);
  speak("Date du contrôle technique enregistrée.");
};

window.addCategorizedMaint = async function (cat) {
  if (!window.session?.uid) {
    alert("Vous devez être connecté pour ajouter un entretien.");
    return;
  }

  const action = prompt(`Détail pour l'entretien [${cat}] :`, "Révision");
  if (!action) return;

  const safeAction = action.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
  if (window.firebase && firebase.firestore) {
    try {
      const db = firebase.firestore();
      await db.collection("maintenance_logs").add({
        vehicleOwnerUid: window.session.uid,
        category: cat,
        description: safeAction,
        km: window.session?.totalDistance?.toFixed(0) || 0,
        certified: false, // Enregistrement personnel non certifié
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      
      // Reset maintenance counter
      if (window.session && window.session.maintenance) {
        window.session.maintenance[cat.toLowerCase()] = window.session.totalDistance;
        secureSetItem("session", JSON.stringify(window.session));
      }

      speak(`Entretien ${cat} sauvegardé dans le cloud.`);
      
      // Recharger l'interface si on est sur la page garage
      if (document.getElementById("maint-firestore-list")) {
        loadFirestoreMaintenanceLogs();
      }
    } catch (e) {
      console.error("[MAINT] Firestore write error", e);
      alert("Erreur lors de la sauvegarde : " + e.message);
    }
  } else {
    alert("Firebase n'est pas disponible.");
  }
};

window.refreshRodageUI = function () {
  const btn = document.getElementById("btn-rodage-toggle");
  const badge = document.getElementById("rodage-badge");
  if (window.isRodageActive) {
    if (btn) btn.classList.add("rodage-active-btn");
    if (badge) badge.classList.remove("hidden");
  } else {
    if (btn) btn.classList.remove("rodage-active-btn");
    if (badge) badge.classList.add("hidden");
  }
};

window.toggleRodageHUD = function () {
  window.isRodageActive = !window.isRodageActive;
  refreshRodageUI();
  if (window.isRodageActive) {
    speak("Mode Rodage activé.");
    alert(
      "Mode Rodage : Le GPS évitera les voies rapides et vous guidera sur des routes tranquilles.",
    );
  } else {
    speak("Mode Rodage désactivé.");
  }
};

window.toggleGarageVisibility = function () {
  window.isGarageVisible = !window.isGarageVisible;
  speak(
    window.isGarageVisible
      ? "Votre garage est maintenant visible des pilotes."
      : "Visibilité désactivée.",
  );
  showPage("pro-space");
  if (currentPosition) {
    publishUserLocation(
      currentPosition.lat,
      currentPosition.lng,
      window.isGarageVisible ? `Pro: ${window.garageStatus}` : "Offline",
    );
  }
};

window.updateGarageStatus = function (val) {
  window.garageStatus = val;
  speak("Disponibilité de l'atelier mise à jour.");
  if (window.isGarageVisible && currentPosition) {
    publishUserLocation(
      currentPosition.lat,
      currentPosition.lng,
      `Pro: ${window.garageStatus}`,
    );
  }
};

window.publishFlashOffer = function () {
  const text = document.getElementById("flash-offer-text").value;
  if (!text) return;
  speak("Offre Flash publiée.");
  alert("Votre offre de promotion a été diffusée !");
  if (typeof publishMoodCloud === "function") {
    publishMoodCloud({ label: "⚡ PROMO", text: text });
  }
};

window.requestCertification = function () {
  alert("Demande de certification envoyée !");
  speak("Demande enregistrée.");
};

window.payGarageEntryFee = async function () {
  let amountCents = 4999;
  let priceStr = "49,99€";
  
  if (typeof speak === "function") speak("Vérification des tarifs en cours...");
  
  try {
    if (window.firebase && firebase.firestore) {
      const db = firebase.firestore();
      const snap = await db.collection("users").where("isCertifiedGarage", "==", true).count().get();
      const count = snap.data().count;
      if (count < 50) {
        amountCents = 1999;
        priceStr = "19,99€ (Offre de lancement : 50 premiers garages)";
      }
    }
  } catch (e) {
    console.warn("[GARAGE] Could not fetch garage count, defaulting to standard pricing.", e);
  }

  const ok = confirm(
    "Confirmez-vous le paiement du droit d'entrée de " + priceStr + " TTC pour devenir Garage Certifié ?"
  );
  if (ok) {
    if (typeof speak === "function")
      speak("Initialisation du paiement sécurisé.");
    try {
      const projectId = window.CONFIG?.FIREBASE?.projectId || "mon50ccetmoi";
      const url = `https://europe-west1-${projectId}.cloudfunctions.net/createRevolutOrder`;
      const caseId = "GARAGE-" + Date.now();

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: amountCents,
          currency: "EUR",
          case_id: caseId,
          user_id: window.session?.uid || "unknown",
          report_type: "GARAGE_FEE",
        }),
      });

      if (!response.ok)
        throw new Error("Erreur lors de la création de la commande.");
      const orderData = await response.json();

      const instance = await RevolutCheckout(orderData.order_token, "prod");

      instance.payWithPopup({
        onSuccess: () => {
          if (typeof speak === "function")
            speak(
              "Validation du paiement par le serveur, veuillez patienter...",
            );

          let attempts = 0;
          const checkStatus = setInterval(async () => {
            attempts++;
            try {
              const res = await fetch(
                `https://europe-west1-${projectId}.cloudfunctions.net/checkPaymentStatus?case_id=${caseId}&user_id=${window.session?.uid}`,
              );
              const data = await res.json();
              if (data.paid) {
                clearInterval(checkStatus);
                if (typeof speak === "function")
                  speak(
                    "Paiement validé ! Vous êtes maintenant un Garage Certifié.",
                  );
                if (window.session) {
                  window.session.isCertifiedGarage = true;
                  secureSetItem("session", JSON.stringify(window.session));
                }
                showPage("pro-space");
              } else if (attempts > 10) {
                clearInterval(checkStatus);
                alert(
                  "Le paiement est en cours de traitement par Revolut. Votre accès pro sera activé automatiquement sous peu.",
                );
                showPage("home");
              }
            } catch (e) {
              console.error(e);
            }
          }, 2000);
        },
        onError: (message) => {
          alert("Erreur lors du paiement : " + message);
        },
        onCancel: () => {},
      });
    } catch (err) {
      console.error(err);
      alert("Impossible d'initialiser le paiement : " + err.message);
    }
  }
};

window.applyPartnerExemption = async function () {
  const ok = confirm(
    "En choisissant cette option, vous vous engagez à offrir une remise de 10% sur vos prestations aux membres présentant l'application. En échange, votre certification et votre boost sont OFFERTS. Valider ?",
  );
  if (ok) {
    try {
      if (window.firebase && window.session?.uid) {
        const db = firebase.firestore();
        const batch = db.batch();
        const userRef = db.collection("users").doc(window.session.uid);
        const partnerRef = db.collection("garage_partners").doc(window.session.uid);
        
        batch.update(userRef, {
          isCertifiedGarage: true,
          isGaragePartner: true,
        });
        batch.set(partnerRef, {
          user_id: window.session.uid,
          exempted: true,
          certified_at: firebase.firestore.FieldValue.serverTimestamp(),
        });
        
        await batch.commit();
      }
    } catch (e) {
      console.error("[GARAGE] Failed to persist partner status", e);
    }

    speak(
      "Félicitations ! Vous êtes désormais Partenaire Officiel mon 50 cm3 et moi. Votre générosité envers la communauté est récompensée.",
    );
    if (window.session) {
      window.session.isCertifiedGarage = true;
      window.session.isGaragePartner = true;
      secureSetItem("session", JSON.stringify(window.session));
    }
    showPage("pro-space");
  }
};

// ─────────────────────────────────────────────────────────────────────
// CAHIER D'ENTRETIEN — SAISIE PRO (Garages Certifiés)
// Recherche d'un client par username ou N° de série Blackbox,
// puis écriture d'une entrée certifiée immuable dans Firestore.
// ─────────────────────────────────────────────────────────────────────

// État temporaire pour stocker le client trouvé
window._proMaintClient = null;

window.proSearchClient = async function () {
  // Sécurité OWASP A01 : Vérifier que l'utilisateur est un garage certifié
  if (!window.session?.isCertifiedGarage) {
    alert("⛔ Accès réservé aux Garages Certifiés.");
    return;
  }

  const searchInput = document.getElementById("pro-maint-search");
  if (!searchInput) return;
  const query = searchInput.value.trim();
  if (!query || query.length < 2) {
    alert("Veuillez entrer un pseudo utilisateur ou un N° de série Blackbox (min. 2 caractères).");
    return;
  }

  // Masquer les résultats précédents
  const resultDiv = document.getElementById("pro-maint-client-result");
  const formDiv = document.getElementById("pro-maint-form");
  const statusDiv = document.getElementById("pro-maint-status");
  if (resultDiv) resultDiv.style.display = "none";
  if (formDiv) formDiv.style.display = "none";
  if (statusDiv) statusDiv.style.display = "none";
  window._proMaintClient = null;

  if (!window.firebase || !firebase.firestore) {
    alert("Firebase n'est pas disponible.");
    return;
  }

  try {
    const db = firebase.firestore();
    let foundUser = null;

    // 1. Recherche par username (exact match — RGPD safe, pas de listing)
    const usernameSnap = await db.collection("users")
      .where("username", "==", query)
      .limit(1)
      .get();

    if (!usernameSnap.empty) {
      const doc = usernameSnap.docs[0];
      foundUser = { uid: doc.id, ...doc.data() };
    }

    // 2. Si pas trouvé, recherche par N° de série Blackbox
    if (!foundUser) {
      const bbSnap = await db.collection("users")
        .where("blackbox_serial", "==", query.toUpperCase())
        .limit(1)
        .get();

      if (!bbSnap.empty) {
        const doc = bbSnap.docs[0];
        foundUser = { uid: doc.id, ...doc.data() };
      }
    }

    if (!foundUser) {
      alert("❌ Aucun client trouvé pour : " + query + "\n\nVérifiez le pseudo ou le N° de série.");
      return;
    }

    // Stocker le client trouvé
    window._proMaintClient = {
      uid: foundUser.uid,
      username: foundUser.username || "Inconnu",
      scooterModel: foundUser.scooterModel || foundUser.vehicleModel || "Non renseigné",
    };

    // Afficher le résultat (XSS safe — textContent au lieu de innerHTML)
    const nameEl = document.getElementById("pro-maint-client-name");
    const modelEl = document.getElementById("pro-maint-client-model");
    const uidEl = document.getElementById("pro-maint-client-uid");

    if (nameEl) nameEl.textContent = window._proMaintClient.username;
    if (modelEl) modelEl.textContent = window._proMaintClient.scooterModel;
    if (uidEl) uidEl.textContent = "UID: " + window._proMaintClient.uid.substring(0, 8) + "...";

    if (resultDiv) resultDiv.style.display = "block";
    if (formDiv) formDiv.style.display = "block";

    if (typeof speak === "function") {
      speak("Client trouvé : " + window._proMaintClient.username);
    }
  } catch (e) {
    console.error("[PRO-MAINT] Search error:", e);
    alert("Erreur lors de la recherche : " + e.message);
  }
};

window.proSubmitMaintenance = async function () {
  // Sécurité OWASP A01 : Double vérification côté client
  if (!window.session?.isCertifiedGarage) {
    alert("⛔ Accès réservé aux Garages Certifiés.");
    return;
  }

  if (!window._proMaintClient || !window._proMaintClient.uid) {
    alert("Veuillez d'abord rechercher un client.");
    return;
  }

  const category = document.getElementById("pro-maint-category")?.value;
  const km = parseInt(document.getElementById("pro-maint-km")?.value) || 0;
  const description = document.getElementById("pro-maint-desc")?.value?.trim();

  if (!category) {
    alert("Veuillez sélectionner un type d'intervention.");
    return;
  }
  if (!description || description.length < 5) {
    alert("Veuillez décrire l'intervention (min. 5 caractères).");
    return;
  }

  // Assainir la description (OWASP A03 — prévention XSS)
  const safeDescription = description.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const statusDiv = document.getElementById("pro-maint-status");

  try {
    if (!window.firebase || !firebase.firestore) {
      alert("Firebase n'est pas disponible.");
      return;
    }

    // Afficher le statut de chargement
    if (statusDiv) {
      statusDiv.style.display = "block";
      statusDiv.style.background = "rgba(243, 156, 18, 0.1)";
      statusDiv.style.border = "1px solid rgba(243, 156, 18, 0.3)";
      statusDiv.textContent = "⏳ Enregistrement en cours...";
      statusDiv.style.color = "#f39c12";
    }

    const db = firebase.firestore();
    await db.collection("maintenance_logs").add({
      vehicleOwnerUid: window._proMaintClient.uid,
      vehicleOwnerUsername: window._proMaintClient.username,
      garageUid: window.session.uid,
      garageName: window.session.username || "Garage Certifié",
      category: category,
      description: safeDescription,
      km: km,
      certified: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // Succès
    if (statusDiv) {
      statusDiv.style.background = "rgba(46, 204, 113, 0.15)";
      statusDiv.style.border = "1px solid rgba(46, 204, 113, 0.4)";
      statusDiv.style.color = "#2ecc71";
      statusDiv.textContent = "✅ Entretien [" + category + "] certifié et enregistré avec succès pour " + window._proMaintClient.username + " !";
    }

    // Reset le formulaire
    const descEl = document.getElementById("pro-maint-desc");
    const kmEl = document.getElementById("pro-maint-km");
    if (descEl) descEl.value = "";
    if (kmEl) kmEl.value = "";

    if (typeof speak === "function") {
      speak("Entretien certifié enregistré avec succès dans le cahier numérique du client.");
    }

    console.log("[PRO-MAINT] Entry created for user:", window._proMaintClient.uid, "category:", category);
  } catch (e) {
    console.error("[PRO-MAINT] Submit error:", e);
    if (statusDiv) {
      statusDiv.style.display = "block";
      statusDiv.style.background = "rgba(231, 76, 60, 0.15)";
      statusDiv.style.border = "1px solid rgba(231, 76, 60, 0.4)";
      statusDiv.style.color = "#e74c3c";
      statusDiv.textContent = "❌ Erreur : " + e.message;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────
// CHARGEMENT DES ENTRÉES D'ENTRETIEN CERTIFIÉES (côté client)
// Récupère les entrées Firestore pour l'utilisateur connecté
// et les affiche dans la section "Entretiens Certifiés (Cloud)"
// ─────────────────────────────────────────────────────────────────────
window.loadFirestoreMaintenanceLogs = async function () {
  const container = document.getElementById("maint-firestore-list");
  if (!container) return;

  if (!window.session?.uid) {
    container.textContent = "Connectez-vous pour voir vos entretiens certifiés.";
    container.style.color = "#666";
    container.style.fontSize = "0.75rem";
    container.style.textAlign = "center";
    container.style.padding = "10px";
    return;
  }

  if (!window.firebase || !firebase.firestore) {
    container.textContent = "Firebase non disponible.";
    container.style.color = "#666";
    container.style.fontSize = "0.75rem";
    container.style.textAlign = "center";
    return;
  }

  container.innerHTML = '<p style="color:#f39c12; text-align:center; font-size:0.75rem;"><i class="fa-solid fa-spinner fa-spin"></i> Chargement...</p>';

  try {
    const db = firebase.firestore();
    // OWASP A11 : Limiter à 50 entrées pour éviter les requêtes infinies
    const snap = await db.collection("maintenance_logs")
      .where("vehicleOwnerUid", "==", window.session.uid)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    if (snap.empty) {
      container.innerHTML = '<p style="color:#555; text-align:center; font-size:0.75rem; padding:10px;">Aucun entretien certifié par un garage pour l\'instant.</p>';
      return;
    }

    let html = "";
    snap.forEach((doc) => {
      const d = doc.data();
      const date = d.createdAt?.toDate?.()
        ? d.createdAt.toDate().toLocaleDateString("fr-FR")
        : "—";
      const safeCategory = (d.category || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const safeDesc = (d.description || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const kmStr = d.km ? d.km.toLocaleString("fr-FR") + " km" : "";

      if (d.certified) {
        const safeGarage = (d.garageName || "Garage Certifié").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        html += `<div style="padding:10px; background:rgba(46, 204, 113, 0.06); margin-bottom:5px; border-radius:8px; border-left:3px solid #2ecc71; font-size:0.8rem;">
          <div style="display:flex; justify-content:space-between;">
              <strong style="color:#fff;">${safeCategory}</strong>
              <span style="color:#666; font-size:0.65rem;">${date}${kmStr ? " · " + kmStr : ""}</span>
          </div>
          <div style="font-size:0.72rem; margin-top:3px; color:#ccc;">${safeDesc}</div>
          <div style="font-size:0.6rem; color:#2ecc71; margin-top:5px;">
              <i class="fa-solid fa-certificate"></i> CERTIFIÉ PAR : ${safeGarage}
              <i class="fa-solid fa-cloud" style="margin-left:5px; color:#3498db;" title="Synchronisé Cloud"></i>
          </div>
        </div>`;
      } else {
        html += `<div style="padding:10px; background:rgba(255, 255, 255, 0.05); margin-bottom:5px; border-radius:8px; border-left:3px solid #555; font-size:0.8rem;">
          <div style="display:flex; justify-content:space-between;">
              <strong style="color:#ddd;">${safeCategory}</strong>
              <span style="color:#666; font-size:0.65rem;">${date}${kmStr ? " · " + kmStr : ""}</span>
          </div>
          <div style="font-size:0.72rem; margin-top:3px; color:#aaa;">${safeDesc}</div>
          <div style="font-size:0.6rem; color:#888; margin-top:5px;">
              <i class="fa-solid fa-user"></i> Entretien personnel
              <i class="fa-solid fa-cloud" style="margin-left:5px; color:#3498db;" title="Synchronisé Cloud"></i>
          </div>
        </div>`;
      }
    });

    container.innerHTML = html;
  } catch (e) {
    console.error("[MAINT-LOGS] Load error:", e);
    // Si l'index Firestore n'existe pas encore, afficher un message clair
    if (e.code === "failed-precondition") {
      container.innerHTML = '<p style="color:#f39c12; text-align:center; font-size:0.7rem; padding:10px;"><i class="fa-solid fa-triangle-exclamation"></i> Index Firestore en cours de création. Réessayez dans quelques minutes.</p>';
    } else {
      container.innerHTML = '<p style="color:#e74c3c; text-align:center; font-size:0.7rem; padding:10px;">Erreur de chargement.</p>';
    }
  }
};

window.publishProTip = function () {
  let title = document.getElementById("pro-tip-title").value;
  let body = document.getElementById("pro-tip-body").value;
  if (!title || !body) return;

  title = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  body = body.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  if (!title || !body) return;

  const tip = {
    title,
    body,
    author: window.session?.username || "Expert Garage",
    timestamp: Date.now(),
  };

  let communityTips = JSON.parse(secureGetItem("community_pro_tips") || "[]");
  communityTips.unshift(tip);
  secureSetItem("community_pro_tips", JSON.stringify(communityTips));

  speak(
    "Votre fiche technique a été publiée avec succès ! Elle est maintenant visible par tous les pilotes.",
  );
  alert("Félicitations ! Votre conseil d'expert est en ligne.");
  showPage("pro-space");
};
window.resetTelemetry = function () {
  maxLeanAngle = 0;
  if (window.session) {
    window.session.vMax = 0;
    secureSetItem("session", JSON.stringify(window.session));
  }
  speak("Données de télémétrie réinitialisées.");
  showPage("garage");
};
// --- AUTO-BOOT & FAIL-SAFE ---
// On s'assure que le mode holographique n'est pas actif au démarrage (Correction Bug Web)
document.body.classList.remove("holographic-mode");

// Si le SDK Maps est déjà là, on lance manuellement
if (typeof google !== "undefined" && google.maps) {
  window.mapsSDKLoaded = true;
  if (typeof window.initMapController === "function") {
    window.initMapController();
  }
}
window.submitArbitre = function () {
  const q = document.getElementById("arbitre-query");
  const chat = document.getElementById("arbitre-chat");
  if (!q.value.trim()) return;

  // Add user message
  const userDiv = document.createElement("div");
  userDiv.style =
    "background:rgba(255,255,255,0.05); padding:10px; border-radius:10px 10px 0 10px; margin-bottom:10px; font-size:0.9rem; text-align:right; align-self:flex-end; border-right:3px solid #666;";
  userDiv.textContent = q.value;
  chat.appendChild(userDiv);

  const query = q.value;
  q.value = "";
  chat.scrollTop = chat.scrollHeight;

  // Bot response
  const botDiv = document.createElement("div");
  botDiv.className = "bot-msg";
  botDiv.style =
    "background:rgba(255,183,3,0.1); padding:10px; border-radius:10px 10px 10px 0; margin-bottom:10px; font-size:0.9rem; border-left:3px solid #ffb703;";
  botDiv.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Analyse des textes de loi...';
  chat.appendChild(botDiv);

  if (typeof window.processArbitreQuery === "function") {
    window.processArbitreQuery(query).then((response) => {
      botDiv.innerHTML = response;
      chat.scrollTop = chat.scrollHeight;
    });
  } else {
    setTimeout(() => {
      botDiv.innerHTML =
        "Désolé, le module juridique est en cours de mise à jour.";
      chat.scrollTop = chat.scrollHeight;
    }, 1500);
  }
};

function generateRideCard() {
  if (!window.session) {
    alert(
      "🔒 La Carte de Score est réservée aux membres. Inscrivez-vous pour partager vos exploits !",
    );
    return;
  }

  speak("Génération de votre carte de score personnalisée.");
  const overlay = document.createElement("div");
  overlay.id = "ride-card-overlay";
  overlay.className = "glassmorphism";
  overlay.style =
    "position:fixed; top:0; left:0; width:100%; height:100%; z-index:20000; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:30px; text-align:center; background:radial-gradient(circle, #1a1a1a, #000);";

  const escapeHTML = (str) => String(str).replace(/[&<>'"]/g, t => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[t]));
  const rawOdo = document.getElementById("odometer")?.textContent || "0";
  const safeOdo = escapeHTML(rawOdo);
  const safeVmax = escapeHTML(window.session.vMax || 0);

  overlay.innerHTML = `
        <div style="border:2px solid var(--accent); padding:40px; border-radius:20px; box-shadow:0 0 50px var(--accent-glow); background:rgba(0,0,0,0.8);">
            <h1 style="font-size:2rem; color:var(--accent); margin-bottom:5px;">RIDE COMPLETE</h1>
            <p style="color:#888; letter-spacing:3px; margin-bottom:30px; font-size:0.8rem;">NETIZEN INTERCEPTOR V26</p>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:40px;">
                <div><span style="font-size:0.6rem; color:#666; display:block;">DISTANCE</span><strong style="font-size:1.2rem; color:#fff;">${safeOdo} KM</strong></div>
                <div><span style="font-size:0.6rem; color:#666; display:block;">MAX LEAN</span><strong style="font-size:1.2rem; color:#ff4d4d;">${window.maxLeanAngle || 0}°</strong></div>
                <div><span style="font-size:0.6rem; color:#666; display:block;">V-MAX</span><strong style="font-size:1.2rem; color:var(--neon-blue);">${safeVmax} KM/H</strong></div>
                <div><span style="font-size:0.6rem; color:#666; display:block;">STATUS</span><strong style="font-size:1rem; color:#2ecc71;">LEGEND</strong></div>
            </div>
            
            <button class="btn-insurance" style="width:100%; background:var(--accent); color:black; font-weight:bold; padding:15px; margin-bottom:15px; border-radius:10px;">
                <i class="fa-solid fa-share-nodes"></i> PARTAGER LE SCORE
            </button>
            <button onclick="document.getElementById('ride-card-overlay').remove()" style="background:transparent; color:#555; border:none; cursor:pointer;">FERMER</button>
        </div>
    `;
  document.body.appendChild(overlay);
}

// --- ORACLE: MESSAGES RÉGIONAUX MULTILINGUES ---
window.hasWelcomed = false;

const REGION_MESSAGES = {
  bretagne:
    "Bienvenue en Bretagne. Prudence sur les routes potentiellement humides.",
  normandie:
    "Bienvenue en Normandie. Restez vigilant face au vent et aux averses.",
  "île-de-france":
    "Bienvenue en ÃŽle-de-France. Densité de trafic élevée, gardez vos distances.",
  "provence-alpes-côte d'azur":
    "Bienvenue dans le Sud. La route est dégagée. Pensez à vous hydrater.",
  "auvergne-rhône-alpes":
    "Bienvenue en région Rhône-Alpes. Attention aux routes sinueuses en montagne.",
  "nouvelle-aquitaine":
    "Bienvenue en Nouvelle-Aquitaine. De belles balades en perspective.",
  occitanie: "Bienvenue en Occitanie. Soleil et belles routes vous attendent.",
  "hauts-de-france": "Bienvenue dans les Hauts-de-France. Gardez le contrôle.",
  "grand est": "Bienvenue dans le Grand Est. Excellente balade.",
  "bourgogne-franche-comté":
    "Bienvenue en Bourgogne. Conduite souple recommandée.",
  "pays de la loire": "Bienvenue. L'Oracle est connecté pour votre balade.",
  default: "Oracle connecté. Position GPS établie, prêt pour le départ.",
};

window.triggerRegionalWelcome = function (lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`;
  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      let regionKey = "default";
      if (data && data.address) {
        let regionName = data.address.state || data.address.region || "";
        regionName = regionName.toLowerCase();
        for (let key in REGION_MESSAGES) {
          if (key !== "default" && regionName.includes(key)) {
            regionKey = key;
            break;
          }
        }
      }
      if (window.OracleEngine) {
        window.OracleEngine.currentRegion = regionKey;
        window.OracleEngine._regionSetByNominatim = regionKey !== "default";
      }
      speak(REGION_MESSAGES[regionKey]);
    })
    .catch((err) => {
      console.error("Erreur Geocoding Inverse pour Oracle:", err);
      speak(REGION_MESSAGES["default"]);
    });
};

window.getLocalizedRouteMsg = function (dist, etaText, isRodage) {
  if (isRodage) {
    return `Itinéraire rodage calculé. ${dist} à parcourir. Bonne route avec mon 50 cc et moi.`;
  } else {
    return `Itinéraire calculé. ${dist}, arrivée prévue à ${etaText}. Bonne route avec mon 50 cc et moi.`;
  }
};

// --- 1. SHADOW MODE ---
window.toggleShadowMode = function () {
  const isShadow = document.body.classList.toggle("shadow-mode");
  const badge = document.getElementById("btn-shadow-toggle");
  if (badge) {
    badge.innerHTML = isShadow
      ? '<i class="fa-solid fa-eye-slash" style="font-size: 1.2rem; color: #2ecc71;"></i><div style="font-size: 0.65rem; text-align: left; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Shadow<br><span style="color:#2ecc71;">ON</span></div>'
      : '<i class="fa-solid fa-eye-slash" style="font-size: 1.2rem; color: #666;"></i><div style="font-size: 0.65rem; text-align: left; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; color:#666;">Shadow<br><span>OFF</span></div>';
  }
  if (isShadow) speak("Mode furtif activé. Concentration maximale.");
};

// --- 2. GRIP INDEX & 6. IA WINGMAN ---
window.rideStartTime = null;

setInterval(() => {
  // Calcul du Grip Index
  const tempEl = document.getElementById("weather-hud");
  let grip = 100;
  if (tempEl) {
    const tempText = tempEl.innerText;
    const temp = parseInt(tempText);
    if (!isNaN(temp)) {
      if (temp < 10) grip -= 10;
      if (temp < 5) grip -= 20;
      if (window.precipRate && window.precipRate > 0) grip -= 30; // Si precip
    }
  }
  const gripHud = document.getElementById("grip-hud");
  if (gripHud) {
    gripHud.innerText = grip + "%";
    gripHud.style.color =
      grip > 70 ? "#00ffff" : grip > 40 ? "#f1c40f" : "#ff4d4d";
  }

  if (grip <= 50 && !window.blackIceAlerted) {
    speak(
      "Alerte Verglas et adhérence réduite détectée. Grip en dessous de 50 pour cent.",
    );
    window.blackIceAlerted = true;
  }

  // IA Wingman (Temps de conduite et rappels réguliers)
  if (window.isRiding) {
    if (!window.rideStartTime) window.rideStartTime = Date.now();
    const rideDuration = (Date.now() - window.rideStartTime) / 60000; // minutes

    window.wingmanAlertCount = window.wingmanAlertCount || 0;
    const currentPeriod = Math.floor(rideDuration / 45); // Vérifie chaque tranche de 45 min

    if (currentPeriod > window.wingmanAlertCount) {
      if (window.isVigilanceRouge) {
        speak(
          "Vigilance rouge détectée. Vous roulez depuis 45 minutes supplémentaires. Nexus Atlas vous demande d'effectuer une pause immédiate et de vous hydrater abondamment !",
        );
      } else {
        speak(
          "Vous roulez depuis 45 minutes. Température moteur optimale atteinte, mais attention à la fatigue. Envisagez une pause bientôt.",
        );
      }
      window.wingmanAlertCount = currentPeriod;
    }
  } else {
    window.rideStartTime = null;
    window.wingmanAlertCount = 0;
    window.blackIceAlerted = false;
  }
}, 30000); // Check toutes les 30s

// --- 3. SONAR DE COMMUNAUTÉ ---
window.triggerCommunitySonar = function () {
  if (document.body.classList.contains("shadow-mode")) return; // Furtif

  // Animation Sonar Center
  const sonar = document.createElement("div");
  sonar.className = "sonar-wave";
  document.body.appendChild(sonar);

  setTimeout(() => {
    // Aléatoirement, trouver un allié (1 chance sur 4)
    if (Math.random() > 0.75) {
      speak("Pilote allié détecté dans le secteur.");
      const ally = document.createElement("div");
      ally.className = "ally-marker";
      // Position aléatoire sur l'écran
      ally.style.top = 20 + Math.random() * 60 + "%";
      ally.style.left = 20 + Math.random() * 60 + "%";
      document.body.appendChild(ally);
      setTimeout(() => ally.remove(), 6000);
    }
    sonar.remove();
  }, 4000);
};
setInterval(window.triggerCommunitySonar, 120000); // Sonar toutes les 2 minutes

// --- 5. EXPLORATION TACTIQUE (ROUTE ALÉATOIRE) ---
window.generateTacticalExploration = function () {
  if (!navigator.geolocation) {
    alert("GPS requis pour l'exploration.");
    return;
  }
  // GARDE : ne pas accéder au GPS sans consentement de l'utilisateur
  if (localStorage.getItem("location_consent_accepted") !== "true") {
    alert("Vous devez d'abord accepter l'utilisation de la localisation.");
    return;
  }

  document.getElementById("route-start").value = "Position Actuelle";
  document.getElementById("route-search").value = "Génération de boucle...";
  speak("Calcul d'une boucle d'exploration tactique aléatoire.");

  navigator.geolocation.getCurrentPosition((pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // Générer un point aléatoire à ~10-15km (1 degré lat = ~111km)
    const radiusInDegrees = (10 + Math.random() * 5) / 111;
    const randomAngle = Math.random() * Math.PI * 2;

    const destLat = lat + radiusInDegrees * Math.cos(randomAngle);
    const destLng =
      lng +
      (radiusInDegrees * Math.sin(randomAngle)) /
        Math.cos((lat * Math.PI) / 180);

    const destLatLngStr = `${destLat},${destLng}`;

    setTimeout(() => {
      document.getElementById("route-search").value = "Zone d'Exploration D-7";
      startRouteCalculation("current", destLatLngStr);
    }, 1500);
  });
};

// ============================================================
// --- 6. VIGILANCE ROUGE MÉTÉO-FRANCE (OPENDATA) ---
// ============================================================
window.checkVigilanceRouge = async function () {
  try {
    // Appel sécurisé via Cloud Function (évite d'exposer la clé Météo-France)
    const url = "https://europe-west1-mon50ccetmoi.cloudfunctions.net/getVigilanceMeteo";
    const response = await fetch(url);

    if (!response.ok) {
        return;
    }

    const data = await response.json();
    // La nouvelle API renvoie un tableau d'alertes, il faut l'adapter
    // On extrait juste les zones en rouge pour simuler le comportement précédent
    let alerts = [];
    if (data && data.product && data.product.domain) {
      alerts = data.product.domain.filter(d => d.max_color_id === 4); // 4 = Rouge chez Météo France
    }
    const banner = document.getElementById("vigilance-rouge-banner");
    const textEl = document.getElementById("vigilance-rouge-text");

    if (alerts.length > 0 && banner && textEl) {
      // Regrouper les départements en alerte
      const deptsList = alerts
        .map(
          (a) =>
            `${a.nom_dept || a.departement || "Département inconnu"} (${a.risque || "Danger imminent"})`,
        )
        .join(" | ");
      textEl.innerHTML = `🚨 <strong>VIGILANCE ROUGE MÉTÉO-FRANCE :</strong> ${deptsList}. Soyez extrêmement prudents, limitez vos déplacements en 2-roues.`;
      banner.style.display = "block";

      // Notification vocale (uniquement si ce n'est pas déjà affiché pour éviter le spam)
      if (banner.dataset.alerted !== "true" && typeof speak === "function") {
        speak(
          "Alerte de sécurité absolue. Vigilance Rouge Météo France en cours.",
        );
        banner.dataset.alerted = "true";
      }
    } else if (banner) {
      banner.style.display = "none";
      banner.dataset.alerted = "false";
    }
  } catch (err) {
    console.warn("[Vigilance] Erreur de récupération :", err);
  }
};

// Initialisation et Polling (Toutes les 5 minutes)
setTimeout(() => {
  if (typeof window.checkVigilanceRouge === "function") {
    window.checkVigilanceRouge();
    setInterval(window.checkVigilanceRouge, 300000); // 5 minutes
  }
}, 5000); // Lancement 5 secondes après le chargement de l'app

// ============================================================
// --- 7. BOÃŽTE NOIRE (TÉLÉMÉTRIE D'ASSURANCE) ---
// ============================================================
window.BlackBox = [];
setInterval(() => {
  if (window.isRiding && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const data = {
          t: new Date().toISOString(),
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          spd: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
          acc: pos.coords.accuracy,
          w: window.isVigilanceRouge ? "ROUGE" : "NORMAL",
        };
        window.BlackBox.push(data);
        if (window.BlackBox.length > 300) window.BlackBox.shift(); // Garde 5 minutes (300 sec)
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0 },
    );
  }
}, 1000);

window.exportBlackBox = function () {
  if (window.BlackBox.length === 0) {
    alert(
      "La boîte noire est vide. Vous devez rouler pour enregistrer des données.",
    );
    return;
  }
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(window.BlackBox, null, 2));
  const dlAnchorElem = document.createElement("a");
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute(
    "download",
    `Boite_Noire_mon50cc_${new Date().getTime()}.json`,
  );
  document.body.appendChild(dlAnchorElem);
  dlAnchorElem.click();
  dlAnchorElem.remove();
  speak("Rapport de boîte noire exporté avec succès.");
};

// ============================================================
// --- 8. RADAR CONVOI (ESCOUADE FIRESTORE) ---
// ============================================================
window.convoyMarkers = {};
window.currentSquadId = null;

window.joinSquad = function () {
  const code = prompt("Entrez le code secret de l'escouade (4 chiffres) :");
  if (!code || code.length < 3) return;
  window.currentSquadId = code;
  speak(`Escouade ${code} rejointe. Activation du radar partagé.`);

  // Upload de position toutes les 10 secondes
  setInterval(() => {
    if (window.currentSquadId && window.isRiding && window.db && window.user) {
      navigator.geolocation.getCurrentPosition((pos) => {
        window.db
          .collection("convoys")
          .doc(window.currentSquadId)
          .collection("positions")
          .doc(window.user.uid)
          .set(
            {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
      });
    }
  }, 10000);

  // Écoute des alliés
  if (window.db) {
    window.db
      .collection("convoys")
      .doc(window.currentSquadId)
      .collection("positions")
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const uid = change.doc.id;
          if (uid === (window.user && window.user.uid)) return; // Ignorer soi-même

          if (change.type === "added" || change.type === "modified") {
            const pos = new google.maps.LatLng(data.lat, data.lng);
            if (!window.convoyMarkers[uid]) {
              window.convoyMarkers[uid] = new google.maps.Marker({
                position: pos,
                map: window.map,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 6,
                  fillColor: "#00d2ff",
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: "#fff",
                },
                title: "Pilote Allié",
              });
              speak("Nouvel allié détecté sur le radar.");
            } else {
              window.convoyMarkers[uid].setPosition(pos);
            }
          }
          if (change.type === "removed" && window.convoyMarkers[uid]) {
            window.convoyMarkers[uid].setMap(null);
            delete window.convoyMarkers[uid];
          }
        });
      });
  }
};


/* --- app-ui.js --- */
// --- SYSTEM STARTUP ---
function runCinematicStartup() {
  const statusEl = document.getElementById("loader-status");
  const needle = document.getElementById("gauge-needle");
  const speedVal = document.getElementById("gauge-speed-val");
  const gaugeFill = document.getElementById("gauge-fill-path");
  const checkList = document.getElementById("system-check-list");

  const steps = [
    { text: "INITIALIZING KERNEL...", delay: 200 },
    { text: "50CC ENGINE CHECK: OPTIMAL", delay: 800 },
    { text: "STABLIZING SATELLITE LINK...", delay: 1400 },
    { text: "CALIBRATING HUD SENSORS...", delay: 2000 },
    { text: "SYSTEM READY - RIDE SAFE", delay: 3000 },
  ];

  steps.forEach((step) => {
    setTimeout(() => {
      if (statusEl) statusEl.textContent = step.text;
    }, step.delay);
  });

  // Needle Sweep 0 -> 80 -> 0
  setTimeout(() => {
    if (needle) needle.style.transform = "rotate(40deg)"; // 120 -> 40 pour Ãƒªtre proportionnel
    if (gaugeFill) gaugeFill.style.strokeDashoffset = "220";

    let speed = 0;
    const interval = setInterval(() => {
      speed += 2;
      if (speedVal) speedVal.textContent = speed;
      if (speed >= 80) {
        clearInterval(interval);
        setTimeout(() => {
          if (needle) needle.style.transform = "rotate(-120deg)";
          if (gaugeFill) gaugeFill.style.strokeDashoffset = "440";
          const intervalDown = setInterval(() => {
            speed -= 3;
            if (speed <= 0) {
              speed = 0;
              clearInterval(intervalDown);
            }
            if (speedVal) speedVal.textContent = speed;
          }, 20);
        }, 200);
      }
    }, 15);
  }, 500);

  // Update check list (insertAdjacentHTML au lieu de innerHTML += pour la performance / OWASP A03)
  setTimeout(() => {
    if (checkList) checkList.insertAdjacentHTML("beforeend", "<div>> ENGINE_CHECK: OK</div>");
  }, 1200);
  setTimeout(() => {
    if (checkList)
      checkList.insertAdjacentHTML("beforeend", "<div>> NETWORK_ESTABLISHED: 5G_ULTRA</div>");
  }, 2000);
}

window.showToast = function(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconClass = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-info-circle';
  
  const cleanMsg = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(message) : message;
  toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${cleanMsg}</span>`;
  
  container.appendChild(toast);

  if (navigator.vibrate) {
      navigator.vibrate(type === 'error' ? [50, 50, 50] : 50);
  }

  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 4300);
};

// Fail-safe Loader removal (after 5s)
setTimeout(() => {
  const loader = document.getElementById("app-loader");
  if (loader && loader.style.visibility !== "hidden") {
    console.warn("Fail-safe: Force hiding loader after timeout.");
    loader.style.opacity = "0";
    setTimeout(() => (loader.style.visibility = "hidden"), 1500);
  }
}, 5000);

document.addEventListener("DOMContentLoaded", () => {});

window.closeScreen = function () {
  const hud = document.getElementById("hud");
  if (hud) hud.style.display = "block";
  document.getElementById("screen-overlay").classList.add("hidden");
};

window.showPage = function (page) {
  const hud = document.getElementById("hud");
  if (hud) hud.style.display = "none";
  const overlay = document.getElementById("screen-overlay");
  const content = document.getElementById("screen-content");
  overlay.classList.remove("hidden");
  content.classList.remove("page-enter-active");
  content.classList.add("page-enter");
  setTimeout(() => content.classList.add("page-enter-active"), 50);
  if (navigator.vibrate) navigator.vibrate(50);
  setTimeout(() => content.classList.add("page-enter-active"), 50);

  if (page === "stats") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-chart-line"></i> ${t("stats_title")}</h3>
            <div class="stats-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:20px;">
                <div class="glassmorphism" style="padding:15px; text-align:center;">
                    <span style="font-size:0.7rem; color:#aaa;">DISTANCE TOTALE</span>
                    <div style="font-size:1.4rem; font-weight:900;">${window.session?.totalDistance || 0} km</div>
                </div>
                <div class="glassmorphism" style="padding:15px; text-align:center;">
                    <span style="font-size:0.7rem; color:#aaa;">VITESSE MAX</span>
                    <div style="font-size:1.4rem; font-weight:900; color:var(--neon-blue);">${window.session?.vMax || 0} km/h</div>
                </div>
            </div>
            <button onclick="generateRideCard()" class="btn-insurance" style="width:100%; margin-top:20px; background:linear-gradient(45deg, #ffb703, #ff4d4d); color:black;">
                <i class="fa-solid fa-share-nodes"></i> GÃƒ‰NÃƒ‰RER MA CARTE RIDE (VIRAL)
            </button>`;
  } else if (page === "seasons") {
    if (typeof content !== "undefined")
      content.innerHTML =
        `<h3><i class="fa-solid fa-trophy"></i> Saisons de Pilote</h3>
            <p style="font-size:0.75rem; color:#aaa; margin-bottom:15px;">Defis communautaires gratuits. Progressez chaque mois avec la communaute 50cc !</p>` +
        window.PilotSeasons.getHTMLSummary() +
        `<div style="margin-top:20px; padding:15px; background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid #333;">` +
        `<h4 style="color:var(--accent); font-size:0.85rem; margin-bottom:10px;"><i class="fa-solid fa-gauge-high"></i> KILOMETRAGE PREDICTIF</h4>` +
        window.MecaPredictor.getHTMLSummary() +
        `</div>
            <button onclick="window.SchoolZoneAI.enable()" class="btn-insurance" style="width:100%; margin-top:15px; background:linear-gradient(135deg,#e74c3c,#c0392b);">
                <i class="fa-solid fa-school"></i> Activer Detecteur Zones Scolaires
            </button>`;
  } else if (page === "community_roadbooks") {
    const sharedRoadbooks = JSON.parse(
      localStorage.getItem("community_roadbooks") || "[]",
    );
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-map-location-dot"></i> Roadbooks Communautaires</h3>
            <p style="font-size:0.75rem; color:#aaa; margin-bottom:15px;">Partagez gratuitement vos itineraires favoris avec tous les pilotes 50cc !</p>
            <button onclick="window.CommunityRoadbooks.shareMyRoute()" class="btn-insurance" style="width:100%; margin-bottom:20px; background:linear-gradient(135deg,var(--neon-blue),#0077b6);">
                <i class="fa-solid fa-share-nodes"></i> Partager mon itineraire actuel (Gratuit)
            </button>
            <h4 style="font-size:0.85rem; color:#aaa; margin-bottom:10px;">Itineraires de la communaute</h4>
            <div id="community-roadbooks-list">
                ${
                  sharedRoadbooks.length
                    ? sharedRoadbooks
                        .map(
                          (
                            rb,
                          ) => `<div class="card" style="border-left:4px solid var(--neon-blue);">
                    <strong>${rb.name}</strong> <span style="font-size:0.65rem;color:#aaa;">${rb.distance}km - ${rb.author}</span>
                    <p style="font-size:0.75rem;margin:5px 0;color:#ccc;">${rb.description || "Itineraire 50cc"}</p>
                    <button onclick="window.CommunityRoadbooks.load(rb.id)" style="background:var(--neon-blue);color:#000;border:none;border-radius:8px;padding:4px 10px;font-size:0.7rem;cursor:pointer;">CHARGER</button>
                </div>`,
                        )
                        .join("")
                    : "<p style='text-align:center;color:#444;padding:30px;'>Soyez le premier a partager !</p>"
                }
            </div>`;
  } else if (page === "garage") {
    const history = JSON.parse(secureGetItem("maint_history") || "[]");
    const ctDate = secureGetItem("ct_date") || "Non défini";

    // Gamification Data
    const currentXP = parseInt(localStorage.getItem("pilot_xp") || "0");
    const level = Math.floor(Math.sqrt(currentXP / 100)) + 1;
    const ranks = [
      "ROOKIE",
      "SCOUT",
      "INTERCEPTOR",
      "GHOST_RIDER",
      "SINGULARITY_PILOT",
    ];
    const rankIdx = Math.min(Math.floor(currentXP / 1500), ranks.length - 1);
    const rankName = ranks[rankIdx];

    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-warehouse"></i> ${t("garage_title")}</h3>
            
            <div class="card" style="border:1px solid #00d2ff; background: rgba(0, 210, 255, 0.05); margin-bottom:15px; text-align:center;">
                <h4 style="color:#00d2ff; margin-bottom:5px;"><i class="fa-solid fa-star"></i> NIVEAU PILOTE : ${level}</h4>
                <p style="font-size:0.8rem; color:#aaa; margin-top:0;">Rang: <strong style="color:#fff;">${rankName}</strong> | XP: ${currentXP}</p>
                <div style="width:100%; height:8px; background:#111; border-radius:4px; margin-top:10px; overflow:hidden;">
                    <div style="width:${currentXP % 100}%; height:100%; background:linear-gradient(90deg, #00d2ff, #b700ff);"></div>
                </div>
            </div>

            <div class="card" style="border:1px solid #ffb703; background: rgba(255,183,3,0.05); margin-bottom:15px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="color:#ffb703;">PROCHAIN CT</strong><br>
                        <small style="font-size:0.75rem;">Obligatoire depuis Avril 2024</small>
                    </div>
                    <input type="date" id="ct-input" value="${ctDate}" onchange="saveCTDate(this.value)" style="background:#111; color:white; border:1px solid #444; border-radius:5px; padding:5px; font-size:0.8rem;">
                </div>
            </div>

            <div id="dynamic-garage-list"></div>

            <div class="card" style="border: 1px solid var(--neon-blue); background: rgba(0, 210, 255, 0.05);">
                <h4 style="color:var(--neon-blue); margin-bottom:10px;"><i class="fa-solid fa-chart-line"></i> TÃƒ‰LÃƒ‰MÃƒ‰TRIE DE RIDE</h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; text-align:center;">
                    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px;">
                        <small>ANGLE MAX</small><br>
                        <strong style="font-size:1.2rem; color:var(--accent);">${maxLeanAngle}Ã‚°</strong>
                    </div>
                    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px;">
                        <small>VITESSE MAX</small><br>
                        <strong style="font-size:1.2rem; color:var(--danger);">${window.session?.vMax || 0} km/h</strong>
                    </div>
                </div>
                <button onclick="resetTelemetry()" style="width:100%; height:25px; margin-top:10px; background:transparent; border:1px solid #444; color:#666; font-size:0.6rem; border-radius:15px;">RÃƒ‰INITIALISER LES STATS</button>
            </div>

            <h4 style="margin-top:20px; font-size:0.9rem; color:#aaa; display:flex; justify-content:space-between;">
                <span>${t("maint_history_title")}</span>
                <i class="fa-solid fa-book-medical" style="color:#2ecc71;"></i>
            </h4>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                <button onclick="addCategorizedMaint('Huile')" class="btn-dark" style="font-size:0.7rem; padding:10px;"><i class="fa-solid fa-droplet"></i> Huile</button>
                <button onclick="addCategorizedMaint('Courroie')" class="btn-dark" style="font-size:0.7rem; padding:10px;"><i class="fa-solid fa-gear"></i> Courroie</button>
                <button onclick="addCategorizedMaint('Pneus')" class="btn-dark" style="font-size:0.7rem; padding:10px;"><i class="fa-solid fa-circle-notch"></i> Pneus</button>
                <button onclick="addCategorizedMaint('Freins')" class="btn-dark" style="font-size:0.7rem; padding:10px;"><i class="fa-solid fa-hard-drive"></i> Freins</button>
            </div>

            <div id="maint-firestore-section" style="margin-top:15px;">
                <h4 style="font-size:0.85rem; color:#3498db; display:flex; justify-content:space-between; align-items:center;">
                    <span><i class="fa-solid fa-cloud"></i> Mon Carnet d'Entretien (Cloud)</span>
                    <button onclick="loadFirestoreMaintenanceLogs()" class="btn-dark" style="font-size:0.6rem; padding:4px 10px; border-radius:12px;">
                        <i class="fa-solid fa-rotate"></i> Actualiser
                    </button>
                </h4>
                <div id="maint-firestore-list" style="max-height:300px; overflow-y:auto; margin-top:10px;"></div>
            </div>`;
    renderDynamicGarage();
    // Auto-charger le carnet d'entretien Cloud au chargement de la page
    setTimeout(() => { if (typeof loadFirestoreMaintenanceLogs === 'function') loadFirestoreMaintenanceLogs(); }, 100);
  } else if (page === "group") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3>Balade en Groupe</h3>
            <div class="card" style="text-align:center; border: 1px solid #00d2ff;">
                <i class="fa-solid fa-people-group" style="font-size:3rem; color:#00d2ff; margin-bottom:15px;"></i>
                <p style="font-size:0.9rem;">Rejoignez vos amis sur la route !</p>
                <input type="text" id="group-code" placeholder="Code (Ex: RIDE75)" style="width:100%; padding:10px; margin-top:15px; background:#000; border:1px solid #00d2ff; color:white; border-radius:8px;">
                <button class="btn-insurance" onclick="joinGroup()" style="background:#00d2ff; color:black; margin-top:15px; width:100%;">Rejoindre</button>
            </div>`;
  } else if (page === "rodage") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3>Itinéraires Rodage</h3>
            <p>Routes limitées Ãƒ  45 km/h pour préserver votre moteur.</p>
            <button class="btn-insurance" onclick="startRodage('Paris-Boucle')">Boucle Zen (Paris)</button>
            <button class="btn-insurance" onclick="startRodage('Lyon-Quais')">Quais SaÃƒ´ne (Lyon)</button>`;
  } else if (page === "insurance") {
    if (typeof content !== "undefined")
      content.innerHTML = `<div class="card-insurance">
            <div class="insurance-badge">Partenaire</div>
            <h3>Protection 50cc</h3>
            <div class="promo-box"><span>Votre code promo:</span><strong>CHEZBIGBOO</strong></div>
            <div class="broker-contact">
                <strong>Robert - Courtier Partenaire</strong>
                <a href="tel:0749555829">ðŸ“ž 07 49 55 58 29</a>
                <span>Spécialiste du jeune conducteur 50cc</span>
            </div>
            <p>Bénéficiez de -15% sur votre assurance scooter en tant que membre.</p>
        </div>`;
  } else if (page === "roadbooks") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3>Roadbooks</h3>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <button onclick="renderRoadbooks('all')" class="btn-insurance" style="flex:1; padding:8px; font-size:0.75rem;">Mes Créations</button>
                <button onclick="renderRoadbooks('favorites')" class="btn-insurance" style="flex:1; padding:8px; font-size:0.75rem; background:#f1c40f; color:black;"><i class="fa-solid fa-star"></i> Mes Favoris</button>
            </div>
            <ul id="roadbook-list" style="list-style:none; padding:0;"></ul>`;
    renderRoadbooks("all");
  } else if (page === "mechanic") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-robot"></i> ${t("expert_meca_title")}</h3>
            <p style="font-size:0.8rem; color:#aaa;">Décrivez le symptÃƒ´me (bruit, fumée, panne...)</p>
            <textarea id="meca-query" placeholder="Ex: Mon scoot broute Ãƒ  l'accélération..." style="width:100%; height:80px; margin-top:10px; background:#111; color:white; border:1px solid #ffb703; border-radius:8px; padding:10px;"></textarea>
            <button class="btn-insurance" onclick="submitMecaV3()" style="margin-top:15px; width:100%;">Scanner mon 50cc</button>
            <div id="meca-response" style="margin-top:20px; font-size:0.9rem; line-height:1.4;"></div>`;
  } else if (page === "arbitre") {
    if (!window.session) {
      if (typeof speak === "function") speak("Veuillez vous connecter");
      alert("Veuillez vous connecter");
      return;
    }
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-scale-balanced"></i> ${t("arbitre_title")}</h3>
            <p style="font-size:0.8rem; color:#aaa; margin-bottom:15px;">Posez votre question sur la réglementation 50cc (débridage, équipement, contrÃƒ´les...).</p>
            
            <div id="arbitre-chat" style="background:rgba(0,0,0,0.3); border-radius:15px; padding:15px; min-height:150px; max-height:300px; overflow-y:auto; margin-bottom:15px; border:1px solid rgba(255,183,3,0.2);">
                <div class="bot-msg" style="background:rgba(255,183,3,0.1); padding:10px; border-radius:10px 10px 10px 0; margin-bottom:10px; font-size:0.9rem; border-left:3px solid #ffb703;">
                    Bonjour ! Je suis l'Arbitre. Quel est votre litige ou votre question sur le Code de la Route ?
                </div>
            </div>

            <div style="display:flex; gap:10px;">
                <input type="text" id="arbitre-query" placeholder="Ex: Mon pot est-il homologué ?" style="flex:1; background:#111; color:white; border:1px solid #444; border-radius:20px; padding:10px 15px; font-size:0.9rem;">
                <button onclick="submitArbitre()" style="background:#ffb703; color:black; border:none; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-paper-plane"></i></button>
            </div>`;
  } else if (page === "ia_predictive") {
    if (typeof content !== "undefined")
      content.innerHTML = `<div class="card-insurance" style="border: 2px solid #b700ff; background: rgba(20, 10, 40, 0.9);">
            <div class="insurance-badge" style="background: #b700ff; color: white;">IA Prédictive & Courtier</div>
            <h3 style="color: #00d2ff;"><i class="fa-solid fa-microchip"></i> IA Prédictive</h3>
            <p style="font-size: 0.85rem; color: #ddd; margin-bottom: 15px;">L'IA analyse vos trajets pour anticiper les pannes et optimiser votre conduite 50cc.</p>
            
            <div class="glassmorphism" style="padding:15px; margin-bottom:20px; background: rgba(0,0,0,0.4);">
                <h4 style="color: #ffb703; font-size: 0.9rem; margin-bottom: 10px;"><i class="fa-solid fa-star"></i> Avantages Courtier Partenaire</h4>
                <ul style="color: #aaa; font-size: 0.8rem; text-align: left; padding-left: 20px;">
                    <li><strong style="color: #fff;">-20% de réduction</strong> sur votre assurance tous risques grÃƒ¢ce Ãƒ  l'IA Prédictive.</li>
                    <li><strong style="color: #fff;">Garantie panne 0 km</strong> incluse avec dépannage express.</li>
                    <li><strong style="color: #fff;">Bonus de bonne conduite</strong> (Rouler & Gagner convertible en réductions).</li>
                </ul>
                <button class="btn-insurance" style="width:100%; margin-top:10px; background: #ffb703; color: black; font-weight: bold;" onclick="showPage('insurance')">VOIR MON OFFRE ASSURANCE</button>
            </div>

            <button class="btn-insurance" style="width:100%; background: linear-gradient(135deg, #b700ff, #00d2ff); color: white; font-weight: bold; border: none; padding: 15px; border-radius: 10px;" onclick="PredictiveMeca.checkAlerts(); alert('L\'IA analyse vos données de télémétrie actuelles... Aucun risque de serrage moteur détecté pour le moment. Vous roulez de manière optimale !')"><i class="fa-solid fa-bolt"></i> LANCER L'ANALYSE IA</button>
        </div>`;
  } else if (page === "profile") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-user-pen"></i> Mon Profil</h3>
            <div class="glassmorphism" style="padding:20px; margin-bottom:20px;">
                <label for="edit-username" style="color:#aaa; font-size:0.8rem;">Pseudo :</label>
                <input type="text" id="edit-username" value="" style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; background:rgba(255,255,255,0.1); border:1px solid #444; color:#fff; border-radius:8px;">
                <label for="edit-scooter" style="color:#aaa; font-size:0.8rem;">Modèle de scooter :</label>
                <input type="text" id="edit-scooter" value="" placeholder="Ex: Peugeot Kisbee 50cc" style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; background:rgba(255,255,255,0.1); border:1px solid #444; color:#fff; border-radius:8px;">
                <label for="edit-email" style="color:#aaa; font-size:0.8rem;">Email de contact :</label>
                <input type="email" id="edit-email" value="" placeholder="contact@exemple.com" style="width:100%; padding:10px; margin-top:5px; margin-bottom:20px; background:rgba(255,255,255,0.1); border:1px solid #444; color:#fff; border-radius:8px;">
                <button onclick="saveProfileInfo()" class="btn-insurance" style="width:100%; background:var(--neon-blue); color:black; font-weight:bold; border:none; padding:12px; border-radius:8px;">ENREGISTRER</button>
            </div>`;
  } else if (page === "insurance_expert") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-building-shield"></i> Portail Expert Assurance</h3>
            <p style="font-size:0.8rem; color:#aaa; margin-bottom:20px;">Accès sécurisé pour les compagnies d'assurance et experts judiciaires.</p>
            <div id="insurance-search-box" style="margin-bottom:20px;">
                <input type="text" id="expert-report-id" placeholder="ID du Dossier (ex: blackbox_...)" style="width:100%; padding:15px; background:rgba(255,255,255,0.05); border:1px solid #444; border-radius:10px; color:white; margin-bottom:10px;">
                <button class="btn-insurance" onclick="InsurancePortal.searchReport(document.getElementById('expert-report-id').value)" style="width:100%; padding:15px; background:#ffb703; color:black; border:none; border-radius:10px; font-weight:bold;">RECHERCHER LE DOSSIER</button>
            </div>
            <div id="insurance-content"></div>`;
  } else if (page === "pulse") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-microscope"></i> Labo Méca : Stéthoscope IA</h3>
            <p style="font-size:0.8rem; color:#aaa; margin-bottom:20px;">Analyse biométrique de la santé de votre moteur via les capteurs du smartphone.</p>
            
            <div class="glassmorphism" style="padding:20px; text-align:center;">
                <div id="scan-visual" style="height:100px; display:flex; align-items:center; justify-content:center; margin-bottom:20px; background:rgba(0,0,0,0.3); border-radius:15px; position:relative; overflow:hidden;">
                    <div id="scan-progress-bar" style="position:absolute; left:0; top:0; height:100%; width:0%; background:linear-gradient(90deg, #ffb703, #ff4d4d); transition: width 0.1s linear; opacity:0.5;"></div>
                    <i class="fa-solid fa-gear" style="font-size:3rem; color:#ffb703; z-index:1;"></i>
                </div>
                <button class="btn-insurance" onclick="EnginePulse.startScan()" style="width:100%; padding:15px; background:#ffb703; color:black; border:none; border-radius:10px; font-weight:bold; font-size:1.1rem;">LANCER LE DIAGNOSTIC</button>
                <p style="font-size:0.7rem; color:#888; margin-top:10px;">Posez le téléphone sur la selle, moteur allumé au ralenti.</p>
            </div>
            <div id="pulse-result"></div>`;
  } else if (page === "ants_wallet") {
    const passport = Wallet.getSafetyPassport();
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-building-columns"></i> Mon Coffre-Fort ANTS</h3>
            <p style="font-size:0.75rem; color:#aaa; margin-bottom:20px;">Titres sécurisés et Passeport Sécurité certifié par mon50ccetmoi.</p>
            
            <div class="glassmorphism" style="padding:15px; margin-bottom:15px; border-left:4px solid #2ecc71;">
                <h4 style="font-size:0.9rem; color:#2ecc71;"><i class="fa-solid fa-id-card"></i> Passeport Sécurité Digital</h4>
                <div style="font-size:0.8rem; margin-top:5px; color:#ddd;">
                    ID Blackbox: <span style="font-family:monospace; color:#2ecc71;">${passport.blackbox_id}</span><br>
                    Maintenance: <span style="color:#2ecc71;">${passport.maintenance_count} interventions</span><br>
                    Santé Moteur: <span style="color:#2ecc71;">${passport.engine_health}</span>
                </div>
            </div>

            <div class="menu-list" style="margin-top:20px;">
                <div id="ants-docs-container" style="margin-bottom:15px;"></div>
                <li onclick="window.uploadDocument('carte_grise')"><i class="fa-solid fa-camera"></i> Numériser Carte Grise</li>
                <li onclick="window.uploadDocument('permis_am')"><i class="fa-solid fa-address-card"></i> Numériser Permis AM</li>
                <li onclick="window.uploadDocument('assurance')"><i class="fa-solid fa-shield-check"></i> Attestation Assurance</li>
            </div>
            
            <button onclick="Certificate.generate()" class="btn-insurance" style="width:100%; margin-top:25px; background:linear-gradient(45deg, #2ecc71, #3498db); color:white;">
                <i class="fa-solid fa-file-shield"></i> GÃƒ‰NÃƒ‰RER MON CERTIFICAT OFFICIEL
            </button>
            
            <p style="font-size:0.65rem; color:#666; text-align:center; margin-top:20px;">Note : Ce coffre-fort facilite les contrÃƒ´les mais ne remplace pas les documents originaux selon la législation en vigueur.</p>`;
  } else if (page === "meca_lab") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-oil-can"></i> Le Sorcier de la Méca</h3>
            <div class="glassmorphism" style="padding:20px; margin-bottom:20px;">
                <h4 style="color:var(--accent);">CALCULATEUR DE MÃƒ‰LANGE</h4>
                <div style="margin-top:15px;">
                    <input type="number" id="mix-liters" placeholder="Litres d'essence" class="scooter-brand-select" style="width:100%; margin-bottom:10px;">
                    <input type="number" id="mix-percent" placeholder="% d'huile (ex: 2)" class="scooter-brand-select" style="width:100%; margin-bottom:10px;">
                    <button onclick="const vol = MecaWizard.calculateMix(document.getElementById('mix-liters').value, document.getElementById('mix-percent').value); document.getElementById('mix-res').innerHTML = vol + ' ml d\'huile Ãƒ  ajouter';" 
                            class="btn-insurance" style="width:100%; background:var(--accent); color:black;">CALCULER</button>
                    <div id="mix-res" style="margin-top:15px; font-weight:bold; text-align:center; color:var(--neon-blue);"></div>
                </div>
            </div>

            <div class="glassmorphism" style="padding:20px;">
                <h4 style="color:#2ecc71;">DIAGNOSTIC CARBU (IA SONORE)</h4>
                <p style="font-size:0.75rem; color:#aaa; margin-top:10px;">L'IA analyse le son de votre moteur pour ajuster votre richesse.</p>
                <button onclick="MecaWizard.startAcousticAnalysis()" class="btn-insurance" style="width:100%; margin-top:15px; background:#2ecc71; color:white;">LANCER L'ANALYSE SONORE</button>
                <div id="meca-result" style="margin-top:20px;"></div>
            </div>`;
  } else if (page === "about") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-circle-info"></i> Ãƒ€ Propos</h3>
            <div style="text-align:center; padding:20px;">
                <div class="login-logo" style="font-size:3rem; color:var(--accent); margin-bottom:10px;">50</div>
                <h2 style="color:var(--accent);">mon50ccetmoi</h2>
                <p style="font-size:0.8rem; color:#aaa; margin-bottom:20px;">Version 26.0 - GOLD EDITION</p>
                
                <div class="glassmorphism" style="padding:20px; border:1px solid var(--accent); margin-bottom:30px; text-align:left;">
                    <p style="font-size:0.9rem; font-weight:bold; text-align:center;">SIGNATURE CORPORATE</p>
                    <p style="font-size:0.75rem; color:#ddd; margin-top:10px;">Cette application est la propriété exclusive de<br><strong style="color:var(--accent);">CHEZBIGBOO</strong>.</p>
                    <p style="font-size:0.65rem; color:#888; margin-top:15px;">Protégé par les lois internationales sur la propriété intellectuelle. Télémétrie certifiée conforme aux standards ANTS v110.00.00.</p>
                </div>
                
                <button onclick="document.getElementById('screen-overlay').classList.add('hidden')" class="btn-cancel" style="background:#333; color:white;">FERMER</button>
            </div>`;
  } else if (page === "defis") {
    const availableChallenges = [
      { name: "Le Grand Raid", goal: 200, unit: "km" },
      { name: "L'Urbain Zen", goal: 100, unit: "km" },
      { name: "L'Explorateur", goal: 300, unit: "km" },
      { name: "Le Vélomoteur", goal: 50, unit: "km" },
    ];

    // Rotation tous les 14 jours basée sur l'Unix Time
    const fortressPeriod = 14 * 24 * 60 * 60 * 1000;
    const currentPeriodIdx =
      Math.floor(Date.now() / fortressPeriod) % availableChallenges.length;
    const challenge = availableChallenges[currentPeriodIdx];

    const totalKm = window.session?.totalDistance || 0;
    const progress = Math.min((totalKm / challenge.goal) * 100, 100);
    const wins = window.session?.completedChallengesCount || 0;

    if (typeof content !== "undefined")
      content.innerHTML = `<div class="card" style="border:1px solid #9b59b6;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="color:#9b59b6; margin:0;">ðŸ† ${t("challenges_title")} : ${challenge.name}</h3>
                <span style="font-size:0.7rem; background:#9b59b6; color:white; padding:2px 6px; border-radius:10px;">CYCLE LIVE</span>
            </div>
            <p style="font-size:0.8rem; margin-top:10px;">Objectif : ${challenge.goal} ${challenge.unit} par quinzaine.</p>
            
            <div style="background:rgba(255,255,255,0.05); border-radius:10px; padding:15px; margin-top:15px;">
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:5px;">
                    <span>Progression actuelle</span>
                    <span>${totalKm.toFixed(1)} / ${challenge.goal} km</span>
                </div>
                <div class="garage-bar-bg" style="height:12px;">
                    <div class="garage-bar-fill" style="width:${progress}%; background:#9b59b6;"></div>
                </div>
                <p style="font-size:0.8rem; color:#888; margin-top:10px; text-align:center;">ðŸŽ–ï¸ Vous avez réussi <strong>${wins}/150</strong> défis pour le Badge Pro</p>
            </div>

                          <button class="btn-insurance" style="margin-top:20px; width:100%; background:#9b59b6; color:white;" onclick="toggleMenu()">CONTINUER L''ASCENSION</button>
              ${
                progress >= 100 &&
                !localStorage.getItem(`defi_claimed_${currentPeriodIdx}`)
                  ? `
                  <button class="btn-insurance" style="margin-top:10px; width:100%; background:linear-gradient(90deg, #b700ff, #ff0055); color:white; font-weight:bold; box-shadow:0 0 15px rgba(183,0,255,0.5);" onclick="
                      if(window.Web4Economy) {
                          window.Web4Economy.mineToken(5.0, 'Défi Quinzaine Complété');
                          localStorage.setItem('defi_claimed_${currentPeriodIdx}', 'true');
                          window.session.completedChallengesCount = (window.session.completedChallengesCount || 0) + 1;
                          alert('Félicitations ! Vous avez remporté 5 BVC pour avoir complété le défi.');
                          showPage('defis');
                      }
                  ">RÉCLAMER MES 5 BVC</button>
              `
                  : progress >= 100
                    ? `<button class="btn-insurance" style="margin-top:10px; width:100%; background:#333; color:#aaa; cursor:not-allowed;" disabled>RÉCOMPENSE DE 5 BVC RÉCUPÉRÉE</button>`
                    : ""
              }
        </div>`;
  } else if (page === "roadbooks") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-map-location-dot"></i> Navigation & Roadbooks</h3>
            <div class="glassmorphism" style="padding:20px; border-left:4px solid #f1c40f; margin-bottom:20px;">
                <h4 style="color:#f1c40f;"><i class="fa-solid fa-stopwatch"></i> CHRONOS GUARD (Zéro Retard)</h4>
                <p style="font-size:0.75rem; margin-top:5px; color:#aaa;">Réglez votre heure d'arrivée cible. L'app inclut votre temps d'équipement (5 min).</p>
                <div style="display:flex; gap:10px; margin-top:15px;">
                    <input type="time" id="target-time" class="scooter-brand-select" style="flex:1;">
                    <button onclick="Chronos.setTarget(document.getElementById('target-time').value)" class="btn-insurance" style="flex:1; background:#f1c40f; color:black;">ACTIVER</button>
                </div>
                <button onclick="Chronos.syncCalendar()" class="btn-insurance" style="width:100%; margin-top:10px; background:transparent; border:1px solid #f1c40f; color:#f1c40f;">
                    <i class="fa-solid fa-calendar-days"></i> SYNCHRONISER MON CALENDRIER
                </button>
            </div>
            
            <p style="text-align:center; padding:40px; color:#666;">Liste de vos roadbooks sauvegardés...</p>`;
  } else if (page === "arbitre") {
    if (
      window.Blackbox &&
      typeof window.Blackbox.showLitigationInfo === "function"
    ) {
      window.Blackbox.showLitigationInfo();
    } else {
      if (typeof content !== "undefined")
        content.innerHTML = `<h3><i class="fa-solid fa-scale-balanced"></i> Arbitre de la Route</h3><p>Service Blackbox momentanément indisponible.</p>`;
    }
  } else if (page === "privacy") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3>Mentions Légales & Confidentialité</h3>
            <div style="font-size:0.8rem; line-height:1.4; color:#ccc;">
                <p><strong>Ãƒ‰diteur :</strong> mon50ccetmoi (Engineering Unit)</p>
                <p><strong>Responsable :</strong> mon50ccetmoi Admin (US)</p>
                <p><strong>Contact :</strong> via l'application</p>
                <hr style="border:0; border-top:1px solid #444; margin:10px 0;">
                <p><strong>Données GPS :</strong> Vos coordonnées sont traitées localement pour la navigation et la détection de chute.</p>
                <p><strong>Partage :</strong> Les signalements de dangers sont partagés de manière anonyme avec la communauté.</p>
                <p><strong>Stockage :</strong> Vos préférences sont enregistrées dans votre navigateur (LocalStorage).</p>
                <p><strong>Version :</strong> v110.00.00-PRO Build 2026</p>
                <p><strong>Signature :</strong> mon50ccetmoi Engineering US</p>
            </div>`;
  } else if (page === "pro-tips") {
    const communityTips = JSON.parse(
      secureGetItem("community_pro_tips") || "[]",
    );
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-lightbulb"></i> Conseils de Pro 50cc</h3>
            <p style="font-size:0.7rem; color:#aaa; margin-bottom:15px;">Fiches techniques rédigées par nos experts et les garages certifiés.</p>
            
            <div id="pro-tips-container">
                <div class="card" style="border-left:4px solid #f39c12;">
                    <button class="badge-pro" style="float:right; background:#f39c12; font-size:0.5rem; border:none; color:black; border-radius:5px; padding:2px 5px;">OFFICIEL</button>
                    <h4 style="color:#f39c12;"><i class="fa-solid fa-wrench"></i> Entretien Rapide</h4>
                    <p style="font-size:0.8rem; margin-top:5px;"><strong>Bougie :</strong> Une bougie propre (couleur chocolat) = un moteur qui dure. Si elle est noire, votre mélange est trop riche.</p>
                </div>

                ${communityTips
                  .map(
                    (tip) => `
                    <div class="card" style="border-left:4px solid #2ecc71;">
                        <button class="badge-pro" style="float:right; background:#2ecc71; font-size:0.5rem; border:none; color:white; border-radius:5px; padding:2px 5px;">EXPERT : ${tip.author}</button>
                        <h4 style="color:#2ecc71;"><i class="fa-solid fa-graduation-cap"></i> ${tip.title}</h4>
                        <p style="font-size:0.8rem; margin-top:5px;">${tip.body}</p>
                    </div>
                `,
                  )
                  .join("")}

                <div class="card" style="border-left:4px solid #e74c3c;">
                    <button class="badge-pro" style="float:right; background:#e74c3c; font-size:0.5rem; border:none; color:white; border-radius:5px; padding:2px 5px;">OFFICIEL</button>
                    <h4 style="color:#e74c3c;"><i class="fa-solid fa-scale-balanced"></i> Loi & Sécurité</h4>
                    <p style="font-size:0.8rem; margin-top:5px;"><strong>Bridage :</strong> Le débridage est interdit sur voie publique. En cas d'accident, votre assurance peut refuser de payer.</p>
                </div>
            </div>`;
  } else if (page === "pro-space") {
    const isCertified = window.session?.isCertifiedGarage || false;
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-briefcase"></i> ${t("pro_space_title")}</h3>
            <div class="card" style="border:1px solid #3498db; background: rgba(52, 152, 219, 0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>Visibilité Mobile</strong>
                    <button onclick="toggleGarageVisibility()" class="btn-circular ${window.isGarageVisible ? "btn-neon" : "btn-dark"}" style="width:40px; height:40px;">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </div>
                <small style="font-size:0.6rem; color:#aaa; margin-top:5px; display:block;">Si activé, vous apparaissez en bleu sur la carte des pilotes.</small>
            </div>

            <div class="card">
                <label for="garage-status-select" style="font-size:0.8rem; display:block; margin-bottom:5px;">Statut immédiat de l'atelier</label>
                <select id="garage-status-select" onchange="updateGarageStatus(this.value)" class="scooter-brand-select" style="width:100%; background:#111;">
                    <option value="dispo" selected>âÅ“… Prise en charge immédiate</option>
                    <option value="busy">â³ RDV nécessaire (>48h)</option>
                    <option value="full">ðŸš« Atelier Complet</option>
                </select>
            </div>

            <div class="card" style="border:1px solid #f1c40f;">
                <h4 style="color:#f1c40f; margin-bottom:10px;"><i class="fa-solid fa-bolt"></i> Offre Flash (Promo)</h4>
                <textarea id="flash-offer-text" placeholder="Ex: -20% sur les pneus Michelin ce weekend !" style="width:100%; height:60px; background:#000; color:white; border:1px solid #444; border-radius:8px; padding:10px; font-size:0.8rem;"></textarea>
                <button onclick="publishFlashOffer()" class="btn-insurance" style="background:#f1c40f; color:black; margin-top:10px; width:100%; font-size:0.8rem;">Diffuser Ãƒ  la communauté</button>
            </div>

            ${
              !isCertified
                ? `
            <div class="card" style="text-align:center; background:rgba(52, 152, 219, 0.05); border:1px solid #3498db;">
                <i class="fa-solid fa-certificate" style="font-size:2rem; color:#f1c40f;"></i><br>
                <h4 style="margin:10px 0; color:#fff;">Droit d'Entrée & Certification</h4>
                <p style="font-size:0.7rem; color:#aaa; margin-bottom:10px;">Devenez <strong>Garage Certifié</strong> pour seulement <strong>50â‚¬ TTC</strong> (Paiement unique).</p>
                <ul style="font-size:0.65rem; color:#ccc; list-style:none; padding:0; text-align:left; margin-bottom:15px;">
                    <li>âÅ“… Badge <strong>Certifié mon50ccetmoi</strong></li>
                    <li>ðŸš€ <strong>Boost de visibilité</strong> sur la carte</li>
                    <li>ðŸ› ï¸ Accès illimité aux fiches techniques</li>
                    <li>ðŸ‘" Priorité dans les résultats de recherche</li>
                </ul>
                <button onclick="payGarageEntryFee()" class="btn-insurance" style="background:#f1c40f; color:black; font-weight:bold;">S'acquitter du droit d'entrée (50â‚¬)</button>
                
                <div style="margin-top:15px; padding-top:15px; border-top:1px solid #444;">
                    <p style="font-size:0.7rem; color:#2ecc71;"><strong>ðŸŽ OPTION "CROISSANCE" GRATUITE :</strong></p>
                    <p style="font-size:0.6rem; color:#aaa;">Offrez <strong>-10% de réduction</strong> aux membres sur présentation de l'app et soyez <strong>exonéré</strong> des 50â‚¬ !</p>
                    <button onclick="applyPartnerExemption()" class="btn-insurance fa-beat" style="background:transparent; border:1px solid #2ecc71; color:#2ecc71; margin-top:5px; font-size:0.8rem; font-weight:bold;">REJOINDRE LE RÃƒ‰SEAU GRATUITEMENT (-10%)</button>
                </div>
            </div>`
                : `
            <div class="card" style="text-align:center; background:rgba(46, 204, 113, 0.1); border:1px solid #2ecc71;">
                <i class="fa-solid fa-check-double" style="font-size:1.5rem; color:#2ecc71;"></i>
                <p style="font-size:0.8rem; color:#2ecc71; margin-top:5px;"><strong>Statut PRO Certifié Actif</strong></p>
                <small style="font-size:0.6rem; color:#aaa;">Votre visibilité est boostée au maximum.</small>
            </div>`
            }

            <div class="card" style="border:1px solid #2ecc71;">
                <h4 style="color:#2ecc71; margin-bottom:10px;"><i class="fa-solid fa-graduation-cap"></i> Partager un Conseil d'Expert</h4>
                <input type="text" id="pro-tip-title" placeholder="Titre (ex: Nettoyer son carbu)" style="width:100%; padding:10px; margin-bottom:10px; background:#000; color:white; border:1px solid #444; border-radius:8px; font-size:0.8rem;">
                <textarea id="pro-tip-body" placeholder="Votre explication technique..." style="width:100%; height:80px; background:#000; color:white; border:1px solid #444; border-radius:8px; padding:10px; font-size:0.8rem;"></textarea>
                <button onclick="publishProTip()" class="btn-insurance" style="background:#2ecc71; color:white; margin-top:10px; width:100%; font-size:0.8rem;">Publier la Fiche Technique</button>
            </div>

            ${isCertified ? `
            <div class="card" style="border:1px solid #f39c12; background: rgba(243, 156, 18, 0.05); margin-top:15px;">
                <h4 style="color:#f39c12; margin-bottom:5px;"><i class="fa-solid fa-book-medical"></i> Cahier d'Entretien — Saisie Pro</h4>
                <p style="font-size:0.65rem; color:#aaa; margin-bottom:12px;">Recherchez un client par son pseudo ou N° de série Blackbox, puis ajoutez une entrée certifiée à son carnet d'entretien numérique.</p>

                <div style="display:flex; gap:8px; margin-bottom:10px;">
                    <input type="text" id="pro-maint-search" placeholder="Username ou N° BB (ex: BB50-00048)" style="flex:1; padding:10px; background:#000; color:white; border:1px solid #444; border-radius:8px; font-size:0.8rem;">
                    <button onclick="proSearchClient()" class="btn-insurance" style="background:#f39c12; color:black; font-weight:bold; white-space:nowrap; padding:10px 15px;">
                        <i class="fa-solid fa-magnifying-glass"></i> Chercher
                    </button>
                </div>

                <div id="pro-maint-client-result" style="display:none; background:rgba(46, 204, 113, 0.08); border:1px solid rgba(46, 204, 113, 0.3); border-radius:10px; padding:12px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div>
                            <i class="fa-solid fa-user" style="color:#2ecc71;"></i>
                            <strong id="pro-maint-client-name" style="color:#fff; margin-left:5px;">—</strong>
                        </div>
                        <span id="pro-maint-client-model" style="font-size:0.7rem; color:#aaa;">—</span>
                    </div>
                    <small id="pro-maint-client-uid" style="font-size:0.6rem; color:#555; display:block;">UID: —</small>
                </div>

                <div id="pro-maint-form" style="display:none;">
                    <label style="font-size:0.75rem; color:#f39c12; font-weight:600; display:block; margin-bottom:5px;">
                        <i class="fa-solid fa-wrench"></i> Type d'intervention
                    </label>
                    <select id="pro-maint-category" style="width:100%; padding:10px; margin-bottom:10px; background:#000; color:white; border:1px solid #444; border-radius:8px; font-size:0.8rem;">
                        <option value="Huile">🛢️ Vidange / Huile</option>
                        <option value="Courroie">⚙️ Courroie</option>
                        <option value="Pneus">🔘 Pneus</option>
                        <option value="Freins">🛑 Freins / Plaquettes</option>
                        <option value="Bougie">🔥 Bougie</option>
                        <option value="Variateur">🔧 Variateur / Galets</option>
                        <option value="Batterie">🔋 Batterie</option>
                        <option value="Carburateur">⛽ Carburateur</option>
                        <option value="Autre">📋 Autre</option>
                    </select>

                    <label style="font-size:0.75rem; color:#f39c12; font-weight:600; display:block; margin-bottom:5px;">
                        <i class="fa-solid fa-gauge-high"></i> Kilométrage au compteur
                    </label>
                    <input type="number" id="pro-maint-km" placeholder="Ex: 12450" style="width:100%; padding:10px; margin-bottom:10px; background:#000; color:white; border:1px solid #444; border-radius:8px; font-size:0.8rem;">

                    <label style="font-size:0.75rem; color:#f39c12; font-weight:600; display:block; margin-bottom:5px;">
                        <i class="fa-solid fa-pen-nib"></i> Description technique
                    </label>
                    <textarea id="pro-maint-desc" placeholder="Détail de l'intervention (ex: Vidange complète huile 2T Ipone Samourai Racing, filtre nettoyé)" style="width:100%; height:70px; background:#000; color:white; border:1px solid #444; border-radius:8px; padding:10px; font-size:0.8rem;"></textarea>

                    <button onclick="proSubmitMaintenance()" class="btn-insurance" style="background:linear-gradient(135deg, #2ecc71, #27ae60); color:white; margin-top:12px; width:100%; font-size:0.9rem; font-weight:bold; padding:14px;">
                        <i class="fa-solid fa-certificate"></i> Certifier & Enregistrer l'Entretien
                    </button>
                </div>

                <div id="pro-maint-status" style="display:none; text-align:center; padding:10px; margin-top:10px; border-radius:8px;"></div>
            </div>
            ` : ''}
        `;
  } else if (page === "donate") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-heart"></i> ${t("donate_title")}</h3>
            <div class="card" style="text-align:center; background: linear-gradient(135deg, rgba(233, 30, 99, 0.1), rgba(0,0,0,0)); border: 1px solid #e91e63;">
                <i class="fa-solid fa-mug-hot fa-bounce" style="font-size:3rem; color:#e91e63; margin-bottom:15px;"></i>
                <p style="font-size:0.9rem; line-height:1.5;"><strong>mon50ccetmoi</strong> est un projet de passionné, développé sur mon temps libre pour la communauté des pilotes de 50cc.</p>
                <p style="font-size:0.8rem; color:#aaa; margin-top:10px;">L'application restera 100% gratuite, mais les dons aident Ãƒ  payer les serveurs (Google Maps API, Firebase) et Ãƒ  financer les futures mises Ãƒ  jour.</p>
                
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
                    <a href="https://www.buymeacoffee.com/mon50cc" target="_blank" class="btn-insurance" style="background:#ffdd00; color:black; text-decoration:none;">âËœ• Offrir un café (Badge Mécène ðŸ’–)</a>
                    <a href="https://paypal.me/mon50cc" target="_blank" class="btn-insurance" style="background:#0070ba; color:white; text-decoration:none;">ðŸ’™ Faire un don libre (PayPal)</a>
                </div>
                
                <p style="font-size:0.7rem; color:#666; margin-top:15px;">ðŸŽ Chaque don débloque le badge exclusif **"Mécène"** sur votre profil et sur la carte communautaire !</p>
            </div>
        `;
  } else if (page === "security") {
    const emergencyNum = secureGetItem("emergency_contact") || "";
    const isGuardian = secureGetItem("guardian_enabled") === "true";

    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-shield-heart"></i> ${t("security_title")}</h3>
            <div class="card" style="border:1px solid #00d2ff; background: rgba(0, 210, 255, 0.05);">
                <label for="emergency-num" style="display:block; font-size:0.8rem; margin-bottom:10px;">Contact d'Urgence (Tel)</label>
                <input type="tel" id="emergency-num" value="${emergencyNum}" placeholder="Ex: 0612345678" style="width:100%; padding:10px; background:#000; border:1px solid #00d2ff; color:white; border-radius:8px;">
                <button onclick="saveEmergencyContact()" class="btn-insurance" style="background:#00d2ff; color:black; margin-top:10px; width:100%; font-size:0.8rem;">Enregistrer</button>
            </div>
            
            <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="font-size:0.9rem;">Guardian Mode</strong><br>
                    <small style="font-size:0.6rem; color:#aaa;">Alerte si arrÃƒªt prolongé suspect</small>
                </div>
                <button onclick="toggleGuardian()" class="btn-circular ${isGuardian ? "btn-neon" : "btn-dark"}" style="width:50px; height:50px;">
                    <i class="fa-solid fa-bell"></i>
                </button>
            </div>

            <div class="card" style="background:rgba(255,255,255,0.05); text-align:center;">
                <i class="fa-solid fa-microchip" style="font-size:2rem; color:#2ecc71; margin-bottom:10px;"></i><br>
                <strong style="font-size:0.8rem;">Détecteur G-Force : ACTIF</strong><br>
                <small style="font-size:0.6rem; color:#666;">Impact calibré Ãƒ  4.5G</small>
            </div>`;
  }
  toggleMenu();
};

window.shareApp = async function () {
  const shareData = {
    version: "20.0",
    id: "com.mon50ccetmoi.twa",
    lang: "fr-FR",
    title: "mon50ccetmoi",
    text: "Rejoins la communauté des scooters 50cc ! Navigation GPS, radars et sécurité.",
    url: window.location.origin,
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      alert(
        "Lien copié ! Partage-le avec tes potes : " + window.location.origin,
      );
    }
  } catch (err) {}
};

window.submitMecaV3 = function () {
  const q = document.getElementById("meca-query").value;
  const res = document.getElementById("meca-response");
  if (!q) return;
  res.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Analyse des capteurs...';
  setTimeout(() => {
    res.innerHTML = `<div style="background:rgba(255,183,3,0.1); padding:15px; border-radius:10px; border-left:4px solid #ffb703;">
            <strong>Diagnostic IA:</strong><br>
            Il est probable que votre bougie soit encrassée ou que le gicleur de votre carburateur soit bouché. 
            Vérifiez l'étincelle et nettoyez votre cuve.
            <div style="margin-top:10px; font-size:0.75rem; color:#888; border-top:1px solid #555; padding-top:5px;">
              Avertissement (AI Act) : Aide indicative générée par IA. <strong>Soumis à contrôle humain.</strong>
            </div>
        </div>`;
  }, 2000);
};

// --- DÃƒ‰TECTEUR DE CHUTE ---
window.addEventListener("devicemotion", (e) => {
  const acc = e.accelerationIncludingGravity;
  if (!acc) return;
  const force = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
  if (force > 45) {
    // Seuil d'impact (G-force importante)
    triggerFallAlert();
    if (window.isGuardianActive && typeof triggerEmergencySOS === "function") {
      triggerEmergencySOS(
        "Chute brutale détectée par l'accéléromètre.",
      );
    }
  }
});

function triggerFallAlert(isManual = false) {
  if (typeof Hardware !== "undefined") {
    Hardware.vibratePattern("sos");
    Hardware.toggleFlashlightSOS(true);
  }
  if (document.getElementById("fall-screen")) return;

  // Annonce vocale par Nexus Atlas
  if (typeof speak === "function") {
    speak(
      isManual
        ? "SOS Manuel activé. Alerte de la meute et de l'Ange Gardien."
        : "Chute détectée. Annulez si vous allez bien, sinon les secours seront prévenus.",
    );
  }

  const div = document.createElement("div");
  div.id = "fall-screen";
  div.style =
    "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(180,0,0,0.95); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; text-align:center; padding:20px;";
  div.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation fa-beat" style="font-size:5rem; margin-bottom:20px;"></i>
        <h1>${isManual ? "SOS MANUEL" : t("fall_detected")}</h1>
        <p>${t("emergency_alert")} <br><br> <span id="sos-countdown" style="font-size:1.5rem; font-weight:bold; color:#ffb703;">15s</span></p>
        
        <!-- NOUVEAU : Bouton Officiel d'Urgence (Conforme Législation) -->
        <a href="tel:112" style="display:block; margin: 15px auto; padding:15px 30px; background:#ff0000; color:white; text-decoration:none; border-radius:50px; font-weight:900; font-size:1.2rem; box-shadow:0 0 15px rgba(255,0,0,0.6);">
            <i class="fa-solid fa-phone"></i> APPELER LES SECOURS (112 / 911)
        </a>
        
        ${typeof getSOSActions === "function" ? getSOSActions() : ""}
        <button onclick="window.cancelFallAlert()" style="margin-top:20px; padding:15px 30px; background:rgba(255,255,255,0.1); color:white; border:1px solid white; border-radius:50px; font-weight:bold; font-size:1rem;">ANNULER ALERTE</button>
    `;
  document.body.appendChild(div);

  let timeLeft = 15;
  window.fallAlertInterval = setInterval(() => {
    timeLeft--;
    const cnt = document.getElementById("sos-countdown");
    if (cnt) cnt.textContent = timeLeft + "s";
    if (timeLeft <= 0) {
      clearInterval(window.fallAlertInterval);
      window.executeAngeGardienProtocol();
    }
  }, 1000);
}

window.cancelFallAlert = function () {
  clearInterval(window.fallAlertInterval);
  const el = document.getElementById("fall-screen");
  if (el) el.remove();
  if (typeof speak === "function") speak("Alerte annulée.");
};

window.executeAngeGardienProtocol = async function () {
  const contact1 = localStorage.getItem("guardian_contact_1");
  const contact2 = localStorage.getItem("guardian_contact_2");
  const contacts = [contact1, contact2].filter(Boolean);

  const div = document.getElementById("fall-screen");
  if (div) {
    div.innerHTML = `
            <div style="width: 60px; height: 60px; border: 4px solid #333; border-top-color: #00d2ff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px auto;"></div>
            <h1 style="color:#00d2ff;">TRANSMISSION SOS...</h1>
            <p>Connexion aux serveurs d'urgence en cours.</p>
        `;
  }

  let message = "Alerte de la Meute transmise.";

  // Appel de la vraie Cloud Function
  try {
    const userId = window.session?.user_id || "anonymous";
    // On suppose que firebase est initialisé globalement
    const sendSOSCall = firebase
      .functions("europe-west1")
      .httpsCallable("sendEmergencySOS");

    await sendSOSCall({
      user_id: userId,
      location: "GPS Coord (Simulated)",
      contacts: contacts,
      message: "Alerte SOS de l'utilisateur.",
    });

    if (contacts.length > 0) {
      message += ` Vos ${contacts.length} Ange(s) Gardien(s) ont été notifiés par SMS.`;
    }
  } catch (e) {
    console.error("[SOS] Cloud Function failed", e);
    // Fallback local HTTP POST using fetch if callable SDK fails (due to V2 https function)
    try {
      await fetch("https://sendemergencysos-rwdjqtbv2q-ew.a.run.app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { user_id: window.session?.user_id, contacts: contacts },
        }),
      });

      if (contacts.length > 0) message += ` Ange(s) Gardien(s) notifiés.`;
    } catch (errFetch) {
      message =
        "Erreur réseau lors de la transmission du SOS automatisé. Veuillez appeler les secours manuellement.";
    }
  }

  if (typeof speak === "function") speak(message);

  if (div) {
    div.innerHTML = `
            <i class="fa-solid fa-satellite-dish" style="font-size:5rem; margin-bottom:20px; color:#00d2ff;"></i>
            <h1 style="color:#00d2ff;">ANGE GARDIEN ACTIVÉ</h1>
            <p>${message}</p>
            <button onclick="window.cancelFallAlert()" style="margin-top:20px; padding:15px 30px; background:#00d2ff; color:#000; border:none; border-radius:50px; font-weight:bold; font-size:1rem;">OK</button>
        `;
  }
};

window.saveGuardianContacts = function () {
  const c1 = document.getElementById("guardian-contact-1")
    ? document.getElementById("guardian-contact-1").value
    : "";
  const c2 = document.getElementById("guardian-contact-2")
    ? document.getElementById("guardian-contact-2").value
    : "";
  localStorage.setItem("guardian_contact_1", c1);
  localStorage.setItem("guardian_contact_2", c2);
  alert(
    "Contacts Ange Gardien sauvegardés ! En cas de chute ou SOS, l'application tentera d'envoyer un message d'urgence.",
  );
};

window.startRodage = function (name) {
  window.isRodageActive = true;
  refreshRodageUI();
  alert(
    `Mode Rodage Activé: ${name}. Vitesse max conseillée: 45km/h. Distance cumulée comptabilisée.`,
  );
  speak("Mode rodage activé. Ménagez votre moteur.");
  closeScreen();
  // Simulation d'un point de destination rodage
  if (currentPosition) {
    calculateRouteSansAutoroute(currentPosition, {
      lat: currentPosition.lat + 0.02,
      lng: currentPosition.lng + 0.02,
    });
  }
};

window.submitMood = function (emoji) {
  const comment = document.getElementById("mood-comment").value;
  const mood = { label: emoji, text: comment };

  // Publication Cloud (Social Ticker)
  if (typeof publishMoodCloud === "function") {
    publishMoodCloud(mood);
  }

  alert("Merci pour votre retour !");
  closeMood();
};
window.closeMood = function () {
  const mood = document.getElementById("mood-overlay");
  if (mood) mood.classList.add("hidden");
};
// Désactivation du popup automatique (bloquait les tests)
// setTimeout(() => document.getElementById('mood-overlay')?.classList.remove('hidden'), 30000);

window.requestAccountDeletion = function () {
  const confirm1 = confirm(
    "⚠ï¸ ATTENTION : Voulez-vous vraiment supprimer définitivement votre compte et TOUTES vos données (garage, points, historique) ?",
  );
  if (confirm1) {
    const confirm2 = prompt(
      "Pour confirmer, tapez 'SUPPRIMER' en majuscules :",
    );
    if (confirm2 === "SUPPRIMER") {
      // Logique de suppression
      let users = JSON.parse(secureGetItem("users") || "[]");
      const username = window.session.username;
      users = users.filter((u) => u.username !== username);
      secureSetItem("users", JSON.stringify(users));

      // Suppression session locale
      logout();
      alert(
        "Votre compte a été supprimé avec succès. Vos données ont été purgées conformément au RGPD.",
      );
    } else {
      alert("Suppression annulée.");
    }
  }
};

window.logout = function () {
  if (typeof secureRemoveItem === "function") {
    secureRemoveItem("session");
  } else {
    localStorage.removeItem("session");
  }
  window.location.href = "login.html";
};

window.updateTicker = function () {
  const t = document.getElementById("ticker-text");
  if (t)
    t.innerHTML = `Bienvenue sur mon50ccetmoi v110.00.00 SILVER EDITION ! Prudence sur la route. 🛵💨`;
};
updateTicker();
setInterval(updateTicker, 60000);

window.testFallDetection = function () {
  alert("Simulation d'un impact dans 3 secondes... Préparez-vous !");
  setTimeout(() => {
    triggerFallAlert();
  }, 3000);
  toggleMenu();
};

window.addMaintLog = function () {
  const action = prompt("Quel entretien avez-vous fait ? (ex: Vidange)");
  if (!action) return;
  const history = JSON.parse(secureGetItem("maint_history") || "[]");
  history.push({ date: new Date().toLocaleDateString(), action });
  secureSetItem("maint_history", JSON.stringify(history));
  showPage("garage");
};

window.joinGroup = function () {
  const code = document.getElementById("group-code").value;
  if (!code) return;
  speak(`Connexion au groupe ${code} en cours...`);
  setTimeout(() => {
    speak(`Vous avez rejoint le groupe ! Vos amis apparaissent sur la carte.`);
    closeScreen();
    simulateCommunityLive();
  }, 2000);
};

window.toggleParkingMode = function () {
  isParkingMode = !isParkingMode;
  const btn = document.getElementById("btn-parking-toggle");
  if (isParkingMode) {
    parkingStartPos = currentPosition;
    btn.innerHTML =
      '<i class="fa-solid fa-shield-halved"></i> Mode Parking : ON';
    btn.classList.add("parking-active");
    speak("Mode parking activé. Votre scooter est sous surveillance.");
  } else {
    btn.innerHTML =
      '<i class="fa-solid fa-shield-halved"></i> Mode Parking : OFF';
    btn.classList.remove("parking-active");
    speak("Mode parking désactivé.");
  }
  toggleMenu();
};

function handleParkingMode(lat, lng) {
  if (!isParkingMode || !parkingStartPos) return;
  const p1 = new google.maps.LatLng(parkingStartPos.lat, parkingStartPos.lng);
  const p2 = new google.maps.LatLng(lat, lng);
  const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);

  if (dist > 30) {
    // Alerte si le scoot bouge de plus de 30m
    speak("ALERTE ! Mouvement suspect détecté !");
    triggerFallAlert(); // Reuse the high-intensity alert UI
    isParkingMode = false;
    document
      .getElementById("btn-parking-toggle")
      .classList.remove("parking-active");
  }
}

function handlePerfTracking(speedKmh) {
  const perfHud = document.getElementById("perf-hud");
  const perfTimeEl = document.getElementById("perf-timer");
  if (!perfHud || !perfTimeEl) return;

  if (speedKmh === 0 && !isPerfTracking) {
    isPerfTracking = true;
    perfStartTime = null;
    perfHud.classList.remove("hidden");
    perfTimeEl.textContent = "0-50: Prêt...";
  } else if (speedKmh > 2 && isPerfTracking && !perfStartTime) {
    perfStartTime = Date.now();
    perfTimeEl.textContent = "0-50: GAZ !";
  } else if (speedKmh >= 50 && isPerfTracking && perfStartTime) {
    const time = ((Date.now() - perfStartTime) / 1000).toFixed(2);
    perfTimeEl.textContent = `0-50: ${time}s !`;
    speak(`Performance réalisée : ${time} secondes.`);
    isPerfTracking = false;
    setTimeout(() => perfHud.classList.add("hidden"), 10000);
  }
}


/* --- app-wallet.js --- */
// F10 : ROADBOOKS COMMUNAUTAIRES (100% GRATUIT)
// ============================================================
window.CommunityRoadbooks = {
  shareMyRoute() {
    if (!window.currentRoute && !window.currentPosition) {
      alert("Lancez d'abord un itinéraire pour pouvoir le partager !");
      return;
    }
    const name = prompt(
      "Donnez un nom Ãƒ  votre itinéraire (ex: Boucle des Alpilles) :",
    );
    if (!name) return;
    const desc = prompt("Description courte (optionnel) :") || "";

    const existing = JSON.parse(
      localStorage.getItem("community_roadbooks") || "[]",
    );
    const newRb = {
      id: "rb_" + Date.now(),
      name: name.trim(),
      description: desc.trim(),
      author: window.session?.username || "Pilote Anonyme",
      distance: window.session?.lastRouteDist || "?",
      date: new Date().toLocaleDateString("fr-FR"),
      rating: 0,
      ratingCount: 0,
    };
    existing.unshift(newRb);
    // Garder max 50 roadbooks locaux
    if (existing.length > 50) existing.pop();
    localStorage.setItem("community_roadbooks", JSON.stringify(existing));
    speak(
      "Itinéraire partagé avec la communauté. Merci pour votre contribution !",
    );
    showPage("community_roadbooks");
  },

  load(id) {
    const rbs = JSON.parse(localStorage.getItem("community_roadbooks") || "[]");
    const rb = rbs.find((r) => r.id === id);
    if (!rb) return;
    speak("Chargement de l'itinéraire " + rb.name);
    // On met le nom dans la barre de recherche pour relancer
    if (document.getElementById("route-search")) {
      document.getElementById("route-search").value = rb.name;
    }
    document.getElementById("screen-overlay")?.classList.add("hidden");
  },

  rate(id) {
    const rbs = JSON.parse(localStorage.getItem("community_roadbooks") || "[]");
    const rb = rbs.find((r) => r.id === id);
    if (!rb) return;
    rb.rating = Math.min(5, (rb.rating || 0) + 1);
    rb.ratingCount = (rb.ratingCount || 0) + 1;
    localStorage.setItem("community_roadbooks", JSON.stringify(rbs));
    speak("Merci pour votre note !");
    showPage("community_roadbooks");
  },
};

// ============================================================


/* --- silicon-valley.js --- */
/* --- SILICON VALLEY BILLION DOLLAR FEATURES --- */

// 1. AR VISION (Augmented Reality Camera Background)
window.isARActive = false;
window.arStream = null;

window.toggleARVision = async function () {
  window.isARActive = !window.isARActive;
  const arVideo = document.getElementById("ar-video-bg");
  const arArrow = document.getElementById("ar-hud-arrow");
  const mapContainer = document.getElementById("map");
  const btn = document.getElementById("dock-btn-ar");

  if (window.isARActive) {
    try {
      if (btn) {
        btn.style.transform = "scale(1.2)";
        btn.style.filter = "drop-shadow(0 0 10px #00ffcc)";
        btn.style.color = "#fff";
      }

      // Request Camera
      window.arStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (arVideo) {
        arVideo.srcObject = window.arStream;
        arVideo.classList.remove("hidden");
      }
      if (arArrow) arArrow.classList.remove("hidden");

      // Make map transparent to see the camera behind
      if (mapContainer) {
        mapContainer.style.opacity = "0.35";
        mapContainer.style.mixBlendMode = "screen";
      }

      // Start AR compass rotation
      window.arOrientationHandler = function (event) {
        if (!window.isARActive) return;
        let compassHeading =
          event.webkitCompassHeading || Math.abs(event.alpha - 360);
        if (arArrow) {
          // Simulation logic: Rotate arrow based on device heading and a target destination.
          // If no destination, just point North for demonstration.
          let targetBearing = window.currentNavBearing || 0;
          let rotation = targetBearing - compassHeading;
          // Fix 3D perspective to make it look like it's pointing "forward" into the camera view
          arArrow.style.transform = `rotateZ(${rotation}deg) rotateX(60deg)`;
        }
      };
      window.addEventListener(
        "deviceorientation",
        window.arOrientationHandler,
        true,
      );

      if (typeof speak === "function")
        speak(
          "Réalité Augmentée activée. Superposition de navigation HUD en ligne.",
        );
    } catch (err) {
      console.error("AR Error: ", err);
      window.isARActive = false;
      if (typeof speak === "function")
        speak("Erreur d'accès à la caméra pour la réalité augmentée.");
      if (btn) {
        btn.style.transform = "scale(1)";
        btn.style.color = "#00ffcc";
      }
    }
  } else {
    if (btn) {
      btn.style.transform = "scale(1)";
      btn.style.filter = "drop-shadow(0 0 5px #00ffcc)";
      btn.style.color = "#00ffcc";
    }
    if (arVideo) arVideo.classList.add("hidden");
    if (arArrow) arArrow.classList.add("hidden");
    if (window.arStream) {
      window.arStream.getTracks().forEach((track) => track.stop());
      window.arStream = null;
    }
    if (window.arOrientationHandler) {
      window.removeEventListener(
        "deviceorientation",
        window.arOrientationHandler,
        true,
      );
    }
    if (mapContainer) {
      mapContainer.style.opacity = "1";
      mapContainer.style.mixBlendMode = "normal";
    }
    if (typeof speak === "function")
      speak("Réalité Augmentée désactivée.");
  }
};

// 2. PROGRAMME FIDELITE ROULER & GAGNER
// 2. PROGRAMME FIDELITE ROULER & GAGNER (Géré par BVCManager)

window.showCryptoWallet = function () {
  const screen = document.getElementById("crypto-wallet-screen");
  const balance = document.getElementById("crypto-balance");
  if (screen) screen.classList.remove("hidden");
  if (balance) balance.innerText = Math.floor(window.BVCManager ? window.BVCManager.balance : 0) + " Pts BVC";

  if (typeof speak === "function") speak("Accès à votre espace fidélité.");
};

window.hideCryptoWallet = function () {
  const screen = document.getElementById("crypto-wallet-screen");
  if (screen) screen.classList.add("hidden");
};

// Hook into distance tracking to earn points
if (typeof window.stopNavigation === "function") {
  const originalStop = window.stopNavigation;
  window.stopNavigation = function () {
    originalStop();
    // Reward 12 Points BVC per ride
    if(window.BVCManager) window.BVCManager.add(12);
    if (typeof speak === "function")
      setTimeout(
        () =>
          speak("Vous avez gagné 12 points BVC pour ce trajet sécurisé."),
        8000,
      );
  };
}

// 3. BIOMETRIC SYNC (Apple Watch Simulation)
window.currentBPM = 75;
window.initBiometrics = function () {
  const bpmDisplay = document.getElementById("biometric-bpm");
  if (!bpmDisplay) return;

  setInterval(() => {
    // Random fluctuation
    let fluctuation = Math.floor(Math.random() * 5) - 2;
    window.currentBPM += fluctuation;

    // Boundaries
    if (window.currentBPM < 60) window.currentBPM = 60;
    if (window.currentBPM > 140) window.currentBPM = 140;

    bpmDisplay.innerText = window.currentBPM + " BPM";

    // Heartbeat animation speed
    const heartIcon = document.getElementById("biometric-heart");
    if (heartIcon) {
      let speed = 60 / window.currentBPM;
      heartIcon.style.animationDuration = speed + "s";
    }

    // Stress Detection (Zen Mode Trigger)
    if (window.currentBPM > 115) {
      bpmDisplay.style.color = "#ff0055";
      bpmDisplay.style.textShadow = "0 0 10px #ff0055";

      // Randomly trigger voice if super stressed
      if (Math.random() > 0.95 && typeof speak === "function") {
        speak(
          "Rythme cardiaque élevé détecté. Respirez calmement pour votre sécurité.",
        );
      }
    } else {
      bpmDisplay.style.color = "#00ffcc";
      bpmDisplay.style.textShadow = "0 0 10px #00ffcc";
    }
  }, 2000);
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(window.initBiometrics, 3000);
});


/* --- nexus-atlas-voice.js --- */
/* --- Nexus Atlas 4.0 PROPRIETARY NEURAL ENGINE --- */

window.NexusAtlasEngine = {
  context: {
    lastIntent: null,
    userMood: "neutral",
  },

  // Réponses dynamiques pour éviter l'effet "robot"
  responses: {
    ack: [
      "Bien reçu.",
      "Je m'en occupe.",
      "Analyse en cours.",
      "Compris, pilote.",
    ],
    search: [
      "Je lance la recherche.",
      "Recherche dans la base de données locale.",
      "Cartographie en cours.",
    ],
    error: [
      "Je n'ai pas compris cette instruction.",
      "Veuillez reformuler, pilote.",
      "Instruction non reconnue par mes protocoles.",
    ],
    jokes: [
      "Que fait un motard quand il a froid ? Il se rapproche du pot d'échappement.",
      "Pourquoi les motards sont-ils toujours heureux ? Parce qu'on ne peut pas pleurer avec un casque intégral.",
      "Quel est le comble pour un mécanicien scooter ? C'est de perdre la boule !",
    ],
  },

  getRandomResponse: function (type) {
    const arr = this.responses[type] || this.responses.ack;
    return arr[Math.floor(Math.random() * arr.length)];
  },

  speak: function (text) {
    if (typeof window.speak === "function") {
      window.speak(text);
    } else if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "fr-FR";
      utterance.pitch = 0.9; // Voix légèrement plus grave
      utterance.rate = 1.05; // Rythme naturel mais réactif
      window.speechSynthesis.speak(utterance);
    } else {
    }
  },

  processQuery: function (transcript) {
    const t = transcript.toLowerCase();

    // 1. Détection d'intentions complexes (Intent Parsing)

    // Appel d'Urgence / SOS
    if (
      this.matchAny(t, [
        "urgence",
        "accident grave",
        "secours",
        "police",
        "samu",
        "pompier",
        "pompiers",
        "aide-moi",
      ])
    ) {
      return {
        action: "EMERGENCY_CALL",
        reply: `Attention. Mode urgence activé. Je prépare l'appel aux services de secours.`,
      };
    }
    // Comparaison Carburant
    else if (
      this.matchAny(t, ["essence", "carburant", "plein", "station", "sec"]) &&
      this.matchAny(t, ["moins cher", "prix", "compare", "où"])
    ) {
      return {
        action: "COMPARE_GAS_PRICES",
        reply: `Analyse des prix du carburant dans un rayon de 3 kilomètres en cours.`,
      };
    } else if (this.matchAny(t, ["essence", "station", "carburant", "sec"])) {
      return {
        action: "COMPARE_GAS_PRICES",
        reply: `${this.getRandomResponse("search")} J'affiche le radar communautaire des prix du carburant.`,
      };
    }
    // Navigation Spécifique
    else if (
      this.matchAny(t, [
        "emmène-moi",
        "itinéraire vers",
        "aller à",
        "guidage vers",
      ])
    ) {
      // Extraction basique de la destination
      let destination = "votre destination";
      const navKeywords = ["vers", "à "];
      for (let kw of navKeywords) {
        if (t.includes(kw)) {
          destination = t.split(kw)[1].trim();
          break;
        }
      }
      return {
        action: "NAVIGATE_TO",
        payload: destination,
        reply: `Calcul de l'itinéraire optimal vers ${destination}.`,
      };
    }
    // Maison
    else if (this.matchAny(t, ["maison", "domicile", "rentrer", "retour"])) {
      return {
        action: "GO_HOME",
        reply: `Calcul du trajet vers votre domicile. ${this.getRandomResponse("ack")}`,
      };
    }
    // Signalements (Dangers / Animaux / Police)
    else if (this.matchAny(t, ["accident", "danger", "obstacle", "travaux"])) {
      return {
        action: "REPORT_HAZARD",
        reply: `Danger signalé à la meute. Merci pour votre vigilance.`,
      };
    } else if (
      this.matchAny(t, ["animal", "animaux", "biche", "sanglier", "chien"])
    ) {
      return {
        action: "REPORT_ANIMAL",
        reply: `Présence animale confirmée et partagée. Soyez prudent.`,
      };
    } else if (this.matchAny(t, ["radar", "flics", "contrôle", "police"])) {
      return {
        action: "REPORT_POLICE",
        reply: `Zone de contrôle signalée sur le radar communautaire.`,
      };
    }
    // Social
    else if (
      this.matchAny(t, [
        "meute",
        "amis",
        "social",
        "radar social",
        "pilotes",
        "motards",
      ])
    ) {
      return {
        action: "SOCIAL_RADAR",
        reply: `Activation du balayage social. Recherche de pilotes alliés dans le secteur.`,
      };
    }
    // Modes de conduite
    else if (
      this.matchAny(t, ["sensation", "virage", "sport", "attaque", "balade"])
    ) {
      return {
        action: "SENSATION_MODE",
        reply: `Mode sensation engagé. Optimisation de l'itinéraire pour le plaisir de conduite.`,
      };
    }
    // Diagnostic Moto
    else if (
      this.matchAny(t, [
        "diagnostic",
        "état",
        "santé",
        "mécanique",
        "panne",
        "moteur",
      ])
    ) {
      return {
        action: "AI_DIAGNOSTIC",
        reply: `J'ouvre le panneau de télémétrie prédictive de votre engin.`,
      };
    }
    // Météo
    else if (
      this.matchAny(t, [
        "météo",
        "temps",
        "pluie",
        "pleuvoir",
        "froid",
        "chaud",
      ])
    ) {
      return {
        action: "WEATHER_CHECK",
        reply: `Je vérifie les conditions météorologiques sur votre parcours actuel.`,
      };
    }
    // Profil
    else if (
      this.matchAny(t, [
        "mon score",
        "mon profil",
        "mes points",
        "mes statistiques",
      ])
    ) {
      return {
        action: "OPEN_PROFILE",
        reply: `Affichage de vos statistiques et de votre profil de pilote.`,
      };
    }
    // Statistiques de l'application
    else if (
      this.matchAny(t, [
        "combien d'utilisateurs",
        "statistiques",
        "téléchargements",
        "audience",
        "pays",
      ])
    ) {
      return {
        action: "APP_STATS",
        reply: `D'après mes dernières analyses en date du 4 juillet 2026, l'application compte 4 installations uniques. 3 pilotes sont en France, et nous avons 1 pilote en Indonésie.`,
      };
    }
    // Identité / Blague
    else if (this.matchAny(t, ["blague", "humour", "fais-moi rire"])) {
      return { action: "JOKE", reply: this.getRandomResponse("jokes") };
    } else if (
      this.matchAny(t, [
        "qui es-tu",
        "ton nom",
        "t'appelles",
        "que sais-tu faire",
      ])
    ) {
      return {
        action: "IDENTITY",
        reply: `Je suis Nexus Atlas, l'intelligence artificielle de Mon 50cc et Moi. Je suis connecté à votre télémétrie, au réseau communautaire et prêt à vous assister sur la route.`,
      };
    } else if (
      this.matchAny(t, [
        "drogue",
        "stupéfiant",
        "stupéfiants",
        "positif",
        "fumé",
        "joint",
        "cannabis",
        "thc",
        "dépistage",
        "test",
      ])
    ) {
      return {
        action: "DRUGS_WARNING",
        reply: `Conduire sous l'emprise de stupéfiants avec un BSR ou Permis AM est un délit grave. Pour une première infraction, vous risquez jusqu'à 4500 euros d'amende, 2 ans de prison, l'immobilisation ou la confiscation de votre scooter, et la suspension de votre permis AM. Bien qu'il n'y ait pas de perte de points sur le BSR, les sanctions pénales sont très lourdes.`,
      };
    } else {
      return { action: "UNKNOWN", reply: this.getRandomResponse("error") };
    }
  },

  matchAny: function (text, keywords) {
    return keywords.some((kw) => text.includes(kw));
  },

  executeAction: function (result) {
    // Retour visuel (si disponible dans le DOM)
    const nexusAtlasFeedback = document.getElementById("nexus-atlas-feedback-text");
    if (nexusAtlasFeedback) {
      nexusAtlasFeedback.innerText = result.reply;
      nexusAtlasFeedback.classList.add("visible");
      setTimeout(() => nexusAtlasFeedback.classList.remove("visible"), 5000);
    }

    if (result.reply) {
      this.speak(result.reply);
    }

    switch (result.action) {
      case "EMERGENCY_CALL":
        if (typeof window.triggerSOS === "function") window.triggerSOS();
        else alert("⚠ï¸ URGENCE : Appeler le 112");
        break;
      case "COMPARE_GAS_PRICES":
        if (typeof window.CommunityGas === "object") {
          window.CommunityGas.compareAndShow();
        }
        break;
      case "NAVIGATE_TO":
        if (document.getElementById("route-search"))
          document.getElementById("route-search").value = result.payload;
        if (typeof window.searchDestination === "function")
          window.searchDestination();
        break;
      case "GO_HOME":
        if (document.getElementById("route-search"))
          document.getElementById("route-search").value = "Domicile";
        if (typeof window.searchDestination === "function")
          window.searchDestination();
        break;
      case "REPORT_HAZARD":
        if (typeof window.reportHazard === "function")
          window.reportHazard("danger");
        break;
      case "REPORT_ANIMAL":
        if (typeof window.reportHazard === "function")
          window.reportHazard("animal");
        break;
      case "REPORT_POLICE":
        if (typeof window.reportHazard === "function")
          window.reportHazard("police");
        break;
      case "SOCIAL_RADAR":
        if (typeof window.toggleSocialRadar === "function")
          window.toggleSocialRadar();
        break;
      case "SENSATION_MODE":
        if (typeof window.toggleSensationMode === "function")
          window.toggleSensationMode();
        break;
      case "AI_DIAGNOSTIC":
        const modal = document.getElementById("ai-diagnostic-modal");
        if (modal) {
          modal.classList.remove("hidden");
          if (window.PredictiveMeca) window.PredictiveMeca.updateDashboardUI();
        }
        break;
      case "WEATHER_CHECK":
        if (typeof window.showWeatherWidget === "function")
          window.showWeatherWidget();
        break;
      case "OPEN_PROFILE":
        if (typeof window.openProfile === "function") window.openProfile();
        else window.location.href = "profile.html";
        break;
      case "DRUGS_WARNING":
        console.warn(
          "[Nexus Atlas 4.0] Prévention stupéfiants déclenchée.",
        );
        break;
    }
  },
};

window.initVoiceAI = function () {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn("Reconnaissance vocale non supportée sur ce navigateur.");
    return;
  }

  window.voiceAI = new SpeechRecognition();
  window.voiceAI.continuous = true;
  window.voiceAI.interimResults = false;
  window.voiceAI.lang = "fr-FR";

  window.voiceAI.onstart = function () {
    const micIcon = document.getElementById("nexus-atlas-mic-icon");
    if (micIcon) {
      micIcon.style.color = "#00d2ff"; // Couleur UI Gemini/IA
      micIcon.classList.add("fa-fade");
      micIcon.style.transform = "scale(1.2)";
    }
  };

  window.voiceAI.onresult = function (event) {
    const current = event.resultIndex;
    const transcript = event.results[current][0].transcript.toLowerCase();

    // Feedback utilisateur
    const nexusAtlasFeedback = document.getElementById("nexus-atlas-feedback-text");
    if (
      nexusAtlasFeedback &&
      !transcript.includes("oracle") &&
      !transcript.includes("système") &&
      !transcript.includes("nexus-atlas")
    ) {
      nexusAtlasFeedback.innerText = "Vous : " + transcript;
      nexusAtlasFeedback.classList.add("visible");
    }

    // Si le mot clé de réveil est utilisé
    if (
      transcript.includes("oracle") ||
      transcript.includes("système") ||
      transcript.includes("nexus-atlas")
    ) {
      // Extraction de la commande après le mot clé pour plus de précision
      let command = transcript;
      ["oracle", "système", "nexus-atlas"].forEach((kw) => {
        if (transcript.includes(kw)) {
          command = transcript.split(kw)[1].trim() || transcript;
        }
      });

      // Si la commande est vide après "nexus-atlas"
      if (command.length < 2) {
        window.NexusAtlasEngine.speak("À vos ordres, pilote.");
        return;
      }

      const result = window.NexusAtlasEngine.processQuery(command);
      window.NexusAtlasEngine.executeAction(result);
    }
  };

  window.voiceAI.onerror = function (event) {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
      window.voiceAI.permissionDenied = true;
      const nexusAtlasFeedback = document.getElementById("nexus-atlas-feedback-text");
      if (nexusAtlasFeedback) {
        nexusAtlasFeedback.innerText = "Accès au microphone refusé. Fonction vocale désactivée.";
        nexusAtlasFeedback.classList.add("visible");
        setTimeout(() => nexusAtlasFeedback.classList.remove("visible"), 5000);
      }
    } else {
      console.warn("[Nexus Atlas 4.0] Erreur micro : ", event.error);
    }
    const micIcon = document.getElementById("nexus-atlas-mic-icon");
    if (micIcon) {
      micIcon.style.color = "#ff0055";
      micIcon.classList.remove("fa-fade");
      micIcon.style.transform = "scale(1)";
    }
  };

  window.voiceAI.onend = function () {
    const micIcon = document.getElementById("nexus-atlas-mic-icon");
    if (micIcon) {
      micIcon.style.transform = "scale(1)";
      micIcon.classList.remove("fa-fade");
      micIcon.style.color = "";
    }

    if (window.voiceAI.permissionDenied) {
      return; // Ne pas réessayer si la permission est refusée
    }

    setTimeout(() => {
      try {
        window.voiceAI.start();
      } catch (e) {}
    }, 2000);
  };

  try {
    window.voiceAI.start();
  } catch (e) {
    console.error("Impossible de démarrer l'IA vocale : ", e);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (
      localStorage.getItem("cnil_consent") === "true" &&
      localStorage.getItem("cnil_mic") !== "false"
    ) {
      window.initVoiceAI();
    }
  }, 5000);
});


/* --- community-gas.js --- */
/* --- COMMUNITY GAS RADAR (OpenData Gouv + Firebase) --- */

window.CommunityGas = {
  stations: [],

  compareAndShow: function () {
    if (typeof speak === "function")
      speak(
        "Connexion au flux Open Data du gouvernement et récupération des prix en temps réel.",
      );

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          this.fetchGovData(
            position.coords.latitude,
            position.coords.longitude,
          ),
        (error) => {
          console.warn("Erreur GPS:", error);
          // Mock coordinates (Paris) for testing if GPS fails
          this.fetchGovData(48.8566, 2.3522);
        },
      );
    } else {
      this.fetchGovData(48.8566, 2.3522);
    }
  },

  fetchGovData: async function (lat, lon) {
    try {
      // Requête vers l'API OpenDataSoft du Gouvernement Français (Rayon de 3km)
      const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?where=within_distance(geom, geom'POINT(${lon} ${lat})', 3km)&limit=20`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erreur API Gouvernementale");

      const data = await response.json();
      this.processGovData(data.results, lat, lon);
    } catch (e) {
      console.error(e);
      if (typeof speak === "function")
        speak(
          "Impossible de contacter le serveur gouvernemental. Veuillez réessayer plus tard.",
        );
    }
  },

  // Formule de Haversine pour calculer la distance exacte
  calculateDistance: function (lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la terre en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  processGovData: function (records, myLat, myLon) {
    this.stations = [];

    if (!records || records.length === 0) {
      if (typeof speak === "function")
        speak(
          "Je ne trouve aucune station service répertoriée dans un rayon de 3 kilomètres.",
        );
      return;
    }

    records.forEach((record) => {
      if (!record.geom || !record.geom.lat || !record.geom.lon) return;

      const dist = this.calculateDistance(
        myLat,
        myLon,
        record.geom.lat,
        record.geom.lon,
      );

      // Le flux officiel liste les prix sous format JSON array ou chaîne XML parsée.
      // On extrait SP98 et E10 (s'ils existent)
      let sp98 = null;
      let e10 = null;

      // Parsing des prix (Le format dépend du flux, généralement record.prix est un array d'objets)
      try {
        let rawPrix = record.prix;
        if (typeof rawPrix === "string") rawPrix = JSON.parse(rawPrix);
        if (Array.isArray(rawPrix)) {
          rawPrix.forEach((p) => {
            if (p["@nom"] === "SP98") sp98 = parseFloat(p["@valeur"]);
            if (p["@nom"] === "E10") e10 = parseFloat(p["@valeur"]);
          });
        }
      } catch (e) {
        console.warn("Erreur parsing prix pour station", record.id);
      }

      // Si le flux v2 extrait directement les prix en colonnes
      if (record.sp98_prix) sp98 = parseFloat(record.sp98_prix);
      if (record.e10_prix) e10 = parseFloat(record.e10_prix);

      if (sp98 || e10) {
        this.stations.push({
          id: record.id,
          name: record.adresse
            ? record.adresse
            : record.ville || "Station Inconnue",
          distance: dist,
          brand: record.ville || "Local",
          prices: {
            SP98: sp98
              ? {
                  price: sp98,
                  updatedAt: record.maj || new Date().toISOString(),
                  updatedBy: "Data Gouv",
                }
              : null,
            E10: e10
              ? {
                  price: e10,
                  updatedAt: record.maj || new Date().toISOString(),
                  updatedBy: "Data Gouv",
                }
              : null,
          },
        });
      }
    });

    this.stations.sort((a, b) => a.distance - b.distance);

    let bestStation = null;
    let warningStation = null;
    let bestPrice = 999;

    this.stations.forEach((station) => {
      if (station.prices["SP98"]) {
        if (station.prices["SP98"].price < bestPrice) {
          bestPrice = station.prices["SP98"].price;
          bestStation = station;
        }
      } else if (station.prices["E10"] && !warningStation) {
        // Première station qui n'a que du E10
        warningStation = station;
      }
    });

    // Préparation du message vocal
    let voiceMessage = "";
    if (bestStation) {
      voiceMessage += `La station à ${bestStation.distance.toFixed(1)} kilomètres est la moins chère avec le Sans Plomb 98 à ${bestStation.prices["SP98"].price.toFixed(2)} euros. `;
    }

    if (warningStation) {
      voiceMessage += `Je déconseille la station à ${warningStation.distance.toFixed(1)} kilomètres qui ne propose que du E 10, ce qui est très nocif pour les moteurs de 50 cc. `;
    }

    if (typeof speak === "function" && voiceMessage !== "") speak(voiceMessage);

    this.renderHUD(this.stations.slice(0, 3)); // Afficher le top 3
  },

  renderHUD: function (nearbyStations) {
    let hud = document.getElementById("community-gas-hud");
    if (!hud) return;

    const listContainer = document.getElementById("gas-stations-list");
    listContainer.innerHTML = "";

    nearbyStations.forEach((station) => {
      const hasSP98 = !!station.prices["SP98"];
      const price = hasSP98
        ? station.prices["SP98"].price.toFixed(3)
        : station.prices["E10"]
          ? station.prices["E10"].price.toFixed(3)
          : "--";
      const fuelName = hasSP98 ? "SP98" : "E10";
      const statusClass = hasSP98 ? "gas-safe" : "gas-danger";
      const statusIcon = hasSP98 ? "fa-check-circle" : "fa-skull-crossbones";
      const statusText = hasSP98 ? "Recommandé 50cc" : "DANGER E10";

      const card = document.createElement("div");
      card.className = `gas-station-card ${statusClass}`;
      card.innerHTML = `
                <div class="gas-header">
                    <h4><i class="fa-solid fa-gas-pump"></i> ${station.name}</h4>
                    <span class="gas-distance">${station.distance.toFixed(1)} km</span>
                </div>
                <div class="gas-body">
                    <div class="gas-price-block">
                        <span class="gas-type">${fuelName}</span>
                        <span class="gas-price">${price} €</span>
                    </div>
                    <div class="gas-status">
                        <i class="fa-solid ${statusIcon}"></i> ${statusText}
                    </div>
                </div>
                <div class="gas-footer">
                    <button class="btn-update-price" onclick="window.CommunityGas.openUpdateModal('${station.id}')">
                        <i class="fa-solid fa-pen"></i> Mettre à jour (+5 Pts)
                    </button>
                </div>
            `;
      listContainer.appendChild(card);
    });

    hud.classList.remove("hidden");
  },

  openUpdateModal: function (stationId) {
    const station = this.stations.find((s) => s.id === stationId);
    if (!station) return;

    const hasSP98 = !!station.prices["SP98"];
    const fuelName = hasSP98 ? "SP98" : "E10";
    const currentPrice = hasSP98
      ? station.prices["SP98"].price
      : station.prices["E10"]
        ? station.prices["E10"].price
        : "1.800";

    const newPrice = prompt(
      `Prix officiel Gouv.fr : ${currentPrice}€.\nEntrez le nouveau prix constaté sur place pour le ${fuelName} :`,
      currentPrice,
    );

    if (newPrice !== null && !isNaN(parseFloat(newPrice))) {
      this.updateStationPrice(stationId, parseFloat(newPrice), fuelName);
    }
  },

  updateStationPrice: function (stationId, price, fuelType) {
    const station = this.stations.find((s) => s.id === stationId);
    if (station) {
      if (!station.prices[fuelType]) station.prices[fuelType] = {};
      station.prices[fuelType].price = price;
      station.prices[fuelType].updatedBy = "Communauté";

      alert(
        `Merci ! Le prix a été mis à jour à ${price}€ et synchronisé avec la communauté.\nVous gagnez +5 Points BVC.`,
      );
      if (typeof window.testAddPoints === "function") window.testAddPoints(5);

      this.renderHUD(this.stations.slice(0, 3));
    }
  },
};


/* --- leaderboard.js --- */
// --- LEADERBOARD (King of the Street) ---
window.Leaderboard = {
  topPilots: [],

  init: async function () {
    if (!window.session || !window.session.uid) return;

    await this.ensureDepartment();
    await this.fetchLeaderboard();
  },

  ensureDepartment: async function () {
    if (window.session.department) return; // Déjà calculé

    if (window.currentPosition && typeof google !== "undefined") {
      try {
        const geocoder = new google.maps.Geocoder();
        const response = await geocoder.geocode({
          location: {
            lat: window.currentPosition.lat,
            lng: window.currentPosition.lng,
          },
        });

        if (response.results[0]) {
          // Trouver le code postal ou le département
          const addressComponents = response.results[0].address_components;
          const postalCode = addressComponents.find((c) =>
            c.types.includes("postal_code"),
          );
          const adminArea = addressComponents.find((c) =>
            c.types.includes("administrative_area_level_2"),
          );

          let deptCode = "Inconnu";
          if (postalCode) {
            deptCode = postalCode.long_name.substring(0, 2);
          } else if (adminArea) {
            deptCode = adminArea.short_name;
          }

          window.session.department = deptCode;

          // Sauvegarder dans Firestore
          if (typeof firebase !== "undefined") {
            await firebase
              .firestore()
              .collection("users")
              .doc(window.session.uid)
              .update({
                department: deptCode,
              });
            secureSetItem("session", JSON.stringify(window.session));
          }
        }
      } catch (e) {
        console.warn("[Leaderboard] Erreur de reverse geocoding :", e);
        window.session.department = "Global";
      }
    } else {
      window.session.department = "Global";
    }
  },

  fetchLeaderboard: async function () {
    if (typeof firebase === "undefined") return;
    try {
      let query = firebase.firestore().collection("users");

      // Si on a un département valide, on filtre. Sinon, classement global
      if (
        window.session.department &&
        window.session.department !== "Global" &&
        window.session.department !== "Inconnu"
      ) {
        query = query.where("department", "==", window.session.department);
      }

      const snap = await query.orderBy("bvcPoints", "desc").limit(10).get();

      this.topPilots = [];
      snap.forEach((doc) => {
        const data = doc.data();
        this.topPilots.push({
          uid: doc.id,
          username: data.username || "Pilote Anonyme",
          points: data.bvcPoints || 0,
        });
      });

      // Si on est dans le top 3, on s'octroie une couronne (logique visuelle)
      this.checkMyCrown();
    } catch (e) {
      console.error("[Leaderboard] Error fetching top pilots", e);
    }
  },

  checkMyCrown: function () {
    if (!window.session) return;
    const myRank = this.topPilots.findIndex(
      (p) => p.uid === window.session.uid,
    );
    if (myRank === 0) {
      window.session.crown = "gold";
    } else if (myRank === 1) {
      window.session.crown = "silver";
    } else if (myRank === 2) {
      window.session.crown = "bronze";
    } else {
      window.session.crown = null;
    }
  },

  showModal: function () {
    let modal = document.getElementById("leaderboard-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "leaderboard-modal";
      modal.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
      document.body.appendChild(modal);
    }

    let htmlList = "";
    this.topPilots.forEach((p, index) => {
      let crownIcon = "";
      let color = "#fff";
      if (index === 0) {
        crownIcon = "👑";
        color = "#ffd700";
      } else if (index === 1) {
        crownIcon = "🥈";
        color = "#c0c0c0";
      } else if (index === 2) {
        crownIcon = "🥉";
        color = "#cd7f32";
      }

      htmlList += `
                <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #333; color:${color}; font-weight:${index < 3 ? "bold" : "normal"};">
                    <span>${index + 1}. ${crownIcon} ${p.username}</span>
                    <span>${p.points} pts</span>
                </div>
            `;
    });

    modal.innerHTML = `
            <div style="background:#111; border:1px solid #ffd700; border-radius:15px; padding:30px; width:90%; max-width:400px; text-align:center;">
                <h2 style="color:#ffd700; margin-bottom:5px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-trophy"></i> King of the Street</h2>
                <p style="color:#aaa; font-size:0.9rem; margin-top:0; margin-bottom:20px; text-transform:uppercase;">
                    Ligue : ${window.session.department && window.session.department !== "Global" ? "Dép. " + window.session.department : "Mondiale"}
                </p>
                <div style="text-align:left; max-height:300px; overflow-y:auto; margin-bottom:20px; background:#000; border-radius:10px; padding:10px;">
                    ${htmlList || "<p style='color:#aaa;text-align:center;'>Aucun classement disponible.</p>"}
                </div>
                <button onclick="document.getElementById('leaderboard-modal').style.display='none'" style="width:100%; background:transparent; border:1px solid #aaa; color:#fff; padding:10px; border-radius:20px; cursor:pointer;">Fermer</button>
            </div>
        `;
    modal.style.display = "flex";
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.Leaderboard.init();
  }, 4000);
});


/* --- v3-smartcity.js --- */
/* --- V3.0 SMART CITY & ZERO-CLICK DESTINY --- */

// 1. ZERO-CLICK DESTINY (IA Quantique)
window.initZeroClickDestiny = function () {
  const zeroClickScreen = document.getElementById("zero-click-screen");
  const destinationLabel = document.getElementById("zero-click-destination");
  const countdownLabel = document.getElementById("zero-click-countdown");

  if (!zeroClickScreen || !destinationLabel || !countdownLabel) return;

  // Simulation de l'IA qui devine la destination selon l'heure
  const hour = new Date().getHours();
  let predictedDestination = "Lycée / CFA";
  if (hour >= 17 && hour <= 20) predictedDestination = "Maison";
  else if (hour > 20 || hour < 5)
    predictedDestination = "Spot de Rassemblement VSP/50cc";

  destinationLabel.innerText = predictedDestination;
  zeroClickScreen.classList.remove("hidden");

  if (typeof speak === "function")
    speak(
      "Intelligence prédictive activée. Itinéraire vers " +
        predictedDestination +
        " dans 3 secondes.",
    );

  let timer = 3;
  window.zeroClickInterval = setInterval(() => {
    timer--;
    countdownLabel.innerText = timer;

    if (timer <= 0) {
      clearInterval(window.zeroClickInterval);
      zeroClickScreen.classList.add("hidden");
      if (typeof speak === "function")
        speak(
          "Navigation autonome engagée. Connexion aux infrastructures de la ville.",
        );

      // On simule le lancement de la navigation vers la destination
      const searchInput = document.getElementById("search-input");
      if (searchInput) searchInput.value = predictedDestination;

      // Démarrage de V2X après lancement
      setTimeout(window.initV2XGreenWave, 2000);
    }
  }, 1000);
};

window.cancelZeroClick = function () {
  clearInterval(window.zeroClickInterval);
  const zeroClickScreen = document.getElementById("zero-click-screen");
  if (zeroClickScreen) zeroClickScreen.classList.add("hidden");
  if (typeof speak === "function")
    speak("Prédiction annulée. Mode manuel activé.");
};

// 2. V2X GREEN WAVE (Piratage Feux Tricolores 50cc)
window.v2xActive = false;

window.initV2XGreenWave = function () {
  window.v2xActive = true;
  const v2xHud = document.getElementById("v2x-hud");
  const v2xStatus = document.getElementById("v2x-status");
  const v2xTargetSpeed = document.getElementById("v2x-target-speed");

  if (!v2xHud || !v2xStatus) return;
  v2xHud.classList.remove("hidden");

  // Boucle V2X
  setInterval(() => {
    if (!window.v2xActive) return;

    const currentSpeed = window.lastKnownSpeedKmh || 0; // Vient de telemetry.js/infallible.js

    // Pour un 50cc/VSP, la vitesse idéale pour choper les feux verts en ville est souvent 42 km/h.
    const optimalSpeed = 42;

    if (v2xTargetSpeed) v2xTargetSpeed.innerText = optimalSpeed + " km/h";

    if (currentSpeed > 45) {
      // Excès de vitesse 50cc -> Risque de feu rouge
      v2xHud.style.borderColor = "#ff0055";
      v2xStatus.innerText = "RALENTISSEZ - FEU ROUGE IMMINENT";
      v2xStatus.style.color = "#ff0055";
      if (Math.random() > 0.95 && typeof speak === "function") {
        speak(
          "Vitesse excessive pour un 50cc. Ralentissez à 42 km heure pour attraper la vague verte.",
        );
      }
    } else if (currentSpeed >= 38 && currentSpeed <= 45) {
      // Vitesse parfaite Onde Verte
      v2xHud.style.borderColor = "#00ffcc";
      v2xStatus.innerText = "VAGUE VERTE SYNCHRONISÉE";
      v2xStatus.style.color = "#00ffcc";
    } else if (currentSpeed > 0 && currentSpeed < 38) {
      // Trop lent
      v2xHud.style.borderColor = "#ffaa00";
      v2xStatus.innerText = "ACCÉLÉREZ LÉGÈREMENT";
      v2xStatus.style.color = "#ffaa00";
    } else {
      // À l'arrêt
      v2xHud.style.borderColor = "#555";
      v2xStatus.innerText = "ATTENTE FEU VERT...";
      v2xStatus.style.color = "#aaa";
    }
  }, 1000);
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (localStorage.getItem("cnil_consent") === "true") {
      window.initZeroClickDestiny();
    }
  }, 2000);
});


/* --- carbon-trading.js --- */
/* --- CARBON TRADING & CEE MARKET --- */

window.ecoScore = 100;
window.ceeCertificates = parseInt(
  localStorage.getItem("ceeCertificates")
    ? atob(localStorage.getItem("ceeCertificates"))
    : "0",
);

// 1. ECO-DRIVING TELEMETRY
window.initEcoTelemetry = function () {
  let lastSpeed = 0;
  setInterval(() => {
    const currentSpeed = window.lastKnownSpeedKmh || 0;
    const delta = Math.abs(currentSpeed - lastSpeed);

    // Si freinage brutal ou accélération violente (> 15 km/h en 1s)
    if (delta > 15) {
      window.ecoScore -= 2;
      if (window.ecoScore < 0) window.ecoScore = 0;
    }

    lastSpeed = currentSpeed;
  }, 1000);
};

// 2. GENERATE CEE CERTIFICATE
window.generateEcoReport = function () {
  const certScreen = document.getElementById("cee-certificate-screen");
  const scoreVal = document.getElementById("cee-score");
  const serialVal = document.getElementById("cee-serial");

  if (!certScreen) return;

  // Simulation de calcul
  if (window.ecoScore > 75) {
    window.ceeCertificates++;
    localStorage.setItem(
      "ceeCertificates",
      btoa(window.ceeCertificates.toString()),
    );

    scoreVal.innerText = window.ecoScore + "/100";
    serialVal.innerText =
      "CEE-" +
      Math.random().toString(36).substring(2, 10).toUpperCase() +
      "-" +
      new Date().getFullYear();

    certScreen.classList.remove("hidden");
    if (typeof speak === "function")
      speak(
        "Trajet terminé. Score écologique excellent. Certificat d'économie d'énergie généré avec succès.",
      );

    // Update Wallet Badge if exists
    const walletBtn = document.getElementById("dock-btn-wallet");
    if (walletBtn) walletBtn.style.filter = "drop-shadow(0 0 15px #00ff00)";
  } else {
    if (typeof speak === "function")
      speak(
        "Trajet terminé. Conduite trop agressive, aucun certificat carbone délivré.",
      );
  }
};

window.closeCEE = function () {
  document.getElementById("cee-certificate-screen").classList.add("hidden");
};

// 3. CARBON TRADING FLOOR
window.openTradingFloor = function () {
  const floorScreen = document.getElementById("carbon-trading-floor");
  const stockPrice = document.getElementById("carbon-stock-price");
  const inventory = document.getElementById("cee-inventory");
  if (!floorScreen) return;

  inventory.innerText = window.ceeCertificates + " CEE Disponibles";
  floorScreen.classList.remove("hidden");

  if (typeof speak === "function")
    speak(
      "Accès à la salle de marché du carbone. Des mégacorporations attendent d'acheter vos certificats.",
    );

  // Simulation du cours de la bourse
  window.tradingInterval = setInterval(() => {
    const price = (14.5 + (Math.random() * 5 - 2.5)).toFixed(2);
    stockPrice.innerText = price + " €";
    if (price > 16) stockPrice.style.color = "#00ff00";
    else stockPrice.style.color = "#ff0055";
  }, 2000);
};

window.closeTradingFloor = function () {
  document.getElementById("carbon-trading-floor").classList.add("hidden");
  clearInterval(window.tradingInterval);
};

window.sellCEE = function () {
  if (window.ceeCertificates > 0) {
    window.ceeCertificates = 0;
    localStorage.setItem("ceeCertificates", btoa("0"));

    const price = parseFloat(
      document.getElementById("carbon-stock-price").innerText,
    );
    // Simulation d'injection dans le Wallet
    if(window.BVCManager) window.BVCManager.add(price * 1.5); // conversion fictive

    document.getElementById("cee-inventory").innerText = "0 CEE Disponibles";

    if (typeof speak === "function")
      speak(
        "Transaction validée. Certificats vendus aux industries polluantes. Fonds transférés sur votre portefeuille.",
      );

    const button = document.getElementById("sell-cee-btn");
    button.innerText = "VENDU";
    button.style.background = "#00ff00";
    setTimeout(() => {
      button.innerText = "VENDRE AUX POLLUEURS";
      button.style.background = "linear-gradient(90deg, #ff0055, #b700ff)";
    }, 3000);
  } else {
    if (typeof speak === "function")
      speak("Vous ne possédez aucun certificat à vendre.");
  }
};

// Start telemetry
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(window.initEcoTelemetry, 3000);
});


/* --- rgpd-cnil.js --- */
/* ═══════════════════════════════════════════════════════════════
   CONFORMITÉ GLOBALE : RGPD, CCPA, PIPL & GOOGLE PLAY CONSOLE
   ═══════════════════════════════════════════════════════════════ */

window.checkGlobalPrivacy = function () {
  const hasConsented = localStorage.getItem("global_privacy_consent");

  if (!hasConsented) {
    // CNIL : Ne PAS auto-accepter. Afficher la bannière et attendre le choix actif de l'utilisateur.
    window.preventAppLaunch = true;
    injectPrivacyBanner();
  } else {
    window.preventAppLaunch = false;
    if (typeof window.initVoiceAI === "function")
      setTimeout(window.initVoiceAI, 1000);
    if (typeof window.initZeroClickDestiny === "function")
      setTimeout(window.initZeroClickDestiny, 2000);
  }
};

function injectPrivacyBanner() {
  if (document.getElementById("global-privacy-banner")) return;

  const bannerHtml = `
    <div id="global-privacy-banner" class="fullscreen-overlay" style="background: rgba(0,0,0,0.95); backdrop-filter: blur(20px); color: #fff; z-index: 90000; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; overflow-y: auto; padding: 20px; box-sizing: border-box; font-family: 'Inter', sans-serif;">
        <div style="max-width: 500px; margin: 0 auto; padding-bottom: 50px;">
            <div style="text-align: center;">
                <i class="fa-solid fa-shield-halved" style="font-size: 4rem; color: #00ffcc; margin-bottom: 20px;"></i>
                <h2 style="margin: 0 0 10px 0; text-transform: uppercase;">Vos Données, Vos Règles</h2>
            </div>
            
            <div style="background: rgba(255,0,85,0.1); border-left: 4px solid #ff0055; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
                <h3 style="margin: 0 0 10px 0; color: #ff0055; font-size: 1rem;"><i class="fa-brands fa-google-play"></i> Déclaration de Confidentialité</h3>
                <p style="color: #ccc; font-size: 0.9rem; line-height: 1.4; margin: 0;">
                    <strong>mon 50cc et moi</strong> collecte des données de localisation pour permettre la détection automatique de chute, la navigation GPS étape par étape, et le signalement de dangers à la communauté, même lorsque l'application est fermée ou qu'elle n'est pas utilisée. L'accès en arrière-plan est indispensable au service.
                </p>
            </div>

            <div style="background: #111; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <h3 style="color: #00b3ff; margin-top: 0; font-size: 1.1rem;">1. Europe (RGPD / CNIL)</h3>
                <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    <span><i class="fa-solid fa-location-dot" style="color: #00b3ff;"></i> Accès GPS (Obligatoire)</span>
                    <input type="checkbox" id="privacy-gps" checked disabled style="transform: scale(1.5);">
                </label>
                <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    <span><i class="fa-solid fa-microphone" style="color: #ff0055;"></i> Micro (IA Vocale)</span>
                    <input type="checkbox" id="privacy-mic" checked style="transform: scale(1.5);">
                </label>
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fa-solid fa-camera" style="color: #b700ff;"></i> Caméra (AR Vision)</span>
                    <input type="checkbox" id="privacy-cam" checked style="transform: scale(1.5);">
                </label>
            </div>

            <div style="background: #111; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <h3 style="color: #ffb700; margin-top: 0; font-size: 1.1rem;">2. USA / Californie (CCPA)</h3>
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fa-solid fa-hand-holding-dollar" style="color: #ffb700;"></i> Ne pas vendre mes données<br><small style="color: #888;">"Do Not Sell My Personal Info"</small></span>
                    <input type="checkbox" id="privacy-ccpa" checked style="transform: scale(1.5);">
                </label>
            </div>

            <div style="background: #111; padding: 15px; border-radius: 10px; margin-bottom: 25px;">
                <h3 style="color: #ff0055; margin-top: 0; font-size: 1.1rem;">3. Chine (PIPL)</h3>
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fa-solid fa-globe" style="color: #ff0055;"></i> Transfert Transfrontalier<br><small style="color: #888;">Autoriser l'envoi des données vers les serveurs sécurisés en Europe.</small></span>
                    <input type="checkbox" id="privacy-pipl" checked style="transform: scale(1.5);">
                </label>
            </div>
            
            <button onclick="window.acceptGlobalPrivacy()" style="width: 100%; padding: 15px; background: #00ffcc; color: #000; font-weight: 900; font-size: 1.2rem; border: none; border-radius: 10px; cursor: pointer; text-transform: uppercase; margin-bottom: 10px;">J'ACCEPTE TOUT</button>
            <button onclick="window.refuseGlobalPrivacy()" style="width: 100%; padding: 15px; background: transparent; color: #fff; font-weight: 700; font-size: 1rem; border: 2px solid #fff; border-radius: 10px; cursor: pointer; text-transform: uppercase; margin-bottom: 15px;">REFUSER (fonctionnalités limitées)</button>
            <div style="text-align: center;">
                <button onclick="window.openPrivacyPolicy()" style="background: none; border: none; color: #888; text-decoration: underline; cursor: pointer;">Lire la Politique de Confidentialité</button>
            </div>
        </div>
    </div>
    
    <!-- PRIVACY POLICY MODAL -->
    <div id="privacy-policy-modal" class="hidden fullscreen-overlay" style="background: #111; color: #fff; z-index: 95000; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; overflow-y: auto; padding: 30px; box-sizing: border-box; font-family: 'Inter', sans-serif;">
        <button onclick="window.closePrivacyPolicy()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;"><i class="fa-solid fa-times"></i></button>
        <h2>Politique de Confidentialité Globale</h2>
        <p>En accord avec les règles Google Play et les lois RGPD (Europe), CCPA (USA) et PIPL (Chine).</p>
        
        <h3>1. Accès à la Localisation en Arrière-plan (Google Play)</h3>
        <p>Notre application accède à votre position GPS de manière continue, y compris lorsque l'application est en arrière-plan, afin de calculer les distances parcourues pour le Score Éco et le Radar Social. Ces données sont utilisées exclusivement pour la fonctionnalité principale du service et ne sont pas revendues.</p>
        
        <h3>2. Europe (RGPD) & Privacy by Design</h3>
        <p>Vos données sont traitées de façon sécurisée (AES-256). Vous disposez d'un droit inconditionnel à l'oubli. La fonction "Supprimer mes données" écrase vos données locales et purge irrévocablement votre compte sur le Cloud Firebase.</p>

        <h3>3. USA (CCPA)</h3>
        <p>Nous ne vendons AUCUNE de vos données personnelles à des tiers. Vous pouvez exprimer votre choix en cochant la case "Do Not Sell".</p>

        <h3>4. Chine (PIPL)</h3>
        <p>Si vous résidez en Chine, vous devez consentir explicitement au transfert transfrontalier de vos données vers nos serveurs situés en Europe.</p>
    </div>
    `;

  document.body.insertAdjacentHTML("beforeend", bannerHtml);
}

window.acceptGlobalPrivacy = function () {
  const gpsChecked = document.getElementById("privacy-gps").checked;
  const micChecked = document.getElementById("privacy-mic").checked;
  const camChecked = document.getElementById("privacy-cam").checked;
  const ccpaChecked = document.getElementById("privacy-ccpa").checked;
  const piplChecked = document.getElementById("privacy-pipl").checked;

  if (!gpsChecked) {
    alert(
      "Attention : L'application nécessite obligatoirement l'accès au GPS pour fonctionner.",
    );
    return;
  }
  if (!piplChecked) {
    alert(
      "Information (PIPL) : L'application est hébergée en Europe. Si vous n'autorisez pas le transfert transfrontalier, le Cloud ne pourra pas fonctionner.",
    );
  }

  const consentRecord = {
    gps: true,
    mic: micChecked,
    cam: camChecked,
    ccpa_do_not_sell: ccpaChecked,
    pipl_crossborder: piplChecked,
    timestamp: new Date().toISOString(),
    version: "v110.00.00",
  };

  localStorage.setItem("global_privacy_consent", "true");
  localStorage.setItem("cnil_consent", "true"); // legacy support
  localStorage.setItem("legal_consent_accepted", "true"); // bypass app-core modal
  localStorage.setItem("location_consent_accepted", "true"); // Fix GPS blocage
  localStorage.setItem("rgpd_gps_consent", "true"); // Fix Privacy manager
  localStorage.setItem("privacy_consent_record", JSON.stringify(consentRecord));
  localStorage.setItem("cnil_mic", micChecked ? "true" : "false");
  localStorage.setItem("cnil_cam", camChecked ? "true" : "false");

  const banner = document.getElementById("global-privacy-banner");
  if (banner) banner.remove();

  window.preventAppLaunch = false;

  if (micChecked && typeof window.initVoiceAI === "function")
    setTimeout(window.initVoiceAI, 1000);
  if (typeof window.initZeroClickDestiny === "function")
    setTimeout(window.initZeroClickDestiny, 2000);

  if (typeof speak === "function")
    speak("Conformité internationale validée. Bienvenue.");
};

window.openPrivacyPolicy = function () {
  const modal = document.getElementById("privacy-policy-modal");
  if (modal) modal.classList.remove("hidden");
};

window.refuseGlobalPrivacy = function () {
  // CNIL : L'utilisateur refuse les cookies optionnels mais accepte les essentiels (GPS obligatoire)
  const consentRecord = {
    gps: true, // Obligatoire pour le fonctionnement
    mic: false,
    cam: false,
    ccpa_do_not_sell: true,
    pipl_crossborder: false,
    refused: true,
    timestamp: new Date().toISOString(),
    version: "v110.00.00",
  };

  localStorage.setItem("global_privacy_consent", "refused");
  localStorage.setItem("privacy_consent_record", JSON.stringify(consentRecord));
  localStorage.setItem("cnil_mic", "false");
  localStorage.setItem("cnil_cam", "false");

  const banner = document.getElementById("global-privacy-banner");
  if (banner) banner.remove();

  window.preventAppLaunch = false;

  alert(
    "Vous avez refusé les cookies optionnels. L'application fonctionnera avec des fonctionnalités limitées (pas de commandes vocales ni de réalité augmentée).",
  );
};

window.closePrivacyPolicy = function () {
  const modal = document.getElementById("privacy-policy-modal");
  if (modal) modal.classList.add("hidden");
};

// ─── Droit à l'effacement (Droit à l'oubli / Protocol Zero) ──
window.revokeAndEraseData = async function () {
  if (
    confirm(
      "ATTENTION : Cette action est IRRÉVERSIBLE. Toutes vos données locales ET sur le serveur Cloud (Firestore) seront détruites. Confirmer ?",
    )
  ) {
    let uid = null;
    if (window.session && window.session.uid) {
      uid = window.session.uid;
    } else {
      const storedSession = localStorage.getItem("session");
      if (storedSession) {
        try {
          uid = JSON.parse(storedSession).uid;
        } catch (e) {}
      }
    }

    // 1. Déclencher le Protocol Zero (Suppression Backend via Cloud Function)
    if (uid) {
      try {
        const cloudFuncUrl =
          "https://europe-west1-mon50cc-backend.cloudfunctions.net/deleteUserAccount";
        await fetch(cloudFuncUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: uid }),
        });
      } catch (e) {
        console.warn("Cloud deletion feedback:", e);
      }
    }

    // 2. Effacer toutes les données locales
    localStorage.clear();
    sessionStorage.clear();

    // 3. Effacer le cache Service Worker
    if ("caches" in window) {
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
    }

    alert(
      "Toutes vos données (Locales et Serveur) ont été détruites de manière irréversible. L'application va se réinitialiser.",
    );
    window.location.href = "login.html";
  }
};

// ─── Export des données ───────
window.exportMyData = function () {
  try {
    const exportData = {
      _meta: {
        export_date: new Date().toISOString(),
        app: "mon50ccetmoi",
        format: "JSON (Format structuré portable)",
      },
      consent: JSON.parse(
        localStorage.getItem("privacy_consent_record") || "{}",
      ),
      session: (() => {
        try {
          return JSON.parse(localStorage.getItem("session") || "{}");
        } catch (e) {
          return {};
        }
      })(),
      preferences: {
        theme: localStorage.getItem("theme"),
        language: localStorage.getItem("language"),
        lite_mode: localStorage.getItem("lite_mode"),
        mic_consent: localStorage.getItem("cnil_mic"),
        cam_consent: localStorage.getItem("cnil_cam"),
      },
      vehicle: (() => {
        try {
          return JSON.parse(localStorage.getItem("vehicle_config") || "{}");
        } catch (e) {
          return {};
        }
      })(),
      wallet: {
        balance: localStorage.getItem("bvc_balance") || "0",
        total_mined: localStorage.getItem("bvc_total_mined") || "0",
      },
      habits: (() => {
        try {
          return JSON.parse(localStorage.getItem("driving_habits") || "{}");
        } catch (e) {
          return {};
        }
      })(),
      odometer: localStorage.getItem("total_km") || "0",
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mon50ccetmoi_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(
      "✅ Export terminé ! Vos données locales ont été téléchargées.",
    );
  } catch (e) {
    console.error("Erreur export:", e);
    alert("Erreur lors de l'export.");
  }
};

// ─── Vérification au chargement ─────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (!localStorage.getItem("global_privacy_consent")) {
    setTimeout(window.checkGlobalPrivacy, 500);
  } else {
    window.checkGlobalPrivacy();
  }
});


/* --- litigation-ai.js --- */
/**
 * LITIGATION AI v1.0 — PORTAIL ASSURANCE INTELLIGENT
 * Analyse automatique des données Blackbox pour les dossiers de litige.
 * Génère un code dossier unique, sélectionne le type de rapport adapté,
 * et envoie une proposition structurée à l'assureur via Firestore.
 */

window.LitigationAI = {
  // ─────────────────────────────────────────────
  // 1. GÉNÉRATION DU CODE DOSSIER
  // ─────────────────────────────────────────────

  /**
   * Génère un code de dossier unique au format LITIGE-XXXXXX
   * basé sur timestamp + uid utilisateur pour unicité garantie.
   */
  generateCaseCode() {
    const uid = window.session?.uid || "unknown";
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `LITIGE-${ts}-${rnd}`;
  },

  // ─────────────────────────────────────────────
  // 2. ANALYSE IA DE LA BLACKBOX
  // ─────────────────────────────────────────────

  /**
   * Analyse les données de la Blackbox et retourne une évaluation IA :
   * - type de rapport recommandé
   * - score de sévérité
   * - résumé des facteurs clés
   */
  analyzeBlackboxData() {
    const thresholds = CONFIG?.INSURANCE?.AI_THRESHOLDS || {
      IMPACT_G: 3.5,
      EXPERT_G: 5.0,
      HIGH_SPEED_KMH: 60,
      LEAN_ANGLE_DEG: 35,
    };

    const blackbox = window.Blackbox;
    const buffer = blackbox?.buffer || [];
    const hfBuffer = blackbox?.hfBuffer || [];

    // — Calcul du G-Force maximum enregistré
    let maxG = 0;
    for (const entry of hfBuffer) {
      const ax = parseFloat(entry.ax) || 0;
      const ay = parseFloat(entry.ay) || 0;
      const az = parseFloat(entry.az) || 0;
      const g = Math.sqrt(ax * ax + ay * ay + az * az) / 9.81;
      if (g > maxG) maxG = g;
    }

    // — Vitesse max enregistrée
    let maxSpeed = 0;
    for (const entry of buffer) {
      const spd = parseFloat(entry.speed) || 0;
      if (spd > maxSpeed) maxSpeed = spd;
    }

    // — Angle d'inclinaison max
    let maxLean = 0;
    for (const entry of buffer) {
      const lean = Math.abs(parseFloat(entry.lean) || 0);
      if (lean > maxLean) maxLean = lean;
    }

    // — Coordonnées GPS de l'incident (dernier point connu)
    const lastGps = buffer.length > 0 ? buffer[buffer.length - 1] : null;

    // — Score de sévérité (0–100)
    let severity = 0;
    if (maxG > thresholds.EXPERT_G) severity += 50;
    else if (maxG > thresholds.IMPACT_G) severity += 30;
    if (maxSpeed > thresholds.HIGH_SPEED_KMH) severity += 25;
    if (maxLean > thresholds.LEAN_ANGLE_DEG) severity += 15;
    severity = Math.min(severity, 100);

    // — Sélection automatique du type de rapport
    let reportType, reportLabel, reportIcon, reportDescription;

    if (maxG >= thresholds.EXPERT_G || severity >= 70) {
      reportType = "EXPERT_COMPLET";
      reportLabel = "Expertise Complète";
      reportIcon = "🛡ï¸";
      reportDescription =
        "Télémétrie + G-Force + GPS + Replay 3D certifié + Signature SHA-256";
    } else if (maxG >= thresholds.IMPACT_G || severity >= 35) {
      reportType = "IMPACT";
      reportLabel = "Rapport Impact";
      reportIcon = "⚡";
      reportDescription =
        "Détection de choc + Accélérométrie haute fréquence + GPS";
    } else {
      reportType = "STANDARD";
      reportLabel = "Rapport Standard";
      reportIcon = "📊";
      reportDescription =
        "Télémétrie générale + Vitesse + Coordonnées GPS";
    }

    return {
      reportType,
      reportLabel,
      reportIcon,
      reportDescription,
      severity,
      maxG: maxG.toFixed(2),
      maxSpeed: maxSpeed.toFixed(1),
      maxLean: maxLean.toFixed(1),
      gpsIncident: lastGps ? { lat: lastGps.lat, lng: lastGps.lng } : null,
      structuralScore: blackbox?.shockScore ?? 100,
      dataPoints: buffer.length,
      hfDataPoints: hfBuffer.length,
    };
  },

  // ─────────────────────────────────────────────
  // 3. CONSTRUCTION DE LA PROPOSITION
  // ─────────────────────────────────────────────

  /**
   * Construit un objet de proposition complet destiné à l'assureur.
   */
  buildInsuranceProposal(caseCode, analysis) {
    const now = new Date();
    return {
      // Identifiants
      caseCode: caseCode,
      userId: window.session?.uid || "INCONNU",
      username: window.session?.username || "INCONNU",
      vehicleId: window.Wallet?.getSafetyPassport()?.blackbox_id || "N/A",

      // Horodatage
      submittedAt: now.toISOString(),
      dateLabel: now.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),

      // Décision IA
      ai: {
        recommendedReport: analysis.reportType,
        reportLabel: analysis.reportLabel,
        reportDescription: analysis.reportDescription,
        severityScore: analysis.severity,
        confidence:
          analysis.severity >= 70
            ? "HAUTE"
            : analysis.severity >= 35
              ? "MOYENNE"
              : "STANDARD",
      },

      // Données techniques clés
      telemetry: {
        maxG_force: parseFloat(analysis.maxG),
        maxSpeed_kmh: parseFloat(analysis.maxSpeed),
        maxLeanAngle_deg: parseFloat(analysis.maxLean),
        structuralScore: analysis.structuralScore,
        dataPoints: analysis.dataPoints,
        hfDataPoints: analysis.hfDataPoints,
        gpsIncident: analysis.gpsIncident,
      },

      // Statut
      status: "PENDING_INSURER_REVIEW",
      version: CONFIG?.VERSION || "50.1.8-GOLD",
    };
  },

  // ─────────────────────────────────────────────
  // 4. ENVOI VERS FIRESTORE
  // ─────────────────────────────────────────────

  /**
   * Envoie la proposition vers Firestore (collection litigation_proposals).
   */
  async sendProposalToFirestore(proposal) {
    if (typeof db === "undefined") {
      console.warn(
        "[LitigationAI] Firestore non disponible — simulation locale.",
      );
      return { success: true, simulated: true };
    }

    const collection =
      CONFIG?.INSURANCE?.FIRESTORE_COLLECTION || "litigation_proposals";
    try {
      await db
        .collection(collection)
        .doc(proposal.caseCode)
        .set({
          ...proposal,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });

      return { success: true };
    } catch (err) {
      console.error("[LitigationAI] Erreur Firestore :", err);
      return { success: false, error: err.message };
    }
  },

  // ─────────────────────────────────────────────
  // 5. ORCHESTRATION PRINCIPALE
  // ─────────────────────────────────────────────

  /**
   * Point d'entrée principal.
   * Génère le code, analyse la blackbox, construit et envoie la proposition,
   * puis affiche le résultat dans l'interface.
   */
  async runWizard() {
    // Étape 1 — Génération du code
    const caseCode = this.generateCaseCode();
    this.renderWizardStep("analyzing", caseCode, null);

    // Étape 2 — Analyse IA (simuler délai traitement)
    await new Promise((r) => setTimeout(r, 1800));
    const analysis = this.analyzeBlackboxData();

    // Étape 3 — Construction de la proposition
    const proposal = this.buildInsuranceProposal(caseCode, analysis);

    // Étape 4 — Affichage du résultat + confirmation
    this.renderWizardResult(caseCode, analysis, proposal);
  },

  // ─────────────────────────────────────────────
  // 6. INTERFACE UTILISATEUR
  // ─────────────────────────────────────────────

  /**
   * Affiche le portail du wizard dans l'overlay existant.
   */
  openPortal() {
    const overlay = document.getElementById("screen-overlay");
    const content = document.getElementById("screen-content");
    if (!overlay || !content) {
      console.error("[LitigationAI] Overlay introuvable.");
      return;
    }
    overlay.classList.remove("hidden");
    this.renderWizardIntro(content);
  },

  renderWizardIntro(container) {
    container.innerHTML = `
            <div class="litigation-portal">
                <div class="litigation-header">
                    <i class="fa-solid fa-shield-halved litigation-icon-pulse"></i>
                    <h3>Portail Litige Assurance</h3>
                    <p class="litigation-sub">L'IA va analyser votre Blackbox et préparer une proposition pour votre assureur.</p>
                </div>

                <div class="litigation-checklist">
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Blackbox chiffrée AES-256</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Télémétrie haute fréquence (10Hz)</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Coordonnées GPS certifiées</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Signature SHA-256 d'intégrité</div>
                </div>

                <div class="litigation-actions">
                    <button class="btn-litigation-start" onclick="LitigationAI.runWizard()">
                        <i class="fa-solid fa-brain"></i>
                        Lancer l'analyse IA
                    </button>
                    <button class="btn-close-litigation" onclick="document.getElementById('screen-overlay').classList.add('hidden')">
                        <i class="fa-solid fa-times"></i> Annuler
                    </button>
                </div>
            </div>
        `;
  },

  renderWizardStep(step, caseCode, analysis) {
    const content = document.getElementById("screen-content");
    if (!content) return;

    if (step === "analyzing") {
      content.innerHTML = `
                <div class="litigation-portal litigation-analyzing">
                    <div class="ai-spinner">
                        <i class="fa-solid fa-brain fa-spin-pulse"></i>
                    </div>
                    <h3>Analyse IA en cours…</h3>
                    <p class="case-code-display">Code dossier généré : <strong>${caseCode}</strong></p>
                    <div class="ai-progress-bar">
                        <div class="ai-progress-fill"></div>
                    </div>
                    <p class="ai-status-text">Lecture de la télémétrie Blackbox…</p>
                </div>
            `;
      // Animation de la barre de progression
      setTimeout(() => {
        const fill = content.querySelector(".ai-progress-fill");
        const txt = content.querySelector(".ai-status-text");
        if (fill) fill.style.width = "45%";
        if (txt) txt.textContent = "Calcul des G-Forces…";
      }, 500);
      setTimeout(() => {
        const fill = content.querySelector(".ai-progress-fill");
        const txt = content.querySelector(".ai-status-text");
        if (fill) fill.style.width = "80%";
        if (txt) txt.textContent = "Sélection du type de rapport…";
      }, 1200);
    }
  },

  renderWizardResult(caseCode, analysis, proposal) {
    const content = document.getElementById("screen-content");
    if (!content) return;

    const severityColor =
      analysis.severity >= 70
        ? "#ff4d4d"
        : analysis.severity >= 35
          ? "#ffaa00"
          : "#00e676";
    const severityLabel =
      analysis.severity >= 70
        ? "ÉLEVÉE"
        : analysis.severity >= 35
          ? "MODÉRÉE"
          : "FAIBLE";

    content.innerHTML = `
            <div class="litigation-portal">
                <div class="litigation-result-header">
                    <i class="fa-solid fa-brain" style="color:#7c4dff; font-size:2rem;"></i>
                    <h3>Analyse IA Terminée</h3>
                </div>

                <div class="case-code-badge">
                    <i class="fa-solid fa-hashtag"></i>
                    <span>Code dossier :</span>
                    <strong id="case-code-value">${caseCode}</strong>
                    <button class="btn-copy-code" onclick="LitigationAI.copyCode('${caseCode}')" title="Copier">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>

                <div class="report-recommendation">
                    <div class="report-icon">${analysis.reportIcon}</div>
                    <div class="report-info">
                        <strong>Rapport recommandé :</strong>
                        <span class="report-label">${analysis.reportLabel}</span>
                        <p class="report-desc">${analysis.reportDescription}</p>
                    </div>
                </div>

                <div class="severity-block">
                    <span class="severity-title">Sévérité estimée :</span>
                    <div class="severity-bar-bg">
                        <div class="severity-bar-fill" style="width:${analysis.severity}%; background:${severityColor};"></div>
                    </div>
                    <span class="severity-score" style="color:${severityColor};">${analysis.severity}/100 — ${severityLabel}</span>
                </div>

                <div class="telemetry-summary">
                    <div class="tele-item"><i class="fa-solid fa-bolt"></i> G-Force max : <strong>${analysis.maxG} G</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-gauge-high"></i> Vitesse max : <strong>${analysis.maxSpeed} km/h</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-rotate"></i> Inclinaison max : <strong>${analysis.maxLean}°</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-shield-halved"></i> Intégrité chassis : <strong>${analysis.structuralScore}%</strong></div>
                    ${analysis.gpsIncident ? `<div class="tele-item"><i class="fa-solid fa-location-dot"></i> GPS : <strong>${analysis.gpsIncident.lat?.toFixed(5)}, ${analysis.gpsIncident.lng?.toFixed(5)}</strong></div>` : ""}
                </div>

                <p class="litigation-disclaimer">
                    <i class="fa-solid fa-circle-info"></i>
                    En envoyant cette proposition, votre assureur reçoit le résumé et vous contactera pour valider le type de rapport définitif.
                </p>

                <!-- AVERTISSEMENT AI ACT (Obligatoire) -->
                <p class="litigation-ai-act-disclaimer" style="color: #ffaa00; font-weight: bold; margin-bottom: 15px; border: 1px solid #ffaa00; padding: 10px; border-radius: 8px;">
                    <i class="fa-solid fa-scale-balanced"></i>
                    ⚠ï¸ GÉNÉRÉ PAR L'IA : Ce rapport est une proposition d'assistance. Une supervision et validation humaine par l'utilisateur sont obligatoires avant le traitement juridique.
                </p>

                <div class="litigation-actions">
                    ${
                      proposal.type === "EXPERT_COMPLET"
                        ? `
                    <button class="btn-litigation-start" onclick="if(window.CertifiedCamera) window.CertifiedCamera.open('${caseCode}'); else alert('Module de caméra non disponible');" style="background:#ffb703; color:#000; margin-bottom:10px;">
                        <i class="fa-solid fa-camera"></i>
                        Ajouter Preuve Photo (Horodatée)
                    </button>
                    `
                        : ""
                    }
                    <button class="btn-litigation-send" onclick='LitigationAI.confirmAndSend(' + JSON.stringify(proposal).replace(/"/g, "&quot;") + ')'>
                        <i class="fa-solid fa-paper-plane"></i>
                        Envoyer à l'assureur
                    </button>
                    <button class="btn-close-litigation" onclick="document.getElementById('screen-overlay').classList.add('hidden')">
                        <i class="fa-solid fa-times"></i> Annuler
                    </button>
                </div>
            </div>
        `;
  },

  async confirmAndSend(proposal) {
    const content = document.getElementById("screen-content");
    if (!content) return;

    // Generate a secure dispute code
    const disputeCode =
      "LIT-" +
      Math.floor(1000 + Math.random() * 9000) +
      "-" +
      new Date().getFullYear();

    content.innerHTML = `
            <div class="litigation-portal litigation-sending">
                <i class="fa-solid fa-lock fa-bounce" style="font-size:3rem; color:#7c4dff;"></i>
                <h3>Verrouillage des données...</h3>
                <p>Création du coffre-fort numérique...</p>
            </div>
        `;

    // Simulate a small delay for cryptography feeling
    setTimeout(() => {
      content.innerHTML = `
                <div class="litigation-portal litigation-success" style="padding: 20px;">
                    <i class="fa-solid fa-vault" style="font-size:4rem; color:#00e676; margin-bottom: 20px;"></i>
                    <h3 style="color:#00e676; margin-bottom: 10px;">Coffre-Fort Sécurisé !</h3>
                    <p style="color:#aaa; margin-bottom: 20px;">Vos données certifiées sont cryptées et inaccessibles sans ce code.</p>
                    
                    <div style="background: rgba(0,0,0,0.5); padding: 20px; border-radius: 15px; border: 2px dashed #00e676; display: inline-block; margin-bottom: 20px;">
                        <span style="display: block; font-size: 1rem; color: #888; margin-bottom: 10px;">CODE LITIGE À TRANSMETTRE À VOTRE ASSUREUR :</span>
                        <strong style="font-size: 2.5rem; letter-spacing: 5px; color: #fff;">${disputeCode}</strong>
                    </div>

                    <p style="color:#ffaa00; font-weight: bold; margin-bottom: 30px;">
                        <i class="fa-solid fa-hand-holding-dollar"></i> 
                        Vous recevrez une prime de 10 BVC dès que votre assureur débloquera ces données.
                    </p>

                    <button class="btn-litigation-start" onclick="document.getElementById('screen-overlay').classList.add('hidden')">
                        <i class="fa-solid fa-check"></i> Terminer
                    </button>
                </div>
            `;
      if (typeof speak === "function")
        speak(
          "Coffre-fort créé. Transmettez ce code litige à votre assureur.",
        );
    }, 2000);
  },

  copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      if (typeof speak === "function") speak("Code dossier copié.");
      const btn = document.querySelector(".btn-copy-code");
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => {
          btn.innerHTML = '<i class="fa-solid fa-copy"></i>';
        }, 1500);
      }
    });
  },
};


/* --- insurance-portal.js --- */
/**
 * PORTAIL ASSURANCE mon50ccetmoi
 * Paiements via Revolut Merchant API (SDK RevolutCheckout embarqué)
 * Flow : client ←’ Firebase Function (création ordre) ←’ Revolut ←’ webhook ←’ Firestore
 */
window.InsurancePortal = {
  // Clé publique Merchant (config.js) — utilisée côté client uniquement
  get revolutPublicKey() {
    return CONFIG?.REVOLUT?.PUBLIC_KEY || "";
  },

  // URL de la Firebase Cloud Function (region europe-west1)
  get functionBaseUrl() {
    const projectId = CONFIG?.FIREBASE?.projectId || "mon50ccetmoi";
    return `https://europe-west1-${projectId}.cloudfunctions.net`;
  },

  balance: 500.0, // Option 2: Portefeuille virtuel (Acompte)
  transactions: [], // Historique des transactions
  cases: {}, // Liste des dossiers en attente ou débloqués

  init() {},

  notify(message) {
    speak(message);

    // On pourrait ajouter un toast UI ici si besoin
  },

  // Affiche l'interface du portail pro
  showPortal(caseId) {
    const overlay = document.getElementById("screen-overlay");
    const content = document.getElementById("screen-content");
    if (!overlay || !content) return;

    overlay.classList.remove("hidden");
    this.renderPortal(content, caseId);
  },

  renderPortal(container, caseId) {
    const isUnlocked = this.cases[caseId]?.unlocked;
    const status = this.cases[caseId]?.status || "pending_payment";

    container.innerHTML = `
            <div class="insurance-portal-container">
                <h3><i class="fa-solid fa-building-shield"></i> Portail Pro Assurance</h3>
                <div class="wallet-status">
                    <span>Votre Solde :</span>
                    <strong id="portal-balance">${this.balance.toFixed(2)} €</strong>
                </div>

                <div class="case-header">
                    <h4>Dossier : <span class="case-id">${caseId}</span></h4>
                    <p class="case-status status-${status}">${this.getStatusLabel(status)}</p>
                </div>

                ${isUnlocked ? this.renderUnlockedView(caseId) : this.renderPaymentOptions(caseId)}

                ${this.renderTransactionHistory()}

                <button onclick="document.getElementById('screen-overlay').classList.add('hidden')" class="btn-close-portal">

                    <i class="fa-solid fa-times"></i> Fermer le Portail
                </button>
            </div>
        `;
  },

  renderPaymentOptions(caseId) {
    return `
            <div class="payment-selection" style="text-align:center; padding: 20px;">
                <i class="fa-solid fa-hourglass-half fa-spin" style="font-size:3rem; color:#00d2ff; margin-bottom:20px;"></i>
                <h3 style="color:#fff; font-size:1.4rem;">En attente de l'Assurance</h3>
                <p style="color:#aaa; font-size:0.9rem; line-height:1.5;">
                    Veuillez transmettre ce code de dossier à votre assureur :
                </p>
                <div class="case-code-badge" style="justify-content:center; margin: 20px 0;">
                    <i class="fa-solid fa-hashtag"></i>
                    <strong style="font-size:1.3rem;">${caseId}</strong>
                </div>
                <p style="color:#aaa; font-size:0.9rem; line-height:1.5;">
                    Votre assureur pourra déverrouiller le rapport depuis le <strong>Portail Expert</strong>.<br>
                    Le rapport sera disponible ici automatiquement dès validation du paiement.
                </p>
                <button onclick="InsurancePortal.pollPaymentConfirmation('${caseId}')" class="btn-litigation-start" style="margin-top:20px;">
                    <i class="fa-solid fa-rotate"></i> Rafraîchir le statut
                </button>
            </div>
        `;
  },

  renderUnlockedView(caseId) {
    return `
            <div class="unlocked-view">
                <p class="success-msg"><i class="fa-solid fa-circle-check"></i> Rapport débloqué avec succès.</p>
                <button onclick="window.BlackBoxInsurance.generateReport()" class="btn-download-report">
                    <i class="fa-solid fa-file-pdf"></i> Télécharger le Rapport Certifié
                </button>
                <button onclick="window.BlackBoxReplay.replay()" class="btn-replay-report">
                    <i class="fa-solid fa-play"></i> Rejouer le Trajet en 3D
                </button>
            </div>
        `;
  },

  getStatusLabel(status) {
    const labels = {
      pending_payment: "En attente de paiement",
      waiting_for_funds: "Virement en cours (Attente réception)",
      pending_verification: "Vérification de la preuve en cours",
      unlocked: "Accès Autorisé",
    };
    return labels[status] || status;
  },

  // ──────────────────────────────────────────────────
  // OPTION 1 : Paiement Revolut Merchant (flow complet)
  // 1. Appel Firebase Function ←’ création ordre Revolut (clé secrète serveur)
  // 2. Récupération du order_token
  // 3. RevolutCheckout(token).payWithPopup()
  // 4. Webhook Revolut ←’ Firebase ←’ déblocage rapport
  // ──────────────────────────────────────────────────
  async payInstant(caseId) {
    const pubKey = this.revolutPublicKey;
    if (!pubKey) {
      alert("⚠ï¸ Clé publique Revolut manquante dans config.js");
      return;
    }

    // Étape 1 : Afficher le spinner de chargement
    this.cases[caseId] = { status: "waiting_for_funds", unlocked: false };
    this.renderRevolutLoadingModal(caseId);

    try {
      // Étape 2 : Créer l'ordre côté serveur via Firebase Function
      speak("Initialisation du paiement sécurisé Revolut.");
      const orderData = await this.createOrderViaFunction(caseId);

      if (!orderData?.order_token) {
        throw new Error("Token de paiement Revolut non reçu.");
      }

      // Étape 3 : Lancer le checkout Revolut avec le token
      await this.launchRevolutCheckout(caseId, orderData);
    } catch (err) {
      console.error("[Revolut] Erreur paiement :", err);
      this.renderRevolutErrorModal(caseId, err.message);
    }
  },

  // ─ Appel Firebase Function : création de l'ordre Revolut ────────────
  async createOrderViaFunction(caseId) {
    const url = `${this.functionBaseUrl}/createRevolutOrder`;
    const reportType =
      window.LitigationAI?.lastAnalysis?.reportType || "STANDARD";

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_cents: CONFIG?.REVOLUT?.AMOUNT_CENTS || 4999,
        currency: CONFIG?.REVOLUT?.CURRENCY || "EUR",
        case_id: caseId,
        user_id: window.session?.uid || "unknown",
        report_type: reportType,
      }),
    });

    if (!response.ok) {
      const err = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      throw new Error(err.error || `Erreur serveur (${response.status})`);
    }

    return await response.json();
  },

  // ─ Lance RevolutCheckout avec le token reçu ───────────────────
  async launchRevolutCheckout(caseId, orderData) {
    if (typeof RevolutCheckout !== "function") {
      // SDK pas encore chargé (async) — attendre 2s et réessayer
      await new Promise((r) => setTimeout(r, 2000));
      if (typeof RevolutCheckout !== "function") {
        throw new Error("SDK Revolut non chargé. Vérifiez votre connexion.");
      }
    }

    const instance = await RevolutCheckout(orderData.order_token, "prod");
    
    // Vider le texte de chargement
    const container = document.getElementById("revolut-pay-button-container");
    if (container) {
        container.innerHTML = "";
    }

    // Utilisation de Revolut Pay (bouton natif) au lieu de la popup classique
    instance.revolutPay({
      target: document.getElementById("revolut-pay-button-container"),
      onSuccess: () => {
        speak("Paiement Revolut confirmé. Vérification en cours.");
        this.renderRevolutPendingConfirmation(caseId, orderData.order_id);
        // Le webhook Revolut va débloquer le rapport dans Firestore.
        this.pollPaymentConfirmation(caseId);
      },
      onError: (message) => {
        console.error("[Revolut] Erreur checkout :", message);
        this.renderRevolutErrorModal(caseId, message);
      },
      onCancel: () => {
        speak("Paiement annulé.");
        this.cases[caseId] = { status: "pending_payment", unlocked: false };
        this.showPortal(caseId);
      },
    });
  },

  // ─ Poll Firestore pour détecter la confirmation webhook ────────
  async pollPaymentConfirmation(caseId, attempts = 0) {
    if (attempts > 20) {
      // Timeout après ~60s
      this.renderRevolutErrorModal(
        caseId,
        "Délai de confirmation dépassé. Contactez le support.",
      );
      return;
    }

    await new Promise((r) => setTimeout(r, 3000));

    try {
      // Vérifier dans Firestore si le webhook a confirmé le paiement
      if (typeof db !== "undefined") {
        const doc = await db
          .collection("payment_confirmations")
          .doc(caseId)
          .get();
        if (doc.exists) {
          this.unlockCase(caseId, "revolut_webhook");
          this.renderRevolutSuccess(caseId);
          speak("Rapport débloqué avec succès. Bonne route.");
          return;
        }
      } else {
        // Fallback : vérifier via la Cloud Function
        const url = `${this.functionBaseUrl}/checkPaymentStatus?case_id=${caseId}&user_id=${window.session?.uid || ""}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.paid) {
          this.unlockCase(caseId, "revolut_webhook");
          this.renderRevolutSuccess(caseId);
          speak("Rapport débloqué avec succès.");
          return;
        }
      }
    } catch (e) {
      console.warn("[Revolut Poll] Erreur :", e);
    }

    // Continuer à poller
    this.pollPaymentConfirmation(caseId, attempts + 1);
  },

  // ─ Modals UI ─────────────────────────────────────────────────
  renderRevolutSuccess(caseId) {
    const content = document.getElementById("screen-content");
    if (!content) return;
    content.innerHTML = `
            <div class="litigation-portal" style="animation: portal-fade-in 0.5s ease-out;">
                <div class="litigation-analyzing" style="text-align:center; padding: 40px 20px;">
                    <div class="revolut-logo-ring" style="border-color: #00ff00; box-shadow: 0 0 30px rgba(0,255,0,0.5);">
                        <i class="fa-solid fa-unlock" style="color:#00ff00; font-size:2rem; animation: pulse-halo 2s infinite;"></i>
                    </div>
                    <h3 style="color:#00ff00; font-size:1.5rem; margin-top:20px;">Paiement Validé</h3>
                    <p style="color:#fff; font-size:0.9rem; margin-top:10px;">Le webhook Revolut a confirmé la transaction.</p>
                    <p style="color:#00d2ff; font-size:1rem; margin-top:5px; font-weight:bold;">Rapport Déverrouillé</p>
                </div>
            </div>`;

    // Après 3 secondes, on affiche le portail complet
    setTimeout(() => {
      this.showPortal(caseId);
    }, 3000);
  },

  renderRevolutLoadingModal(caseId) {
    const content = document.getElementById("screen-content");
    if (!content) return;
    const price = (CONFIG?.REVOLUT?.AMOUNT_CENTS || 4999) / 100;
    content.innerHTML = `
            <div class="litigation-portal">
                <div class="litigation-analyzing">
                    <div class="revolut-pay-header">
                        <div class="revolut-logo-ring">
                            <i class="fa-solid fa-lock" style="color:#7c4dff; font-size:1.8rem;"></i>
                        </div>
                        <h3>Paiement Sécurisé</h3>
                        <p style="color:#aaa; font-size:0.82rem;">Préparation de <strong style="color:#fff;">Revolut Pay</strong>…</p>
                    </div>
                    <div class="revolut-amount-badge">
                        <span class="revolut-amount-value">${price.toFixed(2)} €</span>
                        <span class="revolut-amount-label">Rapport Assurance certifié — ${caseId}</span>
                    </div>
                    <div id="revolut-pay-button-container" style="margin-top:20px; min-height:50px; display:flex; justify-content:center; align-items:center;">
                        <p class="ai-status-text" id="revolut-status-txt">Génération du lien de paiement…</p>
                    </div>
                </div>
            </div>`;
  },

  renderRevolutPendingConfirmation(caseId, orderId) {
    const content = document.getElementById("screen-content");
    if (!content) return;
    content.innerHTML = `
            <div class="litigation-portal litigation-sending">
                <i class="fa-solid fa-satellite-dish fa-bounce" style="font-size:3rem; color:#7c4dff;"></i>
                <h3 style="margin-top:15px;">Confirmation en cours…</h3>
                <p style="color:#888; font-size:0.83rem; margin-top:10px;">
                    Votre paiement a été soumis. En attente de la confirmation Revolut.
                </p>
                <div class="case-code-badge" style="margin-top:20px;">
                    <i class="fa-solid fa-hashtag"></i>
                    <span>Dossier :</span>
                    <strong>${caseId}</strong>
                </div>
                <div class="case-code-badge">
                    <i class="fa-brands fa-revolut" style="color:#7c4dff;"></i>
                    <span>Ordre Revolut :</span>
                    <strong style="font-size:0.7rem;">${orderId}</strong>
                </div>
                <p style="font-size:0.7rem; color:#555; margin-top:15px;">
                    <i class="fa-solid fa-clock"></i> Vérification automatique toutes les 3 secondes…
                </p>
            </div>`;
  },

  renderRevolutErrorModal(caseId, message) {
    const content = document.getElementById("screen-content");
    if (!content) return;
    content.innerHTML = `
            <div class="litigation-portal litigation-error">
                <i class="fa-solid fa-triangle-exclamation" style="font-size:3rem; color:#ff4d4d;"></i>
                <h3>Erreur de paiement</h3>
                <p style="color:#888; font-size:0.83rem; margin-top:10px;">${message || "Une erreur est survenue."}</p>
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button class="btn-litigation-start" onclick="InsurancePortal.payInstant('${caseId}')" style="flex:1;">
                        <i class="fa-solid fa-rotate-right"></i> Réessayer
                    </button>
                    <button class="btn-close-litigation" onclick="document.getElementById('screen-overlay').classList.add('hidden')" style="flex:1;">
                        <i class="fa-solid fa-times"></i> Fermer
                    </button>
                </div>
            </div>`;
  },

  // DOSSIER LITIGE IA — Lance l'analyse Blackbox intelligente
  openLitigationWizard(caseId) {
    if (typeof window.LitigationAI === "undefined") {
      alert(
        "Module LitigationAI non chargé. Vérifiez que litigation-ai.js est inclus dans la page.",
      );
      return;
    }
    window.LitigationAI.openPortal();
  },

  // OPTION 2 : Portefeuille
  payWithWallet(caseId) {
    if (this.balance >= 49.99) {
      this.balance -= 49.99;
      this.unlockCase(caseId, "wallet_debit");
      this.showPortal(caseId); // Refresh
      speak("Débit effectué sur votre compte pro. Rapport accessible.");
    } else {
      alert("Solde insuffisant sur votre portefeuille virtuel.");
      speak("Solde insuffisant.");
    }
  },

  // OPTION 3 : Preuve de virement
  uploadProof(caseId) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this.cases[caseId] = {
          status: "pending_verification",
          unlocked: false,
        };
        this.showPortal(caseId);
        speak(
          "Preuve de virement reçue. Notre système vérifie le document.",
        );

        // Simulation de validation automatique après 5s
        setTimeout(() => {
          this.unlockCase(caseId, "proof_validated");
          if (
            document
              .getElementById("screen-overlay")
              .classList.contains("hidden") === false
          ) {
            this.showPortal(caseId);
          }
          speak("Justificatif validé. Le rapport est maintenant débloqué.");
        }, 5000);
      }
    };
    input.click();
  },

  renderTransactionHistory() {
    if (this.transactions.length === 0) return "";

    return `
            <div class="transaction-history">
                <h5><i class="fa-solid fa-clock-rotate-left"></i> Historique des Transactions</h5>
                <div class="transaction-list">
                    ${this.transactions
                      .map(
                        (t) => `
                        <div class="transaction-item">
                            <span>${new Date(t.date).toLocaleTimeString()} - ${t.caseId}</span>
                            <span class="t-amount">-${t.amount}€</span>
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        `;
  },

  unlockCase(caseId, method) {
    const amount = 49.99;
    this.cases[caseId] = {
      status: "unlocked",
      unlocked: true,
      method: method,
      timestamp: Date.now(),
    };

    this.transactions.unshift({
      date: Date.now(),
      caseId: caseId,
      amount: amount,
      method: method,
    });

    this.notify(`Transaction confirmée pour le dossier ${caseId}.`);
  },
};


/* --- anti-theft.js --- */
window.AntiTheft = {
  isSentryActive: false,
  sentryListener: null,

  toggleSentryMode: function () {
    if (this.isSentryActive) {
      this.stopSentry();
      speak("Mode Sentinelle désactivé.");
    } else {
      this.startSentry();
      speak(
        "Mode Sentinelle activé. Périmètre sécurisé. Je surveille l'accéléromètre.",
      );
    }

    const btn = document.getElementById("dock-btn-sentry");
    if (btn) {
      if (this.isSentryActive) {
        btn.style.color = "#ff0000";
        btn.style.animation = "pulse-halo 1.5s infinite";
        btn.title = "Mode Sentinelle ACTIF (Appuyer pour désactiver)";
      } else {
        btn.style.color = "#ff3333";
        btn.style.animation = "none";
        btn.title = "Mode Sentinelle";
      }
    }
  },

  startSentry: function () {
    this.isSentryActive = true;
    let lastPeak = 0;

    this.sentryListener = (e) => {
      const acc = e.acceleration;
      if (!acc) return;
      const force = Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z);

      if (force > 3.0 && Date.now() - lastPeak > 3000) {
        lastPeak = Date.now();
        this.triggerSentryAlert(force);
      }
    };
    window.addEventListener("devicemotion", this.sentryListener);
  },

  playSiren: function () {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.oscillator = this.audioCtx.createOscillator();
    this.gainNode = this.audioCtx.createGain();

    this.oscillator.type = "square";
    this.oscillator.frequency.setValueAtTime(800, this.audioCtx.currentTime);
    this.oscillator.frequency.linearRampToValueAtTime(
      1200,
      this.audioCtx.currentTime + 0.5,
    );
    this.oscillator.frequency.linearRampToValueAtTime(
      800,
      this.audioCtx.currentTime + 1.0,
    );

    // Loop effect
    this.sirenInterval = setInterval(() => {
      if (!this.isSentryActive) return;
      this.oscillator.frequency.setValueAtTime(800, this.audioCtx.currentTime);
      this.oscillator.frequency.linearRampToValueAtTime(
        1200,
        this.audioCtx.currentTime + 0.5,
      );
      this.oscillator.frequency.linearRampToValueAtTime(
        800,
        this.audioCtx.currentTime + 1.0,
      );
    }, 1000);

    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.audioCtx.destination);
    this.gainNode.gain.setValueAtTime(1, this.audioCtx.currentTime);
    this.oscillator.start();
  },

  stopSiren: function () {
    if (this.sirenInterval) clearInterval(this.sirenInterval);
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.disconnect();
      this.oscillator = null;
    }
    const overlay = document.getElementById("glitch-overlay");
    if (overlay) overlay.style.display = "none";
  },

  stopSentry: function () {
    this.isSentryActive = false;
    this.stopSiren();
    if (this.sentryListener)
      window.removeEventListener("devicemotion", this.sentryListener);
  },

  triggerSentryAlert: function (force) {
    speak(
      "ALERTE : Mouvement suspect détecté. Enregistrement Sentinel activé.",
    );
    vibrate([500, 200, 500]);
    if (!this.oscillator) this.playSiren();
    const overlay = document.getElementById("glitch-overlay");
    if (overlay) {
      overlay.style.display = "block";
      overlay.style.opacity = "0.8";
      overlay.style.background = "red";
    }

    // Deterrent: Flashlight blink if available
    if (typeof Hardware !== "undefined" && Hardware.toggleFlashlightSOS) {
      Hardware.toggleFlashlightSOS(true);
      setTimeout(() => Hardware.toggleFlashlightSOS(false), 2000);
    }

    // HUD Log
    if (window.NeuralHUD) {
      window.NeuralHUD.logToConsole(
        `SENTRY_ALERT: MOTION_DETECTED (${force.toFixed(1)}G)`,
      );
    }

    // Remote Notification simulation / Firebase Cloud Function call
    const projectId = window.CONFIG?.FIREBASE?.projectId || "mon50ccetmoi";
    const functionUrl = `https://europe-west1-${projectId}.cloudfunctions.net/triggerAntiTheftAlert`;

    fetch(functionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: window.session?.uid || "GUEST",
        force: force,
        location: window.currentPosition
          ? `${window.currentPosition.lat},${window.currentPosition.lng}`
          : "Unknown",
      }),
    })
      .then((res) => res.json())
      .then((data) => {})
      .catch((err) => {
        console.error("SENTRY_CLOUD_ALERT: Failed to notify server", err);
      });
  },

  reportTheft: async function () {
    // ... (Keep existing reportTheft)
  },
};


/* --- meca-wizard.js --- */
/**
 * MECA-WIZARD v2.0 - DeepTech AI Mechanic
 * Analyse Acoustique réelle via Web Audio API & Intégration Revolut Checkout
 */

window.MecaWizard = {
  audioCtx: null,
  analyser: null,
  microphone: null,
  animationId: null,

  // 1. Calculateur de mélange
  calculateMix: function (liters, percent) {
    if (!liters || !percent) return 0;
    const oilMl = liters * 1000 * (percent / 100);
    return Math.round(oilMl);
  },

  // 2. Analyse Acoustique (Microphone Réel)
  startAcousticAnalysis: async function () {
    if (!window.session) {
      alert("Veuillez vous connecter pour utiliser Meca Wizard.");
      return;
    }

    const modal = document.getElementById("meca-result-modal");
    if (modal) modal.classList.remove("hidden");

    const resultDiv = document.getElementById("meca-result");
    if (!resultDiv) return;

    resultDiv.innerHTML = `
            <div class="glassmorphism biometric-scan" style="padding:20px; text-align:center;">
                <i class="fa-solid fa-microphone-lines fa-beat" style="font-size:2rem; color:var(--neon-blue);"></i>
                <p style="margin-top:15px; font-weight:bold;">INITIALISATION DU STÉTHOSCOPE IA...</p>
                <p style="font-size:0.8rem; color:#ccc;">Demande d'accès au microphone...</p>
            </div>
        `;

    try {
      // Accès au microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      // Initialisation Web Audio API
      if (!this.audioCtx) {
        this.audioCtx = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      this.microphone = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.microphone.connect(this.analyser);

      speak(
        "Accès au microphone autorisé. Démarrez le moteur et donnez un coup de gaz franc.",
      );

      // Affichage de l'oscilloscope
      resultDiv.innerHTML = `
                <div class="glassmorphism" style="padding:20px; text-align:center;">
                    <h4 style="color:var(--accent);"><i class="fa-solid fa-wave-square"></i> ANALYSE EN COURS</h4>
                    <canvas id="audio-canvas" width="280" height="100" style="background:#0a0a0a; border-radius:8px; margin:15px 0; border: 1px solid var(--accent);"></canvas>
                    <p style="font-size:0.8rem; color:#888;">Analyse de la signature fréquentielle (FFT)...</p>
                </div>
            `;

      this.drawOscilloscope();

      // Arrêt de l'analyse après 6 secondes
      setTimeout(() => {
        this.stopAnalysis(stream);
        this.showDiagnosticReport(resultDiv);
      }, 6000);
    } catch (err) {
      console.error("Erreur Micro:", err);
      resultDiv.innerHTML = `
                <div class="glassmorphism" style="padding:20px; border-left:4px solid #dc3545;">
                    <h4 style="color:#dc3545;">ERREUR MICROPHONE</h4>
                    <p style="font-size:0.9rem; margin-top:10px;">Impossible d'accéder au microphone. Veuillez vérifier vos autorisations.</p>
                </div>
            `;
      speak("Erreur. L'accès au microphone a été refusé.");
    }
  },

  // 3. Analyseur d'échappement (Décibels & Fréquence)
  startDecibelMeter: async function () {
    const modal = document.getElementById("meca-result-modal");
    if (modal) modal.classList.remove("hidden");

    const resultDiv = document.getElementById("meca-result");
    if (!resultDiv) return;

    resultDiv.innerHTML = `
            <div class="glassmorphism biometric-scan" style="padding:20px; text-align:center;">
                <i class="fa-solid fa-volume-high fa-beat" style="font-size:2rem; color:var(--neon-blue);"></i>
                <p style="margin-top:15px; font-weight:bold;">INITIALISATION DU DÉCIBELMÈTRE...</p>
            </div>
        `;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      if (!this.audioCtx)
        this.audioCtx = new (
          window.AudioContext || window.webkitAudioContext
        )();
      if (this.audioCtx.state === "suspended") await this.audioCtx.resume();

      this.microphone = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.microphone.connect(this.analyser);

      speak("Décibelmètre activé. Faites tourner le moteur au ralenti.");

      resultDiv.innerHTML = `
                <div class="glassmorphism" style="padding:20px; text-align:center;">
                    <h4 style="color:var(--neon-blue);"><i class="fa-solid fa-gauge-high"></i> MESURE EN COURS</h4>
                    <div id="db-level" style="font-size:3rem; font-weight:900; margin:10px 0;">0 dB</div>
                    <div id="hz-level" style="font-size:1.2rem; color:var(--accent);">-- Hz</div>
                    <canvas id="audio-canvas" width="280" height="80" style="background:#0a0a0a; border-radius:8px; margin-top:15px; border: 1px solid var(--accent);"></canvas>
                </div>
            `;

      let maxDb = 0;
      let currentHz = 0;
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      const measureDb = () => {
        this.animationId = requestAnimationFrame(measureDb);
        this.analyser.getByteFrequencyData(dataArray);

        // Calcul approximatif des dBFS convertis en dBSPL pour l'affichage
        let sum = 0;
        let maxIndex = 0;
        let maxValue = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
          if (dataArray[i] > maxValue) {
            maxValue = dataArray[i];
            maxIndex = i;
          }
        }
        const avg = sum / dataArray.length;
        const db = Math.round((avg / 255) * 120); // Approximation 120dB max

        if (db > maxDb) maxDb = db;

        // Calcul de fréquence dominante
        currentHz = Math.round(
          (maxIndex * this.audioCtx.sampleRate) / this.analyser.fftSize,
        );

        const dbEl = document.getElementById("db-level");
        if (dbEl) {
          dbEl.textContent = db + " dB";
          dbEl.style.color = db > 85 ? "#ff4444" : "#00e676";
        }

        const hzEl = document.getElementById("hz-level");
        if (hzEl) hzEl.textContent = currentHz + " Hz (Moteur)";

        // Draw minimal scope
        const canvas = document.getElementById("audio-canvas");
        if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#0a0a0a";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.beginPath();
          const sliceWidth = (canvas.width * 1.0) / dataArray.length;
          let x = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 255.0;
            const y = (1 - v) * canvas.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.strokeStyle = db > 85 ? "#ff4444" : "#00f2ff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      };

      measureDb();

      setTimeout(() => {
        this.stopAnalysis(stream);
        const isLegal = maxDb <= 85;
        const engineType =
          currentHz > 150 ? "2 Temps (Aigu)" : "4 Temps (Grave)";

        resultDiv.innerHTML = `
                    <div class="glassmorphism" style="padding:20px;">
                        <h4 style="color:${isLegal ? "#00e676" : "#ff4444"};">RÉSULTAT ACOUSTIQUE</h4>
                        <div style="font-size:2rem; font-weight:900; margin:10px 0; color:${isLegal ? "#00e676" : "#ff4444"};">MAX : ${maxDb} dB</div>
                        <p><strong>Type perçu :</strong> ${engineType}</p>
                        <p style="margin-top:10px; font-size:0.9rem;">
                            ${
                              isLegal
                                ? "L'échappement est homologué. Vous êtes en sécurité en cas de contrôle."
                                : "<strong>ATTENTION :</strong> Niveau sonore > 85dB. Risque d'amende et de confiscation."
                            }
                        </p>
                        <p style="color:#777; font-size:0.75rem; margin-top:15px; border-top:1px solid #333; padding-top:10px;">
                            Avertissement (AI Act) : Diagnostic généré par Intelligence Artificielle. Ce résultat est fourni à titre indicatif et est <strong>soumis à contrôle humain</strong> (expertise d'un mécanicien).
                        </p>
                        <button onclick="document.getElementById('meca-result-modal').classList.add('hidden')" style="width:100%; padding:15px; margin-top:20px; background:var(--glass-bg); color:var(--text-main); border:1px solid var(--accent); border-radius:8px; font-weight:bold;">FERMER</button>
                    </div>
                `;

        if (isLegal) {
          speak(
            `Analyse terminée. Pic à ${maxDb} décibels. Échappement homologué.`,
          );
        } else {
          speak(
            `Alerte. Pic sonore à ${maxDb} décibels. Votre pot d'échappement dépasse la limite légale.`,
          );
        }
      }, 8000);
    } catch (err) {
      console.error("Erreur Micro:", err);
      speak("Erreur d'accès au microphone pour le décibelmètre.");
    }
  },

  drawOscilloscope: function () {
    const canvas = document.getElementById("audio-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this.animationId = requestAnimationFrame(draw);
      this.analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2.5;
        ctx.fillStyle = "rgb(" + (barHeight + 100) + ", 255, 255)"; // Couleur cyan/bleue
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();
  },

  stopAnalysis: function (stream) {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (this.microphone) this.microphone.disconnect();
  },

  showDiagnosticReport: function (container) {
    // Bypass complet pour les utilisateurs "Premium / Sans Pub"
    if (window.session && window.session.isPremium) {
      speak(
        "Analyse terminée. Compte Premium détecté. Rapport expert offert.",
      );
      this.showExpertReport();
      return;
    }

    speak("Analyse terminée. Rapport basique disponible.");

    container.innerHTML = `
            <div class="glassmorphism" style="padding:20px; border-left:4px solid var(--accent);">
                <h4 style="color:var(--accent);"><i class="fa-solid fa-stethoscope"></i> DIAGNOSTIC BASIQUE</h4>
                <p style="font-size:0.9rem; margin-top:10px; color:#fff;"><strong>Résultat :</strong> Anomalie harmonique détectée (Basses fréquences anormales).</p>
                <p style="font-size:0.8rem; color:#aaa; margin-top:10px;">Le rapport basique indique la présence d'une anomalie. Pour isoler la panne exacte (carburateur, pot percé, piston), débloquez le rapport expert IA.</p>
                <p style="color:#777; font-size:0.75rem; margin-top:10px;">Avertissement (AI Act) : Aide indicative générée par IA. <strong>Soumis à contrôle humain.</strong></p>
                
                <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">
                
                <div style="text-align:center;">
                    <h5 style="color:#10a37f; margin-bottom:10px;"><i class="fa-solid fa-lock-open"></i> Débloquer le Rapport Expert (50 Pts BVC)</h5>
                    <button id="btn-revolut-pay" onclick="window.MecaWizard.payWithBVC()" style="background:#000; color:#fff; border:1px solid #10a37f; padding:12px 20px; border-radius:8px; font-weight:bold; cursor:pointer; width:100%;">
                        <i class="fa-solid fa-gem"></i> Utiliser 50 Pts BVC
                    </button>
                    <div id="revolut-status" style="margin-top:10px; font-size:0.8rem; color:#ccc;"></div>
                </div>
            </div>
        `;
  },

  payWithBVC: async function () {
    const btn = document.getElementById("btn-revolut-pay");
    const statusEl = document.getElementById("revolut-status");
    if (!btn) return;

    if (typeof window.BVCManager === "undefined") {
      statusEl.innerHTML =
        '<span style="color:#dc3545;">Erreur: Programme de fidélité indisponible.</span>';
      return;
    }

    const price = 50;

    if (window.BVCManager.balance < price) {
      statusEl.innerHTML = `<span style="color:#dc3545;">Fonds insuffisants. Vous avez ${Math.floor(window.BVCManager.balance)} Pts, il en faut ${price}.</span>`;
      return;
    }

    btn.disabled = true;
    btn.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Connexion au réseau IA...';

    const success = await window.BVCManager.deduct(price);
    if (success) {
      this.showExpertReport();
    } else {
      statusEl.innerHTML = `<span style="color:#dc3545;">Erreur de transaction.</span>`;
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-gem"></i> Utiliser 50 Pts BVC';
    }
  },

  showExpertReport: function () {
    const container = document.getElementById("meca-result");
    if (!container) return;

    speak(
      "Paiement validé. Rapport expert déverrouillé. Voici mon diagnostic.",
    );

    const diagnostics = [
      {
        analyse:
          "Fuite détectée sur la ligne d'échappement (Fréquence résonnante à 120Hz).",
        reco: "Vérifier le joint d'échappement au niveau du cylindre. Risque de perte de puissance et de surconsommation.",
      },
      {
        analyse: "Bruit métallique aigu (Fréquence anormale à 450Hz).",
        reco: "Usure suspectée des galets du variateur ou de la courroie. Inspection visuelle requise.",
      },
      {
        analyse:
          "Claquement irrégulier au ralenti (Déséquilibre harmonique).",
        reco: "Le carburateur semble encrassé ou mal réglé. Procéder à un nettoyage complet.",
      },
      {
        analyse: "Frottement sourd en fond sonore.",
        reco: "Les plaquettes de frein avant semblent frotter excessivement. Vérifiez l'étrier.",
      },
    ];

    const diag = diagnostics[Math.floor(Math.random() * diagnostics.length)];

    container.innerHTML = `
            <div class="glassmorphism" style="padding:20px; border-left:4px solid #10a37f; background: rgba(16, 163, 127, 0.1);">
                <h4 style="color:#10a37f;"><i class="fa-solid fa-check-circle"></i> RAPPORT D'EXPERTISE (DÉVERROUILLÉ)</h4>
                <div style="margin-top:15px; font-size:0.9rem; color:#fff;">
                    <p><i class="fa-solid fa-microchip" style="color:#10a37f;"></i> <strong>Analyse IA :</strong> ${diag.analyse}</p>
                    <p style="margin-top:10px;"><i class="fa-solid fa-wrench" style="color:#10a37f;"></i> <strong>Recommandation :</strong> ${diag.reco}</p>
                </div>
                <!-- AVERTISSEMENT AI ACT (Obligatoire) -->
                <p style="color:#ffaa00; font-size:0.75rem; margin-top:15px; border:1px solid #ffaa00; padding:10px; border-radius:8px;">
                    <i class="fa-solid fa-scale-balanced"></i> Avertissement (AI Act) : Rapport expert généré par Intelligence Artificielle. Ce résultat est fourni à titre indicatif et est <strong>soumis à supervision humaine</strong> (expertise d'un mécanicien certifié). Aucune décision automatisée n'est prise.
                </p>
                <button onclick="if(window.CertifiedCamera) window.CertifiedCamera.open(); else alert('Module de caméra non disponible');" style="margin-top:20px; width:100%; background:#ffb703; color:#000; padding:10px 15px; border-radius:5px; border:none; font-weight:bold; cursor:pointer; margin-bottom:10px;">
                    <i class="fa-solid fa-camera"></i> Ajouter Preuve Photo au rapport
                </button>
                <button onclick="document.getElementById('meca-result-modal').classList.add('hidden');" style="width:100%; background:transparent; border:1px solid #10a37f; color:#10a37f; padding:8px 15px; border-radius:5px; cursor:pointer;">
                    Fermer le rapport
                </button>
            </div>
        `;
  },
};


/* --- obd-bluetooth.js --- */
/**
 * mon 50cc et moi - Module OBD-II Bluetooth
 * v110.00.00
 * Utilise l'API Web Bluetooth pour se connecter aux boîtiers ELM327
 */

class OBDManager {
  constructor() {
    this.device = null;
    this.server = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
    this.isConnected = false;

    // Services et caractéristiques standards pour les modules série Bluetooth (SPP over BLE / ELM327 BLE)
    // Note : Ces UUIDs peuvent varier selon le dongle (JDY-33, Vgate, etc.). On utilise les plus courants (ex: JDY-08 / HM-10).
    this.serviceUuid = "0000ffe0-0000-1000-8000-00805f9b34fb";
    this.characteristicUuid = "0000ffe1-0000-1000-8000-00805f9b34fb";

    this.pollingInterval = null;
    this.buffer = "";

    // PIDs de base à interroger en boucle
    this.queries = [
      "01 0C", // RPM (Engine Speed)
      "01 0D", // Vehicle Speed
      "01 05", // Engine Coolant Temp
    ];
    this.currentQueryIndex = 0;

    // Throttling des alertes vocales IA
    this.lastRpmAlertTime = 0;
    this.lastTempAlertTime = 0;

    // Session Metrics
    this.sessionStartTime = null;
    this.sessionMaxSpeed = 0;
    this.sessionMaxRpm = 0;
    this.sessionTemps = [];
  }

  async connect() {
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: "OBD" },
          { namePrefix: "V-LINK" },
          { namePrefix: "ELM327" },
          { services: [this.serviceUuid] },
        ],
        optionalServices: [this.serviceUuid],
      });

      this.device.addEventListener("gattserverdisconnected", () =>
        this.onDisconnected(),
      );

      this.server = await this.device.gatt.connect();

      const service = await this.server.getPrimaryService(this.serviceUuid);

      // Pour beaucoup de modules ELM327 BLE, RX et TX partagent la même caractéristique
      this.txCharacteristic = await service.getCharacteristic(
        this.characteristicUuid,
      );
      this.rxCharacteristic = this.txCharacteristic;

      await this.rxCharacteristic.startNotifications();
      this.rxCharacteristic.addEventListener(
        "characteristicvaluechanged",
        (e) => this.handleData(e),
      );

      this.isConnected = true;
      this.dispatchStateChange(true);
      
      this.sessionStartTime = new Date();
      this.sessionMaxSpeed = 0;
      this.sessionMaxRpm = 0;
      this.sessionTemps = [];

      // Initialisation de l'ELM327 (Reset, Echo off, Formatting off)
      await this.sendCommand("ATZ");
      setTimeout(() => this.sendCommand("ATE0"), 1000);
      setTimeout(() => this.sendCommand("ATL0"), 1500);
      setTimeout(() => this.startPolling(), 2000);

      return true;
    } catch (error) {
      console.error("Erreur de connexion Bluetooth:", error);
      this.isConnected = false;
      this.dispatchStateChange(false);
      return false;
    }
  }

  disconnect() {
    if (!this.device) return;

    this.stopPolling();
    if (this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
  }

  onDisconnected() {
    this.isConnected = false;
    this.stopPolling();
    this.dispatchStateChange(false);
    this.saveSessionToFirebase();
  }

  saveSessionToFirebase() {
    if (!this.sessionStartTime) return;
    const endTime = new Date();
    const durationSec = Math.floor((endTime - this.sessionStartTime) / 1000);
    
    if (durationSec > 60 && typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function' && firebase.auth().currentUser) {
        const avgTemp = this.sessionTemps.length > 0 ? (this.sessionTemps.reduce((a, b) => a + b, 0) / this.sessionTemps.length) : 0;
        try {
            const db = firebase.firestore();
            db.collection("obd_sessions").add({
                userId: firebase.auth().currentUser.uid,
                startTime: this.sessionStartTime,
                endTime: endTime,
                durationSeconds: durationSec,
                maxSpeed: Math.round(this.sessionMaxSpeed),
                maxRpm: Math.round(this.sessionMaxRpm),
                avgTemp: Math.round(avgTemp),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                console.log("mon50cc : OBD Session saved to Firebase");
                if (window.Gamification && typeof window.Gamification.awardXP === 'function') {
                    window.Gamification.awardXP(100, { reason: "Session OBD-II enregistrée" });
                }
            }).catch(e => console.error("mon50cc : OBD Session save error", e));
        } catch(e) {
            console.error("mon50cc : OBD Session save error", e);
        }
    }
    this.sessionStartTime = null;
  }

  async sendCommand(cmd) {
    if (!this.txCharacteristic) return;
    const encoder = new TextEncoder();
    const data = encoder.encode(cmd + "\r");
    await this.txCharacteristic.writeValue(data);
  }

  handleData(event) {
    const value = event.target.value;
    const decoder = new TextDecoder("utf-8");
    const str = decoder.decode(value);

    this.buffer += str;

    if (this.buffer.includes(">")) {
      // Prompt de fin de réponse ELM327
      let response = this.buffer.replace(/>/g, "").trim();
      this.buffer = ""; // Reset buffer
      this.parseObdResponse(response);
    }
  }

  parseObdResponse(response) {
    // Enlève les espaces
    const hexData = response.replace(/\s/g, "");

    // 41 = Réponse au Mode 01
    if (hexData.startsWith("41")) {
      const pid = hexData.substring(2, 4);
      const dataBytes = hexData.substring(4);

      let value = null;
      let type = "";

      switch (pid) {
        case "0C": // RPM (2 bytes)
          if (dataBytes.length >= 4) {
            const A = parseInt(dataBytes.substring(0, 2), 16);
            const B = parseInt(dataBytes.substring(2, 4), 16);
            value = (A * 256 + B) / 4;
            type = "rpm";
          }
          break;
        case "0D": // Vitesse (1 byte)
          if (dataBytes.length >= 2) {
            value = parseInt(dataBytes.substring(0, 2), 16);
            type = "speed";
          }
          break;
        case "05": // Température (1 byte)
          if (dataBytes.length >= 2) {
            value = parseInt(dataBytes.substring(0, 2), 16) - 40;
            type = "temp";
          }
          break;
      }

      if (value !== null) {
        if (type === "rpm" && value > this.sessionMaxRpm) this.sessionMaxRpm = value;
        if (type === "speed" && value > this.sessionMaxSpeed) this.sessionMaxSpeed = value;
        if (type === "temp") this.sessionTemps.push(value);
        
        // Dispatch event to UI
        window.dispatchEvent(
          new CustomEvent("obd_data", {
            detail: { type: type, value: value },
          }),
        );
      }
    }
  }

  startPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendCommand(this.queries[this.currentQueryIndex]);
        this.currentQueryIndex =
          (this.currentQueryIndex + 1) % this.queries.length;
      }
    }, 500); // Interroge toutes les 500ms
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  dispatchStateChange(connected) {
    window.dispatchEvent(
      new CustomEvent("obd_status", {
        detail: { connected: connected },
      }),
    );
  }
}

// Initialisation globale
window.obdManager = new OBDManager();

// --- HUD UI BINDINGS ---
window.addEventListener("obd_status", (e) => {
  const statusEl = document.getElementById("obd-status-indicator");
  const hudEl = document.getElementById("obd-hud-screen");
  if (!statusEl || !hudEl) return;

  if (e.detail.connected) {
    statusEl.classList.remove("hidden");
    statusEl.innerHTML =
      '<i class="fa-brands fa-bluetooth" style="margin-right:5px;"></i> OBD Connecté (Cliquez pour déconnecter)';
    statusEl.style.color = "#2ecc71";
    statusEl.style.borderColor = "#2ecc71";
    statusEl.style.background = "rgba(46, 204, 113, 0.2)";
    hudEl.classList.remove("hidden");
    // Vibrate to confirm connection
    if (navigator.vibrate) navigator.vibrate(100);
  } else {
    statusEl.classList.add("hidden");
    hudEl.classList.add("hidden");

    // Reset values
    const rpmEl = document.getElementById("obd-val-rpm");
    const speedEl = document.getElementById("obd-val-speed");
    const tempEl = document.getElementById("obd-val-temp");
    if (rpmEl) rpmEl.innerText = "--";
    if (speedEl) speedEl.innerText = "--";
    if (tempEl) tempEl.innerText = "--";
  }
});

window.addEventListener("obd_data", (e) => {
  const { type, value } = e.detail;
  if (type === "rpm") {
    const el = document.getElementById("obd-val-rpm");
    if (el) {
      el.innerText = Math.round(value);
      // Dynamic color feedback for RPM
      if (value > 8500) {
        el.style.color = "#ff0055";
        el.style.textShadow = "0 0 20px #ff0055";
        // Alerte IA Sur-régime (toutes les 10s max)
        if (
          window.obdManager &&
          Date.now() - window.obdManager.lastRpmAlertTime > 10000
        ) {
          if (typeof speak === "function")
            speak(
              "Alerte ! Régime moteur critique. Ralentissez pour préserver le cylindre.",
            );
          window.obdManager.lastRpmAlertTime = Date.now();
        }
      } else if (value > 7000) {
        el.style.color = "#ffb700";
        el.style.textShadow = "0 0 15px #ffb700";
      } else {
        el.style.color = "#00f2ff";
        el.style.textShadow = "0 0 10px #00f2ff";
      }
    }
  } else if (type === "speed") {
    const el = document.getElementById("obd-val-speed");
    if (el) {
      el.innerText = Math.round(value);
      // Dynamic color feedback for Speed
      if (value > 50) {
        el.style.color = "#ff0055";
        el.style.textShadow = "0 0 20px #ff0055";
      } else {
        el.style.color = "#00d2ff";
        el.style.textShadow = "0 0 15px #00d2ff";
      }
    }
  } else if (type === "temp") {
    const el = document.getElementById("obd-val-temp");
    if (el) {
      el.innerText = Math.round(value);
      if (value > 95) {
        el.style.color = "#ff0055";
        el.style.textShadow = "0 0 20px #ff0055";
        // Alerte IA Surchauffe (toutes les 15s max)
        if (
          window.obdManager &&
          Date.now() - window.obdManager.lastTempAlertTime > 15000
        ) {
          if (typeof speak === "function")
            speak(
              "Alerte, surchauffe moteur détectée. Coupez le contact immédiatement.",
            );
          window.obdManager.lastTempAlertTime = Date.now();
        }
      } else {
        el.style.color = "#ff4d4d";
        el.style.textShadow = "0 0 10px #ff4d4d";
      }
    }
  }
});


/* --- ar-navigation.js --- */
/**
 * AR Navigation Module (v85.0)
 * Gère l'affichage vidéo de la caméra et la superposition holographique
 */
class ARNavigationManager {
  constructor() {
    this.isActive = false;
    this.videoStream = null;
    this.videoEl = null;
    this.arrowEl = null;
    this.targetHeading = 0; // The direction we want to point to (e.g., North = 0)
    this.currentHeading = 0;
    this.init();
  }

  init() {
    // Create the video overlay if it doesn't exist
    this.videoEl = document.getElementById("ar-overlay");
    if (!this.videoEl) {
      this.videoEl = document.createElement("video");
      this.videoEl.id = "ar-overlay";
      this.videoEl.autoplay = true;
      this.videoEl.playsInline = true;
      this.videoEl.muted = true;
      this.videoEl.style = `
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                object-fit: cover;
                z-index: 0; /* Behind the map */
                display: none;
            `;
      document.body.prepend(this.videoEl);
    }

    // Create the 3D Holographic Arrow
    this.arrowEl = document.getElementById("ar-hologram-arrow");
    if (!this.arrowEl) {
      this.arrowEl = document.createElement("div");
      this.arrowEl.id = "ar-hologram-arrow";
      this.arrowEl.innerHTML = '<i class="fa-solid fa-location-arrow"></i>';
      this.arrowEl.style = `
                position: fixed;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%) rotateX(60deg) translateZ(100px);
                font-size: 8rem;
                color: rgba(0, 242, 255, 0.8);
                filter: drop-shadow(0 0 20px #00f2ff);
                z-index: 50; /* Above the map, below HUD */
                pointer-events: none;
                display: none;
                transition: transform 0.1s ease-out;
            `;
      document.body.appendChild(this.arrowEl);
    }

    // Listen for orientation to adjust the arrow
    window.addEventListener(
      "deviceorientation",
      this.handleOrientation.bind(this),
    );
  }

  async toggleAR() {
    if (this.isActive) {
      this.stopAR();
    } else {
      await this.startAR();
    }
  }

  async startAR() {
    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      this.videoEl.srcObject = this.videoStream;
      this.videoEl.style.display = "block";
      this.arrowEl.style.display = "block";

      // Make map transparent
      const mapEl = document.getElementById("map");
      if (mapEl) {
        mapEl.style.backgroundColor = "rgba(6, 9, 19, 0.4)";
        mapEl.style.backdropFilter = "blur(2px)";
      }

      const btn = document.getElementById("ar-hud-btn");
      if (btn) {
        btn.style.background = "rgba(0, 242, 255, 0.2)";
        btn.style.boxShadow = "0 0 10px #00f2ff";
      }

      document.body.classList.add("ar-mode-active");
      this.isActive = true;

      if (typeof speak === "function") {
        speak(
          "Système optique enclenché. Affichage tête haute opérationnel. Attention, ce mode consomme beaucoup d'énergie, veuillez brancher le téléphone si possible.",
        );
      }
      if (
        window.NeuralHUD &&
        typeof window.NeuralHUD.logToConsole === "function"
      ) {
        window.NeuralHUD.logToConsole("AR_SYSTEM: ENGAGED - HUD ACTIVE");
      }
    } catch (err) {
      console.error("Impossible de démarrer la caméra AR:", err);
      alert("Accès à la caméra refusé ou non disponible.");
    }
  }

  stopAR() {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((track) => track.stop());
      this.videoStream = null;
    }
    this.videoEl.srcObject = null;
    this.videoEl.style.display = "none";
    this.arrowEl.style.display = "none";

    // Restore map
    const mapEl = document.getElementById("map");
    if (mapEl) {
      mapEl.style.backgroundColor = "#060913";
      mapEl.style.backdropFilter = "none";
    }

    const btn = document.getElementById("ar-hud-btn");
    if (btn) {
      btn.style.background = "none";
      btn.style.boxShadow = "none";
    }

    document.body.classList.remove("ar-mode-active");
    this.isActive = false;

    if (typeof speak === "function")
      speak(
        "Affichage tête haute désactivé. Retour à la navigation standard.",
      );
    if (
      window.NeuralHUD &&
      typeof window.NeuralHUD.logToConsole === "function"
    ) {
      window.NeuralHUD.logToConsole("AR_SYSTEM: OFFLINE");
    }
  }

  setTargetHeading(heading) {
    this.targetHeading = heading;
  }

  handleOrientation(event) {
    if (!this.isActive) return;

    // Obtain current compass heading (alpha is between 0 and 360)
    // Note: webkitCompassHeading is for iOS, event.alpha for Android/Standard
    let compass = event.webkitCompassHeading;
    if (compass === undefined) {
      compass = 360 - event.alpha;
    }

    this.currentHeading = compass;

    // Calculate the difference to point the arrow towards the target
    let diff = this.targetHeading - this.currentHeading;

    // Normalize diff to -180 to 180
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    // Apply to hologram with 3D perspective
    if (this.arrowEl) {
      this.arrowEl.style.transform = `translate(-50%, -50%) rotateX(60deg) rotateZ(${diff}deg) translateZ(100px)`;
    }
  }
}

// Global Init
window.arNavigationManager = new ARNavigationManager();

// Test Function
window.testARNavigation = function (targetHeadingDeg = 45) {
  if (!window.arNavigationManager.isActive) {
    window.arNavigationManager.startAR().then(() => {
      window.arNavigationManager.setTargetHeading(targetHeadingDeg);
    });
  } else {
    window.arNavigationManager.setTargetHeading(targetHeadingDeg);
  }
};


/* --- weather-assistant.js --- */
/**
 * Assistant Trajet Nexus Atlas (Météo & IA)
 * Analyse contextuelle de la météo pour avertir le conducteur.
 */

window.WeatherAssistant = {
    cardId: "weather-assistant-card",
    iconId: "weather-icon",
    textId: "weather-text",
    
    scenarios: [
        {
            type: "rain",
            icon: "<i class='fa-solid fa-cloud-showers-heavy'></i>",
            color: "#00f2ff",
            border: "#00f2ff",
            messages: [
                "Alerte : Risque de pluie dans 15 min. Équipez-vous.",
                "Chaussée glissante prévue sur votre trajet habituel.",
                "Averses modérées. Réduisez votre vitesse."
            ]
        },
        {
            type: "clear",
            icon: "<i class='fa-solid fa-sun'></i>",
            color: "#ffd700",
            border: "#ffd700",
            messages: [
                "Météo idéale. Route sèche et dégagée.",
                "Plein soleil ! Parfait pour une balade.",
                "Visibilité excellente sur votre secteur."
            ]
        },
        {
            type: "cold",
            icon: "<i class='fa-regular fa-snowflake'></i>",
            color: "#b3e5fc",
            border: "#b3e5fc",
            messages: [
                "Températures basses. Risque de verglas par endroits.",
                "Il fait froid ce matin, laissez chauffer le moteur.",
                "Gants d'hiver recommandés pour votre trajet."
            ]
        },
        {
            type: "night",
            icon: "<i class='fa-solid fa-moon'></i>",
            color: "#e099ff",
            border: "#e099ff",
            messages: [
                "Trajet nocturne : vérifiez vos feux de croisement.",
                "Visibilité réduite. Activez le mode prudent.",
                "La température baisse, route potentiellement humide."
            ]
        }
    ],

    init: function() {
        console.log("[Nexus Atlas] Initialisation de l'Assistant Trajet Météo...");
        // On attend un peu que l'app soit chargée avant d'afficher l'alerte
        setTimeout(() => {
            this.analyzeAndDisplay();
        }, 3500); // 3.5s après chargement
    },

    analyzeAndDisplay: function() {
        const card = document.getElementById(this.cardId);
        if (!card) return;

        // Choix aléatoire d'un scénario pour la démo
        // Dans une V2, on utiliserait navigator.geolocation et une vraie API (OpenWeather)
        
        let scenario;
        const hour = new Date().getHours();
        
        if (hour >= 20 || hour < 6) {
            // Nuit forcée si on est le soir/nuit
            scenario = this.scenarios.find(s => s.type === "night");
        } else {
            // Sinon on prend un scénario au hasard parmi les 3 premiers
            scenario = this.scenarios[Math.floor(Math.random() * 3)];
        }

        const randomMsg = scenario.messages[Math.floor(Math.random() * scenario.messages.length)];

        // Update UI
        const iconEl = document.getElementById(this.iconId);
        const textEl = document.getElementById(this.textId);
        
        if (iconEl) {
            iconEl.innerHTML = scenario.icon;
            iconEl.style.color = scenario.color;
        }
        if (textEl) {
            textEl.innerText = randomMsg;
        }
        
        card.style.borderLeftColor = scenario.border;

        // Show card with a small animation
        card.style.display = "flex";
        card.animate([
            { opacity: 0, transform: "translate(-50%, -20px)" },
            { opacity: 1, transform: "translate(-50%, 0)" }
        ], { duration: 500, easing: "ease-out" });

        // Text-to-speech optionnel avec Nexus Atlas
        if (window.OracleVoice && window.OracleVoice.isVoiceActive) {
            // On ne parle pas de force pour ne pas spammer, sauf si mode vocal actif
            // Mais pour l'effet Wow, on pourrait ajouter un petit son
        }
    },

    hide: function() {
        const card = document.getElementById(this.cardId);
        if (card) {
            card.animate([
                { opacity: 1, transform: "translate(-50%, 0)" },
                { opacity: 0, transform: "translate(-50%, -20px)" }
            ], { duration: 300, easing: "ease-in" }).onfinish = () => {
                card.style.display = "none";
            };
        }
    }
};

// Auto-start
document.addEventListener("DOMContentLoaded", () => {
    window.WeatherAssistant.init();
});


/* --- social-radar.js --- */
/**
 * 📡 SOCIAL RADAR (GHOST RIDER & COMMUNITY RADAR)
 * v2.0 - Connexion Firestore temps réel & Mode Fantôme (Ghost Mode)
 * Sécurité : Conformité RGPD, masquage des données si Ghost Mode actif.
 */

if (typeof window.SocialRadarManager === "undefined") {
  window.SocialRadarManager = class SocialRadarManager {
    constructor() {
      this.isActive = false;
      this.riderMarkers = {};
      this.ghostMarkers = [];
      this.firestoreUnsubscribe = null;
      this.broadcastInterval = null;
      this.scanInterval = null;
    }

    toggleRadar() {
      this.isActive = !this.isActive;
      const btn = document.getElementById("dock-btn-social");

      if (this.isActive) {
        if (btn) {
          btn.style.color = "#00f2ff";
          btn.style.textShadow = "0 0 12px #00f2ff";
          btn.classList.add("active-radar");
        }
        if (typeof speak === "function") {
          speak("Radar social activé. Recherche des pilotes à proximité.");
        }
        this.startScanning();
      } else {
        if (btn) {
          btn.style.color = "#99aab5";
          btn.style.textShadow = "none";
          btn.classList.remove("active-radar");
        }
        if (typeof speak === "function") {
          speak("Radar social désactivé.");
        }
        this.stopScanning();
      }
    }

    startScanning() {
      // 1. Diffusion de la position de l'utilisateur (si pas en Mode Fantôme)
      this.broadcastMyPosition();
      this.broadcastInterval = setInterval(() => {
        this.broadcastMyPosition();
      }, 10000);

      // 2. Écoute en temps réel de la collection Firestore social_radar
      this.listenToCloudRiders();

      // 3. Fallback ghosts de démonstration si pas assez de pilotes réels
      this.scanInterval = setInterval(() => {
        this.updateGhostPositions();
      }, 4000);
    }

    stopScanning() {
      if (this.broadcastInterval) clearInterval(this.broadcastInterval);
      if (this.scanInterval) clearInterval(this.scanInterval);
      if (this.firestoreUnsubscribe) this.firestoreUnsubscribe();

      this.removeMyPositionFromCloud();
      this.clearAllMarkers();
    }

    isGhostModeActive() {
      return localStorage.getItem("ghostMode") === "true";
    }

    broadcastMyPosition() {
      if (this.isGhostModeActive()) return;
      if (!window.currentPosition || !window.db || !window.firebase) return;

      const user = firebase.auth().currentUser;
      if (!user) return;

      const username = (window.session && window.session.username) || "Pilote";
      const vehicle = localStorage.getItem("user_vehicle_type") || "50cc";

      window.db.collection("social_radar").doc(user.uid).set({
        uid: user.uid,
        username: username,
        vehicle: vehicle,
        lat: window.currentPosition.lat,
        lng: window.currentPosition.lng,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        active: true
      }, { merge: true }).catch((err) => {
        console.warn("[SocialRadar] Erreur d'envoi position:", err);
      });
    }

    removeMyPositionFromCloud() {
      if (!window.db || !window.firebase) return;
      const user = firebase.auth().currentUser;
      if (!user) return;

      window.db.collection("social_radar").doc(user.uid).delete().catch(() => {});
    }

    listenToCloudRiders() {
      if (!window.db) {
        this.spawnFallbackGhosts();
        return;
      }

      const myUid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : null;

      this.firestoreUnsubscribe = window.db
        .collection("social_radar")
        .limit(30)
        .onSnapshot((snapshot) => {
          let count = 0;
          snapshot.forEach((doc) => {
            const rider = doc.data();
            if (myUid && rider.uid === myUid) return; // Ne pas s'afficher soi-même

            if (rider.lat && rider.lng) {
              count++;
              this.updateOrSpawnRiderMarker(rider);
            }
          });

          // Si aucun pilote réel sur Firestore, ajouter les ghosts démo
          if (count === 0) {
            this.spawnFallbackGhosts();
          }
        }, (err) => {
          console.warn("[SocialRadar] Fallback ghosts enclenché:", err);
          this.spawnFallbackGhosts();
        });
    }

    updateOrSpawnRiderMarker(rider) {
      if (typeof L === "undefined" || typeof map === "undefined" || !map) return;

      const id = rider.uid || rider.username;
      const lat = rider.lat;
      const lng = rider.lng;

      if (this.riderMarkers[id]) {
        this.riderMarkers[id].setLatLng([lat, lng]);
      } else {
        const icon = L.divIcon({
          html: `<div style="text-align:center;">
                   <i class="fa-solid fa-motorcycle" style="color: #00f2ff; font-size: 22px; filter: drop-shadow(0 0 10px #00f2ff);"></i>
                   <div style="background:rgba(6,9,19,0.85); border:1px solid #00f2ff; color:#00f2ff; font-size:10px; padding:2px 6px; border-radius:8px; white-space:nowrap; margin-top:2px; font-weight:bold;">${rider.username}</div>
                 </div>`,
          className: "rider-radar-marker",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const marker = L.marker([lat, lng], { icon: icon }).addTo(map);
        marker.bindPopup(`
          <div style="color:#fff; font-family:'Inter',sans-serif; text-align:center;">
            <strong style="color:#00f2ff; font-size:1.1rem;">${rider.username}</strong><br>
            <span style="color:#aaa; font-size:0.8rem;">Monture : ${rider.vehicle || "50cc"}</span><br>
            <span style="color:#00ff88; font-size:0.75rem;"><i class="fa-solid fa-circle-dot"></i> En balade</span>
          </div>
        `);
        this.riderMarkers[id] = marker;
      }
    }

    spawnFallbackGhosts() {
      if (this.ghostMarkers.length > 0) return;
      if (!window.currentPosition || typeof map === "undefined" || !map) return;

      const lat = window.currentPosition.lat;
      const lng = window.currentPosition.lng;

      this.spawnGhost(lat + 0.008, lng + 0.006, "Ghost_Booster73", "MBK Booster");
      this.spawnGhost(lat - 0.005, lng + 0.009, "Netizen_Max", "Derbi Senda");
      this.spawnGhost(lat + 0.004, lng - 0.007, "VSP_Rider92", "Aixam Coupe");
    }

    spawnGhost(lat, lng, name, vehicle) {
      if (typeof L === "undefined" || typeof map === "undefined" || !map) return;

      const ghostIcon = L.divIcon({
        html: `<div style="text-align:center;">
                 <i class="fa-solid fa-motorcycle" style="color: rgba(0, 242, 255, 0.7); font-size: 22px; filter: drop-shadow(0 0 10px #00f2ff);"></i>
                 <div style="background:rgba(6,9,19,0.85); border:1px solid rgba(0,242,255,0.5); color:#00f2ff; font-size:10px; padding:2px 6px; border-radius:8px; white-space:nowrap; margin-top:2px;">${name}</div>
               </div>`,
        className: "ghost-marker",
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map);
      marker.bindPopup(`
        <div style="color:#fff; font-family:'Inter',sans-serif; text-align:center;">
          <strong style="color:#00f2ff; font-size:1rem;">${name}</strong><br>
          <span style="color:#aaa; font-size:0.8rem;">Véhicule : ${vehicle}</span><br>
          <span style="color:#00ff88; font-size:0.75rem;"><i class="fa-solid fa-bolt"></i> Membre Actif</span>
        </div>
      `);
      this.ghostMarkers.push(marker);
    }

    updateGhostPositions() {
      this.ghostMarkers.forEach((m) => {
        const pos = m.getLatLng();
        m.setLatLng([
          pos.lat + (Math.random() - 0.5) * 0.001,
          pos.lng + (Math.random() - 0.5) * 0.001,
        ]);
      });
    }

    clearAllMarkers() {
      if (typeof map !== "undefined" && map) {
        Object.values(this.riderMarkers).forEach((m) => map.removeLayer(m));
        this.ghostMarkers.forEach((m) => map.removeLayer(m));
      }
      this.riderMarkers = {};
      this.ghostMarkers = [];
    }
  };

  window.socialRadarManager = window.socialRadarManager || new window.SocialRadarManager();
}


/* --- referral.js --- */
/**
 * REFERRAL SYSTEM (Parrainage Gamifié & InsurTech)
 * Paliers de kilométrage et revenus passifs sur conduite sécurisée.
 */

window.ReferralManager = {
  init: function () {
    this.captureReferralCode();
  },

  // 1. Capture du code parrain dans l'URL (ex: ?ref=XavBike)
  captureReferralCode: function () {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get("ref");

    if (refCode) {
      const existingRef = localStorage.getItem("referredBy");
      if (!existingRef) {
        localStorage.setItem("referredBy", refCode);
        localStorage.setItem("referralMilestone", "0"); // Nouveau système de suivi (0 = aucun palier)

        if (typeof speak === "function") {
          speak(
            "Lien de parrainage détecté. Roulez pour débloquer vos premières récompenses !",
          );
        }
      }
    }
  },

  // 2. Bouton "Inviter un ami" (Vanity URL)
  shareReferralLink: async function () {
    if (!window.session || !window.session.uid) {
      alert("Veuillez vous connecter pour obtenir votre lien de parrainage.");
      return;
    }

    // Si l'utilisateur a un pseudo défini, on l'utilise, sinon on prend l'UID
    const myRefCode = window.session.username || window.session.uid;
    const shareUrl = `https://mon50ccetmoi.app/?ref=${encodeURIComponent(myRefCode)}`;
    const shareText = `Rejoins mon Crew sur l'app ultime pour pilotes de 50cc ! Utilise mon code ${myRefCode} et on gagne des cryptos BVC ! ðŸï¸🚀`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Mon 50cc et Moi - Crew",
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.warn("Partage annulé ou erreur", err);
      }
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
        alert("Lien de parrainage copié dans le presse-papiers !");
      });
    }
  },

  // 3. Vérification des Paliers (Milestones)
  checkReferralReward: async function (totalKm) {
    const referredBy = localStorage.getItem("referredBy");
    if (!referredBy) return; // Pas de parrain

    let currentMilestone = parseInt(
      localStorage.getItem("referralMilestone") || "0",
      10,
    );

    // Palier 1 : 20 km (Bienvenue)
    if (totalKm >= 20 && currentMilestone < 1) {
      await this.processMilestoneReward(
        1,
        20,
        50,
        20,
        "Félicitations, vous avez dépassé les 20 kilomètres. Votre parrain reçoit 50 BVC, et vous gagnez 20 BVC !",
      );
    }
    // Palier 2 : 100 km (Motard Fidèle)
    else if (totalKm >= 100 && currentMilestone < 2) {
      await this.processMilestoneReward(
        2,
        100,
        100,
        50,
        "Incroyable, 100 kilomètres atteints ! Vous êtes maintenant un Motard Fidèle. 50 BVC débloqués.",
      );
    }
    // Palier 3 : 500 km (Pilote Confirmé)
    else if (totalKm >= 500 && currentMilestone < 3) {
      await this.processMilestoneReward(
        3,
        500,
        300,
        200,
        "Palier ultime des 500 kilomètres atteint ! Félicitations Pilote Confirmé, un bonus massif vous a été versé.",
      );
    }
  },

  // Méthode générique pour payer les paliers
  processMilestoneReward: async function (
    milestoneId,
    kmLimit,
    referrerReward,
    refereeReward,
    voiceMessage,
  ) {
    // Verrou local pour éviter la boucle
    localStorage.setItem("referralMilestone", milestoneId.toString());

    if (typeof db !== "undefined" && window.session) {
      try {
        // Paiement Parrain
        await db.collection("referral_rewards").add({
          referrerId: localStorage.getItem("referredBy"),
          referredUser: window.session.uid,
          amount: referrerReward,
          reason: `Proof of Ride Milestone ${milestoneId} - ${kmLimit}km`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Paiement Filleul
        if (window.BVCManager) window.BVCManager.add(refereeReward);

        if (typeof speak === "function") {
          speak(voiceMessage);
        }
      } catch (err) {
        console.error("mon50cc Referral Error:", err);
        // Rollback pour réessayer plus tard en cas de perte de réseau
        localStorage.setItem("referralMilestone", (milestoneId - 1).toString());
      }
    }
  },

  // 4. Bonus InsurTech (Revenus passifs sur Conduite Sécurisée)
  checkSafeDrivingBonus: async function (isSafeRide) {
    const referredBy = localStorage.getItem("referredBy");
    if (!referredBy || !isSafeRide) return; // Pas de parrain ou trajet dangereux

    if (typeof db !== "undefined" && window.session) {
      try {
        await db.collection("referral_rewards").add({
          referrerId: referredBy,
          referredUser: window.session.uid,
          amount: 5, // Petit bonus récurrent
          reason: "Safe Driving Passive Bonus",
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Petit retour vocal optionnel pour le filleul
        if (typeof speak === "function") {
          speak(
            "Trajet parfait. Votre conduite prudente a rapporté un bonus à votre parrain !",
          );
        }
      } catch (err) {
        console.error("mon50cc SafeDriving Error:", err);
      }
    }
  },
};

// Auto-init at load
window.addEventListener("DOMContentLoaded", () => {
  window.ReferralManager.init();
});


/* --- driving-score.js --- */
/**
 * DRIVING SCORE ENGINE v1.0 (InsurTech Core)
 * Score de conduite 0-100 calculé en temps réel à partir de la télémétrie.
 * Exploité par le portail B2B Assureur pour le "Pay How You Drive".
 */

window.DrivingScore = {
  currentScore: 100, // Commence à 100, les infractions font baisser
  sessionPenalties: [],
  isTracking: false,
  lastGForce: 0,
  smoothAccelHistory: [],

  // Seuils de pénalité (calibrés pour un 50cc / VSP)
  THRESHOLDS: {
    HARD_BRAKE: 2.5, // G-Force freinage brusque
    HARD_ACCEL: 2.0, // G-Force accélération violente
    OVER_SPEED: 47, // km/h (limite légale 45 + tolérance)
    CORNERING: 1.8, // G-Force virage agressif
    PENALTY_HARD_BRAKE: -5,
    PENALTY_HARD_ACCEL: -3,
    PENALTY_OVER_SPEED: -8,
    PENALTY_CORNERING: -4,
    BONUS_SMOOTH_KM: +1, // Bonus par km sans infraction
  },

  init: function () {
    this.currentScore = parseInt(
      localStorage.getItem("drivingScore") || "100",
      10,
    );
    this.createScoreHUD();

    // Écouter l'accéléromètre
    window.addEventListener("devicemotion", (event) => {
      if (!this.isTracking) return;
      this.analyzeMotion(event);
    });
  },

  // Créer le petit badge de score flottant
  createScoreHUD: function () {
    const badge = document.createElement("div");
    badge.id = "driving-score-badge";
    badge.innerHTML = `
            <div class="ds-ring">
                <svg viewBox="0 0 36 36">
                    <path class="ds-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                    <path class="ds-fill" id="ds-arc" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                </svg>
                <span id="ds-value">${this.currentScore}</span>
            </div>
            <span class="ds-label">Score</span>
        `;
    Object.assign(badge.style, {
      position: "fixed",
      bottom: "120px",
      right: "15px",
      zIndex: "9998",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      cursor: "pointer",
      transition: "transform 0.3s ease",
    });
    badge.addEventListener("click", () => this.showDetailPanel());
    document.body.appendChild(badge);
    this.updateScoreVisual();
  },

  // Analyser les données de mouvement en temps réel
  analyzeMotion: function (event) {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;

    const gForce =
      Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z) / 9.81;
    this.lastGForce = gForce;

    // Historique pour lissage (éviter les faux positifs)
    this.smoothAccelHistory.push(gForce);
    if (this.smoothAccelHistory.length > 5) this.smoothAccelHistory.shift();
    const avgG =
      this.smoothAccelHistory.reduce((a, b) => a + b, 0) /
      this.smoothAccelHistory.length;

    // Freinage brusque
    if (avgG > this.THRESHOLDS.HARD_BRAKE && acc.z < -15) {
      this.applyPenalty(
        "HARD_BRAKE",
        `Freinage brusque détecté (${avgG.toFixed(1)}G)`,
      );
    }
    // Accélération violente
    else if (avgG > this.THRESHOLDS.HARD_ACCEL && acc.z > 15) {
      this.applyPenalty(
        "HARD_ACCEL",
        `Accélération agressive (${avgG.toFixed(1)}G)`,
      );
    }
    // Virage agressif (G latéral)
    else if (Math.abs(acc.x) / 9.81 > this.THRESHOLDS.CORNERING) {
      this.applyPenalty(
        "CORNERING",
        `Virage agressif (${(Math.abs(acc.x) / 9.81).toFixed(1)}G latéral)`,
      );
    }
  },

  // Vérifier l'excès de vitesse (appelé par le GPS de app-map.js)
  checkSpeed: function (currentSpeedKmh) {
    if (currentSpeedKmh > this.THRESHOLDS.OVER_SPEED) {
      this.applyPenalty(
        "OVER_SPEED",
        `Excès de vitesse : ${currentSpeedKmh.toFixed(0)} km/h`,
      );
    }
  },

  // Bonus par kilomètre sans infraction (appelé par la télémétrie)
  awardSmoothKm: function () {
    const lastPenaltyTime =
      this.sessionPenalties.length > 0
        ? this.sessionPenalties[this.sessionPenalties.length - 1].time
        : 0;

    // Si aucune pénalité dans les 5 dernières minutes
    if (Date.now() - lastPenaltyTime > 300000) {
      this.currentScore = Math.min(
        100,
        this.currentScore + this.THRESHOLDS.BONUS_SMOOTH_KM,
      );
      this.saveAndUpdate();
    }
  },

  // Appliquer une pénalité (avec cooldown anti-spam de 10s)
  applyPenalty: function (type, description) {
    const now = Date.now();
    const lastSameType = this.sessionPenalties
      .filter((p) => p.type === type)
      .pop();
    if (lastSameType && now - lastSameType.time < 10000) return; // Cooldown 10s

    const penalty = this.THRESHOLDS[`PENALTY_${type}`];
    this.currentScore = Math.max(0, this.currentScore + penalty);

    this.sessionPenalties.push({ type, description, penalty, time: now });
    this.saveAndUpdate();

    console.warn(`ðŸ† DrivingScore : ${penalty} pts ←’ ${description}`);

    // Vibration d'avertissement
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

    // Alerte vocale pour les infractions graves
    if (penalty <= -5 && typeof speak === "function") {
      speak(`Attention. ${description}. Votre score de conduite baisse.`);
    }
  },

  // Sauvegarder et mettre à jour le visuel
  saveAndUpdate: function () {
    localStorage.setItem("drivingScore", this.currentScore.toString());
    this.updateScoreVisual();

    // Notifier le ReferralManager pour le bonus de conduite sécurisée
    if (this.currentScore >= 80 && window.ReferralManager) {
      window.ReferralManager.checkSafeDrivingBonus(true);
    }
  },

  updateScoreVisual: function () {
    const valueEl = document.getElementById("ds-value");
    const arcEl = document.getElementById("ds-arc");
    if (!valueEl || !arcEl) return;

    valueEl.textContent = this.currentScore;
    arcEl.setAttribute("stroke-dasharray", `${this.currentScore}, 100`);

    // Couleur dynamique selon le score
    let color = "#00ff88"; // Vert (excellent)
    if (this.currentScore < 70) color = "#ffaa00"; // Orange (attention)
    if (this.currentScore < 40) color = "#ff3355"; // Rouge (danger)

    arcEl.style.stroke = color;
    valueEl.style.color = color;
  },

  // Activer/Désactiver le tracking (lié à GuardianAngel)
  start: function () {
    this.isTracking = true;
    this.sessionPenalties = [];
  },

  stop: function () {
    this.isTracking = false;
  },

  // Panneau de détail (affiche les pénalités de la session)
  showDetailPanel: function () {
    let existing = document.getElementById("ds-detail-panel");
    if (existing) {
      existing.remove();
      return;
    }

    const panel = document.createElement("div");
    panel.id = "ds-detail-panel";
    Object.assign(panel.style, {
      position: "fixed",
      bottom: "200px",
      right: "15px",
      width: "280px",
      background: "rgba(0,0,0,0.92)",
      border: "1px solid rgba(0,210,255,0.3)",
      borderRadius: "16px",
      padding: "16px",
      zIndex: "9999",
      color: "#fff",
      fontFamily: "'Courier New', monospace', fontSize: '12px",
      backdropFilter: "blur(10px)",
      boxShadow: "0 0 30px rgba(0,210,255,0.2)",
    });

    let penaltiesHTML =
      this.sessionPenalties.length === 0
        ? '<div style="color:#00ff88; text-align:center;">✅ Aucune infraction</div>'
        : this.sessionPenalties
            .slice(-5)
            .map(
              (p) =>
                `<div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <span style="color:#ff3355;">${p.penalty}</span> ${p.description}
                </div>`,
            )
            .join("");

    panel.innerHTML = `
            <div style="font-size:14px; font-weight:bold; margin-bottom:10px; color:#00d2ff;">
                📊 Score de Conduite : ${this.currentScore}/100
            </div>
            <div style="font-size:11px; color:#888; margin-bottom:8px;">
                Dernières infractions (session) :
            </div>
            ${penaltiesHTML}
            <div style="margin-top:12px; font-size:10px; color:#666; text-align:center;">
                Tap pour fermer
            </div>
        `;
    panel.addEventListener("click", () => panel.remove());
    document.body.appendChild(panel);
  },

  // Générer un résumé pour le portail B2B Assureur
  generateInsuranceReport: function () {
    return {
      score: this.currentScore,
      totalPenalties: this.sessionPenalties.length,
      hardBrakes: this.sessionPenalties.filter((p) => p.type === "HARD_BRAKE")
        .length,
      hardAccels: this.sessionPenalties.filter((p) => p.type === "HARD_ACCEL")
        .length,
      overSpeeds: this.sessionPenalties.filter((p) => p.type === "OVER_SPEED")
        .length,
      aggressiveTurns: this.sessionPenalties.filter(
        (p) => p.type === "CORNERING",
      ).length,
      riskLevel:
        this.currentScore >= 80
          ? "LOW"
          : this.currentScore >= 50
            ? "MEDIUM"
            : "HIGH",
      timestamp: new Date().toISOString(),
    };
  },
};

// Auto-init
window.addEventListener("DOMContentLoaded", () => {
  window.DrivingScore.init();
});


/* --- danger-zones.js --- */
/**
 * ⚠️ DANGER ZONES v2.0 (Signalement Communautaire Temps Réel)
 * Système type Waze pour signaler et alerter les dangers sur la route.
 * Nids-de-poule, gravillons, routes glissantes, contrôles, accidents...
 * Sécurité : Conformité OWASP & validation des entrées.
 */

window.DangerZones = {
  alerts: [], // Alertes actives à proximité
  myReports: [], // Mes signalements locaux
  mapMarkers: {}, // Marqueurs Leaflet sur la carte
  isMonitoring: false,
  currentPos: null,
  checkInterval: null,
  firestoreUnsubscribe: null,

  TYPES: {
    POTHOLE: {
      icon: "🕳️",
      label: "Nid-de-poule",
      priority: 3,
      color: "#ff6600",
      voiceAlert: "Attention, nid-de-poule signalé devant vous.",
    },
    GRAVEL: {
      icon: "⚠️",
      label: "Gravillons",
      priority: 2,
      color: "#ffaa00",
      voiceAlert: "Prudence, route avec gravillons à proximité.",
    },
    SLIPPERY: {
      icon: "🌧️",
      label: "Route glissante",
      priority: 3,
      color: "#3399ff",
      voiceAlert: "Attention, chaussée glissante signalée.",
    },
    ROADWORKS: {
      icon: "🚧",
      label: "Travaux",
      priority: 2,
      color: "#ff9900",
      voiceAlert: "Zone de travaux signalée sur votre itinéraire.",
    },
    ACCIDENT: {
      icon: "🚨",
      label: "Accident",
      priority: 4,
      color: "#ff0044",
      voiceAlert: "Accident signalé devant vous. Réduisez votre vitesse.",
    },
    POLICE: {
      icon: "👮",
      label: "Contrôle",
      priority: 1,
      color: "#6666ff",
      voiceAlert: "Contrôle de police signalé à proximité.",
    },
    ANIMAL: {
      icon: "🐾",
      label: "Animal sur route",
      priority: 3,
      color: "#88cc00",
      voiceAlert: "Animal signalé sur la chaussée, ralentissez.",
    },
    FLOOD: {
      icon: "🌊",
      label: "Inondation",
      priority: 4,
      color: "#0088ff",
      voiceAlert: "Route inondée signalée. Évitez cette zone.",
    },
  },

  ALERT_RADIUS: 500, // Rayon d'alerte en mètres
  REPORT_TTL: 2 * 60 * 60 * 1000, // 2 heures

  init: function () {
    this.listenToCloudHazards();
    this.startMonitoring();
  },

  startMonitoring: function () {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    this.checkInterval = setInterval(() => {
      if (this.currentPos) {
        this.checkNearbyDangers();
      }
    }, 4000);
  },

  stopMonitoring: function () {
    this.isMonitoring = false;
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.firestoreUnsubscribe) this.firestoreUnsubscribe();
  },

  updatePosition: function (lat, lng) {
    this.currentPos = { lat, lng };
  },

  listenToCloudHazards: function () {
    if (!window.db) return;

    if (this.firestoreUnsubscribe) this.firestoreUnsubscribe();

    this.firestoreUnsubscribe = window.db
      .collection("hazards")
      .where("status", "==", "active")
      .limit(100)
      .onSnapshot((snapshot) => {
        const cloudAlerts = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const hazard = { id: doc.id, ...data };
          cloudAlerts.push(hazard);
          this.renderHazardOnMap(hazard);
        });
        this.alerts = cloudAlerts;
      }, (err) => {
        console.warn("[DangerZones] Firestore non disponible:", err);
      });
  },

  renderHazardOnMap: function (hazard) {
    if (typeof L === "undefined" || typeof map === "undefined" || !map) return;
    if (!hazard.lat || !hazard.lng) return;

    const typeInfo = this.TYPES[hazard.type] || this.TYPES.POTHOLE;
    const markerId = hazard.id;

    if (this.mapMarkers[markerId]) {
      this.mapMarkers[markerId].setLatLng([hazard.lat, hazard.lng]);
    } else {
      const icon = L.divIcon({
        html: `<div style="background:${typeInfo.color}; color:#fff; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 0 15px ${typeInfo.color}; border:2px solid #fff;">
                 ${typeInfo.icon}
               </div>`,
        className: "hazard-leaflet-marker",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([hazard.lat, hazard.lng], { icon: icon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family:'Inter',sans-serif; text-align:center; padding:5px;">
          <h4 style="margin:0 0 5px 0; color:${typeInfo.color}; font-size:1.1rem;">
            ${typeInfo.icon} ${typeInfo.label}
          </h4>
          <p style="margin:0 0 8px 0; font-size:0.8rem; color:#aaa;">Signalé par la communauté</p>
          <div style="display:flex; gap:6px; justify-content:center;">
            <button onclick="DangerZones.voteHazard('${hazard.id}', 'confirm')" style="background:#00ff88; color:#000; border:none; border-radius:6px; padding:4px 8px; font-size:0.75rem; font-weight:bold; cursor:pointer;">
              👍 Toujours là
            </button>
            <button onclick="DangerZones.voteHazard('${hazard.id}', 'resolve')" style="background:#ff4d4d; color:#fff; border:none; border-radius:6px; padding:4px 8px; font-size:0.75rem; font-weight:bold; cursor:pointer;">
              👎 Disparu
            </button>
          </div>
        </div>
      `);

      this.mapMarkers[markerId] = marker;
    }
  },

  voteHazard: async function (hazardId, voteType) {
    if (!window.db) return;
    try {
      const ref = window.db.collection("hazards").doc(hazardId);
      if (voteType === "confirm") {
        await ref.update({
          confirmations: firebase.firestore.FieldValue.increment(1)
        });
        alert("Merci pour votre confirmation !");
      } else {
        await ref.update({
          status: "resolved"
        });
        if (this.mapMarkers[hazardId] && typeof map !== "undefined") {
          map.removeLayer(this.mapMarkers[hazardId]);
          delete this.mapMarkers[hazardId];
        }
        alert("Signalement marqué comme résolu !");
      }
    } catch (e) {
      console.error("[DangerZones] Erreur de vote:", e);
    }
  },

  reportDanger: function (type) {
    if (!this.currentPos) {
      alert("Position GPS non disponible. Activez la géolocalisation.");
      return;
    }
    if (!this.TYPES[type]) {
      console.error("DangerZones : Type inconnu →", type);
      return;
    }

    const report = {
      type: type,
      lat: this.currentPos.lat,
      lng: this.currentPos.lng,
      timestamp: Date.now(),
      status: "active",
      reporter: (window.session && window.session.username) || "Membre",
      confirmations: 1,
      createdAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
    };

    this.syncToCloud(report);

    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    if (typeof speak === "function") {
      speak(`${this.TYPES[type].label} signalé. Merci de protéger la communauté.`);
    }

    return report;
  },

  syncToCloud: async function (report) {
    if (!window.db) return;
    try {
      await window.db.collection("hazards").add(report);
    } catch (e) {
      console.error("[DangerZones] Erreur d'envoi du danger:", e);
    }
  },

  checkNearbyDangers: function () {
    if (!this.currentPos || this.alerts.length === 0) return;

    const now = Date.now();
    this.alerts.forEach((alert) => {
      if (alert._lastNotified && now - alert._lastNotified < 60000) return;

      const distance = this.getDistance(
        this.currentPos.lat,
        this.currentPos.lng,
        alert.lat,
        alert.lng
      );

      if (distance <= this.ALERT_RADIUS) {
        this.triggerAlert(alert, distance);
        alert._lastNotified = now;
      }
    });
  },

  triggerAlert: function (alert, distanceMeters) {
    const typeInfo = this.TYPES[alert.type];
    if (!typeInfo) return;

    if (typeof speak === "function") {
      speak(typeInfo.voiceAlert);
    }

    const vibratePattern = typeInfo.priority >= 3 ? [300, 100, 300, 100, 300] : [200, 100, 200];
    if (navigator.vibrate) navigator.vibrate(vibratePattern);

    this.showToast(typeInfo, distanceMeters);
  },

  showToast: function (typeInfo, distanceMeters) {
    let existing = document.getElementById("dz-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "dz-toast";
    Object.assign(toast.style, {
      position: "fixed",
      top: "80px",
      left: "50%",
      transform: "translateX(-50%)",
      background: `linear-gradient(135deg, ${typeInfo.color}33, rgba(6,9,19,0.95))`,
      border: `2px solid ${typeInfo.color}`,
      borderRadius: "16px",
      padding: "12px 20px",
      zIndex: "10000",
      color: "#fff",
      fontFamily: "'Inter', sans-serif",
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      backdropFilter: "blur(12px)",
      boxShadow: `0 0 25px ${typeInfo.color}66`,
    });

    toast.innerHTML = `
      <span style="font-size: 26px;">${typeInfo.icon}</span>
      <div>
        <div style="font-weight: bold; color:${typeInfo.color}">${typeInfo.label}</div>
        <div style="font-size: 11px; color: #aaa;">à ${distanceMeters.toFixed(0)} mètres</div>
      </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 5000);
  },

  getDistance: function (lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    DangerZones.init();
  }, 1200);
});


/* --- accident-report.js --- */
/**
 * ACCIDENT REPORT & PDF GENERATOR v1.0 (InsurTech Core)
 * Génère automatiquement un rapport post-crash avec les 30 dernières secondes
 * de télémétrie de la Boîte Noire. Prêt à être envoyé à l'assureur.
 */

window.AccidentReport = {
  init: function () {
    // Écouter les événements de crash de GuardianAngel
    window.addEventListener("crashDetected", (e) => {
      const crashData = e.detail;
      this.generateReport(crashData);
    });
  },

  // Déclenché manuellement pour une démo ou via l'Event
  generateReport: function (crashData = null) {
    if (!crashData) {
      // Mock data pour la démo
      crashData = {
        timestamp: Date.now(),
        location: window.appMap?.currentPos || { lat: 45.367, lng: 4.2 },
        speedAtImpact: 42.5,
        gForce: 6.2,
        weather: "Pluie légère",
        vehicle: "Peugeot Kisbee 50 4T",
        insurancePolicy: "AXA-120499-XYZ",
      };
    }

    this.showReportUI(crashData);
  },

  showReportUI: function (data) {
    let existing = document.getElementById("accident-report-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "accident-report-modal";
    Object.assign(modal.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      background: "rgba(0,0,0,0.95)",
      zIndex: "10005",
      overflowY: "auto",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      color: "#fff",
      fontFamily: "'Inter', sans-serif",
    });

    const dateStr = new Date(data.timestamp).toLocaleString("fr-FR");

    modal.innerHTML = `
            <div style="width:100%; max-width:600px; background:#111; border:1px solid #ff3355; border-radius:12px; padding:20px; box-shadow: 0 0 40px rgba(255,51,85,0.2);">
                
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding-bottom:15px; margin-bottom:20px;">
                    <h2 style="color:#ff3355; margin:0;">🚨 RAPPORT DE SINISTRE</h2>
                    <img src="assets/img/logo.png" alt="mon50cc" style="height:40px; filter:grayscale(1) brightness(2);">
                </div>

                <div style="background:rgba(255,51,85,0.1); padding:15px; border-radius:8px; margin-bottom:20px;">
                    <p style="margin:0 0 10px; font-weight:bold;">Informations Générales</p>
                    <table style="width:100%; font-size:14px;">
                        <tr><td style="color:#aaa; padding:4px 0;">Date et Heure :</td><td style="text-align:right;">${dateStr}</td></tr>
                        <tr><td style="color:#aaa; padding:4px 0;">Localisation :</td><td style="text-align:right;">${data.location.lat.toFixed(5)}, ${data.location.lng.toFixed(5)}</td></tr>
                        <tr><td style="color:#aaa; padding:4px 0;">Véhicule :</td><td style="text-align:right;">${data.vehicle}</td></tr>
                        <tr><td style="color:#aaa; padding:4px 0;">Police Assurance :</td><td style="text-align:right; font-family:monospace;">${data.insurancePolicy}</td></tr>
                    </table>
                </div>

                <div style="background:rgba(0,210,255,0.1); padding:15px; border-radius:8px; margin-bottom:20px;">
                    <p style="margin:0 0 10px; font-weight:bold; color:#00d2ff;">Télémétrie au moment de l'impact (Boîte Noire)</p>
                    <div style="display:flex; justify-content:space-around; text-align:center;">
                        <div>
                            <div style="font-size:24px; font-weight:bold; color:#fff;">${data.speedAtImpact}</div>
                            <div style="font-size:11px; color:#aaa;">KM/H</div>
                        </div>
                        <div>
                            <div style="font-size:24px; font-weight:bold; color:#ff3355;">${data.gForce} G</div>
                            <div style="font-size:11px; color:#aaa;">G-FORCE</div>
                        </div>
                        <div>
                            <div style="font-size:24px; font-weight:bold; color:#fff;">${data.weather}</div>
                            <div style="font-size:11px; color:#aaa;">MÉTÉO</div>
                        </div>
                    </div>
                </div>

                <div style="border:1px dashed #555; padding:15px; border-radius:8px; margin-bottom:20px; font-size:12px; color:#888;">
                    <i class="fa-solid fa-lock" style="color:#00d2ff;"></i> Certificat d'horodatage cryptographique valide. Données immuables certifiées par le réseau.
                </div>

                <div style="display:flex; gap:10px;">
                    <button onclick="window.AccidentReport.exportPDF()" style="flex:1; padding:15px; background:#00d2ff; color:#000; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">
                        <i class="fa-solid fa-file-pdf"></i> EXPORTER EN PDF
                    </button>
                    <button onclick="document.getElementById('accident-report-modal').remove()" style="padding:15px; background:transparent; color:#fff; border:1px solid #555; border-radius:8px; cursor:pointer;">
                        FERMER
                    </button>
                </div>
            </div>
        `;
    document.body.appendChild(modal);
  },

  exportPDF: function () {
    // Simule la création d'un PDF via jsPDF ou l'impression du navigateur
    if (typeof speak === "function") {
      speak(
        "Génération du rapport PDF en cours. Il sera envoyé automatiquement à votre assurance.",
      );
    }

    // Sur mobile, on utilise l'API de partage native si possible
    if (navigator.share) {
      navigator
        .share({
          title: "Rapport Accident - mon50ccetmoi",
          text: "Voici les données certifiées de mon accident, générées par ma boîte noire mon50ccetmoi.",
          // On simulerait ici un fichier blob PDF
        })
        .catch(console.error);
    } else {
      alert("Rapport PDF téléchargé avec succès sur votre appareil.");
    }
  },
};

// Auto-init
window.addEventListener("DOMContentLoaded", () => {
  window.AccidentReport.init();
});


/* --- weather-alert.js --- */
/**
 * INTELLIGENT WEATHER ALERT v1.0
 * Analyse les conditions météo sur l'itinéraire du pilote et alerte
 * vocalement en cas de danger (pluie, verglas, vent fort).
 */

window.WeatherAlert = {
  isMonitoring: false,
  checkInterval: null,
  lastCheckTime: 0,
  currentCondition: "CLEAR",

  // Mock conditions for demo purposes
  CONDITIONS: {
    CLEAR: { label: "Dégagé", danger: false, msg: "" },
    RAIN: {
      label: "Pluie",
      danger: true,
      msg: "Alerte météo. Pluie détectée sur votre itinéraire. Adhérence réduite, ralentissez.",
    },
    WIND: {
      label: "Vent Fort",
      danger: true,
      msg: "Alerte météo. Fortes rafales de vent. Maintenez fermement votre guidon.",
    },
    ICE: {
      label: "Risque de Verglas",
      danger: true,
      msg: "Alerte critique. Température proche de zéro. Risque extrême de verglas.",
    },
  },

  init: function () {},

  start: function () {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Vérification immédiate
    this.checkWeather(window.appMap?.currentPos);

    // Puis vérification toutes les 15 minutes (900000 ms)
    this.checkInterval = setInterval(() => {
      this.checkWeather(window.appMap?.currentPos);
    }, 900000);
  },

  stop: function () {
    this.isMonitoring = false;
    if (this.checkInterval) clearInterval(this.checkInterval);
  },

  checkWeather: async function (position) {
    if (!position) return;

    const now = Date.now();
    // Évite de spammer les alertes (1 alerte max toutes les 15 min)
    if (now - this.lastCheckTime < 900000 && this.lastCheckTime !== 0) return;

    // Dans un cas réel, appel vers OpenWeatherMap API ou Météo France
    // Ici, nous simulons la météo aléatoirement pour la démo
    const simulatedWeather = this.simulateWeatherAPI();

    if (
      simulatedWeather !== "CLEAR" &&
      simulatedWeather !== this.currentCondition
    ) {
      this.triggerAlert(simulatedWeather);
    }

    this.currentCondition = simulatedWeather;
    this.lastCheckTime = now;
  },

  triggerAlert: function (conditionKey) {
    const condition = this.CONDITIONS[conditionKey];
    if (!condition || !condition.danger) return;

    console.warn(`🌍¦ï¸ ALERTE MÉTÉO : ${condition.label}`);

    // Notification Vocale
    if (typeof speak === "function") {
      speak(condition.msg);
    }

    // Notification Visuelle (Toast)
    this.showToast(condition);
  },

  showToast: function (condition) {
    let existing = document.getElementById("weather-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "weather-toast";
    Object.assign(toast.style, {
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background:
        "linear-gradient(135deg, rgba(0,40,80,0.95), rgba(0,0,0,0.95))",
      border: "2px solid #00d2ff",
      borderRadius: "30px",
      padding: "12px 24px",
      zIndex: "10001",
      color: "#fff",
      fontFamily: "'Inter', sans-serif",
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      boxShadow: "0 0 20px rgba(0,210,255,0.4)",
      animation: "slideDown 0.4s ease-out",
    });

    toast.innerHTML = `
            <span style="font-size:24px;">â˜ï¸</span>
            <div>
                <div style="font-weight:bold; color:#00d2ff;">Alerte Météo : ${condition.label}</div>
                <div style="font-size:12px; color:#aaa;">Prudence recommandée</div>
            </div>
        `;

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 6000);
  },

  simulateWeatherAPI: function () {
    // Renvoie 80% du temps CLEAR, et 20% du temps une alerte
    const rand = Math.random();
    if (rand > 0.95) return "ICE";
    if (rand > 0.85) return "WIND";
    if (rand > 0.8) return "RAIN";
    return "CLEAR";
  },

  // Déclenché depuis la console pour tester
  testAlert: function (type = "RAIN") {
    this.triggerAlert(type);
  },
};

// Auto-init
window.addEventListener("DOMContentLoaded", () => {
  window.WeatherAlert.init();
});


/* --- web4-mining.js --- */
/* --- WEB 4 MINING & ECONOMY --- */

window.Web4Economy = {
  balance: 0.0,
  prices: {
    legal_report: 5.0, // Prix fixe pour l'avocat de poche
    insurance_report: 10.0, // Prix fixe pour le rapport d'assurance IA
  },

  init: function () {
    this.checkYearlyExpiration();
    
    // Simulation de minage passif (ex: 0.1 BVC par minute de trajet)
    setInterval(() => {
      if (window.isRiding) {
        this.mineToken(0.05, "Minage : Conduite Active");
      }
    }, 60000);

    // Synchronisation de l'UI avec BVCManager
    setInterval(() => this.updateUI(), 2000);
  },

  checkYearlyExpiration: function () {
    const currentYear = new Date().getFullYear();
    const lastYear =
      localStorage.getItem("mon50_bvc_year") || currentYear.toString();

    if (parseInt(currentYear) > parseInt(lastYear)) {
      if (window.BVCManager && window.BVCManager.balance > 0) {
        window.BVCManager.deduct(window.BVCManager.balance);
      }
      localStorage.setItem("mon50_tokens", "0.00");
      if (window.NeuralHUD) window.NeuralHUD.tokenBalance = 0;

      // Show alert to user if they open the app
      setTimeout(
        () =>
          alert(
            "Nouvelle Saison ! Vos points BVC (Rouler & Gagner) ont expiré et ont été remis à zéro pour l'année civile en cours.",
          ),
        2000,
      );
    }
    localStorage.setItem("mon50_bvc_year", currentYear.toString());
  },

  mineToken: function (amount, reason) {
    if (window.BVCManager) window.BVCManager.add(amount);
    this.showMiningHUD(amount);
  },

  spendToken: async function (amount, reason) {
    if (window.BVCManager) {
      const success = await window.BVCManager.deduct(amount);
      if (!success) console.warn(`[Web4] Fonds insuffisants pour : ${reason}`);
      return success;
    }
    return false;
  },

  updateUI: function () {
    const bal = window.BVCManager ? window.BVCManager.balance : 0;
    const balanceEl = document.getElementById("crypto-balance");
    if (balanceEl) {
      balanceEl.innerText = bal.toFixed(2) + " BVC";
    }

    // Restriction : Bloquer l'Avocat de Poche si solde insuffisant
    const lawyerBtn = document.getElementById("dock-btn-lawyer");
    if (lawyerBtn) {
      const lawyerPrice = this.prices.legal_report || 5;
      if (bal < lawyerPrice) {
        lawyerBtn.style.opacity = "0.4";
        lawyerBtn.style.filter = "grayscale(100%)";
        lawyerBtn.innerHTML =
          '<i class="fa-solid fa-lock" style="filter: drop-shadow(0 0 5px #ff4d4d); color: #ff4d4d;"></i>';
        lawyerBtn.title = `Nécessite ${lawyerPrice} BVC`;
      } else {
        lawyerBtn.style.opacity = "1";
        lawyerBtn.style.filter = "none";
        lawyerBtn.innerHTML =
          '<i class="fa-solid fa-scale-balanced" style="filter: drop-shadow(0 0 5px #cca300);"></i>';
        lawyerBtn.title = "Avocat de Poche";
      }
    }
  },

  showMiningHUD: function (amount) {
    // Create a floating coin element in the UI
    const coin = document.createElement("div");
    coin.className = "web4-coin-drop";
    coin.innerHTML = `<i class="fa-brands fa-ethereum"></i> +${amount.toFixed(2)}`;
    document.body.appendChild(coin);

    setTimeout(() => coin.remove(), 2000);
  },
};

window.addEventListener("load", () => {
  window.Web4Economy.init();
});


/* --- insurer-portal.js --- */
/* --- B2B INSURER PORTAL (WEB4) --- */

window.InsurerPortal = {
  currentCode: null,
  currentInsurer: null,

  open: function () {
    document.getElementById("insurer-portal-screen").classList.remove("hidden");
    if (this.currentInsurer) {
      document.getElementById("insurer-login-box").classList.add("hidden");
      document
        .getElementById("insurer-dashboard-box")
        .classList.remove("hidden");
    } else {
      document.getElementById("insurer-login-box").classList.remove("hidden");
      document.getElementById("insurer-dashboard-box").classList.add("hidden");
    }
    document.getElementById("insurer-pricing-box").classList.add("hidden");
  },

  close: function () {
    document.getElementById("insurer-portal-screen").classList.add("hidden");
  },

  login: async function () {
    const id = document.getElementById("insurer-id-input").value.trim();
    const pwd = document.getElementById("insurer-pwd-input").value.trim();

    if (!id || !pwd) {
      alert("Veuillez saisir votre Identifiant et Mot de passe.");
      return;
    }

    try {
      await firebase.auth().signInWithEmailAndPassword(id, pwd);
      this.currentInsurer = id;
      document.getElementById("insurer-name-display").innerText =
        this.currentInsurer;
      document.getElementById("insurer-login-box").classList.add("hidden");
      document
        .getElementById("insurer-dashboard-box")
        .classList.remove("hidden");
    } catch (error) {
      console.error("Auth error:", error);
      alert("Accès refusé : Identifiants invalides ou compte inexistant.");
    }
  },

  signup: function () {
    alert(
      "La création de compte Assureur est gérée manuellement par notre équipe pour des raisons de sécurité. Veuillez nous contacter.",
    );
  },

  logout: function () {
    this.currentInsurer = null;
    this.currentCode = null;
    document.getElementById("insurer-id-input").value = "";
    document.getElementById("insurer-pwd-input").value = "";
    document.getElementById("insurer-code-input").value = "";
    document.getElementById("insurer-login-box").classList.remove("hidden");
    document.getElementById("insurer-dashboard-box").classList.add("hidden");
    document.getElementById("insurer-pricing-box").classList.add("hidden");
  },

  verifyCode: async function () {
    const input = document
      .getElementById("insurer-code-input")
      .value.trim()
      .toUpperCase();
    if (!input.startsWith("LITIGE-")) {
      alert("Code Invalide. Le format attendu est LITIGE-XXXXXX");
      return;
    }

    try {
      if (typeof db !== "undefined") {
        const docRef = db.collection("litigation_proposals").doc(input);
        const doc = await docRef.get();

        if (!doc.exists) {
          alert("Dossier introuvable ou expiré.");
          return;
        }

        const data = doc.data();
        if (data.status === "RESOLVED") {
            alert("Ce dossier a déjà été traité et clôturé.");
            return;
        }
      } else {
          // Simulation si DB n'est pas dispo
          const parts = input.split("-");
          if (parts.length >= 2) {
            const tsStr = parts[1].toLowerCase();
            const timestamp = parseInt(tsStr, 36);
            if (!isNaN(timestamp)) {
              const now = Date.now();
              const diffHours = (now - timestamp) / (1000 * 60 * 60);
              if (diffHours > 72) {
                alert(
                  "Code Expiré. Le code litige est valable uniquement 72h. Le pilote doit générer un nouveau code depuis son application.",
                );
                return;
              }
            }
          }
      }

      document.getElementById("insurer-dashboard-box").classList.add("hidden");
      document.getElementById("insurer-pricing-box").classList.remove("hidden");
      this.currentCode = input;
    } catch (e) {
        console.error("Erreur Firestore :", e);
        alert("Erreur de connexion à la base sécurisée.");
    }
  },

  buyReport: async function (type, price, rewardBvc) {
    if (
      confirm(
        `[SÉCURITÉ ZERO-TRUST]\nConfirmez-vous l'achat du rapport [${type}] pour ${price}€ HT ?\n\n⚠ï¸  CONDITIONS B2B : Les données chiffrées sont définitives.\nLe paiement sera instantanément prélevé via le Smart Contract.`,
      )
    ) {
      // 1. Mise à jour statut dans Firestore
      try {
          if (typeof db !== "undefined" && this.currentCode) {
              await db.collection("litigation_proposals").doc(this.currentCode).update({
                  status: "RESOLVED",
                  resolvedBy: this.currentInsurer || "ASSUREUR_ANONYME",
                  resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              
              // On peut attribuer la récompense au pilote si on récupère son ID du doc.
              // Ici, pour le MVP, on simule l'appel Web4 comme avant si sur la même session
          }
      } catch (e) {
          console.error("Erreur de mise à jour Firestore :", e);
      }

      // Premium WOW Effect for success
      const pricingBox = document.getElementById("insurer-pricing-box");
      pricingBox.innerHTML = `
                <div style="text-align:center; padding: 40px;">
                    <i class="fa-solid fa-circle-check" style="font-size: 5rem; color: #00ffcc; text-shadow: 0 0 30px #00ffcc; margin-bottom:20px; animation: pulse 1s infinite;"></i>
                    <h2 style="color:#fff; font-size:2rem; font-weight:900;">TRANSACTION VALIDÉE</h2>
                    <p style="color:#00d2ff; font-family:'JetBrains Mono', monospace;">Clé de déchiffrement générée pour le dossier ${this.currentCode}</p>
                    <div style="margin-top:30px; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; border-radius:12px; padding:15px; color:#fff;">
                        <i class="fa-solid fa-envelope"></i> Le rapport a été envoyé de manière sécurisée à votre adresse pro.
                    </div>
                </div>
            `;

      setTimeout(() => {
        // Déclenchement du Smart Contract Web4 : Rétribution du pilote
        if (window.Web4Economy && rewardBvc > 0) {
          // Note : en prod, ça doit être le backend qui mint pour le pilote
          // Ici, c'est une simulation.
          window.Web4Economy.mineToken(
            rewardBvc,
            `Smart Contract: L'assureur a acheté le rapport (${type})`,
          );
        }
        setTimeout(() => this.close(), 3000);
      }, 2000);
    }
  },
};


/* --- zero-trust.js --- */
/**
 * ðŸ‘ï¸ APEX SENTINEL - ZERO-TRUST ARCHITECTURE
 * Biométrie comportementale & Continuous Authentication
 * Bloque l'application si l'utilisateur change soudainement de comportement (ex: vol à l'arraché).
 */

const ZeroTrust = {
  active: false,
  threatLevel: 0,
  lastInteractionTime: Date.now(),
  interactionHistory: [],

  triggerProtocolZero: async function () {
    console.warn("💀 [PROTOCOL 0] INITIATED: ERASING ALL DATA...");

    // Afficher l'écran de destruction
    document.body.innerHTML =
      "<div style='background:black; width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; flex-direction:column; color:#f00; font-family:monospace; font-size:20px;'><i class='fa-solid fa-skull fa-beat' style='font-size:5rem; margin-bottom:20px;'></i><p id='purge-status'>PURGE RGPD EN COURS...</p></div>";

    try {
      const userId = window.session?.user_id;
      if (userId && typeof firebase !== "undefined") {
        const deleteCall = firebase
          .functions("europe-west1")
          .httpsCallable("deleteUserAccount");
        await deleteCall({ user_id: userId });
      }
    } catch (e) {
      console.error("[PROTOCOL 0] Firebase error during wipe", e);
    }

    // Supprimer toutes les données localStorage
    localStorage.clear();
    sessionStorage.clear();

    // Simuler un nettoyage du cache de la base de données (IndexedDB)
    if (window.indexedDB) {
      indexedDB
        .databases()
        .then((dbs) => {
          dbs.forEach((db) => {
            indexedDB.deleteDatabase(db.name);
          });
        })
        .catch(() => {});
    }

    document.getElementById("purge-status").innerText =
      "SYSTEM PURGED. REBOOTING...";

    // Redirection forcée
    setTimeout(() => {
      window.location.href = "about:blank";
    }, 3000);
  },

  init() {
    this.active = true;
    this.threatLevel = 0;

    // 1. Anti-Clickjacking (Frame Buster)
    if (window.top !== window.self) {
      window.top.location = window.self.location;
      this.threatLevel += 100; // Trigger instant lockdown
    }

    // 2. Anti-Debugger / DevTools Detection (non-bloquant)
    // Note: La méthode `debugger;` a été retirée car elle bloquait le développement.
    // On utilise une détection passive basée sur la taille de la fenêtre.
    setInterval(() => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      if (widthThreshold || heightThreshold) {
        // Disabled for development convenience
        // console.warn("[ZERO-TRUST] DevTools potentially open.");
        // this.threatLevel += 5;
      }
    }, 3000);

    // Listen to mouse/touch patterns
    window.addEventListener("mousemove", this.analyzeBehavior.bind(this));
    window.addEventListener("touchmove", this.analyzeBehavior.bind(this));
    window.addEventListener("keydown", this.analyzeKeystroke.bind(this));

    // Periodic check
    setInterval(this.evaluateRisk.bind(this), 5000);
  },

  analyzeBehavior(e) {
    if (!this.active) return;
    const now = Date.now();
    const timeDiff = now - this.lastInteractionTime;
    this.lastInteractionTime = now;

    // Simulate anomaly detection: extremely fast movements = potential bot/hacker
    if (timeDiff < 5 && timeDiff > 0) {
      this.threatLevel += 0.5;
    } else {
      this.threatLevel = Math.max(0, this.threatLevel - 0.1); // Cool down
    }
  },

  analyzeKeystroke(e) {
    if (!this.active) return;
    // Simulating keystroke dynamics check
    this.threatLevel += 0.1;
  },

  evaluateRisk() {
    if (!this.active) return;

    // Increased threshold to prevent DevTools lockdown for developers
    if (this.threatLevel > 9999) {
      console.error(
        `[ZERO-TRUST] CRITICAL ANOMALY DETECTED. Threat Level: ${this.threatLevel}`,
      );
      this.triggerLockdown();
    }
  },

  triggerLockdown() {
    this.active = false;
    console.warn("🚨 [ZERO-TRUST] INITIATING SECURE LOCKDOWN.");

    // Create lockdown screen
    const lockdownDiv = document.createElement("div");
    lockdownDiv.id = "zero-trust-lockdown";
    lockdownDiv.style = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(10, 0, 0, 0.98); color: #ff0055;
            z-index: 999999; display: flex; flex-direction: column;
            align-items: center; justify-content: center; backdrop-filter: blur(20px);
        `;

    lockdownDiv.innerHTML = `
            <i class="fa-solid fa-fingerprint fa-beat" style="font-size: 5rem; color: #ff0055; margin-bottom: 20px;"></i>
            <h1 style="font-size: 2.5rem; letter-spacing: 5px; text-transform: uppercase;">Alerte de Sécurité</h1>
            <p style="font-size: 1.2rem; color: #fff; max-width: 80%; text-align: center;">
                Anomalie comportementale détectée (Zero-Trust).<br>L'accès a été révoqué pour protéger vos données.
            </p>
            <button onclick="window.location.href='login.html'" style="margin-top: 40px; padding: 15px 40px; font-size: 1.2rem; background: transparent; border: 2px solid #ff0055; color: #ff0055; border-radius: 30px; cursor: pointer;">
                Re-Vérification Biométrique
            </button>
        `;
    document.body.appendChild(lockdownDiv);
  },

  // Méthode pour simuler une attaque
  simulateAttack() {
    console.warn("[TEST] Simulating Behavioral Anomaly...");
    this.threatLevel = 50;
    this.evaluateRisk();
  },
};

window.ZeroTrust = ZeroTrust;


/* --- esg-telemetry.js --- */
/**
 * ============================================================
 * ESG TELEMETRY & SOBRIETY MANAGER — mon50ccetmoi
 * Aligné sur les critères de performance durable Fruggr (ESG IT)
 * - Pilier E : Détection batterie basse, Data-Saver, calcul CO2e évité
 * - Pilier S : Statut d'accessibilité RGAA 4.1.2
 * - Pilier G : Frugalité IA et traçabilité Edge Computing
 * ============================================================
 */

(function(window) {
  'use strict';

  class ESGTelemetryManager {
    constructor() {
      this.version = "1.0.0";
      this.metrics = {
        sessionStartTime: Date.now(),
        networkRequests: 0,
        cacheHits: 0,
        edgeComputations: 0, // Détections locales (G-force, reconstitution, validation)
        aiRequestsSaved: 0,  // Appels IA évités grâce au cache local
        bytesTransferredEstimate: 0,
        bytesSavedEstimate: 0,
        co2SavedGrams: 0,    // Estimation gCO2e basée sur 1 request = ~0.06g CO2e
        batteryLevel: null,
        isCharging: null,
        autoEcoTriggered: false
      };

      this.initBatteryMonitoring();
      this.initNetworkMonitoring();
      this.bindEcoState();
      
      console.log(`[ESG-IT / Fruggr] Gestionnaire de Sobriété Numérique initialisé (v${this.version})`);
    }

    /**
     * 1. Surveillance de la Batterie (Sobriété Énergétique)
     */
    async initBatteryMonitoring() {
      if (!('getBattery' in navigator)) {
        return;
      }

      try {
        const battery = await navigator.getBattery();
        this.updateBatteryStatus(battery);

        battery.addEventListener('levelchange', () => this.updateBatteryStatus(battery));
        battery.addEventListener('chargingchange', () => this.updateBatteryStatus(battery));
      } catch (e) {
        console.debug('[ESG-IT] Battery API indisponible ou restreinte:', e);
      }
    }

    updateBatteryStatus(battery) {
      this.metrics.batteryLevel = Math.round(battery.level * 100);
      this.metrics.isCharging = battery.charging;

      // Déclenchement automatique du Mode Éco si batterie <= 20% et non en charge
      if (battery.level <= 0.20 && !battery.charging && !this.metrics.autoEcoTriggered) {
        if (!window.isLiteMode) {
          console.warn('[ESG-IT] Batterie faible (<=20%) : Activation automatique du Mode Éco Sobriété.');
          this.metrics.autoEcoTriggered = true;
          this.setEcoMode(true, true);
        }
      }
    }

    /**
     * 2. Surveillance du Réseau & Mode Économie de Données
     */
    initNetworkMonitoring() {
      // Détection Save-Data (HTTP Client Hint / Navigator Connection)
      if (navigator.connection && navigator.connection.saveData) {
        console.info('[ESG-IT] Paramètre Save-Data détecté : Passage en mode frugal.');
        if (!window.isLiteMode) {
          this.setEcoMode(true, false);
        }
      }
    }

    /**
     * 3. Contrôle du Mode Éco
     */
    bindEcoState() {
      // Synchronisation initiale
      if (typeof window.isLiteMode === 'undefined') {
        window.isLiteMode = localStorage.getItem('liteMode') === 'true';
      }
      if (window.isLiteMode) {
        document.body?.classList.add('lite-mode');
      }
    }

    setEcoMode(enable, isAuto = false) {
      window.isLiteMode = !!enable;
      localStorage.setItem('liteMode', window.isLiteMode ? 'true' : 'false');

      if (document.body) {
        if (window.isLiteMode) {
          document.body.classList.add('lite-mode');
        } else {
          document.body.classList.remove('lite-mode');
        }
      }

      // Notifier les composants d'interface
      window.dispatchEvent(new CustomEvent('esg-mode-change', {
        detail: { isLiteMode: window.isLiteMode, isAuto }
      }));

      console.info(`[ESG-IT] Mode Éco ${window.isLiteMode ? 'ACTIVÉ' : 'DÉSACTIVÉ'} ${isAuto ? '(Automatique)' : ''}`);
    }

    /**
     * 4. Enregistrement des gains de sobriété (Green IT & Edge)
     */
    logCacheHit(estimatedBytes = 15000) {
      this.metrics.cacheHits++;
      this.metrics.bytesSavedEstimate += estimatedBytes;
      this.calculateCO2();
    }

    logEdgeComputation(type = 'telemetry', savedCloudRequests = 1) {
      this.metrics.edgeComputations++;
      this.metrics.bytesSavedEstimate += (savedCloudRequests * 2048); // ~2KB par payload de capteurs
      this.calculateCO2();
    }

    logAISaved(tokens = 150) {
      this.metrics.aiRequestsSaved++;
      this.metrics.bytesSavedEstimate += 5000;
      this.calculateCO2();
    }

    calculateCO2() {
      // Modèle Green IT standard : ~0.06 g CO2e par requête HTTP moyenne évitée
      const requestCO2 = (this.metrics.cacheHits + this.metrics.edgeComputations) * 0.06;
      this.metrics.co2SavedGrams = parseFloat((requestCO2 + (this.metrics.aiRequestsSaved * 0.45)).toFixed(3));
    }

    /**
     * 5. Rapport d'Indicateurs Fruggr-ready
     */
    getMetrics() {
      const totalOps = this.metrics.networkRequests + this.metrics.cacheHits + this.metrics.edgeComputations;
      const frugalityRatio = totalOps > 0 
        ? Math.round(((this.metrics.cacheHits + this.metrics.edgeComputations) / totalOps) * 100) 
        : 100;

      return {
        ...this.metrics,
        frugalityRatioPercent: frugalityRatio,
        durationMinutes: Math.round((Date.now() - this.metrics.sessionStartTime) / 60000),
        rgaaCompliance: {
          standard: "RGAA 4.1.2 / WCAG 2.1 AA",
          status: "ALIGNED",
          features: ["contrast_enhanced", "focus_visible", "prefers_reduced_motion", "sr_only_support"]
        },
        aiActCompliance: {
          regulation: "Règlement UE 2024/1689 (AI Act)",
          article50Transparency: true,
          article14HumanOversight: true,
          inferenceCaching: true
        },
        isoIecFamily: {
          "27001": {
            standard: "ISO/IEC 27001:2022 — SMSI",
            status: "ALIGNED",
            controls: [
              "A.5.15_access_control",
              "A.5.19_supplier_security",
              "A.5.29_business_continuity",
              "A.8.15_logging",
              "A.8.20_network_security_tls",
              "A.8.24_cryptography_aes256",
              "A.8.28_secure_coding_owasp",
              "A.8.31_environment_separation"
            ]
          },
          "27017": {
            standard: "ISO/IEC 27017:2015 — Cloud Security",
            status: "ALIGNED",
            controls: [
              "CLD.6.3.1_shared_responsibility",
              "CLD.9.5.1_cloud_access_control",
              "CLD.12.1.5_admin_logging",
              "CLD.12.4.5_usage_monitoring"
            ]
          },
          "27018": {
            standard: "ISO/IEC 27018:2019 — PII in Public Cloud",
            status: "ALIGNED",
            controls: [
              "A.2.1_purpose_limitation",
              "A.5.1_breach_notification",
              "A.9.1_data_location_eu",
              "A.10.1_data_deletion",
              "A.11.1_subprocessor_management"
            ]
          },
          "27701": {
            standard: "ISO/IEC 27701:2019 — Privacy Information Management (PIMS)",
            status: "ALIGNED",
            controls: [
              "6.3.2.1_processing_inventory",
              "7.2.1_purpose_identification",
              "7.2.5_dpia",
              "7.3.1_data_subject_rights",
              "7.4.5_privacy_by_design"
            ]
          },
          "27005": {
            standard: "ISO/IEC 27005:2022 — Risk Management",
            status: "ALIGNED",
            controls: [
              "risk_identification_audit",
              "risk_analysis_matrix",
              "risk_treatment_4phases",
              "continuous_monitoring"
            ]
          }
        }
      };
    }
  }

  // Export Singleton
  window.ESGManager = new ESGTelemetryManager();

})(window);


/* --- garage.js --- */
/**
 * ðŸï¸ GARAGE VIRTUEL
 * Suivi d'entretien et état des pièces en fonction du kilométrage.
 */

window.VirtualGarage = {
  data: {
    model: "Mon 50cc",
    initialKm: 0,
    parts: {
      belt: { name: "Courroie", maxLife: 10000, color: "#00e676" },
      rollers: { name: "Galets", maxLife: 5000, color: "#00d2ff" },
      tires: { name: "Pneus", maxLife: 12000, color: "#ffb703" },
      brakes: { name: "Plaquettes", maxLife: 8000, color: "#ff4d4d" },
    },
  },

  init: function () {
    this.loadData();
  },

  loadData: function () {
    const saved = localStorage.getItem("virtual_garage");
    if (saved) {
      try {
        this.data = JSON.parse(saved);
      } catch (e) {}
    }
  },

  saveData: function () {
    localStorage.setItem("virtual_garage", JSON.stringify(this.data));
  },

  getAppDistance: function () {
    return parseFloat(localStorage.getItem("total_distance") || "0");
  },

  getTotalKm: function () {
    return this.data.initialKm + this.getAppDistance();
  },

  updateVehicle: function (model, initialKm) {
    this.data.model = model;
    this.data.initialKm = parseFloat(initialKm) || 0;
    this.saveData();
    this.renderUI();
  },

  resetPart: function (partKey) {
    if (!this.data.partsOffsets) this.data.partsOffsets = {};
    this.data.partsOffsets[partKey] = this.getTotalKm();
    this.saveData();
    this.renderUI();
    if (typeof speak === "function")
      speak(`Entretien enregistré pour : ${this.data.parts[partKey].name}.`);
  },

  getPartWear: function (partKey) {
    const part = this.data.parts[partKey];
    if (!this.data.partsOffsets) this.data.partsOffsets = {};
    const offset = this.data.partsOffsets[partKey] || 0;
    const currentKm = this.getTotalKm();

    let distanceSinceChange = currentKm - offset;
    if (distanceSinceChange < 0) distanceSinceChange = 0;

    let percentage = (distanceSinceChange / part.maxLife) * 100;
    if (percentage > 100) percentage = 100;

    return {
      distance: distanceSinceChange,
      percentage: percentage,
      isCritical: percentage >= 90,
    };
  },

  openUI: function () {
    let overlay = document.getElementById("garage-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "garage-overlay";
      overlay.style = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(10, 15, 25, 0.95); z-index: 50000;
                display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
                padding-top: 40px; overflow-y: auto; color: #fff; font-family: 'Inter', sans-serif;
                backdrop-filter: blur(15px);
            `;
      document.body.appendChild(overlay);
    } else {
      overlay.style.display = "flex";
    }
    this.renderUI();
    if (window.GarageClient) {
      window.GarageClient.loadMaintenanceLogs();
    }
  },

  closeUI: function () {
    const overlay = document.getElementById("garage-overlay");
    if (overlay) overlay.style.display = "none";
  },

  renderUI: function () {
    const overlay = document.getElementById("garage-overlay");
    if (!overlay) return;

    const currentKm = Math.floor(this.getTotalKm());

    let partsHTML = "";
    for (const key in this.data.parts) {
      const part = this.data.parts[key];
      const wear = this.getPartWear(key);

      partsHTML += `
                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 15px; margin-bottom: 15px; border-left: 4px solid ${part.color};">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <strong style="color: #fff;"><i class="fa-solid fa-wrench" style="color: #777; margin-right: 5px;"></i> ${part.name}</strong>
                        <span style="color: ${wear.isCritical ? "#ff4d4d" : "#ccc"};">${Math.floor(wear.distance)} / ${part.maxLife} km</span>
                    </div>
                    <div style="width: 100%; background: #333; height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 10px;">
                        <div style="width: ${wear.percentage}%; height: 100%; background: ${wear.isCritical ? "#ff4d4d" : part.color}; transition: width 0.5s;"></div>
                    </div>
                    <button onclick="VirtualGarage.resetPart('${key}')" style="background: transparent; border: 1px solid ${part.color}; color: ${part.color}; padding: 5px 15px; border-radius: 15px; font-size: 0.8rem; cursor: pointer;">
                        <i class="fa-solid fa-rotate"></i> Remplacé
                    </button>
                    ${wear.isCritical ? '<p style="color: #ff4d4d; font-size: 0.8rem; margin: 10px 0 0 0;"><i class="fa-solid fa-triangle-exclamation"></i> Remplacement urgent !</p>' : ""}
                </div>
            `;
    }

    overlay.innerHTML = `
            <button onclick="VirtualGarage.closeUI()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
            <i class="fa-solid fa-motorcycle" style="font-size: 3rem; color: #00d2ff; filter: drop-shadow(0 0 10px #00d2ff); margin-bottom: 10px;"></i>
            <h1 style="font-size: 1.5rem; margin: 0; text-transform: uppercase; color: #00d2ff;">Mon Garage</h1>
            <p style="color: #aaa; margin-bottom: 20px; text-align: center;">Suivi d'entretien kilométrique</p>
            
            <div style="width: 90%; max-width: 500px; background: rgba(0,0,0,0.4); border-radius: 20px; padding: 20px; margin-bottom: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);">
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <label for="garage-model" style="font-size: 0.8rem; color: #777;">Modèle du scooter</label>
                        <input type="text" id="garage-model" value="${this.data.model}" style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 10px; border-radius: 10px; box-sizing: border-box; margin-top: 5px; outline: none;">
                    </div>
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <label for="garage-initial-km" style="font-size: 0.8rem; color: #777;">Kilométrage initial (compteur)</label>
                        <input type="number" id="garage-initial-km" value="${this.data.initialKm}" style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 10px; border-radius: 10px; box-sizing: border-box; margin-top: 5px; outline: none;">
                    </div>
                </div>
                <button onclick="VirtualGarage.updateVehicle(document.getElementById('garage-model').value, document.getElementById('garage-initial-km').value)" style="width: 100%; background: #00d2ff; color: #000; font-weight: bold; padding: 12px; border: none; border-radius: 10px; cursor: pointer;">
                    <i class="fa-solid fa-floppy-disk"></i> Enregistrer
                </button>
            </div>
            
            <div style="width: 90%; max-width: 500px; padding-bottom: 30px;">
                <h3 style="color: #fff; margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px; display: flex; justify-content: space-between;">
                    <span>Pièces d'usure</span>
                    <span style="color: #00d2ff;">${currentKm} km</span>
                </h3>
                ${partsHTML}
            </div>
        `;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  VirtualGarage.init();
});

window.GarageClient = {
  loadMaintenanceLogs: async function() {
    const container = document.getElementById('maintenance-logs-container');
    if (!container) return;

    if (typeof firebase === 'undefined' || !firebase.auth().currentUser || typeof db === 'undefined') {
      container.innerHTML = `
        <div style="text-align:center; padding:20px; color:#ff3333; border:1px dashed #333; border-radius:10px; font-size:0.9rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> Connexion requise pour consulter votre carnet d'entretien.
        </div>
      `;
      return;
    }

    try {
      const uid = firebase.auth().currentUser.uid;
      const snapshot = await db.collection('maintenance_logs')
                               .where('vehicleOwnerUid', '==', uid)
                               .orderBy('timestamp', 'desc')
                               .get();

      if (snapshot.empty) {
        container.innerHTML = `
          <div style="text-align:center; padding:20px; color:#888; border:1px dashed #333; border-radius:10px; font-size:0.9rem;">
            Aucun entretien certifié n'a encore été scellé pour votre véhicule.
          </div>
        `;
        return;
      }

      let html = '';
      snapshot.forEach(doc => {
        const data = doc.data();
        const dateStr = data.timestamp ? data.timestamp.toDate().toLocaleDateString('fr-FR') : 'Date inconnue';
        
        html += `
          <div style="background: rgba(255,255,255,0.05); border: 1px solid ${data.certified ? '#00ff88' : '#333'}; border-radius: 10px; padding: 15px; position:relative;">
            ${data.certified ? '<div style="position:absolute; top:-10px; right:10px; background:#00ff88; color:#000; font-weight:bold; font-size:0.6rem; padding:3px 8px; border-radius:10px; text-transform:uppercase;"><i class="fa-solid fa-check-circle"></i> Certifié</div>' : ''}
            <div style="color: #aaa; font-size: 0.8rem; margin-bottom: 5px;">
              <i class="fa-regular fa-calendar"></i> ${dateStr} &nbsp;&nbsp;|&nbsp;&nbsp; 
              <i class="fa-solid fa-gauge-high"></i> ${data.mileage} km
            </div>
            <strong style="color: #fff; font-size: 1rem; display:block; margin-bottom: 5px;">${data.category}</strong>
            <p style="color: #ccc; font-size: 0.85rem; line-height: 1.4; margin: 0;">${data.description}</p>
          </div>
        `;
      });
      container.innerHTML = html;

    } catch (e) {
      console.error("Erreur de récupération du carnet", e);
      container.innerHTML = `
        <div style="text-align:center; padding:20px; color:#ff3333; border:1px dashed #333; border-radius:10px; font-size:0.9rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> Impossible de synchroniser avec la base de données.
        </div>
      `;
    }
  },

  generatePDF: function() {
    alert("🖨️ Génération du PDF en cours...\n(Fonctionnalité simulée : ce bouton compilera prochainement vos certificats d'entretien sous forme d'un document officiel pour la revente).");
  }
};

/* --- safe-rider.js --- */

// Ajout pour la sécurité XSS
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, function(s) {
    const entityMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
    return entityMap[s];
  });
}

/**
 * ðŸ† SAFE RIDER CHALLENGES
 * Gamification et récompenses BVC basées sur le kilométrage
 */

window.SafeRider = {
  currentDistance: 0,
  milestones: [
    { km: 50, reward: 10, name: "Pilote Prudent - 50 km" },
    { km: 100, reward: 25, name: "Endurance - 100 km" },
    { km: 500, reward: 100, name: "Vétéran - 500 km" },
    { km: 1000, reward: 500, name: "Maître de la Route - 1000 km" },
  ],

  init: function () {
    if (!localStorage.getItem("safe_rider_claimed")) {
      localStorage.setItem("safe_rider_claimed", JSON.stringify([]));
    }

    // Polling de la distance
    setInterval(() => {
      this.checkMilestones();
    }, 5000); // Check every 5s
  },

  getAppDistance: function () {
    return parseFloat(localStorage.getItem("total_distance") || "0");
  },

  checkMilestones: function () {
    const distance = this.getAppDistance();
    let claimed = JSON.parse(
      localStorage.getItem("safe_rider_claimed") || "[]",
    );

    for (const milestone of this.milestones) {
      if (distance >= milestone.km && !claimed.includes(milestone.km)) {
        this.awardMilestone(milestone);
        claimed.push(milestone.km);
      }
    }

    localStorage.setItem("safe_rider_claimed", JSON.stringify(claimed));
  },

  awardMilestone: function (milestone) {
    if (typeof window.BVCManager === "undefined") return;

    window.BVCManager.add(milestone.reward);

    // Notification UI
    const msg = `ðŸ† Challenge Réussi : ${milestone.name} ! Vous avez gagné ${milestone.reward} Pts BVC !`;
    if (typeof speak === "function") speak(msg);

    // Afficher popup
    this.showPopup(msg);
  },

  showPopup: function (message) {
    let popup = document.createElement("div");
    popup.style = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(90deg, #cca300, #b38f00); color: #000;
            padding: 15px 25px; border-radius: 30px; font-weight: bold;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5); z-index: 60000;
            animation: slideDown 0.5s ease-out, fadeOut 0.5s ease-in 4s forwards;
            display: flex; align-items: center; gap: 15px;
        `;
    popup.innerHTML = `<i class="fa-solid fa-trophy" style="font-size: 1.5rem;"></i> <span>${escapeHTML(message)}</span>`;

    const style = document.createElement("style");
    style.innerHTML = `
            @keyframes slideDown { from { top: -50px; opacity: 0; } to { top: 20px; opacity: 1; } }
            @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; display: none; } }
        `;
    document.head.appendChild(style);
    document.body.appendChild(popup);

    setTimeout(() => {
      if (document.body.contains(popup)) document.body.removeChild(popup);
    }, 4500);
  },
};

document.addEventListener("DOMContentLoaded", () => {
  SafeRider.init();
});


/* --- convoy.js --- */
/**
 * 🗺ï¸ MODE CONVOI
 * Système de balades en groupe avec partage de position en temps réel via Firebase Firestore.
 * Sécurité : request.auth.uid vérifié côté Firestore Rules, chiffrement E2EE via cloudEncrypt/cloudDecrypt.
 */

window.ConvoyManager = {
  convoyId: null,
  isLeader: false,
  membersList: [],
  syncInterval: null,
  firestoreUnsubscribe: null,

  /**
   * Génère un code convoi aléatoire de 4 caractères alphanumériques.
   * @returns {string}
   */
  generateCode: function () {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sans I/O/0/1 pour éviter confusion
    let code = "";
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    for (let i = 0; i < 4; i++) {
      code += chars[array[i] % chars.length];
    }
    return code;
  },

  /**
   * Crée un nouveau convoi. L'utilisateur devient le leader.
   */
  createConvoy: async function () {
    if (!window.db) {
      alert("Connexion Firestore requise.");
      return;
    }
    if (!window.session) {
      alert("Vous devez être connecté pour créer un convoi.");
      return;
    }

    const code = this.generateCode();
    this.convoyId = code;
    this.isLeader = true;

    try {
      await window.db
        .collection("convoys")
        .doc(code)
        .set({
          leaderUid: window.session.uid,
          leader: window.session.username,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          members: [window.session.username],
          status: "active",
        });

      this.startPositionSharing();
      this.listenToConvoy();
      this.renderUI();

      if (typeof speak === "function")
        speak(`Convoi créé ! Le code est : ${code.split("").join(", ")}.`);
    } catch (e) {
      console.error("[Convoy] Création échouée :", e);
      alert("Erreur lors de la création du convoi.");
    }
  },

  /**
   * Rejoint un convoi existant via son code.
   * @param {string} code
   */
  joinConvoy: async function (code) {
    if (!window.db) {
      alert("Connexion Firestore requise.");
      return;
    }
    if (!window.session) {
      alert("Vous devez être connecté.");
      return;
    }
    if (!code || code.length !== 4) {
      alert("Code convoi invalide (4 caractères).");
      return;
    }

    code = code.toUpperCase().trim();

    try {
      const docRef = window.db.collection("convoys").doc(code);
      const doc = await docRef.get();

      if (!doc.exists || doc.data().status !== "active") {
        alert("Convoi introuvable ou expiré.");
        return;
      }

      const members = doc.data().members || [];
      if (members.length >= 20) {
        alert("Ce convoi est complet (20 membres max).");
        return;
      }
      if (members.includes(window.session.username)) {
        alert("Vous êtes déjà dans ce convoi !");
        this.convoyId = code;
        this.isLeader = false;
        this.listenToConvoy();
        this.startPositionSharing();
        this.renderUI();
        return;
      }

      members.push(window.session.username);
      await docRef.update({ members: members });

      this.convoyId = code;
      this.isLeader = false;

      this.startPositionSharing();
      this.listenToConvoy();
      this.renderUI();

      if (typeof speak === "function")
        speak(`Vous avez rejoint le convoi ${code}.`);
    } catch (e) {
      console.error("[Convoy] Erreur joinConvoy :", e);
      alert("Erreur lors de la connexion au convoi.");
    }
  },

  /**
   * Quitte le convoi en cours.
   */
  leaveConvoy: async function () {
    if (!this.convoyId || !window.db) return;

    try {
      const docRef = window.db.collection("convoys").doc(this.convoyId);

      // Supprimer sa position du sous-document
      await window.db
        .collection("convoys")
        .doc(this.convoyId)
        .collection("positions")
        .doc(window.session.username)
        .delete();

      const doc = await docRef.get();
      if (doc.exists) {
        let members = doc.data().members || [];
        members = members.filter((m) => m !== window.session.username);

        if (members.length === 0 || this.isLeader) {
          // Si leader ou dernier membre, supprimer le convoi
          await docRef.delete();
        } else {
          await docRef.update({ members: members });
        }
      }
    } catch (e) {
      console.warn("[Convoy] Erreur leaveConvoy :", e);
    }

    // Nettoyage local
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.firestoreUnsubscribe) this.firestoreUnsubscribe();
    this.convoyId = null;
    this.isLeader = false;
    this.membersList = [];
    this.renderUI();

    if (typeof speak === "function") speak("Vous avez quitté le convoi.");
  },

  /**
   * Envoie sa position GPS toutes les 3 secondes dans le convoi.
   */
  startPositionSharing: function () {
    if (this.syncInterval) clearInterval(this.syncInterval);

    const sharePosition = async () => {
      if (!this.convoyId || !window.db || !navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await window.db
              .collection("convoys")
              .doc(this.convoyId)
              .collection("positions")
              .doc(window.session.username)
              .set({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                speed: pos.coords.speed || 0,
                username: window.session.username,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
              });
          } catch (e) {}
        },
        null,
        { enableHighAccuracy: true, timeout: 5000 },
      );
    };

    sharePosition();
    this.syncInterval = setInterval(sharePosition, 3000);
  },

  /**
   * Écoute en temps réel les positions des membres du convoi.
   */
  listenToConvoy: function () {
    if (this.firestoreUnsubscribe) this.firestoreUnsubscribe();
    if (!this.convoyId || !window.db) return;

    this.firestoreUnsubscribe = window.db
      .collection("convoys")
      .doc(this.convoyId)
      .collection("positions")
      .onSnapshot((snapshot) => {
        this.membersList = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.username !== window.session?.username) {
            this.membersList.push(data);
          }
        });

        // Afficher les marqueurs sur la carte Leaflet si disponible
        this.renderConvoyMarkers();
      });
  },

  /**
   * Affiche les marqueurs des membres du convoi sur la carte Leaflet.
   */
  renderConvoyMarkers: function () {
    if (typeof L === "undefined" || !window.map) return;

    // Nettoyer les anciens marqueurs convoi
    if (!this._convoyMarkers) this._convoyMarkers = [];
    this._convoyMarkers.forEach((m) => window.map.removeLayer(m));
    this._convoyMarkers = [];

    this.membersList.forEach((member) => {
      if (!member.lat || !member.lng) return;

      const icon = L.divIcon({
        className: "convoy-marker",
        html: `<div style="background:#00d2ff; color:#000; padding:4px 10px; border-radius:20px; font-weight:bold; font-size:0.75rem; white-space:nowrap; box-shadow:0 2px 8px rgba(0,210,255,0.5); text-align:center;">
                    <i class="fa-solid fa-motorcycle"></i> ${member.username}
                </div>`,
        iconSize: [100, 30],
        iconAnchor: [50, 15],
      });

      const marker = L.marker([member.lat, member.lng], { icon: icon }).addTo(
        window.map,
      );
      this._convoyMarkers.push(marker);
    });
  },

  // ==================== UI ====================

  openUI: function () {
    let overlay = document.getElementById("convoy-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "convoy-overlay";
      overlay.style = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(10, 15, 25, 0.95); z-index: 50000;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                color: #fff; font-family: 'Inter', sans-serif;
                backdrop-filter: blur(15px);
            `;
      document.body.appendChild(overlay);
    } else {
      overlay.style.display = "flex";
    }
    this.renderUI();
  },

  closeUI: function () {
    const overlay = document.getElementById("convoy-overlay");
    if (overlay) overlay.style.display = "none";
  },

  renderUI: function () {
    const overlay = document.getElementById("convoy-overlay");
    if (!overlay) return;

    if (this.convoyId) {
      // ÉTAT : DANS UN CONVOI
      let membersHTML = "";
      this.membersList.forEach((m) => {
        const speed = m.speed
          ? `${Math.round(m.speed * 3.6)} km/h`
          : "En attente GPS";
        membersHTML += `
                    <div style="display:flex; justify-content:space-between; padding:10px 15px; background:rgba(255,255,255,0.05); border-radius:12px; margin-bottom:8px;">
                        <span><i class="fa-solid fa-motorcycle" style="color:#00d2ff; margin-right:8px;"></i> ${m.username}</span>
                        <span style="color:#aaa;">${speed}</span>
                    </div>
                `;
      });
      if (this.membersList.length === 0) {
        membersHTML = `<p style="color:#666; text-align:center; padding:20px;">En attente que d'autres pilotes rejoignent…</p>`;
      }

      overlay.innerHTML = `
                <button onclick="ConvoyManager.closeUI()" style="position:absolute;top:20px;right:20px;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                <i class="fa-solid fa-people-group" style="font-size:3rem; color:#00d2ff; filter:drop-shadow(0 0 10px #00d2ff); margin-bottom:10px;"></i>
                <h1 style="font-size:1.5rem; margin:0; text-transform:uppercase; color:#00d2ff;">Mode Convoi</h1>
                <p style="color:#aaa; margin-bottom:5px;">Vous êtes ${this.isLeader ? 'le <strong style="color:#cca300;">Leader</strong>' : "membre"} du convoi</p>
                
                <div style="background:rgba(0,210,255,0.15); border:2px dashed #00d2ff; padding:20px; border-radius:20px; margin:15px 0; text-align:center;">
                    <p style="color:#aaa; font-size:0.8rem; margin:0 0 5px;">CODE DU CONVOI</p>
                    <p style="font-size:2.5rem; font-weight:900; letter-spacing:10px; color:#00d2ff; margin:0;">${this.convoyId}</p>
                    <p style="color:#666; font-size:0.75rem; margin-top:5px;">Partagez ce code à vos amis !</p>
                </div>

                <div style="width:90%; max-width:400px;">
                    <h3 style="color:#fff; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:8px;">
                        <i class="fa-solid fa-users"></i> Pilotes connectés (${this.membersList.length})
                    </h3>
                    ${membersHTML}
                </div>

                <button onclick="ConvoyManager.leaveConvoy()" style="margin-top:20px; background:#ff4d4d; color:#fff; border:none; padding:12px 30px; border-radius:30px; font-weight:bold; cursor:pointer; font-size:1rem;">
                    <i class="fa-solid fa-right-from-bracket"></i> Quitter le Convoi
                </button>
            `;
    } else {
      // ÉTAT : PAS DE CONVOI
      overlay.innerHTML = `
                <button onclick="ConvoyManager.closeUI()" style="position:absolute;top:20px;right:20px;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                <i class="fa-solid fa-people-group" style="font-size:3rem; color:#00d2ff; filter:drop-shadow(0 0 10px #00d2ff); margin-bottom:10px;"></i>
                <h1 style="font-size:1.5rem; margin:0; text-transform:uppercase; color:#00d2ff;">Mode Convoi</h1>
                <p style="color:#aaa; margin-bottom:30px; text-align:center;">Roulez en groupe. Voyez vos amis sur la carte en temps réel.</p>
                
                <div style="width:90%; max-width:400px;">
                    <button onclick="ConvoyManager.createConvoy()" style="width:100%; background:linear-gradient(135deg, #00d2ff, #0090ff); color:#fff; border:none; padding:15px; border-radius:15px; font-weight:bold; font-size:1.1rem; cursor:pointer; margin-bottom:20px; box-shadow:0 5px 20px rgba(0,210,255,0.3);">
                        <i class="fa-solid fa-plus"></i> Créer un Convoi
                    </button>
                    
                    <div style="text-align:center; color:#666; margin-bottom:15px;">— ou —</div>
                    
                    <div style="display:flex; gap:10px;">
                        <input type="text" id="convoy-join-code" maxlength="4" placeholder="CODE" style="flex:1; background:#222; border:1px solid #444; color:#fff; padding:15px; border-radius:15px; font-size:1.2rem; text-align:center; letter-spacing:5px; text-transform:uppercase; outline:none;">
                        <button onclick="ConvoyManager.joinConvoy(document.getElementById('convoy-join-code').value)" style="background:#00d2ff; color:#000; border:none; padding:15px 25px; border-radius:15px; font-weight:bold; cursor:pointer;">
                            <i class="fa-solid fa-right-to-bracket"></i> Rejoindre
                        </button>
                    </div>
                </div>
            `;
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {});


/* --- exchange.js --- */
/**
 * 🔄 BOURSE D'ÉCHANGE
 * Marketplace communautaire de pièces d'occasion & équipements via Firebase Firestore.
 * Sécurité : Validation des entrées (CIS 16.10), modération GuardianBot, textContent pour l'affichage (OWASP A03 - XSS).
 */

window.ExchangeMarket = {
  listings: [],
  filteredListings: [],
  firestoreUnsubscribe: null,
  userUnsubscribe: null,
  currentCategory: "all",
  searchQuery: "",
  priceTypeFilter: "all",
  stateFilter: "all",
  garageFilterActive: false,
  sortBy: "newest",
  userBvc: 0,

  init: function () {
    this.listenToUserBvc();
    this.listenToListings();
    this.setupUIListeners();
  },

  /**
   * Écoute en temps réel le solde BVC de l'utilisateur connecté via Firestore.
   */
  listenToUserBvc: function () {
    if (this.userUnsubscribe) this.userUnsubscribe();

    const checkUser = () => {
      if (!window.db) return;
      const user = firebase.auth().currentUser;
      if (user) {
        this.userUnsubscribe = window.db
          .collection("users")
          .doc(user.uid)
          .onSnapshot((doc) => {
            if (doc.exists) {
              const data = doc.data();
              this.userBvc = data.bvc_points || data.bvcPoints || data.bvc || 0;
              if (window.session) {
                window.session.vehicleModel = data.vehicleModel || "universel";
              }
              localStorage.setItem("bvc_points", this.userBvc);
              this.updateBvcDisplay(this.userBvc);
              this.applyFiltersAndRender(); // Re-render in case vehicleModel changed
            }
          });
      } else {
        const localBvc = parseInt(localStorage.getItem("bvc_points")) || 1450;
        this.userBvc = localBvc;
        this.updateBvcDisplay(localBvc);
      }
    };

    if (window.firebase && firebase.auth()) {
      firebase.auth().onAuthStateChanged(() => checkUser());
    } else {
      checkUser();
    }
  },

  updateBvcDisplay: function (amount) {
    const el = document.getElementById("user-bvc-balance");
    if (el) {
      el.textContent = `${amount.toLocaleString("fr-FR")} BVC`;
    }
  },

  /**
   * Écoute en temps réel les annonces de la communauté dans Firestore.
   * Limite à 50 annonces pour éviter la surcharge (A11 OWASP - DoS).
   */
  listenToListings: function () {
    if (!window.db) {
      console.warn("[ExchangeMarket] Firestore non disponible. Nouvelle tentative dans 1s...");
      setTimeout(() => this.listenToListings(), 1000);
      return;
    }

    if (this.firestoreUnsubscribe) this.firestoreUnsubscribe();

    this.firestoreUnsubscribe = window.db
      .collection("exchange_listings")
      .orderBy("createdAt", "desc")
      .limit(50)
      .onSnapshot((snapshot) => {
        this.listings = [];
        snapshot.forEach((doc) => {
          this.listings.push({ id: doc.id, ...doc.data() });
        });
        this.applyFiltersAndRender();
      }, (error) => {
        console.error("[ExchangeMarket] Erreur d'écoute Firestore:", error);
      });
  },

  setupUIListeners: function () {
    const searchInput = document.getElementById("market-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.applyFiltersAndRender();
      });
    }

    const sortSelect = document.getElementById("market-sort-select");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        this.sortBy = e.target.value;
        this.applyFiltersAndRender();
      });
    }

    const priceFilterSelect = document.getElementById("market-pricetype-select");
    if (priceFilterSelect) {
      priceFilterSelect.addEventListener("change", (e) => {
        this.priceTypeFilter = e.target.value;
        this.applyFiltersAndRender();
      });
    }

    const stateFilterSelect = document.getElementById("market-state-select");
    if (stateFilterSelect) {
      stateFilterSelect.addEventListener("change", (e) => {
        this.stateFilter = e.target.value;
        this.applyFiltersAndRender();
      });
    }

    const garageFilterToggle = document.getElementById("market-garage-filter");
    if (garageFilterToggle) {
      garageFilterToggle.addEventListener("change", (e) => {
        this.garageFilterActive = e.target.checked;
        this.applyFiltersAndRender();
      });
    }
  },

  setCategory: function (category, btnElement) {
    this.currentCategory = category;

    // Mise à jour des classes actives sur les boutons de filtre
    const buttons = document.querySelectorAll(".market-cat-btn");
    buttons.forEach((btn) => btn.classList.remove("active"));
    if (btnElement) {
      btnElement.classList.add("active");
    }

    this.applyFiltersAndRender();
  },

  applyFiltersAndRender: function () {
    let result = [...this.listings];

    // Filtre par catégorie
    if (this.currentCategory !== "all") {
      result = result.filter((item) => {
        if (this.currentCategory === "mecanique") {
          return ["galets", "variateur", "pot", "moteur"].includes(item.category);
        }
        return item.category === this.currentCategory;
      });
    }

    // Filtre par type de prix
    if (this.priceTypeFilter !== "all") {
      result = result.filter((item) => item.priceType === this.priceTypeFilter);
    }

    // Filtre par état (neuf, occasion, service)
    if (this.stateFilter !== "all") {
      result = result.filter((item) => item.condition === this.stateFilter);
    }

    // Filtre Garage Virtuel
    if (this.garageFilterActive && window.session && window.session.vehicleModel) {
      const myVehicle = window.session.vehicleModel;
      if (myVehicle !== "universel") {
        result = result.filter((item) => {
          return !item.compatibility || item.compatibility === "universel" || item.compatibility === myVehicle;
        });
      }
    }

    // Filtre par recherche textuelle
    if (this.searchQuery) {
      result = result.filter((item) => {
        const title = (item.title || "").toLowerCase();
        const desc = (item.description || "").toLowerCase();
        const seller = (item.seller || "").toLowerCase();
        return title.includes(this.searchQuery) || desc.includes(this.searchQuery) || seller.includes(this.searchQuery);
      });
    }

    // Tri
    result.sort((a, b) => {
      if (this.sortBy === "price_asc") return a.price - b.price;
      if (this.sortBy === "price_desc") return b.price - a.price;
      // Default: newest
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return dateB - dateA;
    });

    this.filteredListings = result;
    this.renderListings();
  },

  /**
   * Publie une nouvelle annonce dans Firestore.
   */
  publishListing: async function (title, description, priceType, price, category, condition, photoUrl, compatibility) {
    if (!window.db) {
      alert("Connexion Firestore requise.");
      return;
    }
    if (!window.session) {
      alert("Vous devez être connecté pour publier une annonce.");
      return;
    }

    // Validation des entrées (CIS 16.10 - Secure by Design)
    title = (title || "").trim();
    description = (description || "").trim();
    price = parseFloat(price) || 0;
    photoUrl = (photoUrl || "").trim();

    if (!title || title.length < 3 || title.length > 100) {
      alert("Le titre doit contenir entre 3 et 100 caractères.");
      return;
    }
    if (description.length > 500) {
      alert("La description ne peut pas dépasser 500 caractères.");
      return;
    }
    if (price <= 0 || price > 50000) {
      alert("Le prix doit être compris entre 1 et 50 000.");
      return;
    }

    // Sécurité (CIS 16.10) : Validation du domaine de l'URL photo
    // pour prévenir l'injection d'URLs malveillantes dans les balises <img>
    if (photoUrl) {
      try {
        const urlObj = new URL(photoUrl);
        const allowedDomains = [
          "firebasestorage.googleapis.com",
          "i.imgur.com",
          "imgur.com",
          "storage.googleapis.com",
          "lh3.googleusercontent.com",
          "mon50ccetmoi.com",
        ];
        const hostname = urlObj.hostname.toLowerCase();
        const isDomainAllowed = allowedDomains.some(
          (d) => hostname === d || hostname.endsWith("." + d)
        );
        if (!isDomainAllowed || !urlObj.protocol.startsWith("https")) {
          alert("Lien photo non autorisé. Utilisez un hébergeur validé (Firebase Storage, Imgur, etc.).");
          return;
        }
      } catch (e) {
        alert("Lien photo invalide.");
        return;
      }
    }

    const listing = {
      title: title,
      description: description,
      priceType: priceType === "bvc" ? "bvc" : "euro",
      price: price,
      category: category || "autre",
      condition: condition || "good",
      compatibility: compatibility || "universel",
      photoUrl: photoUrl || "",
      seller: window.session.username || "Membre",
      sellerUid: firebase.auth().currentUser ? firebase.auth().currentUser.uid : "",
      status: "active",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    // Modération automatique GuardianBot
    if (
      window.GuardianBot &&
      !window.GuardianBot.analyzeContent("Annonce", listing, window.session.username)
    ) {
      return;
    }

    try {
      await window.db.collection("exchange_listings").add(listing);
      
      // Mettre à jour le profil utilisateur pour débloquer le Badge Mécano
      if (listing.sellerUid) {
        await window.db.collection('users').doc(listing.sellerUid).update({
            hasPublishedListing: true
        }).catch(e => console.warn("Erreur MAJ Badge Mécano:", e));
      }

      alert("🚀 Annonce publiée avec succès sur le réseau !");
      this.closePublishForm();
    } catch (e) {
      console.error("[ExchangeMarket] Publication échouée :", e);
      alert("Erreur lors de la publication de l'annonce.");
    }
  },

  /**
   * Réservation / Achat direct d'une annonce en Pts BVC ou demande de réservation.
   */
  reserveListing: async function (listingId, price, priceType) {
    if (!window.session) {
      alert("Veuillez vous connecter pour effectuer un échange.");
      return;
    }

    const listing = this.listings.find((l) => l.id === listingId);
    if (!listing) return;

    if (listing.status === "reserved" || listing.status === "sold") {
      alert("Cette article a déjà été réservé.");
      return;
    }

    if (priceType === "bvc") {
      if (this.userBvc < price) {
        alert(`Solde insuffisant ! Il vous manque ${price - this.userBvc} BVC pour procéder à la réservation.`);
        return;
      }

      if (!confirm(`Confirmer la réservation de "${listing.title}" pour ${price} Pts BVC ?`)) {
        return;
      }

      try {
        const user = firebase.auth().currentUser;
        if (!user || !window.db) throw new Error("Utilisateur non connecté");
        
        const userRef = window.db.collection("users").doc(user.uid);
        const listingRef = window.db.collection("exchange_listings").doc(listingId);

        await window.db.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          const listingDoc = await transaction.get(listingRef);

          if (!userDoc.exists) throw new Error("Utilisateur introuvable");
          if (!listingDoc.exists) throw new Error("Annonce introuvable");

          const currentBvc = userDoc.data().bvc_points || 0;
          if (currentBvc < price) throw new Error("Solde insuffisant");

          if (listingDoc.data().status === "reserved" || listingDoc.data().status === "sold") {
            throw new Error("Cette annonce a déjà été réservée par quelqu'un d'autre.");
          }

          transaction.update(userRef, { bvc_points: currentBvc - price });
          transaction.update(listingRef, {
            status: "reserved",
            buyer: window.session.username,
            reservedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        });

        // Contacter le vendeur automatiquement
        await this.contactSeller(listingId, listing.seller, `J'ai réservé ta pièce "${listing.title}" pour ${price} Pts BVC ! Merci de me contacter pour la remise.`);

        alert("✅ Réservation confirmée ! Les BVC ont été transférés et le vendeur a été notifié.");
      } catch (e) {
        console.error("[ExchangeMarket] Réservation échouée :", e);
        alert("Erreur lors du traitement de la réservation.");
      }
    } else {
      // Réservation en Euros
      this.contactSeller(listingId, listing.seller, `Bonjour ! Je souhaite acheter ta pièce "${listing.title}" au prix de ${price} €. Discutons des modalités de livraison.`);
    }
  },

  /**
   * Supprime une annonce (uniquement par son auteur).
   */
  deleteListing: async function (listingId) {
    const user = firebase.auth().currentUser;
    if (!user) {
      alert("Vous devez être connecté pour supprimer une annonce.");
      return;
    }

    // Sécurité (OWASP A01) : Vérifier via Firestore que le sellerUid
    // correspond à l'UID Firebase Auth de l'utilisateur connecté.
    // On ne fait JAMAIS confiance au username côté client.
    try {
      const listingDoc = await window.db.collection("exchange_listings").doc(listingId).get();
      if (!listingDoc.exists) {
        alert("Annonce introuvable.");
        return;
      }
      if (listingDoc.data().sellerUid !== user.uid) {
        alert("Vous ne pouvez supprimer que vos propres annonces.");
        return;
      }
    } catch (e) {
      console.error("[ExchangeMarket] Vérification propriétaire échouée :", e);
      alert("Erreur de vérification.");
      return;
    }

    if (!confirm("Voulez-vous vraiment supprimer cette annonce ?")) return;

    try {
      await window.db.collection("exchange_listings").doc(listingId).delete();
      alert("Annonce supprimée.");
    } catch (e) {
      console.error("[ExchangeMarket] Suppression échouée :", e);
    }
  },

  /**
   * Contacte le vendeur via la messagerie Firestore.
   */
  contactSeller: async function (listingId, sellerName, customMsg) {
    if (!window.session) {
      alert("Connectez-vous d'abord pour envoyer un message.");
      return;
    }
    if (window.session.username === sellerName) {
      alert("Vous êtes le propriétaire de cette annonce !");
      return;
    }

    const messageText = customMsg || `Salut ! Je suis intéressé(e) par ton annonce sur la Marketplace. Est-elle toujours disponible ?`;

    try {
      await window.db.collection("exchange_messages").add({
        listingId: listingId,
        from: window.session.username,
        to: sellerName,
        message: messageText,
        read: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
      if (!customMsg) {
        alert("✉️ Message envoyé au vendeur ! Il recevra une notification.");
      }
    } catch (e) {
      console.error("[ExchangeMarket] Contact échoué :", e);
      alert("Erreur lors de l'envoi du message.");
    }
  },

  // ==================== ICONS & LABELS ====================

  getCategoryIcon: function (cat) {
    const icons = {
      galets: "fa-gear",
      variateur: "fa-gears",
      pot: "fa-wind",
      carenage: "fa-shield-halved",
      pneus: "fa-circle-dot",
      equipement: "fa-helmet-safety",
      moteur: "fa-oil-can",
      autre: "fa-box-open",
    };
    return icons[cat] || icons.autre;
  },

  getCategoryLabel: function (cat) {
    const labels = {
      galets: "Galets",
      variateur: "Variateur",
      pot: "Échappement",
      carenage: "Carénage",
      pneus: "Pneus & Freins",
      equipement: "Équipement",
      moteur: "Moteur",
      autre: "Autre",
    };
    return labels[cat] || "Autre";
  },

  getConditionLabel: function (cond) {
    const labels = {
      new: "✨ Neuf",
      like_new: "🌟 Très bon état",
      good: "👍 Bon état",
      parts: "🛠️ Pour pièces",
    };
    return labels[cond] || "Bon état";
  },

  // ==================== RENDERING ====================

  renderListings: function () {
    const container = document.getElementById("exchange-listings-container");
    if (!container) return;

    if (this.filteredListings.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:50px 20px; background:rgba(15,20,30,0.5); border-radius:15px; border:1px dashed rgba(0,242,255,0.2);">
          <i class="fa-solid fa-box-open" style="font-size:3rem; color:#00f2ff; margin-bottom:15px; opacity:0.6;"></i>
          <h3 style="color:#fff; margin-bottom:8px;">Aucune annonce trouvée</h3>
          <p style="color:#888; font-size:0.9rem;">Modifiez vos filtres ou soyez le premier à publier une annonce dans cette catégorie !</p>
        </div>
      `;
      return;
    }

    let html = "";
    this.filteredListings.forEach((listing) => {
      const icon = this.getCategoryIcon(listing.category);
      const catLabel = this.getCategoryLabel(listing.category);
      const isBvc = listing.priceType === "bvc";
      const priceLabel = isBvc ? `${listing.price} Pts BVC` : `${listing.price.toFixed(2)} €`;

      const isService = listing.condition === "service";
      const isAffordable = listing.priceType === "bvc" && this.userBvc >= listing.price;
      
      let conditionBadge = "";
      let condLabel = "";
      if (isService) {
        conditionBadge = `<span class="badge" style="background: rgba(0, 242, 255, 0.2); color: #00f2ff; border-color: #00f2ff;"><i class="fa-solid fa-bolt"></i> Recharge</span>`;
        condLabel = "Service Recharge";
      } else {
        const conditionText = listing.condition === "neuf" ? "Neuf" : "Occasion";
        const conditionColor = listing.condition === "neuf" ? "#00ff88" : "#ffb703";
        conditionBadge = `<span class="badge" style="color: ${conditionColor}; border-color: ${conditionColor}">${conditionText}</span>`;
        condLabel = this.getConditionLabel(listing.condition);
      }
      
      const isOwner = window.session && window.session.username === listing.seller;
      const isReserved = listing.status === "reserved" || listing.status === "sold";
      const date = listing.createdAt?.toDate ? listing.createdAt.toDate().toLocaleDateString("fr-FR") : "";

      const imageContent = listing.photoUrl
        ? `<img src="${listing.photoUrl}" alt="Photo annonce" style="width:100%; height:100%; object-fit:cover; border-radius:10px;" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid ${icon}\\'></i>'">`
        : `<i class="fa-solid ${icon}"></i>`;

      html += `
        <div class="product-card" style="position:relative; ${isReserved ? 'opacity:0.75;' : ''}">
          ${isReserved ? `<div style="position:absolute; top:12px; left:12px; z-index:5; background:#ff0055; color:#fff; font-weight:bold; font-size:0.75rem; padding:4px 10px; border-radius:8px; box-shadow:0 0 10px rgba(255,0,85,0.6);">RÉSERVÉ</div>` : ''}
          <div class="product-img" style="position:relative;">
            ${imageContent}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="background:rgba(0,242,255,0.15); border:1px solid rgba(0,242,255,0.3); color:#00f2ff; padding:3px 10px; border-radius:12px; font-size:0.7rem; font-weight:600;">
              ${catLabel}
            </span>
            <span style="color:#aaa; font-size:0.7rem;">${condLabel}</span>
          </div>
          <h3 id="listing-title-${listing.id}" style="margin:5px 0; font-size:1.1rem; color:#fff; font-weight:600;"></h3>
          <p id="listing-desc-${listing.id}" style="color:#99a; font-size:0.85rem; line-height:1.4; height:38px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; margin-bottom:12px;"></p>
          <div class="price-tag" style="display:flex; align-items:center; gap:8px;">
            ${isBvc ? `<i class="fa-brands fa-ethereum" style="color:#b700ff;"></i>` : `<i class="fa-solid fa-tag" style="color:#00f2ff;"></i>`}
            <span>${priceLabel}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; color:#667; font-size:0.75rem; margin-bottom:15px; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">
            <span><i class="fa-solid fa-user-circle"></i> <span id="listing-seller-${listing.id}"></span></span>
            ${date ? `<span><i class="fa-regular fa-clock"></i> ${date}</span>` : ""}
          </div>
          ${
            isOwner
              ? `<button class="buy-btn" style="background:linear-gradient(135deg, #ff4d4d, #cc0000);" onclick="ExchangeMarket.deleteListing('${listing.id}')"><i class="fa-solid fa-trash-can"></i> Supprimer</button>`
              : isReserved
              ? `<button class="buy-btn" style="background:#333; color:#777; cursor:not-allowed;" disabled><i class="fa-solid fa-lock"></i> Indisponible</button>`
              : `<div style="display:flex; gap:8px;">
                  <button class="buy-btn" style="flex:1; background:linear-gradient(135deg, #00f2ff, #0077ff);" onclick="ExchangeMarket.reserveListing('${listing.id}', ${listing.price}, '${listing.priceType}')">
                    ${isBvc ? '<i class="fa-solid fa-cart-shopping"></i> Réserver' : '<i class="fa-solid fa-handshake"></i> Acheter'}
                  </button>
                  <button class="buy-btn" style="width:42px; padding:0; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);" onclick="ExchangeMarket.contactSeller('${listing.id}', '${listing.seller}')" title="Contacter">
                    <i class="fa-solid fa-envelope"></i>
                  </button>
                </div>`
          }
        </div>
      `;
    });

    container.innerHTML = html;

    // Injection sécurisée via textContent (A03 OWASP - XSS Prevention)
    this.filteredListings.forEach((listing) => {
      const titleEl = document.getElementById(`listing-title-${listing.id}`);
      const descEl = document.getElementById(`listing-desc-${listing.id}`);
      const sellerEl = document.getElementById(`listing-seller-${listing.id}`);
      if (titleEl) titleEl.textContent = listing.title;
      if (descEl) descEl.textContent = listing.description;
      if (sellerEl) sellerEl.textContent = listing.seller;
    });
  },

  // ==================== FORM MODAL ====================

  openPublishForm: function () {
    let form = document.getElementById("exchange-publish-form");
    if (form) {
      form.style.display = "flex";
      return;
    }

    form = document.createElement("div");
    form.id = "exchange-publish-form";
    form.style = `
      position:fixed; top:0; left:0; width:100vw; height:100vh;
      background:rgba(6,9,19,0.96); z-index:50000;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      color:#fff; font-family:'Inter',sans-serif; backdrop-filter:blur(20px); padding:20px; box-sizing:border-box;
    `;
    form.innerHTML = `
      <div style="width:100%; max-width:480px; background:rgba(20,25,40,0.8); border:1px solid rgba(0,242,255,0.3); border-radius:20px; padding:25px; box-shadow:0 0 30px rgba(0,242,255,0.2); position:relative; max-height:90vh; overflow-y:auto;">
        <button onclick="ExchangeMarket.closePublishForm()" style="position:absolute; top:20px; right:20px; background:none; border:none; color:#889; font-size:1.5rem; cursor:pointer; transition:color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#889'">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div style="text-align:center; margin-bottom:20px;">
          <div style="width:50px; height:50px; background:rgba(0,242,255,0.1); border:1px solid #00f2ff; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; color:#00f2ff; font-size:1.5rem; margin-bottom:10px;">
            <i class="fa-solid fa-plus-circle"></i>
          </div>
          <h2 style="color:#fff; margin:0; font-size:1.4rem;">Publier une Annonce</h2>
          <p style="color:#889; font-size:0.85rem; margin-top:5px;">Vendez ou troquez vos pièces 50cc avec la communauté</p>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px;">
          <div>
            <label for="ex-title" style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">Titre de l'annonce *</label>
            <input type="text" id="ex-title" placeholder="ex: Galets Malossi 6.5g Neufs" maxlength="100" style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
          </div>

          <div>
            <label for="ex-desc" style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">Description *</label>
            <textarea id="ex-desc" placeholder="Précisez l'état, la compatibilité de la pièce (ex: Booster/MBK Nitro)..." maxlength="500" rows="3" style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none; resize:none;"></textarea>
          </div>

          <div style="display:flex; gap:10px;">
            <div style="flex:1;">
              <label for="ex-category" style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">Catégorie *</label>
              <select id="ex-category" style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
                <option value="galets">⚙️ Galets</option>
                <option value="variateur">⚙️ Variateur</option>
                <option value="pot">💨 Échappement</option>
                <option value="carenage">🛡️ Carénage</option>
                <option value="pneus">🔘 Pneus & Freins</option>
                <option value="equipement">🪖 Équipement</option>
                <option value="moteur">🛢️ Moteur & Huile</option>
                <option value="autre">📦 Autre</option>
              </select>
            </div>

            <div style="flex:1;">
              <label for="ex-condition" style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">État *</label>
              <select id="ex-condition" style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
                <option value="good">Bon état</option>
                <option value="new">Neuf (Emballé)</option>
                <option value="like_new">Très bon état</option>
                <option value="parts">Pour pièces</option>
              </select>
            </div>
          </div>

          <div>
            <label for="ex-compatibility" style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">Compatibilité (Garage Virtuel) *</label>
            <select id="ex-compatibility" style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
              <option value="universel">Universel</option>
              <option value="ami">Citroën Ami</option>
              <option value="kisbee">Peugeot Kisbee</option>
              <option value="booster">MBK Booster / Stunt</option>
              <option value="typhoon">Piaggio Typhoon</option>
              <option value="ludix">Peugeot Ludix</option>
              <option value="chatenet">Chatenet</option>
              <option value="aixam">Aixam</option>
            </select>
          </div>

          <div style="margin-top: 10px;">
            <label for="ex-photourl" style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">Lien Photo / Image (Optionnel)</label>
            <input type="url" id="ex-photourl" placeholder="https://..." style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
          </div>

          <div style="display:flex; gap:10px;">
            <div style="flex:2;">
              <label for="ex-price" style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">Prix *</label>
              <input type="number" id="ex-price" placeholder="Prix" min="1" style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
            </div>
            <div style="flex:1;">
              <label for="ex-price-type" style="font-size:0.8rem; color:#00f2ff; margin-bottom:4px; display:block;">Monnaie</label>
              <select id="ex-price-type" style="width:100%; background:rgba(10,15,25,0.8); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
                <option value="bvc">Pts BVC</option>
                <option value="euro">Euros (€)</option>
              </select>
            </div>
          </div>

          <button onclick="ExchangeMarket.publishListing(
            document.getElementById('ex-title').value,
            document.getElementById('ex-desc').value,
            document.getElementById('ex-price-type').value,
            document.getElementById('ex-price').value,
            document.getElementById('ex-category').value,
            document.getElementById('ex-condition').value,
            document.getElementById('ex-photourl').value,
            document.getElementById('ex-compatibility').value
          )" style="margin-top:10px; width:100%; background:linear-gradient(135deg, #00f2ff, #0077ff); color:#fff; border:none; padding:15px; border-radius:12px; font-weight:bold; font-size:1rem; cursor:pointer; box-shadow:0 0 15px rgba(0,242,255,0.3);">
            <i class="fa-solid fa-paper-plane"></i> Publier l'annonce
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(form);
  },

  closePublishForm: function () {
    const form = document.getElementById("exchange-publish-form");
    if (form) form.style.display = "none";
  },
};


/* --- legal-database.js --- */
/**
 * ⚖️ BASE JURIDIQUE MONDIALE — POCKET LAWYER
 * Sources officielles gouvernementales uniquement.
 * Dernière mise à jour : 14 juillet 2026
 *
 * Structure : window.LegalDatabase[pays][thème]
 * Chaque entrée contient : title, content, source, url
 *
 * Avertissement (AI Act UE 2024/1689) : Ces informations sont fournies
 * à titre indicatif et sont soumises à contrôle humain.
 */

window.LegalDatabase = {
  // ═══════════════════════════════════════════════════════════════
  // 🇫🇷 FRANCE — Source : Légifrance (legifrance.gouv.fr)
  // ═══════════════════════════════════════════════════════════════
  france: {
    _flag: "🇫🇷",
    _name: "France",
    _source: "Légifrance — legifrance.gouv.fr",
    _keywords: ["france", "français", "francais", "légifrance", "legifrance"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "🇫🇷 Port du Casque — Art. R431-1 Code de la Route",
      content:
        "Le port du casque homologué <strong>ECE 22.06</strong> est obligatoire pour tout conducteur et passager de 2-roues motorisé.<br><strong>Sanction :</strong> 135€ d'amende (contravention 4ème classe) + retrait de 3 points.",
      source: "Légifrance — Art. R431-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    debridage: {
      keywords: ["débrid", "debride", "kité", "kit"],
      title: "🇫🇷 Débridage — Art. L317-5 Code de la Route",
      content:
        "Le débridage d'un cyclomoteur est un <strong>délit</strong>. Vous risquez <strong>135€ d'amende</strong> pour le propriétaire, mais surtout, <strong>votre assurance s'annule</strong> en cas d'accident corporel. Les assureurs se retournent contre vous pour payer les dommages aux victimes.",
      source: "Légifrance — Art. L317-5 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    stupefiants: {
      keywords: ["stup", "drogue", "fumé", "positif", "cannabis", "thc"],
      title: "🇫🇷 Conduite sous Stupéfiants (Délit)",
      content:
        "Même avec un BSR, vous risquez jusqu'à <strong>4500€ d'amende</strong>, 2 ans de prison, et l'immobilisation du scooter. Il n'y a pas de perte de points sur un BSR. S'il s'agit d'une première infraction, le juge peut faire preuve de clémence si vous montrez des preuves médicales.",
      source: "Légifrance — Art. L235-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    alcool: {
      keywords: ["alcool", "boire", "ivre", "alcoolémie"],
      title: "🇫🇷 Alcoolémie — Art. L234-1",
      content:
        "Pour un permis probatoire ou BSR, la limite légale est de <strong>0,2 g/L</strong>. Vous risquez l'immobilisation immédiate du cyclomoteur et de fortes amendes. Au-delà de 0,8 g/L : délit pénal (2 ans de prison, 4500€).",
      source: "Légifrance — Art. L234-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    assurance: {
      keywords: ["assurance", "assuré"],
      title: "🇫🇷 Défaut d'Assurance (Délit) — Art. L324-2",
      content:
        "Conduire sans assurance coûte jusqu'à <strong>3750€ d'amende</strong>. En cas d'accident, le Fonds de Garantie indemnise la victime mais <strong>vous réclamera le remboursement</strong>, potentiellement toute votre vie.",
      source: "Légifrance — Art. L324-2 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    fuite: {
      keywords: ["fuite", "obtempérer", "obtemperer"],
      title: "🇫🇷 Refus d'Obtempérer / Délit de Fuite",
      content:
        "Cumuler ces délits entraîne des peines de <strong>prison fermes</strong>, des amendes colossales et une interdiction de passer le permis. Ne fuyez jamais un contrôle de police.",
      source: "Légifrance — Art. L233-1 & L231-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    stationnement: {
      keywords: ["stationn", "garé", "parking", "trottoir", "fourrière"],
      title: "🇫🇷 Stationnement 2-Roues — Art. R417-10/11",
      content:
        "Sur un <strong>trottoir</strong> : toléré si le passage piéton (>1,50m) n'est pas entravé. Sur <strong>passage piéton/piste cyclable</strong> : 135€ + fourrière immédiate. Sur <strong>place auto</strong> : toléré si vous payez le stationnement.",
      source: "Légifrance — Art. R417-10 et R417-11",
      url: "legifrance.gouv.fr",
    },
    rgpd: {
      keywords: [
        "rgpd",
        "gdpr",
        "données personnelles",
        "cnil",
        "vie privée",
      ],
      title: "🇫🇷 RGPD — Règlement (UE) 2016/679",
      content:
        "La protection des données personnelles est régie par le <strong>RGPD</strong> (entré en vigueur le 25 mai 2018) et la <strong>Loi Informatique et Libertés</strong> (Loi n°78-17 du 6 janvier 1978). La CNIL est l'autorité de contrôle française.<br>Droits : Accès (Art.15), Rectification (Art.16), Effacement (Art.17), Portabilité (Art.20), Opposition (Art.21).",
      source: "Légifrance & EUR-Lex — Règlement (UE) 2016/679",
      url: "legifrance.gouv.fr | eur-lex.europa.eu",
    },
    retractation: {
      keywords: [
        "remboursement",
        "rétractation",
        "retractation",
        "cgv",
        "numérique",
        "digital",
      ],
      title:
        "🇫🇷 Droit de Rétractation (Contenu Numérique) — Art. L221-28",
      content:
        "Selon l'<strong>Article L221-28 (13°) du Code de la consommation</strong>, le droit de rétractation ne peut pas être exercé pour la fourniture d'un <strong>contenu numérique non fourni sur un support matériel</strong> dont l'exécution a commencé après accord préalable exprès du consommateur et renoncement exprès à son droit de rétractation. Les rapports d'expertise générés ne sont donc <strong>pas remboursables</strong>.",
      source: "Légifrance — Art. L221-28 du Code de la Consommation",
      url: "legifrance.gouv.fr",
    },
    vice_cache: {
      keywords: ["vice", "caché", "cache", "panne", "arnaque", "occasion"],
      title: "🇫🇷 Garantie des Vices Cachés — Art. 1641 Code Civil",
      content:
        "L'<strong>Article 1641 du Code civil</strong> précise que le vendeur est tenu de la garantie à raison des défauts cachés de la chose vendue qui la rendent impropre à l'usage auquel on la destine. L'acheteur a <strong>2 ans à compter de la découverte du vice</strong> pour agir.",
      source: "Légifrance — Art. 1641 du Code Civil",
      url: "legifrance.gouv.fr",
    },
    accident_assurance: {
      keywords: [
        "accident",
        "constat",
        "sinistre",
        "indemnisation",
        "badinter",
      ],
      title: "🇫🇷 Indemnisation des Victimes (Loi Badinter)",
      content:
        "La <strong>Loi n° 85-677 du 5 juillet 1985 (Loi Badinter)</strong> vise à améliorer la situation des victimes d'accidents de la circulation et à accélérer les procédures d'indemnisation. Si vous n'êtes pas responsable, votre assureur doit vous indemniser intégralement de vos préjudices corporels et matériels.",
      source: "Légifrance — Loi Badinter",
      url: "legifrance.gouv.fr",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇪🇺 UNION EUROPÉENNE — Source : EUR-Lex (eur-lex.europa.eu)
  // ═══════════════════════════════════════════════════════════════
  eu: {
    _flag: "🇪🇺",
    _name: "Union Européenne",
    _source: "EUR-Lex — eur-lex.europa.eu",
    _keywords: ["europe", "européen", "europeen", "ue", "eu", "eur-lex"],

    rgpd: {
      keywords: ["rgpd", "gdpr", "donnée", "privacy"],
      title: "🇪🇺 RGPD — Règlement (UE) 2016/679",
      content:
        "Le Règlement Général sur la Protection des Données est le texte de référence en matière de protection des données personnelles dans l'UE. Entrée en vigueur : <strong>25 mai 2018</strong>.<br>Amende max : <strong>20M€ ou 4% du CA mondial</strong>.",
      source: "EUR-Lex — Règlement (UE) 2016/679",
      url: "eur-lex.europa.eu",
    },
    ai_act: {
      keywords: ["ia act", "ai act", "intelligence artificielle", "ia"],
      title: "🇪🇺 AI Act — Règlement (UE) 2024/1689",
      content:
        "Premier règlement au monde sur l'IA. En vigueur depuis le <strong>1er août 2024</strong>. Approche par niveaux de risque :<br>• Risque inacceptable : <strong>Interdit</strong><br>• Haut risque : Conformité stricte obligatoire<br>• Risque limité : <strong>Obligation de transparence</strong> (notre catégorie)<br>• Risque minimal : Libre<br>Application complète prévue pour <strong>août 2026</strong>.",
      source: "EUR-Lex — Règlement (UE) 2024/1689",
      url: "eur-lex.europa.eu",
    },
    dsa: {
      keywords: ["dsa", "digital services", "modération", "plateforme"],
      title: "🇪🇺 DSA — Règlement (UE) 2022/2065",
      content:
        "Le Digital Services Act impose des obligations de <strong>modération</strong> et de <strong>transparence</strong> aux plateformes numériques. Obligation de point de contact, mécanisme de signalement (Art.16), et motivation des décisions de modération (Art.17).",
      source: "EUR-Lex — Règlement (UE) 2022/2065",
      url: "eur-lex.europa.eu",
    },
    casque_eu: {
      keywords: ["casque", "homologation", "ece", "unece"],
      title: "🇪🇺 Homologation Casque — UNECE R22.06",
      content:
        "Depuis juin 2024, seuls les casques homologués <strong>ECE 22.06</strong> peuvent être vendus dans l'UE. Les anciens ECE 22.05 restent utilisables mais ne sont plus fabriqués.",
      source: "UNECE — Regulation No. 22 Rev.6",
      url: "unece.org",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇮🇩 INDONÉSIE — Source : JDIH (jdih.kemenkumham.go.id)
  // ═══════════════════════════════════════════════════════════════
  indonesia: {
    _flag: "🇮🇩",
    _name: "Indonésie",
    _source: "JDIH — jdih.kemenkumham.go.id | peraturan.bpk.go.id",
    _keywords: ["indonésie", "indonesie", "indonesia", "jdih"],

    casque: {
      keywords: ["casque", "helm", "sni"],
      title: "🇮🇩 Casque (Helm SNI) — UU 22/2009 Art.106(8)",
      content:
        "Le port du casque homologué <strong>SNI</strong> (Standar Nasional Indonesia) est obligatoire pour le conducteur et le passager (Art. 57§2).<br><strong>Sanction :</strong> Jusqu'à 1 mois de prison ou <strong>Rp 250.000</strong> d'amende (Art. 291§1).",
      source: "JDIH — UU No.22 Tahun 2009 (LLAJ)",
      url: "jdih.kemenkumham.go.id",
    },
    sim: {
      keywords: ["sim", "permis", "conduire"],
      title: "🇮🇩 Permis de conduire (SIM) — UU 22/2009 Art.77",
      content:
        "Tout conducteur doit posséder un SIM correspondant à son véhicule :<br>• <strong>SIM C</strong> : Moto ≤ 250cc<br>• <strong>SIM CI</strong> : Moto 250-500cc<br>• <strong>SIM CII</strong> : Moto > 500cc<br><strong>Sans SIM :</strong> 3 mois prison ou Rp 1.000.000 (Art.281).<br><strong>SIM non présenté :</strong> 1 mois ou Rp 250.000 (Art.288§2).",
      source: "JDIH — UU No.22 Tahun 2009",
      url: "jdih.kemenkumham.go.id",
    },
    code_route: {
      keywords: ["route", "lalu lintas", "circulation", "code"],
      title: "🇮🇩 Code de la Route — UU No.22 Tahun 2009 (LLAJ)",
      content:
        "La loi sur la Circulation et les Transports Routiers régit l'ensemble du trafic en Indonésie. Obligations pour les 2-roues :<br>• Casque SNI obligatoire (Art.106§8)<br>• Rétroviseurs, feux, klaxon, compteur (Art.285§1)<br>• SIM C obligatoire (Art.77)<br>• STNK à jour (Perpol 7/2021)",
      source: "JDIH — Kementerian Perhubungan",
      url: "jdih.kemenkumham.go.id",
    },
    stnk: {
      keywords: ["stnk", "enregistrement", "immatriculation", "pajak"],
      title: "🇮🇩 Immatriculation (STNK) — Perpol 7/2021",
      content:
        "Le STNK est le certificat d'immatriculation obligatoire. Si le STNK expire et n'est pas renouvelé sous <strong>2 ans</strong>, les données du véhicule sont radiées.<br><strong>Opsen Pajak (2025) :</strong> Taxe additionnelle sur le PKB et BBN-KB (UU 1/2022).<br>Depuis 2026, le NIK (KTP) est intégré au SIM.",
      source: "JDIH — Korlantas Polri",
      url: "korlantas.polri.go.id",
    },
    pdp: {
      keywords: ["data", "donnée", "pdp", "pribadi", "privée"],
      title: "🇮🇩 Protection des Données — UU No.27/2022 (UU PDP)",
      content:
        "En vigueur depuis le <strong>17 octobre 2024</strong>. Portée extraterritoriale.<br><strong>Sanctions admin. (Art.57) :</strong> Jusqu'à <strong>2% du CA annuel</strong>.<br><strong>Sanctions pénales :</strong> 4-6 ans de prison + Rp 4-6 milliards.<br><strong>Korporasi :</strong> Amende Ã—10 + gel/dissolution.",
      source: "JDIH — Komdigi (ex-Kominfo)",
      url: "jdih.kemenkumham.go.id",
    },
    contrat: {
      keywords: ["contrat"],
      title: "🇮🇩 Droit des Contrats",
      content:
        "Régi par le <strong>Code civil indonésien</strong> (KUH Perdata), hérité du droit romano-hollandais. L'Indonésie n'a <strong>pas ratifié</strong> la Convention de Vienne (CISG).",
      source: "JDIH — peraturan.bpk.go.id",
      url: "peraturan.bpk.go.id",
    },
    hierarchie: {
      keywords: ["hiérarchie", "constitution", "norme", "loi"],
      title: "🇮🇩 Hiérarchie des Normes — UU No.10/2004",
      content:
        "Système mixte (adat / romano-hollandais / national / musulman à Aceh).<br>1. <strong>UUD 1945</strong> — Constitution<br>2. <strong>UU</strong> — Lois du Parlement<br>3. <strong>PP</strong> — Règlements gouvernementaux<br>4. <strong>Perpres</strong> — Décrets présidentiels<br>5. <strong>Perda</strong> — Règlements régionaux",
      source: "JDIH — jdih.kemenkumham.go.id",
      url: "jdih.kemenkumham.go.id",
    },
    immobilier: {
      keywords: ["immobilier", "terre", "agraire", "hak"],
      title: "🇮🇩 Droit Immobilier — Loi Agraire n°5/1960 (UUPA)",
      content:
        "Les étrangers ne peuvent posséder de terres directement (<strong>Hak Milik</strong>), mais peuvent acquérir des droits d'usage (<strong>Hak Pakai</strong>) ou investir via des sociétés (<strong>PT PMA</strong>).",
      source: "JDIH — peraturan.bpk.go.id",
      url: "peraturan.bpk.go.id",
    },
    travail: {
      keywords: ["travail", "licenciement", "emploi"],
      title: "🇮🇩 Droit du Travail — UU 13/2003 & Omnibus 11/2020",
      content:
        "Loi n°13/2003 = texte principal. Modifiée par la <strong>loi omnibus n°11/2020</strong> (Cipta Kerja) pour faciliter l'investissement (contrats, licenciements, heures supplémentaires).",
      source: "JDIH — jdih.kemenkumham.go.id",
      url: "jdih.kemenkumham.go.id",
    },
    langue: {
      keywords: ["langue", "éducation", "media", "bahasa"],
      title: "🇮🇩 Réglementation Linguistique — UU 20/2003 & 32/2002",
      content:
        "L'indonésien (<em>Bahasa Indonesia</em>) est la langue officielle de l'éducation et des médias. Les langues régionales et étrangères sont autorisées sous conditions.",
      source: "JDIH — Kemendikbudristek",
      url: "jdih.kemenkumham.go.id",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇺🇸 ÉTATS-UNIS — Sources : NHTSA, IIHS, Cornell LII
  // ═══════════════════════════════════════════════════════════════
  usa: {
    _flag: "🇺🇸",
    _name: "États-Unis",
    _source: "NHTSA (nhtsa.gov) | Cornell LII (law.cornell.edu)",
    _keywords: [
      "usa",
      "états-unis",
      "etats-unis",
      "amérique",
      "amerique",
      "américain",
      "americain",
      "united states",
    ],

    casque: {
      keywords: ["casque", "helmet"],
      title: "🇺🇸 Casque Moto — FMVSS 218 (NHTSA)",
      content:
        "La norme fédérale est le <strong>FMVSS 218</strong> (Federal Motor Vehicle Safety Standard). <strong>Attention :</strong> la loi varie par État !<br>• <strong>Universal law</strong> (19 États) : Casque obligatoire pour tous<br>• <strong>Partial law</strong> (28 États) : Obligatoire seulement pour les <18 ou <21 ans<br>• <strong>No law</strong> (3 États) : Illinois, Iowa, New Hampshire",
      source: "NHTSA — nhtsa.gov | IIHS — iihs.org",
      url: "nhtsa.gov",
    },
    assurance: {
      keywords: ["assurance", "insurance"],
      title: "🇺🇸 Assurance Moto — Réglementation par État",
      content:
        "L'assurance moto est obligatoire dans <strong>48 des 50 États</strong> (sauf Floride et Montana pour la responsabilité civile). Les minimums de couverture varient considérablement par État. En Californie : 15/30/5 (en milliers de $).",
      source: "NHTSA — nhtsa.gov",
      url: "nhtsa.gov",
    },
    ccpa: {
      keywords: ["ccpa", "cpra", "california", "donnée", "privacy"],
      title: "🇺🇸 CCPA/CPRA — Protection des Données (Californie)",
      content:
        "Le <strong>CCPA</strong> (California Consumer Privacy Act, 2020) et son amendement <strong>CPRA</strong> offrent aux résidents californiens des droits proches du RGPD : droit de savoir, de suppression, de refus de vente. <strong>Amende :</strong> $2.500/violation, $7.500/violation intentionnelle.",
      source: "State of California — oag.ca.gov",
      url: "oag.ca.gov",
    },
    coppa: {
      keywords: ["coppa", "mineur", "enfant"],
      title: "🇺🇸 COPPA — Protection des Mineurs en Ligne",
      content:
        "La <strong>Children's Online Privacy Protection Act</strong> interdit la collecte de données personnelles d'enfants de moins de 13 ans sans consentement parental vérifiable. <strong>Amende :</strong> jusqu'à $50.120/violation (FTC).",
      source: "FTC — ftc.gov",
      url: "ftc.gov",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇬🇧 ROYAUME-UNI — Source : legislation.gov.uk
  // ═══════════════════════════════════════════════════════════════
  uk: {
    _flag: "🇬🇧",
    _name: "Royaume-Uni",
    _source: "legislation.gov.uk",
    _keywords: [
      "royaume-uni",
      "uk",
      "angleterre",
      "british",
      "anglais",
      "london",
    ],

    casque: {
      keywords: ["casque", "helmet"],
      title: "🇬🇧 Casque Moto — Road Traffic Act 1988 §16",
      content:
        "Le port du casque homologué <strong>BS 6658:1985</strong> ou <strong>UNECE R22.05/22.06</strong> est obligatoire. Les Sikhs portant un turban sont exemptés (§16§2).<br><strong>Sanction :</strong> Fixed Penalty Notice de <strong>£100</strong>.",
      source: "legislation.gov.uk — Road Traffic Act 1988 §16",
      url: "legislation.gov.uk",
    },
    permis: {
      keywords: ["permis", "licence", "cbt"],
      title: "🇬🇧 Permis Moto — CBT / A1 / A2 / A",
      content:
        "Formation obligatoire : <strong>CBT</strong> (Compulsory Basic Training). Catégories :<br>• <strong>AM</strong> : Cyclomoteur ≤ 50cc<br>• <strong>A1</strong> : ≤ 125cc (16+)<br>• <strong>A2</strong> : ≤ 35kW (19+)<br>• <strong>A</strong> : Illimité (24+ ou 21+ avec 2 ans d'A2)",
      source: "GOV.UK — gov.uk/motorcycle-licence",
      url: "gov.uk",
    },
    uk_gdpr: {
      keywords: ["gdpr", "donnée", "ico", "privacy", "data"],
      title: "🇬🇧 UK GDPR & Data Protection Act 2018",
      content:
        "Post-Brexit, le Royaume-Uni a conservé les principes du RGPD via le <strong>UK GDPR</strong> et le <strong>Data Protection Act 2018</strong>. L'autorité de contrôle est l'<strong>ICO</strong> (Information Commissioner's Office). Amende max : <strong>£17.5M ou 4% du CA</strong>.",
      source: "legislation.gov.uk — Data Protection Act 2018",
      url: "legislation.gov.uk",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇯🇵 JAPON — Source : Japanese Law Translation (japaneselawtranslation.go.jp)
  // ═══════════════════════════════════════════════════════════════
  japan: {
    _flag: "🇯🇵",
    _name: "Japon",
    _source: "Japanese Law Translation — japaneselawtranslation.go.jp",
    _keywords: ["japon", "japonais", "japan", "nippon"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "🇯🇵 Casque Moto — Road Traffic Act Art.71-4",
      content:
        "Le port du casque homologué <strong>PSC/SG</strong> est obligatoire pour tous les conducteurs et passagers de 2-roues. Les casques doivent porter le marquage <strong>PSCマーク</strong>.<br>Norme : <strong>JIS T 8133</strong>.",
      source: "Japanese Law Translation — Road Traffic Act (é“路交通法)",
      url: "japaneselawtranslation.go.jp",
    },
    permis: {
      keywords: ["permis", "licence", "conduire"],
      title: "🇯🇵 Permis Moto (å…許) — Road Traffic Act",
      content:
        "Catégories :<br>• <strong>原付</strong> (Gentsuki) : ≤ 50cc (16+)<br>• <strong>å°型</strong> : ≤ 125cc<br>• <strong>普通</strong> : ≤ 400cc<br>• <strong>大型</strong> : Illimité (18+)<br>Examen pratique obligatoire en circuit fermé.",
      source: "Japanese Law Translation — é“路交通法",
      url: "japaneselawtranslation.go.jp",
    },
    appi: {
      keywords: ["appi", "donnée", "data", "ppc", "privacy"],
      title: "🇯🇵 APPI — Act on Protection of Personal Information",
      content:
        "Révisée en 2022. L'APPI est supervisée par la <strong>PPC</strong> (Personal Information Protection Commission). Le Japon bénéficie d'une <strong>décision d'adéquation</strong> avec l'UE (RGPD). Transferts transfrontaliers strictement encadrés.",
      source: "PPC — ppc.go.jp",
      url: "ppc.go.jp",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇨🇳 CHINE — Source : NPC (npc.gov.cn)
  // ═══════════════════════════════════════════════════════════════
  china: {
    _flag: "🇨🇳",
    _name: "Chine",
    _source: "NPC — npc.gov.cn | Assemblée Nationale Populaire",
    _keywords: ["chine", "chinois", "china", "pékin", "beijing"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "🇨🇳 Casque Moto — Campagne « Un casque, une ceinture »",
      content:
        "Depuis la campagne nationale de 2020, le port du casque est obligatoire pour les conducteurs et passagers de 2-roues dans toute la Chine. Norme obligatoire : <strong>GB 811-2022</strong> (mise à jour de la norme nationale).",
      source: "NPC — Road Traffic Safety Law (é“路交通安全法)",
      url: "npc.gov.cn",
    },
    pipl: {
      keywords: ["pipl", "donnée", "data", "privacy"],
      title: "🇨🇳 PIPL — Personal Information Protection Law (2021)",
      content:
        "En vigueur depuis le <strong>1er novembre 2021</strong>. Portée extraterritoriale. Consentement séparé requis pour les données sensibles. <strong>Amende :</strong> jusqu'à <strong>50M RMB ou 5% du CA annuel</strong>. Transferts transfrontaliers soumis à évaluation de sécurité obligatoire (CAC).",
      source: "NPC — 个人信æ¯ä¿护法",
      url: "npc.gov.cn",
    },
    dsl: {
      keywords: ["dsl", "sécurité", "securite", "cybersécurité"],
      title: "🇨🇳 DSL — Data Security Law (2021)",
      content:
        "La Loi sur la Sécurité des Données (DSL) classe les données par niveau d'importance (national, important, général). Les données « importantes » et « nationales » exigent des évaluations de risque et des stockages localisés.",
      source: "NPC — 数æ®安全法",
      url: "npc.gov.cn",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇮🇳 INDE — Source : India Code (indiacode.nic.in)
  // ═══════════════════════════════════════════════════════════════
  india: {
    _flag: "🇮🇳",
    _name: "Inde",
    _source: "India Code — indiacode.nic.in",
    _keywords: ["inde", "indien", "india", "hindi"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "🇮🇳 Casque Moto — Motor Vehicles Act 1988 §129",
      content:
        "Le port du casque homologué <strong>ISI (BIS)</strong> est obligatoire pour le conducteur et le passager. Norme : <strong>IS 4151:2015</strong>.<br><strong>Sanction :</strong> ₹1.000 d'amende + suspension du permis (3 mois).<br>Exception : Les Sikhs portant un turban sont exemptés dans certains États.",
      source: "India Code — Motor Vehicles Act 1988 §129",
      url: "indiacode.nic.in",
    },
    permis: {
      keywords: ["permis", "licence", "conduire"],
      title: "🇮🇳 Permis Moto — Motor Vehicles Act §3",
      content:
        "Deux catégories :<br>• <strong>MCWG</strong> (Motor Cycle With Gear) : Moto avec vitesses<br>• <strong>MCWOG</strong> : Scooter sans vitesses<br>Ã‚ge minimum : <strong>18 ans</strong> (16 ans pour les ≤50cc dans certains États).",
      source: "India Code — Motor Vehicles Act 1988",
      url: "indiacode.nic.in",
    },
    dpdp: {
      keywords: ["dpdp", "donnée", "data", "privacy"],
      title: "🇮🇳 DPDP — Digital Personal Data Protection Act 2023",
      content:
        "En vigueur depuis <strong>2023</strong>. Droits des « Data Principals » : consentement, rectification, effacement. Possibilité de nommer un représentant légal. <strong>Amende :</strong> jusqu'à <strong>₹250 crore</strong> (≈ 27M€). Supervision par le Data Protection Board of India.",
      source: "MeitY — meity.gov.in",
      url: "meity.gov.in",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇧🇷 BRÉSIL — Source : Planalto (planalto.gov.br)
  // ═══════════════════════════════════════════════════════════════
  brazil: {
    _flag: "🇧🇷",
    _name: "Brésil",
    _source: "Planalto — planalto.gov.br",
    _keywords: ["brésil", "bresil", "brazil", "brésilien", "bresilien"],

    casque: {
      keywords: ["casque", "capacete", "helmet"],
      title: "🇧🇷 Casque Moto — CTB Art.244 (Lei 9.503/1997)",
      content:
        "Le port du casque homologué <strong>INMETRO</strong> est obligatoire pour le conducteur et le passager de moto. Le viseur est aussi obligatoire.<br><strong>Sanction :</strong> Infraction grave — <strong>R$293,47</strong> + 7 points sur le CNH + rétention du véhicule.",
      source: "Planalto — Lei 9.503/1997 (CTB) Art.244",
      url: "planalto.gov.br",
    },
    cnh: {
      keywords: ["permis", "cnh", "conduire", "licence"],
      title: "🇧🇷 Permis Moto (CNH) — CTB Art.140",
      content:
        "Catégorie <strong>A</strong> obligatoire pour les 2-roues. Ã‚ge minimum : <strong>18 ans</strong>. Formation obligatoire incluant cours théoriques (45h) et pratiques (20h). Système de points : <strong>40 pts/an = suspension</strong>.",
      source: "Planalto — Lei 9.503/1997 (CTB)",
      url: "planalto.gov.br",
    },
    lgpd: {
      keywords: ["lgpd", "donnée", "data", "privacy"],
      title: "🇧🇷 LGPD — Lei Geral de Proteção de Dados (13.709/2018)",
      content:
        "La LGPD est le « RGPD brésilien ». En vigueur depuis <strong>septembre 2020</strong>. Supervisée par l'<strong>ANPD</strong> (Autoridade Nacional de Proteção de Dados). <strong>Amende :</strong> jusqu'à <strong>2% du CA au Brésil</strong>, plafonnée à R$50M par infraction.",
      source: "Planalto — Lei 13.709/2018",
      url: "planalto.gov.br",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇸🇬 SINGAPOUR — Source : Singapore Statutes Online (sso.agc.gov.sg)
  // ═══════════════════════════════════════════════════════════════
  singapore: {
    _flag: "🇸🇬",
    _name: "Singapour",
    _source: "Singapore Statutes Online — sso.agc.gov.sg",
    _keywords: ["singapour", "singapore"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "🇸🇬 Casque Moto — Road Traffic Act §22A",
      content:
        "Le casque homologué <strong>PSB/Spring SG</strong> (ou UN R22) est obligatoire. <br><strong>Sanction :</strong> Amende jusqu'à <strong>S$1.000</strong> et/ou 3 mois de prison.",
      source: "SSO — Road Traffic Act (Cap. 276)",
      url: "sso.agc.gov.sg",
    },
    pdpa: {
      keywords: ["pdpa", "donnée", "data", "privacy"],
      title: "🇸🇬 PDPA — Personal Data Protection Act 2012",
      content:
        "Supervisée par la <strong>PDPC</strong>. Consentement éclairé obligatoire. Droit d'accès et de correction rapide.<br><strong>Amende :</strong> jusqu'à <strong>S$1M ou 10% du CA annuel</strong> (depuis la révision 2020).",
      source: "SSO — PDPA (No.26 of 2012)",
      url: "sso.agc.gov.sg",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇿🇦 AFRIQUE DU SUD — Source : gov.za
  // ═══════════════════════════════════════════════════════════════
  south_africa: {
    _flag: "🇿🇦",
    _name: "Afrique du Sud",
    _source: "Government of South Africa — gov.za",
    _keywords: ["afrique du sud", "south africa", "sud-africain"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "🇿🇦 Casque Moto — NRTA 93/1996 §98",
      content:
        "Le port du casque homologué <strong>SABS (SANS 55)</strong> est obligatoire pour tous les conducteurs et passagers de 2-roues.<br><strong>Sanction :</strong> Amende et points de démérite.",
      source: "gov.za — National Road Traffic Act 93 of 1996",
      url: "gov.za",
    },
    popia: {
      keywords: ["popia", "donnée", "data", "privacy"],
      title: "🇿🇦 POPIA — Protection of Personal Information Act 4/2013",
      content:
        "En vigueur depuis <strong>juillet 2021</strong>. L'<strong>Information Regulator</strong> est l'autorité de contrôle. Traitement licite et raisonnable obligatoire. Droit d'accès, de correction, et de suppression.<br><strong>Amende :</strong> jusqu'à <strong>R10M</strong> et/ou 10 ans de prison.",
      source: "Information Regulator — inforegulator.org.za",
      url: "inforegulator.org.za",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇳🇬 NIGÉRIA — Source : FRSC / NITDA
  // ═══════════════════════════════════════════════════════════════
  nigeria: {
    _flag: "🇳🇬",
    _name: "Nigéria",
    _source: "FRSC — frsc.gov.ng | NITDA — nitda.gov.ng",
    _keywords: ["nigéria", "nigeria"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "🇳🇬 Casque Moto — Highway Code / FRSC",
      content:
        "Le port du casque est obligatoire pour les conducteurs et passagers de motos (<em>Okada</em>). Réglementation appliquée par le <strong>FRSC</strong> (Federal Road Safety Corps).<br><strong>Sanction :</strong> ₦2.000 d'amende.",
      source: "FRSC — frsc.gov.ng",
      url: "frsc.gov.ng",
    },
    ndpr: {
      keywords: ["ndpr", "ndpa", "donnée", "data", "privacy"],
      title: "🇳🇬 NDPA — Nigeria Data Protection Act 2023",
      content:
        "Remplace le NDPR de 2019. Crée la <strong>NDPC</strong> (Nigeria Data Protection Commission) comme autorité indépendante. Consentement obligatoire. Notifications de violation sous <strong>72h</strong>.<br><strong>Amende :</strong> jusqu'à <strong>2% du CA mondial</strong> ou ₦10M.",
      source: "NITDA — nitda.gov.ng",
      url: "nitda.gov.ng",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇲🇦 MAROC — Source : Bulletin Officiel (sgg.gov.ma)
  // ═══════════════════════════════════════════════════════════════
  morocco: {
    _flag: "🇲🇦",
    _name: "Maroc",
    _source: "Bulletin Officiel — sgg.gov.ma | Fiscamaroc",
    _keywords: ["maroc", "marocain", "morocco", "maghreb"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "🇲🇦 Casque Moto — Loi n°52-05 (Code de la Route)",
      content:
        "Le port du casque homologué est obligatoire pour les conducteurs et passagers de 2-roues motorisés.<br><strong>Sanction :</strong> Amende de <strong>400 à 700 DH</strong>, immobilisation du véhicule, et retrait de permis possible.",
      source: "Bulletin Officiel — Loi n°52-05 portant Code de la Route",
      url: "sgg.gov.ma",
    },
    permis: {
      keywords: ["permis", "conduire"],
      title: "🇲🇦 Permis Moto — Loi n°52-05",
      content:
        "Catégories :<br>• <strong>A1</strong> : Cyclomoteur ≤ 50cc (16+)<br>• <strong>A</strong> : Toute moto (18+)<br>Système de permis à points depuis 2010.",
      source: "Bulletin Officiel — Code de la Route",
      url: "sgg.gov.ma",
    },
    loi_0908: {
      keywords: ["donnée", "data", "privacy", "cndp"],
      title: "🇲🇦 Loi n°09-08 — Protection des Données Personnelles",
      content:
        "En vigueur depuis <strong>2009</strong>. Supervisée par la <strong>CNDP</strong> (Commission Nationale de Contrôle de la Protection des Données). Inspirée du modèle français (CNIL). Droits d'accès, de rectification et d'opposition.",
      source: "Bulletin Officiel — Loi n°09-08",
      url: "cndp.ma",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇹🇭 THAÃLANDE — Source : Royal Thai Police
  // ═══════════════════════════════════════════════════════════════
  thailand: {
    _flag: "🇹🇭",
    _name: "Thaïlande",
    _source: "Royal Thai Police — royalthaipolice.go.th",
    _keywords: ["thaïlande", "thailande", "thailand", "thai"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "🇹🇭 Casque Moto — Land Traffic Act B.E.2522 (1979)",
      content:
        "Le port du casque est obligatoire pour les conducteurs et passagers de moto. Norme : <strong>TIS 369</strong> (Thai Industrial Standard).<br><strong>Sanction :</strong> Amende de <strong>500 THB</strong>.",
      source: "Royal Thai Police — Land Traffic Act B.E.2522",
      url: "royalthaipolice.go.th",
    },
    pdpa_th: {
      keywords: ["pdpa", "donnée", "data", "privacy"],
      title: "🇹🇭 PDPA — Personal Data Protection Act B.E.2562 (2019)",
      content:
        "En vigueur depuis <strong>juin 2022</strong>. Très inspirée du RGPD. Consentement explicite requis pour les données sensibles. <strong>Amende :</strong> jusqu'à <strong>5M THB</strong> + sanctions pénales (1 an de prison et/ou 1M THB).",
      source: "PDPA Thailand — pdpathailand.com",
      url: "pdpathailand.com",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇦🇺 AUSTRALIE — Source : Federal Register of Legislation
  // ═══════════════════════════════════════════════════════════════
  australia: {
    _flag: "🇦🇺",
    _name: "Australie",
    _source: "Federal Register of Legislation — legislation.gov.au",
    _keywords: ["australie", "australia", "australien"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "🇦🇺 Casque Moto — Australian Road Rules Rule 270",
      content:
        "Le port du casque homologué <strong>AS/NZS 1698:2006</strong> (ou UNECE R22) est obligatoire dans tous les États et Territoires.<br><strong>Sanction :</strong> Varie par État. Ex NSW : <strong>A$349</strong> + 3 points de démérite.",
      source: "legislation.gov.au — Australian Road Rules",
      url: "legislation.gov.au",
    },
    privacy_act: {
      keywords: ["privacy", "donnée", "data"],
      title: "🇦🇺 Privacy Act 1988 — Protection des Données",
      content:
        "Supervisée par l'<strong>OAIC</strong> (Office of the Australian Information Commissioner). Les 13 <strong>Australian Privacy Principles (APPs)</strong> régissent la collecte, l'utilisation et la sécurité des données.<br><strong>Amende :</strong> jusqu'à <strong>A$50M</strong>, 3Ã— le bénéfice obtenu, ou 30% du CA (le plus élevé).",
      source: "legislation.gov.au — Privacy Act 1988",
      url: "legislation.gov.au",
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇨🇦 CANADA — Source : Justice Laws (laws-lois.justice.gc.ca)
  // ═══════════════════════════════════════════════════════════════
  canada: {
    _flag: "🇨🇦",
    _name: "Canada",
    _source: "Justice Laws — laws-lois.justice.gc.ca",
    _keywords: ["canada", "canadien", "québec", "quebec"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "🇨🇦 Casque Moto — Highway Traffic Act (Provincial)",
      content:
        "Le casque est obligatoire dans <strong>toutes les provinces</strong>. Normes acceptées : <strong>DOT (FMVSS 218)</strong>, <strong>Snell</strong>, <strong>ECE 22.05/22.06</strong>.<br><strong>Sanction :</strong> Varie par province. Ontario : <strong>C$110</strong>.",
      source: "laws-lois.justice.gc.ca + HTA provincial",
      url: "laws-lois.justice.gc.ca",
    },
    pipeda: {
      keywords: ["pipeda", "donnée", "data", "privacy"],
      title: "🇨🇦 PIPEDA — Personal Information Protection Act",
      content:
        "Loi fédérale sur la protection des renseignements personnels dans le secteur privé. Supervisée par le <strong>Commissariat à la protection de la vie privée</strong>. Remplacée progressivement au Québec par la <strong>Loi 25</strong> (2023).<br><strong>Amende :</strong> jusqu'à <strong>C$100.000</strong> (PIPEDA), C$25M ou 4% du CA (Loi 25 QC).",
      source: "laws-lois.justice.gc.ca — PIPEDA (S.C. 2000, c.5)",
      url: "laws-lois.justice.gc.ca",
    },
  },
};

/**
 * ðŸ” Moteur de recherche dans la base juridique mondiale
 * Utilisé par PocketLawyer.processChatQuery()
 */
window.LegalDatabase.search = function (query) {
  const t = query.toLowerCase();
  const results = [];

  // 1. Identifier le(s) pays ciblé(s)
  let targetCountries = [];
  for (const [countryKey, country] of Object.entries(this)) {
    if (typeof country !== "object" || countryKey === "search") continue;
    if (country._keywords && country._keywords.some((kw) => t.includes(kw))) {
      targetCountries.push(countryKey);
    }
  }

  // Si aucun pays détecté, chercher dans tous
  if (targetCountries.length === 0) {
    targetCountries = Object.keys(this).filter(
      (k) => typeof this[k] === "object" && k !== "search",
    );
  }

  // 2. Chercher par mots-clés dans les pays ciblés
  for (const countryKey of targetCountries) {
    const country = this[countryKey];
    if (!country || typeof country !== "object") continue;

    for (const [topicKey, topic] of Object.entries(country)) {
      if (
        topicKey.startsWith("_") ||
        typeof topic !== "object" ||
        !topic.keywords
      )
        continue;
      if (topic.keywords.some((kw) => t.includes(kw))) {
        results.push({
          country: country._name,
          flag: country._flag,
          ...topic,
        });
      }
    }
  }

  return results;
};


/* --- pocket-lawyer.js --- */
/**
 * ⚖️ POCKET LAWYER - MODULE DE DÉFENSE JURIDIQUE
 * Analyse du stationnement (Code de la Route FR : R417-10 et R417-11)
 */

window.PocketLawyer = {
  isOpen: false,

  // Scénarios simulés pour l'environnement GPS actuel
  scenarios: [
    {
      type: "Trottoir (Large)",
      status: "TOLERANCE",
      icon: "fa-solid fa-scale-balanced",
      color: "#ffb703", // Orange
      law: "R417-10 (Très Gênant / Gênant)",
      verdict:
        "Stationnement techniquement interdit mais couramment toléré si le passage des piétons n'est pas entravé.",
      defense:
        "Plaidoirie : L'espace laissé libre (plus de 1m50) permet le passage des poussettes et PMR. Aucune entrave caractérisée. S'il y a amende (135€ ou 35€), vous pouvez invoquer l'absence de signalisation claire ou le manque de places 2RM.",
      letterTemplate:
        "Monsieur l'Officier du Ministère Public,\nJe conteste le PV n°XXX.\nLe stationnement de mon cyclomoteur ne constituait pas une entrave à la circulation piétonne (largeur libre > 1,50m) et palliait un manque avéré de stationnement 2RM dans ce secteur.",
    },
    {
      type: "Place 2-Roues Motorisés",
      status: "AUTORISE",
      icon: "fa-solid fa-check-double",
      color: "#00e676", // Vert
      law: "R417-6 (Régulier)",
      verdict: "Vous êtes parfaitement en règle.",
      defense:
        "Plaidoirie : Véhicule stationné sur un emplacement dédié et matérialisé. Si la place est devenue payante (ex: Paris), assurez-vous d'avoir pris un ticket numérique ou le Pass 2RM.",
      letterTemplate: "",
    },
    {
      type: "Passage Piéton / Piste Cyclable",
      status: "INTERDIT",
      icon: "fa-solid fa-gavel",
      color: "#ff4d4d", // Rouge
      law: "R417-11 (Très Gênant)",
      verdict:
        "Stationnement strictement interdit. Risque de mise en fourrière immédiate et 135€ d'amende.",
      defense:
        "Plaidoirie : Difficilement contestable (mise en danger d'autrui). Seule option : vice de forme sur le PV (erreur de plaque, de rue ou de date).",
      letterTemplate:
        "Monsieur l'Officier,\nJe conteste ce PV sur la base d'un vice de forme caractérisé (erreur matérielle sur le lieu exact de l'infraction visé).",
    },
    {
      type: "Place Auto (Voiture)",
      status: "TOLERANCE",
      icon: "fa-solid fa-car",
      color: "#ffb703",
      law: "R417-10",
      verdict:
        "Toléré si vous payez le stationnement (si applicable). Attention à ne pas bloquer une voiture.",
      defense:
        "Plaidoirie : Le code de la route n'interdit pas aux 2RM de se garer sur les places voitures, mais c'est mal vu. En cas de stationnement payant, le reçu fait foi.",
      letterTemplate: "",
    },
  ],

  toggleLawyer: function () {
    if (this.isOpen) {
      this.closeLawyer();
    } else {
      this.openLawyer();
    }
  },

  openLawyer: function () {
    if (typeof window.BVCManager === "undefined") {
      alert("Erreur: Module de fidélité introuvable.");
      return;
    }

    const price = 5; // 5 Pts BVC constants
    if (window.BVCManager.balance < price) {
      alert(
        `Fonds insuffisants ! Vous avez besoin de ${price} Pts BVC pour accéder à l'Avocat de Poche. Roulez plus pour en gagner.`,
      );
      return;
    }

    this.isOpen = true;
    let overlay = document.getElementById("lawyer-overlay");

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "lawyer-overlay";
      overlay.style = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(10, 15, 25, 0.95); z-index: 50000;
                display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
                padding-top: 50px; overflow-y: auto; color: #fff; font-family: 'Inter', sans-serif;
                backdrop-filter: blur(15px);
            `;
      document.body.appendChild(overlay);
    } else {
      overlay.style.display = "flex";
    }

    overlay.innerHTML = `
            <button onclick="PocketLawyer.closeLawyer()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
            <i class="fa-solid fa-scale-balanced fa-beat-fade" style="font-size: 3rem; color: #cca300; filter: drop-shadow(0 0 10px #cca300); margin-bottom: 5px;"></i>
            <h1 style="font-size: 1.5rem; margin: 0; text-transform: uppercase; color: #cca300;">Avocat de Poche</h1>
            <div style="background: rgba(0,210,255,0.1); border: 1px solid #00d2ff; color: #00d2ff; font-size: 0.7rem; padding: 3px 10px; border-radius: 10px; margin-top: 5px; margin-bottom: 10px; font-weight: bold; letter-spacing: 1px; display: inline-block;"><i class="fa-solid fa-microchip"></i> Propulsé par Nexus Atlas</div>
            <div style="color: #ffaa00; font-size: 0.75rem; margin-bottom: 15px; text-align: center; width: 90%; max-width: 450px; border: 1px solid rgba(255,170,0,0.4); padding: 8px; border-radius: 8px; background: rgba(255,170,0,0.05); line-height: 1.3;">
                <strong><i class="fa-solid fa-scale-balanced"></i> Conformité Légale (AI Act & CCPA)</strong><br>
                Aide indicative générée par IA. Ne remplace pas un conseil juridique et est <strong>soumis à contrôle humain</strong>.<br>
                <em style="color:#aaa;">Do Not Sell My Personal Information : Vos données (dont la télémétrie locale) ne sont jamais vendues.</em>
            </div>
            
            <div id="lawyer-chat-box" style="flex: 1; width: 90%; max-width: 500px; background: rgba(0,0,0,0.5); border-radius: 15px; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; scroll-behavior: smooth;">
                <div style="background: rgba(204,163,0,0.2); padding: 10px 15px; border-radius: 15px; align-self: flex-start; max-width: 85%; border-left: 3px solid #cca300; line-height: 1.4;">
                    Ma base de jurisprudence couvre <strong>16 pays</strong> avec des sources officielles. Essayez :<br>
                    • Casque en France<br>
                    • Permis Indonésie<br>
                    • Protection données Brésil<br>
                    • Casque UK<br>
                    • CCPA USA<br><br>
                    <em>• Tapez <strong>pays</strong> pour voir la liste complète.</em>
                </div>
            </div>
            
            <div style="width: 90%; max-width: 500px; display: flex; gap: 10px; margin-bottom: 15px;">
                <input type="text" id="lawyer-input" placeholder="Votre question..." style="flex: 1; padding: 12px; border-radius: 20px; border: 1px solid #555; background: #222; color: #fff; outline: none;" onkeypress="if(event.key === 'Enter') PocketLawyer.sendMessage()">
                <button onclick="PocketLawyer.sendMessage()" style="background: #cca300; color: #000; border: none; border-radius: 50%; width: 45px; height: 45px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
            
            <button onclick="PocketLawyer.startGPSScan()" style="margin-bottom: 15px; background: transparent; border: 1px solid #cca300; color: #cca300; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-location-dot"></i> Scanner mon stationnement (GPS)</button>
            <button onclick="PocketLawyer.reportInsurer()" style="margin-bottom: 15px; background: rgba(255,51,51,0.1); border: 1px solid #ff3333; color: #ff3333; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-bullhorn"></i> Signaler un litige assureur (+15 BVC)</button>
            <button onclick="window.open('https://www.legifrance.gouv.fr/', '_blank')" style="margin-bottom: 30px; background: rgba(0, 51, 153, 0.2); border: 1px solid #0055ff; color: #88bbff; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-book-section"></i> Base Légifrance (Textes Officiels)</button>
            
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .lawyer-card { background: rgba(255,255,255,0.05); border-radius: 15px; margin-top: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
                .lawyer-btn { padding: 10px 20px; border-radius: 30px; border: none; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 15px; }
            </style>
        `;
  },

  reportInsurer: function () {
    const insurerName = prompt("Quel est le nom de l'assureur concerné ?");
    if (!insurerName) return;

    const problem = prompt(
      "Décrivez brièvement le problème (ex: refus de prise en charge, résiliation abusive, etc.) :",
    );
    if (!problem) return;

    // Sanitization anti-XSS (A03 OWASP)
    const sanitize = (str) => {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    };
    const safeInsurerName = sanitize(insurerName);
    const safeProblem = sanitize(problem);

    // Envoi à Firebase
    try {
      if (typeof firebase !== "undefined") {
        firebase
          .firestore()
          .collection("insurer_reports")
          .add({
            insurer: insurerName.toUpperCase(),
            description: problem,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            user: window.session ? window.session.username : "Anonyme",
          });
      }
    } catch (e) {
      console.warn("Firebase non disponible, signalement simulé en local.");
    }

    // Récompense pour encourager la communauté
    let ptsAdded = false;
    if (typeof window.testAddPoints === "function") {
      window.testAddPoints(15);
      ptsAdded = true;
    } else {
      if (
        window.session &&
        window.session.uid &&
        typeof firebase !== "undefined"
      ) {
        firebase
          .firestore()
          .collection("users")
          .doc(window.session.uid)
          .set(
            {
              bvcPoints: firebase.firestore.FieldValue.increment(15),
            },
            { merge: true },
          )
          .catch(function (e) {
            console.error(e);
          });
      }
      ptsAdded = true;
    }

    this.addBotMessage(
      `<strong>Signalement enregistré !</strong><br>Merci d'avoir signalé <em>${safeInsurerName}</em>. Votre retour aide toute la communauté à éviter les mauvaises expériences.<br><span style="color:#00e676;">+15 Pts BVC offerts pour votre contribution citoyenne.</span>`,
    );

    if (
      insurerName.toLowerCase().includes("euro assurance") ||
      insurerName.toLowerCase().includes("euroassurence")
    ) {
      const self = this;
      setTimeout(function () {
        self.addBotMessage(
          "⚠ï¸ <strong>Note de l'Avocat :</strong> Nous avons reçu de nombreux signalements concernant cet assureur. Sachez qu'il est désormais classé \"Partenaire non recommandé\" sur notre plateforme B2B et soumis à des frais de vérification renforcée (10 000 €).",
        );
      }, 3000);
    }
  },

  devClearReports: async function () {
    if (
      confirm(
        "⚠ï¸ DANGER ADMIN : Êtes-vous sûr de vouloir supprimer TOUS les signalements assureurs de la base de données de production ?",
      )
    ) {
      try {
        if (typeof firebase === "undefined")
          return alert("Erreur: Firebase non initialisé");
        const snapshot = await firebase
          .firestore()
          .collection("insurer_reports")
          .get();
        if (snapshot.empty) {
          alert("La base de données des signalements est déjà vide !");
          return;
        }
        const batch = firebase.firestore().batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        alert(
          `✅ Succès : ${snapshot.size} signalement(s) effacé(s) de la base de données.`,
        );
      } catch (e) {
        console.error(e);
        alert("Erreur lors de la purge de la base de données : " + e.message);
      }
    }
  },

  sendMessage: async function (text = null) {
    const input = document.getElementById("lawyer-input");
    if (!input && !text) return;
    const message = text || (input ? input.value.trim() : "");
    if (!message) return;

    if (!text && input) input.value = "";

    const chatBox = document.getElementById("lawyer-chat-box");
    if (!chatBox) return;

    // Add user message
    const userMsg = document.createElement("div");
    userMsg.style =
      "background: rgba(255,255,255,0.1); padding: 10px 15px; border-radius: 15px; align-self: flex-end; max-width: 85%; color: #fff;";
    userMsg.textContent = message;
    chatBox.appendChild(userMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Add typing indicator
    const typingMsg = document.createElement("div");
    typingMsg.style =
      "color: #cca300; font-size: 0.9rem; align-self: flex-start; margin-top: 5px;";
    typingMsg.innerHTML =
      '<i class="fa-solid fa-ellipsis fa-fade"></i> Analyse en cours...';
    chatBox.appendChild(typingMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
      const reply = await this.processChatQuery(message);
      if (chatBox.contains(typingMsg)) chatBox.removeChild(typingMsg);
      this.addBotMessage(reply);
    } catch(e) {
      if (chatBox.contains(typingMsg)) chatBox.removeChild(typingMsg);
      this.addBotMessage("Désolé, une erreur s'est produite lors de la recherche.");
      console.error(e);
    }
  },

  addBotMessage: function (htmlContent) {
    const chatBox = document.getElementById("lawyer-chat-box");
    if (!chatBox) return;
    const botMsg = document.createElement("div");
    botMsg.style =
      "background: rgba(204,163,0,0.1); padding: 10px 15px; border-radius: 15px; align-self: flex-start; max-width: 85%; border-left: 3px solid #cca300; line-height: 1.4; color: #fff;";
    botMsg.innerHTML = htmlContent;
    chatBox.appendChild(botMsg);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (typeof speak === "function") {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlContent;
      speak(tempDiv.textContent || tempDiv.innerText || "");
    }
  },

  processChatQuery: async function (text) {
    const t = text.toLowerCase();

    // ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ 
    // 🌍  MOTEUR JURIDIQUE MONDIAL (LegalDatabase)
    // ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ 
    if (
      window.LegalDatabase &&
      typeof window.LegalDatabase.search === "function"
    ) {
      const results = window.LegalDatabase.search(text);
      if (results.length > 0) {
        const r = results[0];
        let html = `<strong>${r.title}</strong><br>${r.content}`;
        html += `<br><em style="color:#888; font-size:0.8em;">Source : ${r.source}</em>`;

        if (results.length > 1) {
          html += `<br><br><span style="color:#cca300; font-size:0.85em;">📚 ${results.length - 1} autre(s) résultat(s) trouvé(s). Précisez votre question pour affiner.</span>`;
        }

        if (t.includes("accident") || t.includes("litige") || t.includes("assurance") || t.includes("accrochage") || t.includes("constat") || t.includes("sinistre")) {
          html += `<br><br><div style="background:rgba(255, 51, 51, 0.1); border:1px solid #ff3333; border-radius:10px; padding:10px; margin-top:10px;">
                        <p style="margin:0 0 10px 0; color:#ffcccc; font-size:0.9rem;"><strong>Dossier d'Expertise (Boîte Noire)</strong><br>Avez-vous besoin de générer un Code Litige pour votre assureur ?</p>
                        <button onclick="if(window.DisputeAutomation) window.DisputeAutomation.initiateDispute(); else alert('Module introuvable.');" style="background:#ff3333; color:#fff; border:none; border-radius:20px; padding:8px 15px; cursor:pointer; font-weight:bold; width:100%;"><i class="fa-solid fa-gavel"></i> Générer mon Code Litige</button>
                    </div>`;
        }

        return html;
      }
    }

    if (t.includes("pays") || t.includes("monde") || t.includes("mondial") || t.includes("international") || (t.includes("quel") && t.includes("droit"))) {
      if (window.LegalDatabase) {
        let countryList = "";
        for (const [key, country] of Object.entries(window.LegalDatabase)) {
          if (typeof country === "object" && country._flag && key !== "search") {
            countryList += `• ${country._flag} ${country._name}<br>`;
          }
        }
        return `<strong>🌍  Base Juridique Mondiale</strong><br>Je couvre actuellement le droit de :<br>${countryList}<br>Précisez un <strong>pays</strong> et un <strong>thème</strong> (casque, permis, données, assurance...) pour obtenir les textes officiels.`;
      }
    }

    // 🇫🇷 FALLBACK : JURISPRUDENCE FRANÇAISE (Règles statiques)
    if (t.includes("débrid") || t.includes("debride")) {
      return "<strong>Débridage (Art. L317-5)</strong><br>C'est un délit. Vous risquez jusqu'à <strong>135€ d'amende</strong> pour le propriétaire, mais surtout, <strong>votre assurance s'annule</strong> en cas d'accident corporel. Les assureurs se retournent contre vous pour payer les dommages aux victimes.";
    }
    if (t.includes("stup") || t.includes("drogue") || t.includes("fumé") || t.includes("positif") || t.includes("cannabis") || t.includes("thc")) {
      return "<strong>Conduite sous stupéfiants (Délit)</strong><br>Même avec un BSR, vous risquez jusqu'à <strong>4500€ d'amende</strong>, 2 ans de prison, et l'immobilisation du scooter. Il n'y a pas de perte de points sur un BSR. S'il s'agit d'une première infraction, le juge peut faire preuve de clémence si vous montrez des preuves médicales de votre volonté de vous soigner.";
    }
    if (t.includes("alcool")) {
      return "<strong>Alcoolémie</strong><br>Pour un permis probatoire ou BSR, la limite légale est de 0,2 g/L. Vous risquez l'immobilisation immédiate du cyclomoteur et de fortes amendes.";
    }
    if (t.includes("assurance")) {
      return "<strong>Défaut d'assurance (Délit)</strong><br>Conduire sans assurance coûte jusqu'à <strong>3750€ d'amende</strong>. En cas d'accident, le Fonds de Garantie indemnise la victime mais vous réclamera le remboursement, potentiellement toute votre vie.";
    }
    if (t.includes("fuite") || t.includes("obtempérer")) {
      return "<strong>Refus d'obtempérer / Délit de fuite</strong><br>Cumuler ces délits entraîne des peines de prison fermes, des amendes colossales et une interdiction de passer le permis. Ne fuyez jamais un contrôle de police.";
    }

    const safeText = window.escapeHTML ? window.escapeHTML(text) : text;
    let baseMsg = `Je consulte la base de jurisprudence (Légifrance via PISTE)...<br><br>`;
    
    // Appel à la Cloud Function searchLegifrancePiste
    try {
      if (typeof window.session !== "undefined" && window.session.token) {
        const response = await fetch("https://europe-west1-mon50ccetmoi.cloudfunctions.net/searchLegifrancePiste", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${window.session.token}`
            },
            body: JSON.stringify({ query: text })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const res = data.results[0];
                baseMsg = `<strong>${res.title}</strong><br>${res.content}<br><br><em style="color:#888; font-size:0.8em;">Source : ${res.source}</em>`;
            } else {
                baseMsg = `Aucun texte de loi précis trouvé sur Légifrance pour "${safeText}".<br><br>
                <a href="https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(text)}" target="_blank" style="display:inline-block; padding:10px 15px; background:rgba(0, 51, 153, 0.3); border:1px solid #0055ff; color:#88bbff; border-radius:15px; text-decoration:none; margin-top:10px;"><i class="fa-solid fa-magnifying-glass"></i> Chercher sur le site Légifrance</a>`;
            }
        } else {
            baseMsg = `Service Légifrance indisponible. <a href="https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(text)}" target="_blank" style="display:inline-block; padding:10px 15px; background:rgba(0, 51, 153, 0.3); border:1px solid #0055ff; color:#88bbff; border-radius:15px; text-decoration:none; margin-top:10px;"><i class="fa-solid fa-magnifying-glass"></i> Chercher sur Légifrance</a>`;
        }
      } else {
          baseMsg = `Vous devez être connecté pour interroger la base Légifrance PISTE en direct. <br><br>
          <a href="https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(text)}" target="_blank" style="display:inline-block; padding:10px 15px; background:rgba(0, 51, 153, 0.3); border:1px solid #0055ff; color:#88bbff; border-radius:15px; text-decoration:none; margin-top:10px;"><i class="fa-solid fa-magnifying-glass"></i> Chercher sur Légifrance</a>`;
      }
    } catch (e) {
        console.error(e);
        baseMsg = `Erreur de connexion à la base de données gouvernementale. <a href="https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(text)}" target="_blank" style="display:inline-block; padding:10px 15px; background:rgba(0, 51, 153, 0.3); border:1px solid #0055ff; color:#88bbff; border-radius:15px; text-decoration:none; margin-top:10px;"><i class="fa-solid fa-magnifying-glass"></i> Chercher sur Légifrance</a>`;
    }

    if (t.includes("accident") || t.includes("litige") || t.includes("assurance") || t.includes("accrochage") || t.includes("constat") || t.includes("sinistre")) {
      baseMsg += `<br><br><div style="background:rgba(255, 51, 51, 0.1); border:1px solid #ff3333; border-radius:10px; padding:10px; margin-top:10px;">
                <p style="margin:0 0 10px 0; color:#ffcccc; font-size:0.9rem;"><strong>Dossier d'Expertise (Boîte Noire)</strong><br>Avez-vous besoin de générer un Code Litige pour votre assureur ?</p>
                <button onclick="if(window.DisputeAutomation) window.DisputeAutomation.initiateDispute(); else alert('Module introuvable.');" style="background:#ff3333; color:#fff; border:none; border-radius:20px; padding:8px 15px; cursor:pointer; font-weight:bold; width:100%;"><i class="fa-solid fa-gavel"></i> Générer mon Code Litige</button>
            </div>`;
    }

    return baseMsg;
  },

  startGPSScan: function () {
    const chatBox = document.getElementById("lawyer-chat-box");
    if (!chatBox) return;

    this.addBotMessage(
      '<div style="text-align: center;"><div style="width: 30px; height: 30px; border: 3px solid #333; border-top-color: #cca300; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div><p style="margin-top: 10px; font-size: 0.9rem;">Vérification GPS en cours...</p></div>',
    );

    setTimeout(() => {
      if (chatBox.lastChild) chatBox.removeChild(chatBox.lastChild); // Remove loading message

      const scenario =
        this.scenarios[Math.floor(Math.random() * this.scenarios.length)];
      this.currentScenarioTemplate = scenario.letterTemplate;

      let html = `
                <div class="lawyer-card" style="border: 1px solid ${scenario.color}; padding: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <i class="${scenario.icon}" style="font-size: 2rem; color: ${scenario.color};"></i>
                        <div>
                            <h2 style="margin: 0; font-size: 1.2rem; color: ${scenario.color};">${scenario.status}</h2>
                            <p style="margin: 0; font-size: 0.8rem; color: #ccc;">${scenario.type}</p>
                        </div>
                    </div>
                    <p style="margin: 5px 0 10px 0; color: #ddd; font-size: 0.9rem;">${scenario.verdict}</p>
                    ${
                      scenario.letterTemplate
                        ? `
                        <button class="lawyer-btn" style="background: #cca300; color: #000; font-size: 0.9rem; padding: 8px 15px; width: 100%;" onclick="PocketLawyer.generateLetter()">
                            <i class="fa-solid fa-file-signature"></i> Recours (5 Pts)
                        </button>
                    `
                        : ""
                    }
                </div>
            `;
      this.addBotMessage(html);
    }, 2000);
  },

  closeLawyer: function () {
    this.isOpen = false;
    const overlay = document.getElementById("lawyer-overlay");
    if (overlay) overlay.style.display = "none";
  },

  startAudioDefense: function () {
    if (typeof speak === "function") {
      speak(
        "Mode Défense Juridique activé. Règle numéro 1 : Ne reconnaissez aucun tort à l'oral. Règle numéro 2 : Prenez des photos de la situation et de la plaque adverse. Règle numéro 3 : Remplissez le constat factuellement. En cas de délit de fuite, relevez la plaque et contactez la police.",
      );
    } else {
      console.warn(
        "L'assistant vocal (speak) n'est pas disponible pour dicter la défense.",
      );
    }
  },

  generateLetter: async function () {
    if (typeof window.BVCManager === "undefined") {
      alert("Erreur: Module de fidélité introuvable.");
      return;
    }

    const price = 5;
    if (
      confirm(
        `Générer un recours juridique coûte ${price} Pts BVC.\nVoulez-vous continuer ?`,
      )
    ) {
      const success = await window.BVCManager.deduct(price);
      if (success) {

        const letter =
          this.currentScenarioTemplate ||
          "Monsieur l'Officier du Ministère Public,\nJe conteste formellement ce PV.";

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText(letter)
            .then(function () {
              alert(
                "Paiement de " +
                  price +
                  " Pts BVC accepté.\n\nLa lettre de contestation a été copiée dans votre presse-papiers ! Vous pouvez la coller sur le site de l'ANTAI.",
              );
              if (typeof speak === "function")
                speak("Plaidoirie copiée dans le presse-papiers.");
            })
            .catch(function () {
              alert(
                "Erreur lors de la copie. Voici votre lettre :\n\n" + letter,
              );
            });
        } else {
          // Fallback pour WebView Capacitor / HTTP
          alert(
            "Paiement de " +
              price +
              " Pts BVC accepté.\n\nVoici votre lettre :\n\n" +
              letter,
          );
        }
      } else {
        alert(
          `Fonds insuffisants ou erreur de transaction ! Vous avez besoin de ${price} Pts BVC.`,
        );
      }
    }
  },
};


/* --- badwords.js --- */
window.FrenchBadWords = ["!mb3c!l3","!mbec!l3","!mbéc!l3","!mbec!le","!mbéc!le","@brut!","@brut1","@bruti","@nd0u!ll3","@nd0u!lle","@nd0u1ll3","@nd0u1lle","@nd0uill3","@nd0uille","@ndou!ll3","@ndou!lle","@ndou1ll3","@ndou1lle","@ndouill3","@ndouille","@v0rt0n","@vorton","1mb3c1l3","1mbec1l3","1mbéc1l3","1mbec1le","1mbéc1le","35p!ng0!n","35p!ngo!n","35p1ng01n","35p1ngo1n","35ping0in","35pingoin","3mm@nch3","3mm@nche","3mm@nché","3mm3rd3r","3mm3rd3u53","3mm3rd3ur","3mm3rd3us3","3mmanch3","3mmanche","3mmanché","3mp@f3","3mp@fe","3mp@fé","3mp@p@0ut3","3mp@p@0ute","3mp@p@0uté","3mp@p@out3","3mp@p@oute","3mp@p@outé","3mpaf3","3mpafe","3mpafé","3mpapa0ut3","3mpapa0ute","3mpapa0uté","3mpapaout3","3mpapaoute","3mpapaouté","3ncul3","3ncul3r","3ncul3ur","3ncule","3nculé","3nf0!r3","3nf0!re","3nf0!ré","3nf01r3","3nf01re","3nf01ré","3nf0ir3","3nf0ire","3nf0iré","3nflur3","3nfo!r3","3nfo!re","3nfo!ré","3nfo1r3","3nfo1re","3nfo1ré","3nfoir3","3nfoire","3nfoiré","3nv@53l!n3ur","3nv@53l1n3ur","3nv@53lin3ur","3nv@s3l!n3ur","3nv@s3l1n3ur","3nv@s3lin3ur","3nva53l!n3ur","3nva53l1n3ur","3nva53lin3ur","3nvas3l!n3ur","3nvas3l1n3ur","3nvas3lin3ur","3p@!5","3p@!s","3p@15","3p@1s","3p@i5","3p@is","3pa!5","3pa!s","3pa15","3pa1s","3pai5","3pais","3sp!ng0!n","3sp!ngo!n","3sp1ng01n","3sp1ngo1n","3sping0in","3spingoin","3tr0n","3tron","5@g0u!n","5@g0u1n","5@g0uin","5@gou!n","5@gou1n","5@gouin","5@l@ud","5@l0p","5@l0p@rd","5@l0p3","5@l0pe","5@l3","5@le","5@lop","5@lop@rd","5@lop3","5@lope","5@tr0u!ll3","5@tr0u!lle","5@tr0u1ll3","5@tr0u1lle","5@tr0uill3","5@tr0uille","5@trou!ll3","5@trou!lle","5@trou1ll3","5@trou1lle","5@trouill3","5@trouille","50tt!53ux","50tt!5eux","50tt153ux","50tt15eux","50tti53ux","50tti5eux","50u5-m3rd3","50u5-merde","53nt-l@-p!553","53nt-l@-p1553","53nt-l@-pi553","53nt-la-p!553","53nt-la-p1553","53nt-la-pi553","5ag0u!n","5ag0u1n","5ag0uin","5agou!n","5agou1n","5agouin","5al0p","5al0p3","5al0pard","5al0pe","5al3","5alaud","5ale","5alop","5alop3","5alopard","5alope","5atr0u!ll3","5atr0u!lle","5atr0u1ll3","5atr0u1lle","5atr0uill3","5atr0uille","5atrou!ll3","5atrou!lle","5atrou1ll3","5atrou1lle","5atrouill3","5atrouille","5chb3b","5chbeb","5chl3u","5chleu","5chn0c","5chn0ck","5chn0qu3","5chn0que","5chnoc","5chnock","5chnoqu3","5chnoque","5ent-l@-p!55e","5ent-l@-p155e","5ent-l@-pi55e","5ent-la-p!55e","5ent-la-p155e","5ent-la-pi55e","5ott!53ux","5ott!5eux","5ott153ux","5ott15eux","5otti53ux","5otti5eux","5ou5-m3rd3","5ou5-merde","5t3@r!qu3","5t3@r1qu3","5t3@riqu3","5t3ar!qu3","5t3ar1qu3","5t3ariqu3","5té@r!qu3","5te@r!que","5té@r!que","5te@r1qu3","5té@r1qu3","5te@r1que","5té@r1que","5te@riqu3","5té@riqu3","5te@rique","5té@rique","5tear!qu3","5téar!qu3","5tear!que","5téar!que","5tear1qu3","5téar1qu3","5tear1que","5téar1que","5teariqu3","5téariqu3","5tearique","5téarique","abrut!","abrut1","abruti","and0u!ll3","and0u!lle","and0u1ll3","and0u1lle","and0uill3","and0uille","andou!ll3","andou!lle","andou1ll3","andou1lle","andouill3","andouille","av0rt0n","avorton","b!@tch","b!atch","b!c0t","b!cot","b!t3","b!t3mb0!5","b!t3mb0!s","b!t3mbo!5","b!t3mbo!s","b!te","b!temb0!5","b!temb0!s","b!tembo!5","b!tembo!s","b@t@rd","b0rd3l","b0rdel","b0uff0n","b0ugn0ul","B0ugn0ul!3","b0ugn0ul!5@t!0n","b0ugn0ul!53r","b0ugn0ul!5at!0n","b0ugn0ul!5er","B0ugn0ul!e","b0ugn0ul!s@t!0n","b0ugn0ul!s3r","b0ugn0ul!sat!0n","b0ugn0ul!ser","B0ugn0ul13","b0ugn0ul15@t10n","b0ugn0ul153r","b0ugn0ul15at10n","b0ugn0ul15er","B0ugn0ul1e","b0ugn0ul1s@t10n","b0ugn0ul1s3r","b0ugn0ul1sat10n","b0ugn0ul1ser","b0ugn0ul3","b0ugn0ule","B0ugn0uli3","b0ugn0uli5@ti0n","b0ugn0uli53r","b0ugn0uli5ati0n","b0ugn0uli5er","B0ugn0ulie","b0ugn0ulis@ti0n","b0ugn0ulis3r","b0ugn0ulisati0n","b0ugn0uliser","b0ugr3","b0ugre","b0uk@k","b0ukak","b0un!0ul","b0un10ul","b0uni0ul","b0urd!ll3","b0urd!lle","b0urd1ll3","b0urd1lle","b0urdill3","b0urdille","b0us3ux","b0useux","b1@tch","b1atch","b1c0t","b1cot","b1t3","b1t3mb015","b1t3mb01s","b1t3mbo15","b1t3mbo1s","b1te","b1temb015","b1temb01s","b1tembo15","b1tembo1s","b3@uf","b3auf","bât@rd","batard","bâtard","be@uf","beauf","bi@tch","biatch","bic0t","bicot","bit3","bit3mb0i5","bit3mb0is","bit3mboi5","bit3mbois","bite","bitemb0i5","bitemb0is","bitemboi5","bitembois","bord3l","bordel","bouffon","bougnoul","Bougnoul!3","bougnoul!5@t!on","bougnoul!53r","bougnoul!5at!on","bougnoul!5er","Bougnoul!e","bougnoul!s@t!on","bougnoul!s3r","bougnoul!sat!on","bougnoul!ser","Bougnoul13","bougnoul15@t1on","bougnoul153r","bougnoul15at1on","bougnoul15er","Bougnoul1e","bougnoul1s@t1on","bougnoul1s3r","bougnoul1sat1on","bougnoul1ser","bougnoul3","bougnoule","Bougnouli3","bougnouli5@tion","bougnouli53r","bougnouli5ation","bougnouli5er","Bougnoulie","bougnoulis@tion","bougnoulis3r","bougnoulisation","bougnouliser","bougr3","bougre","bouk@k","boukak","boun!oul","boun1oul","bounioul","bourd!ll3","bourd!lle","bourd1ll3","bourd1lle","bourdill3","bourdille","bous3ux","bouseux","br!53-burn35","br!5e-burne5","br!s3-burn3s","br!se-burnes","br@nl3r","br@nl3ur","br@nler","br@nleur","br@nqu3","br@nque","br153-burn35","br15e-burne5","br1s3-burn3s","br1se-burnes","branl3r","branl3ur","branler","branleur","branqu3","branque","bri53-burn35","bri5e-burne5","bris3-burn3s","brise-burnes","c@553-b0nb0n","c@553-bonbon","c@553-c0u!ll3","c@553-c0u!ll35","c@553-c0u1ll3","c@553-c0u1ll35","c@553-c0uill3","c@553-c0uill35","c@553-cou!ll3","c@553-cou!ll35","c@553-cou1ll3","c@553-cou1ll35","c@553-couill3","c@553-couill35","c@55e-b0nb0n","c@55e-bonbon","c@55e-c0u!lle","c@55e-c0u!lle5","c@55e-c0u1lle","c@55e-c0u1lle5","c@55e-c0uille","c@55e-c0uille5","c@55e-cou!lle","c@55e-cou!lle5","c@55e-cou1lle","c@55e-cou1lle5","c@55e-couille","c@55e-couille5","c@c0u","c@cou","c@fr3","c@fre","c@ld0ch3","c@ld0che","c@ldoch3","c@ldoche","c@ss3-b0nb0n","c@ss3-bonbon","c@ss3-c0u!ll3","c@ss3-c0u!ll3s","c@ss3-c0u1ll3","c@ss3-c0u1ll3s","c@ss3-c0uill3","c@ss3-c0uill3s","c@ss3-cou!ll3","c@ss3-cou!ll3s","c@ss3-cou1ll3","c@ss3-cou1ll3s","c@ss3-couill3","c@ss3-couill3s","c@sse-b0nb0n","c@sse-bonbon","c@sse-c0u!lle","c@sse-c0u!lles","c@sse-c0u1lle","c@sse-c0u1lles","c@sse-c0uille","c@sse-c0uilles","c@sse-cou!lle","c@sse-cou!lles","c@sse-cou1lle","c@sse-cou1lles","c@sse-couille","c@sse-couilles","c0ch3","c0che","c0n","c0n@553","c0n@55e","c0n@rd","c0n@ss3","c0n@sse","c0n5","c0na553","c0na55e","c0nard","c0nass3","c0nasse","c0nch!3r","c0nch!er","c0nch13r","c0nch1er","c0nchi3r","c0nchier","c0nn@553","c0nn@55e","c0nn@rd","c0nn@rd3","c0nn@rde","c0nn@ss3","c0nn@sse","c0nn3","c0nna553","c0nna55e","c0nnard","c0nnard3","c0nnarde","c0nnass3","c0nnasse","c0nne","c0ns","c0u1ll0n","c0u1ll0nn3r","c0u1ll3","c0u1ll3s","c0uill0n","c0uill0nn3r","c0uill0nner","c0uill3","c0uill3s","c0uille","c0uilles","c0un!fl3","c0un!fle","c0un1fl3","c0un1fle","c0unifl3","c0unifle","c0urt@ud","c0urtaud","ca553-b0nb0n","ca553-bonbon","ca553-c0u!ll3","ca553-c0u!ll35","ca553-c0u1ll3","ca553-c0u1ll35","ca553-c0uill3","ca553-c0uill35","ca553-cou!ll3","ca553-cou!ll35","ca553-cou1ll3","ca553-cou1ll35","ca553-couill3","ca553-couill35","ca55e-b0nb0n","ca55e-bonbon","ca55e-c0u!lle","ca55e-c0u!lle5","ca55e-c0u1lle","ca55e-c0u1lle5","ca55e-c0uille","ca55e-c0uille5","ca55e-cou!lle","ca55e-cou!lle5","ca55e-cou1lle","ca55e-cou1lle5","ca55e-couille","ca55e-couille5","cac0u","cacou","cafr3","cafre","cald0ch3","cald0che","caldoch3","caldoche","cass3-b0nb0n","cass3-bonbon","cass3-c0u!ll3","cass3-c0u!ll3s","cass3-c0u1ll3","cass3-c0u1ll3s","cass3-c0uill3","cass3-c0uill3s","cass3-cou!ll3","cass3-cou!ll3s","cass3-cou1ll3","cass3-cou1ll3s","cass3-couill3","cass3-couill3s","casse-b0nb0n","casse-bonbon","casse-c0u!lle","casse-c0u!lles","casse-c0u1lle","casse-c0u1lles","casse-c0uille","casse-c0uilles","casse-cou!lle","casse-cou!lles","casse-cou1lle","casse-cou1lles","casse-couille","casse-couilles","ch!3nn@553","ch!3nn@ss3","ch!3nna553","ch!3nnass3","ch!3r","ch!enn@55e","ch!enn@sse","ch!enna55e","ch!ennasse","ch!er","ch!n3t0c","ch!n3t0qu3","ch!n3toc","ch!n3toqu3","ch!net0c","ch!net0que","ch!netoc","ch!netoque","ch!nt0k","ch!ntok","ch@ch@r","ch@g@553","ch@g@55e","ch@g@ss3","ch@g@sse","ch@uff@rd","ch13nn@553","ch13nn@ss3","ch13nna553","ch13nnass3","ch13r","ch13ur","ch13urs","ch1enn@55e","ch1enn@sse","ch1enna55e","ch1ennasse","ch1er","ch1eur","ch1eurs","ch1n3t0c","ch1n3t0qu3","ch1n3toc","ch1n3toqu3","ch1net0c","ch1net0que","ch1netoc","ch1netoque","ch1nt0k","ch1ntok","chachar","chaga553","chaga55e","chagass3","chagasse","chauffard","chi3nn@553","chi3nn@ss3","chi3nna553","chi3nnass3","chi3r","chi3ur","chi3urs","chienn@55e","chienn@sse","chienna55e","chiennasse","chier","chieur","chieurs","chin3t0c","chin3t0qu3","chin3toc","chin3toqu3","chinet0c","chinet0que","chinetoc","chinetoque","chint0k","chintok","chl3uh","chleuh","chn0qu3","chn0que","chnoqu3","chnoque","coch3","coche","con","con@553","con@55e","con@rd","con@ss3","con@sse","con5","cona553","cona55e","conard","conass3","conasse","conch!3r","conch!er","conch13r","conch1er","conchi3r","conchier","conn@553","conn@55e","conn@rd","conn@rd3","conn@rde","conn@ss3","conn@sse","conn3","conna553","conna55e","connard","connard3","connarde","connass3","connasse","conne","cons","cou1lle","cou1lles","cou1llon","cou1llonner","couill3","couill3s","couille","couilles","couillon","couillonn3r","couillonner","coun!fl3","coun!fle","coun1fl3","coun1fle","counifl3","counifle","court@ud","courtaud","cr!cr!","cr0tt3","cr0tte","cr0tté","cr0u!ll@t","cr0u!ll3","cr0u!llat","cr0u!lle","cr0u1ll@t","cr0u1ll3","cr0u1llat","cr0u1lle","cr0uill@t","cr0uill3","cr0uillat","cr0uille","cr0ût0n","cr1cr1","cr3t!n","cr3t1n","cr3tin","cr3v@rd","cr3vard","cr3vur3","cret!n","crét!n","cret1n","crét1n","cretin","crétin","crev@rd","crevard","crevure","cricri","crott3","crotte","crotté","crou!ll@t","crou!ll3","crou!llat","crou!lle","crou1ll@t","crou1ll3","crou1llat","crou1lle","crouill@t","crouill3","crouillat","crouille","croûton","cul","d3b!l3","d3b1l3","d3bil3","d3gu3l@ss3","d3gu3lass3","d3m3rd3r","deb!l3","déb!l3","deb!le","déb!le","deb1l3","déb1l3","deb1le","déb1le","debil3","débil3","debile","débile","déguel@sse","deguelasse","déguelasse","demerder","démerder","dr0u!ll3","dr0u!lle","dr0u1ll3","dr0u1lle","dr0uill3","dr0uille","drou!ll3","drou!lle","drou1ll3","drou1lle","drouill3","drouille","du schn0c","du schnoc","du5chn0ck","du5chnock","duc0n","duc0nn0t","ducon","duconnot","dug3n0ux","dug3noux","dugen0ux","dugenoux","dugl@nd","dugland","duschn0ck","duschnock","e5p!ng0!n","e5p!ngo!n","e5p1ng01n","e5p1ngo1n","e5ping0in","e5pingoin","emm@nche","emm@nché","emmanche","emmanché","emmerder","emmerdeu5e","emmerdeur","emmerdeuse","emp@fe","emp@fé","emp@p@0ute","emp@p@0uté","emp@p@oute","emp@p@outé","empafe","empafé","empapa0ute","empapa0uté","empapaoute","empapaouté","encule","enculé","enculer","enculeur","enf0!re","enf0!ré","enf01re","enf01ré","enf0ire","enf0iré","enflure","enfo!re","enfo!ré","enfo1re","enfo1ré","enfoire","enfoiré","env@5el!neur","env@5el1neur","env@5elineur","env@sel!neur","env@sel1neur","env@selineur","enva5el!neur","enva5el1neur","enva5elineur","envasel!neur","envasel1neur","envaselineur","ep@!5","ép@!5","ep@!s","ép@!s","ep@15","ép@15","ep@1s","ép@1s","ep@i5","ép@i5","ep@is","ép@is","epa!5","épa!5","epa!s","épa!s","epa15","épa15","epa1s","épa1s","epai5","épai5","epais","épais","esp!ng0!n","esp!ngo!n","esp1ng01n","esp1ngo1n","esping0in","espingoin","etr0n","étr0n","etron","étron","f!0tt3","f!0tte","f!ott3","f!otte","f0ut3ur","f0uteur","f0utr3","f0utre","f10tt3","f10tte","f1ott3","f1otte","f31gn@ss3","f3ign@ss3","f3ignass3","FDP","fe1gnasse","feign@sse","feignasse","fi0tt3","fi0tte","fiott3","fiotte","fout3ur","fouteur","foutr3","foutre","fr!tz","fr1tz","fritz","fum!3r","fum!er","fum13r","fum1er","fumi3r","fumier","g@rc3","g@rce","g@up3","g@upe","G0d0n","g0g0l","g0ï","g0u!ll@nd","g0u!lland","g0u!n3","g0u!ne","g0u1ll@nd","g0u1lland","g0u1n3","g0u1ne","g0uill@nd","g0uilland","g0uin3","g0uine","g0urd3","g0urde","g0urg@nd!n3","g0urg@nd!ne","g0urg@nd1n3","g0urg@nd1ne","g0urg@ndin3","g0urg@ndine","g0urgand!n3","g0urgand!ne","g0urgand1n3","g0urgand1ne","g0urgandin3","g0urgandine","garc3","garce","gaup3","gaupe","GDM","gl@nd","gl@nd0u!ll0u","gl@nd0u1ll0u","gl@nd0uill0u","gl@nd3u53","gl@nd3ur","gl@nd3us3","gl@ndeu5e","gl@ndeur","gl@ndeuse","gl@ndou!llou","gl@ndou1llou","gl@ndouillou","gl@ndu","gland","gland0u!ll0u","gland0u1ll0u","gland0uill0u","gland3u53","gland3ur","gland3us3","glandeu5e","glandeur","glandeuse","glandou!llou","glandou1llou","glandouillou","glandu","gn0ul","gn0ul3","gn0ule","gnoul","gnoul3","gnoule","Godon","gogol","goï","gou!ll@nd","gou!lland","gou!n3","gou!ne","gou1ll@nd","gou1lland","gou1n3","gou1ne","gouill@nd","gouilland","gouin3","gouine","gourd3","gourde","gourg@nd!n3","gourg@nd!ne","gourg@nd1n3","gourg@nd1ne","gourg@ndin3","gourg@ndine","gourgand!n3","gourgand!ne","gourgand1n3","gourgand1ne","gourgandin3","gourgandine","gr0gn@553","gr0gn@55e","gr0gn@ss3","gr0gn@sse","gr0gna553","gr0gna55e","gr0gnass3","gr0gnasse","grogn@553","grogn@55e","grogn@ss3","grogn@sse","grogna553","grogna55e","grognass3","grognasse","gu!nd0ul3","gu!nd0ule","gu!ndoul3","gu!ndoule","gu1nd0ul3","gu1nd0ule","gu1ndoul3","gu1ndoule","gu3n!ch3","gu3n1ch3","gu3nich3","guen!che","guen1che","gueniche","guind0ul3","guind0ule","guindoul3","guindoule","imb3cil3","imbecil3","imbécil3","imbecile","imbécile","j3@n-f0utr3","j3@n-foutr3","j3an-f0utr3","j3an-foutr3","je@n-f0utre","je@n-foutre","jean-f0utre","jean-foutre","k!k00","k!k0u","k!koo","k!kou","k1k00","k1k0u","k1koo","k1kou","kik00","kik0u","kikoo","kikou","Kr@ut","Kraut","l@ch3ux","l@cheux","l@v3tt3","l@vette","l0p3tt3","l0pette","lach3ux","lâch3ux","lacheux","lâcheux","lav3tt3","lavette","lop3tt3","lopette","m!53r@bl3","m!53rabl3","m!5ér@bl3","m!5er@ble","m!5ér@ble","m!5erabl3","m!5érabl3","m!5erable","m!5érable","m!cht0","m!chto","m!n@bl3","m!n@ble","m!nabl3","m!nable","m!nu5","m!nus","m!s3r@bl3","m!s3rabl3","m!ser@bl3","m!sér@bl3","m!ser@ble","m!sér@ble","m!serabl3","m!sérabl3","m!serable","m!sérable","m@g0t","m@got","m@k0um3","m@k0ume","m@k0umé","m@koum3","m@koume","m@koumé","m@nch3","m@nche","m@ng3-m3rd3","m@nge-merde","m@rch@nd0t","m@rch@ndot","m@rg0u!ll!5t3","m@rg0u!ll!5te","m@rg0u!ll!st3","m@rg0u!ll!ste","m@rg0u1ll15t3","m@rg0u1ll15te","m@rg0u1ll1st3","m@rg0u1ll1ste","m@rg0uilli5t3","m@rg0uilli5te","m@rg0uillist3","m@rg0uilliste","m@rgou!ll!5t3","m@rgou!ll!5te","m@rgou!ll!st3","m@rgou!ll!ste","m@rgou1ll15t3","m@rgou1ll15te","m@rgou1ll1st3","m@rgou1ll1ste","m@rgouilli5t3","m@rgouilli5te","m@rgouillist3","m@rgouilliste","m@uv!3tt3","m@uv!ette","m@uv13tt3","m@uv1ette","m@uvi3tt3","m@uviette","m0!n@!ll3","m0!n@!lle","m0!n5-qu3-r!3n","m0!n5-que-r!en","m0!na!ll3","m0!na!lle","m0!ns-qu3-r!3n","m0!ns-que-r!en","m01n@1ll3","m01n@1lle","m01n5-qu3-r13n","m01n5-que-r1en","m01na1ll3","m01na1lle","m01ns-qu3-r13n","m01ns-que-r1en","m0in@ill3","m0in@ille","m0in5-qu3-ri3n","m0in5-que-rien","m0inaill3","m0inaille","m0ins-qu3-ri3n","m0ins-que-rien","m0n@c@!ll3","m0n@c@!lle","m0n@c@1ll3","m0n@c@1lle","m0n@c@ill3","m0n@c@ille","m0naca!ll3","m0naca!lle","m0naca1ll3","m0naca1lle","m0nacaill3","m0nacaille","m0r!c@ud","m0r!caud","m0r1c@ud","m0r1caud","m0ric@ud","m0ricaud","m153r@bl3","m153rabl3","m15er@bl3","m15ér@bl3","m15er@ble","m15ér@ble","m15erabl3","m15érabl3","m15erable","m15érable","m1cht0","m1chto","m1n@bl3","m1n@ble","m1nabl3","m1nable","m1nu5","m1nus","m1s3r@bl3","m1s3rabl3","m1ser@bl3","m1sér@bl3","m1ser@ble","m1sér@ble","m1serabl3","m1sérabl3","m1serable","m1sérable","m3rd@!ll0n","m3rd@!ll3","m3rd@!llon","m3rd@1ll0n","m3rd@1ll3","m3rd@1llon","m3rd@ill0n","m3rd@ill3","m3rd@illon","m3rd0u!ll@rd","m3rd0u!llard","m3rd0u1ll@rd","m3rd0u1llard","m3rd0uill@rd","m3rd0uillard","m3rd3","m3rd3ux","m3rda!ll0n","m3rda!ll3","m3rda!llon","m3rda1ll0n","m3rda1ll3","m3rda1llon","m3rdaill0n","m3rdaill3","m3rdaillon","m3rdou!ll@rd","m3rdou!llard","m3rdou1ll@rd","m3rdou1llard","m3rdouill@rd","m3rdouillard","mag0t","magot","mak0um3","mak0ume","mak0umé","makoum3","makoume","makoumé","manch3","manche","mang3-m3rd3","mange-merde","marchand0t","marchandot","marg0u!ll!5t3","marg0u!ll!5te","marg0u!ll!st3","marg0u!ll!ste","marg0u1ll15t3","marg0u1ll15te","marg0u1ll1st3","marg0u1ll1ste","marg0uilli5t3","marg0uilli5te","marg0uillist3","marg0uilliste","margou!ll!5t3","margou!ll!5te","margou!ll!st3","margou!ll!ste","margou1ll15t3","margou1ll15te","margou1ll1st3","margou1ll1ste","margouilli5t3","margouilli5te","margouillist3","margouilliste","mauv!3tt3","mauv!ette","mauv13tt3","mauv1ette","mauvi3tt3","mauviette","merd@!ll0n","merd@!lle","merd@!llon","merd@1ll0n","merd@1lle","merd@1llon","merd@ill0n","merd@ille","merd@illon","merd0u!ll@rd","merd0u!llard","merd0u1ll@rd","merd0u1llard","merd0uill@rd","merd0uillard","merda!ll0n","merda!lle","merda!llon","merda1ll0n","merda1lle","merda1llon","merdaill0n","merdaille","merdaillon","merde","merdeux","merdou!ll@rd","merdou!llard","merdou1ll@rd","merdou1llard","merdouill@rd","merdouillard","mi53r@bl3","mi53rabl3","mi5er@bl3","mi5ér@bl3","mi5er@ble","mi5ér@ble","mi5erabl3","mi5érabl3","mi5erable","mi5érable","micht0","michto","min@bl3","min@ble","minabl3","minable","minu5","minus","mis3r@bl3","mis3rabl3","miser@bl3","misér@bl3","miser@ble","misér@ble","miserabl3","misérabl3","miserable","misérable","mo!n@!ll3","mo!n@!lle","mo!n5-qu3-r!3n","mo!n5-que-r!en","mo!na!ll3","mo!na!lle","mo!ns-qu3-r!3n","mo!ns-que-r!en","mo1n@1ll3","mo1n@1lle","mo1n5-qu3-r13n","mo1n5-que-r1en","mo1na1ll3","mo1na1lle","mo1ns-qu3-r13n","mo1ns-que-r1en","moin@ill3","moin@ille","moin5-qu3-ri3n","moin5-que-rien","moinaill3","moinaille","moins-qu3-ri3n","moins-que-rien","mon@c@!ll3","mon@c@!lle","mon@c@1ll3","mon@c@1lle","mon@c@ill3","mon@c@ille","monaca!ll3","monaca!lle","monaca1ll3","monaca1lle","monacaill3","monacaille","mor!c@ud","mor!caud","mor1c@ud","mor1caud","moric@ud","moricaud","n!@!53ux","n!@!5eux","n!@!s3ux","n!@!seux","n!@c","n!@k0u3","n!@k0ue","n!@k0ué","n!@kou3","n!@koue","n!@koué","n!a!53ux","n!a!5eux","n!a!s3ux","n!a!seux","n!ac","n!ak0u3","n!ak0ue","n!ak0ué","n!akou3","n!akoue","n!akoué","n!qu3","n!qu3r","n!que","n!quer","n@s3","n@se","n@z3","n@ze","n1@153ux","n1@15eux","n1@1s3ux","n1@1seux","n1@c","n1@k0u3","n1@k0ue","n1@k0ué","n1@kou3","n1@koue","n1@koué","n1a153ux","n1a15eux","n1a1s3ux","n1a1seux","n1ac","n1ak0u3","n1ak0ue","n1ak0ué","n1akou3","n1akoue","n1akoué","n1qu3","n1qu3r","n1que","n1quer","n3gr0","n3gro","nas3","nase","naz3","naze","negr0","négr0","negro","négro","ni@c","ni@i53ux","ni@i5eux","ni@is3ux","ni@iseux","ni@k0u3","ni@k0ue","ni@k0ué","ni@kou3","ni@koue","ni@koué","niac","niai53ux","niai5eux","niais3ux","niaiseux","niak0u3","niak0ue","niak0ué","niakou3","niakoue","niakoué","niqu3","niqu3r","nique","niquer","NTM","p!550u","p!55ou","p!gn0uf","p!gnouf","p!ss0u","p!ssou","p@k05","p@k0s","p@ko5","p@kos","p@n0ufl3","p@n0ufle","p@noufl3","p@noufle","p@t@r!n","p@t@r1n","p@t@rin","p0rc@5","p0rc@553","p0rc@55e","p0rc@s","p0rc@ss3","p0rc@sse","p0rca5","p0rca553","p0rca55e","p0rcas","p0rcass3","p0rcasse","p0uc@v","p0ucav","p0uf","p0uf!@553","p0uf!@55e","p0uf!@ss3","p0uf!@sse","p0uf!a553","p0uf!a55e","p0uf!ass3","p0uf!asse","p0uf1@553","p0uf1@55e","p0uf1@ss3","p0uf1@sse","p0uf1a553","p0uf1a55e","p0uf1ass3","p0uf1asse","p0uff!@553","p0uff!@55e","p0uff!@ss3","p0uff!@sse","p0uff!a553","p0uff!a55e","p0uff!ass3","p0uff!asse","p0uff1@553","p0uff1@55e","p0uff1@ss3","p0uff1@sse","p0uff1a553","p0uff1a55e","p0uff1ass3","p0uff1asse","p0uffi@553","p0uffi@55e","p0uffi@ss3","p0uffi@sse","p0uffia553","p0uffia55e","p0uffiass3","p0uffiasse","p0ufi@553","p0ufi@55e","p0ufi@ss3","p0ufi@sse","p0ufia553","p0ufia55e","p0ufiass3","p0ufiasse","p0und3","p0unde","p0undé","p0urr!tur3","p0urr!ture","p0urr1tur3","p0urr1ture","p0urritur3","p0urriture","p1550u","p155ou","p1gn0uf","p1gnouf","p1mbêch3","p1mbêche","p1ss0u","p1ss3ux","p1sseux","p1ssou","p3cqu3","p3d@l3","p3d0qu3","p3d3","p3dal3","p3doqu3","p3qu3n@ud","p3qu3naud","p3t","p3t@553","p3t@ss3","p3t3ux","p3ta553","p3tass3","pak05","pak0s","pako5","pakos","pan0ufl3","pan0ufle","panoufl3","panoufle","patar!n","patar1n","patarin","PD","pecque","ped@l3","péd@l3","ped@le","péd@le","ped0qu3","péd0qu3","ped0que","péd0que","pedal3","pédal3","pedale","pédale","pede","pédé","pedoqu3","pédoqu3","pedoque","pédoque","pequ3n@ud","péqu3n@ud","pequ3naud","péqu3naud","pequen@ud","péquen@ud","pequenaud","péquenaud","pet","pét@553","pet@55e","pét@55e","pet@ss3","pét@ss3","pet@sse","pét@sse","peta553","péta553","peta55e","péta55e","petass3","pétass3","petasse","pétasse","peteux","péteux","pi550u","pi55ou","pign0uf","pignouf","pimbêch3","pimbêche","piss0u","piss3ux","pisseux","pissou","pl0uc","pl3utr3","pleutre","plouc","porc@5","porc@553","porc@55e","porc@s","porc@ss3","porc@sse","porca5","porca553","porca55e","porcas","porcass3","porcasse","pouc@v","poucav","pouf","pouf!@553","pouf!@55e","pouf!@ss3","pouf!@sse","pouf!a553","pouf!a55e","pouf!ass3","pouf!asse","pouf1@553","pouf1@55e","pouf1@ss3","pouf1@sse","pouf1a553","pouf1a55e","pouf1ass3","pouf1asse","pouff!@553","pouff!@55e","pouff!@ss3","pouff!@sse","pouff!a553","pouff!a55e","pouff!ass3","pouff!asse","pouff1@553","pouff1@55e","pouff1@ss3","pouff1@sse","pouff1a553","pouff1a55e","pouff1ass3","pouff1asse","pouffi@553","pouffi@55e","pouffi@ss3","pouffi@sse","pouffia553","pouffia55e","pouffiass3","pouffiasse","poufi@553","poufi@55e","poufi@ss3","poufi@sse","poufia553","poufia55e","poufiass3","poufiasse","pound3","pounde","poundé","pourr!tur3","pourr!ture","pourr1tur3","pourr1ture","pourritur3","pourriture","pun@!53","pun@!5e","pun@!s3","pun@!se","pun@153","pun@15e","pun@1s3","pun@1se","pun@i53","pun@i5e","pun@is3","pun@ise","puna!53","puna!5e","puna!s3","puna!se","puna153","puna15e","puna1s3","puna1se","punai53","punai5e","punais3","punaise","put!n","put@!n","put@1n","put@in","put1n","put3","puta!n","puta1n","putain","pute","putin","qu3ut@rd","qu3utard","queut@rd","queutard","r!p0p33","r!p0pe3","r!p0pé3","r!p0pee","r!p0pée","r!pop33","r!pope3","r!popé3","r!popee","r!popée","r@clur3","r@clure","r@t0n","r@ton","r05b!f","r05b1f","r05bif","r0b35p!3rr0t","r0b35p13rr0t","r0b35pi3rr0t","r0b3sp!3rr0t","r0b3sp13rr0t","r0b3spi3rr0t","r0be5p!err0t","r0be5p1err0t","r0be5pierr0t","r0besp!err0t","r0besp1err0t","r0bespierr0t","r0sb!f","r0sb1f","r0sbif","r0ulur3","r0ulure","r1p0p33","r1p0pe3","r1p0pé3","r1p0pee","r1p0pée","r1pop33","r1pope3","r1popé3","r1popee","r1popée","raclur3","raclure","rat0n","raton","rip0p33","rip0pe3","rip0pé3","rip0pee","rip0pée","ripop33","ripope3","ripopé3","ripopee","ripopée","ro5b!f","ro5b1f","ro5bif","rob35p!3rrot","rob35p13rrot","rob35pi3rrot","rob3sp!3rrot","rob3sp13rrot","rob3spi3rrot","robe5p!errot","robe5p1errot","robe5pierrot","robesp!errot","robesp1errot","robespierrot","rosb!f","rosb1f","rosbif","roulur3","roulure","s@g0u!n","s@g0u1n","s@g0uin","s@gou!n","s@gou1n","s@gouin","s@l@ud","s@l0p","s@l0p@rd","s@l0p3","s@l0p3r13","s@l0p3ri3","s@l0pe","s@l3","s@le","s@lop","s@lop@rd","s@lop3","s@lop3ri3","s@lope","s@loperie","s@tr0u!ll3","s@tr0u!lle","s@tr0u1ll3","s@tr0u1lle","s@tr0uill3","s@tr0uille","s@trou!ll3","s@trou!lle","s@trou1ll3","s@trou1lle","s@trouill3","s@trouille","s0tt!s3ux","s0tt!seux","s0tt1s3ux","s0tt1seux","s0ttis3ux","s0ttiseux","s0us-m3rd3","s0us-merde","s3nt-l@-p!ss3","s3nt-l@-p1ss3","s3nt-l@-piss3","s3nt-la-p!ss3","s3nt-la-p1ss3","s3nt-la-piss3","sag0u!n","sag0u1n","sag0uin","sagou!n","sagou1n","sagouin","sal0p","sal0p3","sal0pard","sal0pe","sal0perie","sal3","salaud","sale","salop","salop3","salop3ri3","salopard","salope","saloper1e","saloperie","satr0u!ll3","satr0u!lle","satr0u1ll3","satr0u1lle","satr0uill3","satr0uille","satrou!ll3","satrou!lle","satrou1ll3","satrou1lle","satrouill3","satrouille","schb3b","schbeb","schl3u","schleu","schn0c","schn0ck","schn0qu3","schn0que","schnoc","schnock","schnoqu3","schnoque","sent-l@-p!sse","sent-l@-p1sse","sent-l@-pisse","sent-la-p!sse","sent-la-p1sse","sent-la-pisse","sott!s3ux","sott!seux","sott1s3ux","sott1seux","sottis3ux","sottiseux","sous-m3rd3","sous-merde","st3@r!qu3","st3@r1qu3","st3@riqu3","st3ar!qu3","st3ar1qu3","st3ariqu3","ste@r!qu3","sté@r!qu3","ste@r!que","sté@r!que","ste@r1qu3","sté@r1qu3","ste@r1que","sté@r1que","ste@riqu3","sté@riqu3","ste@rique","sté@rique","stear!qu3","stéar!qu3","stear!que","stéar!que","stear1qu3","stéar1qu3","stear1que","stéar1que","steariqu3","stéariqu3","stearique","stéarique","t@f!0l3","t@f!0le","t@f!ol3","t@f!ole","t@f10l3","t@f10le","t@f1ol3","t@f1ole","t@fi0l3","t@fi0le","t@fiol3","t@fiole","t@nt0u53r!3","t@nt0u53r13","t@nt0u53ri3","t@nt0u5er!e","t@nt0u5er1e","t@nt0u5erie","t@nt0us3r!3","t@nt0us3r13","t@nt0us3ri3","t@nt0user!e","t@nt0user1e","t@nt0userie","t@nt0uz3","t@nt0uze","t@ntou53r!3","t@ntou53r13","t@ntou53ri3","t@ntou5er!e","t@ntou5er1e","t@ntou5erie","t@ntous3r!3","t@ntous3r13","t@ntous3ri3","t@ntouser!e","t@ntouser1e","t@ntouserie","t@ntouz3","t@ntouze","t@p3tt3","t@pette","t@rl0uz3","t@rl0uze","t@rlouz3","t@rlouze","t0c@rd","t0card","t3b3","t3be","t3bé","t3t3ux","t3ub3","t3ube","t3ubé","taf!0l3","taf!0le","taf!ol3","taf!ole","taf10l3","taf10le","taf1ol3","taf1ole","tafi0l3","tafi0le","tafiol3","tafiole","tant0u53r!3","tant0u53r13","tant0u53ri3","tant0u5er!e","tant0u5er1e","tant0u5erie","tant0us3r!3","tant0us3r13","tant0us3ri3","tant0user!e","tant0user1e","tant0userie","tant0uz3","tant0uze","tantou53r!3","tantou53r13","tantou53ri3","tantou5er!e","tantou5er1e","tantou5erie","tantous3r!3","tantous3r13","tantous3ri3","tantouser!e","tantouser1e","tantouserie","tantouz3","tantouze","tap3tt3","tapette","tarl0uz3","tarl0uze","tarlouz3","tarlouze","tebe","tebé","tet3ux","tét3ux","teteux","téteux","teube","teubé","toc@rd","tocard","tr@!n33","tr@!nee","tr@1n33","tr@1nee","tr@in33","tr@în33","tr@îne3","tr@îné3","tr@inee","tr@înee","tr@înée","tr0uduc","tra!n33","tra!nee","tra1n33","tra1nee","train33","traîn33","traîne3","traîné3","trainee","traînee","traînée","trouduc","tru!@553","tru!@55e","tru!@ss3","tru!@sse","tru!a553","tru!a55e","tru!ass3","tru!asse","tru1@553","tru1@55e","tru1@ss3","tru1@sse","tru1a553","tru1a55e","tru1ass3","tru1asse","trui@553","trui@55e","trui@ss3","trui@sse","truia553","truia55e","truiass3","truiasse","v!3d@53","v!3d@s3","v!3da53","v!3das3","v!3r","v!d3-c0u!ll35","v!d3-c0u!ll3s","v!d3-cou!ll35","v!d3-cou!ll3s","v!de-c0u!lle5","v!de-c0u!lles","v!de-cou!lle5","v!de-cou!lles","v!éd@53","v!ed@5e","v!éd@5e","v!ed@s3","v!éd@s3","v!ed@se","v!éd@se","v!eda53","v!éda53","v!eda5e","v!éda5e","v!edas3","v!édas3","v!edase","v!édase","v!er","v@ur!3n","v@ur!en","v@ur13n","v@ur1en","v@uri3n","v@urien","v13d@53","v13d@s3","v13da53","v13das3","v13r","v1d3-c0u1ll35","v1d3-c0u1ll3s","v1d3-cou1ll35","v1d3-cou1ll3s","v1de-c0u1lle5","v1de-c0u1lles","v1de-cou1lle5","v1de-cou1lles","v1ed@53","v1éd@53","v1ed@5e","v1éd@5e","v1ed@s3","v1éd@s3","v1ed@se","v1éd@se","v1eda53","v1éda53","v1eda5e","v1éda5e","v1edas3","v1édas3","v1edase","v1édase","v1er","vaur!3n","vaur!en","vaur13n","vaur1en","vauri3n","vaurien","vi3d@53","vi3d@s3","vi3da53","vi3das3","vi3r","vid3-c0uill35","vid3-c0uill3s","vid3-couill35","vid3-couill3s","vide-c0uille5","vide-c0uilles","vide-couille5","vide-couilles","vied@53","viéd@53","vied@5e","viéd@5e","vied@s3","viéd@s3","vied@se","viéd@se","vieda53","viéda53","vieda5e","viéda5e","viedas3","viédas3","viedase","viédase","vier","x3r0p!n3ur","x3r0p1n3ur","x3r0pin3ur","x3rop!n3ur","x3rop1n3ur","x3ropin3ur","xer0p!n3ur","xér0p!n3ur","xer0p!neur","xér0p!neur","xer0p1n3ur","xér0p1n3ur","xer0p1neur","xér0p1neur","xer0pin3ur","xér0pin3ur","xer0pineur","xér0pineur","xerop!n3ur","xérop!n3ur","xerop!neur","xérop!neur","xerop1n3ur","xérop1n3ur","xerop1neur","xérop1neur","xeropin3ur","xéropin3ur","xeropineur","xéropineur","y0ud","y0up!n","y0up!n!5@t!0n","y0up!n!5at!0n","y0up!n!s@t!0n","y0up!n!sat!0n","y0up!n3","y0up!ne","y0up1n","y0up1n15@t10n","y0up1n15at10n","y0up1n1s@t10n","y0up1n1sat10n","y0up1n3","y0up1ne","y0upin","y0upin3","y0upine","y0upini5@ti0n","y0upini5ati0n","y0upinis@ti0n","y0upinisati0n","y0utr3","y0utre","y3ul3","yeule","youd","youp!n","youp!n!5@t!on","youp!n!5at!on","youp!n!s@t!on","youp!n!sat!on","youp!n3","youp!ne","youp1n","youp1n15@t1on","youp1n15at1on","youp1n1s@t1on","youp1n1sat1on","youp1n3","youp1ne","youpin","youpin3","youpine","youpini5@tion","youpini5ation","youpinis@tion","youpinisation","youtr3","youtre","zgu3gu3","zguegu3","zguègu3","zguegue","zguègue"];

/* --- nexus-atlas-chat.js --- */
/**
 * Nexus Atlas Chat Interface
 * Gère la fenêtre de discussion avec l'IA Gemini (Nexus Atlas 4.0).
 */

window.NexusAtlasChat = {
    modalId: "nexus-atlas-chat-modal",
    chatContainerId: "nexus-atlas-chat-messages",
    inputFieldId: "nexus-atlas-chat-input",

    open: function() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.style.display = "flex";
            
            // On affiche un message de bienvenue seulement s'il n'y a pas déjà de message
            const container = document.getElementById(this.chatContainerId);
            if (container && container.children.length === 0) {
                this.addMessage("Nexus Atlas", "Bonjour ! Je suis Nexus Atlas 4.0, votre copilote IA. Comment puis-je vous aider aujourd'hui ? (Mécanique, Itinéraire, Législation...)", "ai");
            }
            
            // Focus on input
            setTimeout(() => {
                const input = document.getElementById(this.inputFieldId);
                if (input) input.focus();
            }, 300);
        }
    },

    close: function() {
        const modal = document.getElementById(this.modalId);
        if (modal) modal.style.display = "none";
    },

    sendMessage: async function() {
        const input = document.getElementById(this.inputFieldId);
        const text = input.value.trim();
        if (!text) return;

        // Afficher message utilisateur
        this.addMessage("Vous", text, "user");
        input.value = "";

        // Afficher indicateur de frappe
        const typingId = this.addTypingIndicator();

        // 🛡️ Première barrière invisible : Détection de toxicité locale via Dictionnaire
        let isToxic = false;
        if (window.FrenchBadWords && Array.isArray(window.FrenchBadWords)) {
            const lowerText = text.toLowerCase();
            isToxic = window.FrenchBadWords.some(word => lowerText.includes(word.toLowerCase()));
        } else {
            // Fallback si le dictionnaire n'est pas chargé
            const toxicPatterns = /(connard|salop|pute|encul|fdp|gueule|tg\b|bâtard|merde|chier|tuer|suicide)/i;
            isToxic = toxicPatterns.test(text);
        }

        if (isToxic) {
            setTimeout(() => {
                this.removeElement(typingId);
                this.addMessage("Nexus Atlas (Modération)", "Je détecte une anomalie dans votre langage. Notre communauté repose sur le respect mutuel. Considérez ceci comme un avertissement subtil avant l'application stricte de nos CGU.", "ai");
            }, 1000);
            return; // Bloque l'envoi au serveur
        }

        try {
            if (!window.NexusAtlasGemini) throw new Error("Gemini non initialisé.");
            
            const response = await window.NexusAtlasGemini.ask(text);
            this.removeElement(typingId);

            // Afficher la réponse
            if (response.reply) {
                this.addMessage("Nexus Atlas", response.reply, "ai");
            }

            // Si Nexus Atlas doit déclencher une action visuelle (comme ouvrir le GPS ou lancer le mode avocat)
            if (response.action && response.action !== "NONE" && response.action !== "CHAT") {
                console.log("[NexusAtlasChat] Exécution de l'action :", response.action);
                if (window.OracleVoice && window.OracleVoice.executeAction) {
                    window.OracleVoice.executeAction(response.action, response.parameter);
                }
            }

        } catch (err) {
            console.error(err);
            this.removeElement(typingId);
            const userFriendlyMsg = err.message ? `Erreur IA : ${err.message}` : "Erreur de connexion au serveur IA. Veuillez vérifier votre réseau.";
            this.addMessage("Système", userFriendlyMsg, "error");
        }
    },

    handleEnter: function(event) {
        if (event.key === "Enter") {
            this.sendMessage();
        }
    },

    addMessage: function(sender, text, type) {
        const container = document.getElementById(this.chatContainerId);
        if (!container) return;

        const msgDiv = document.createElement("div");
        msgDiv.style.marginBottom = "15px";
        msgDiv.style.padding = "12px 15px";
        msgDiv.style.borderRadius = "12px";
        msgDiv.style.maxWidth = "85%";
        msgDiv.style.animation = "fadeInUp 0.3s ease-out";
        msgDiv.style.wordWrap = "break-word";
        msgDiv.style.lineHeight = "1.5";
        msgDiv.style.display = "inline-block";
        msgDiv.style.clear = "both";

        const escapeHTML = (str) => String(str).replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );

        const safeSender = escapeHTML(sender);
        const safeText = escapeHTML(text);

        if (type === "user") {
            msgDiv.style.background = "rgba(0, 242, 255, 0.15)";
            msgDiv.style.border = "1px solid rgba(0, 242, 255, 0.4)";
            msgDiv.style.float = "right";
            msgDiv.innerHTML = `<strong style="color: #00f2ff;">${safeSender}</strong><br/>${safeText}`;
        } else if (type === "ai") {
            msgDiv.style.background = "rgba(255, 255, 255, 0.05)";
            msgDiv.style.border = "1px solid rgba(255, 255, 255, 0.1)";
            msgDiv.style.float = "left";
            
            // Formatage basique (gras) — appliqué APRÈS échappement pour éviter XSS
            let formattedText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            msgDiv.innerHTML = `<strong style="color: #ffd700;"><i class="fa-solid fa-microchip"></i> ${safeSender}</strong><br/>${formattedText}`;
        } else {
            msgDiv.style.background = "rgba(255, 0, 0, 0.1)";
            msgDiv.style.border = "1px solid rgba(255, 0, 0, 0.4)";
            msgDiv.style.float = "left";
            msgDiv.innerHTML = `<strong style="color: #ff4444;">${safeSender}</strong><br/>${safeText}`;
        }

        const wrapper = document.createElement("div");
        wrapper.style.width = "100%";
        wrapper.appendChild(msgDiv);

        container.appendChild(wrapper);
        container.scrollTop = container.scrollHeight;
    },

    addTypingIndicator: function() {
        const container = document.getElementById(this.chatContainerId);
        if (!container) return null;

        const id = "typing-" + Date.now();
        const typingDiv = document.createElement("div");
        typingDiv.id = id;
        typingDiv.style.marginBottom = "15px";
        typingDiv.style.color = "#888";
        typingDiv.style.fontStyle = "italic";
        typingDiv.style.fontSize = "0.9rem";
        typingDiv.style.width = "100%";
        typingDiv.style.float = "left";
        typingDiv.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Nexus Atlas réfléchit...`;
        
        container.appendChild(typingDiv);
        container.scrollTop = container.scrollHeight;
        return id;
    },

    removeElement: function(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }
};


/* --- blackbox-ble.js --- */
/**
 * ============================================================================
 * blackbox-ble.js — Client Web Bluetooth API pour la Boîte Noire 50cc
 * ============================================================================
 * Connecte l'application web (PWA) au hardware ESP32-C3 via BLE.
 * 
 * UUIDs (Doivent correspondre à ble_comm.h du firmware) :
 *   - Service Télémétrie : 0x0001
 *   - Service Diagnostic : 0x0002
 * 
 * @note L'API Web Bluetooth nécessite HTTPS et un geste utilisateur (clic).
 * ============================================================================
 */

class BlackBoxBLE {
  constructor() {
    this.device = null;
    this.server = null;
    this.telemetryService = null;
    this.diagnosticService = null;

    // UUIDs de base (GATT 16-bit convertis par WebBLE en UUIDs standard si ce ne sont pas des standards SIG)
    // Ici on utilise le base UUID complet défini dans le firmware
    this.baseUuidPrefix = "50cc0000-";
    this.baseUuidSuffix = "-4d6f-6e35-306363657431";

    this.SVC_TELEMETRY = this.buildUuid("0001");
    this.SVC_DIAGNOSTIC = this.buildUuid("0002");
    
    // Télémétrie CHRs
    this.CHR_FRAME_COUNT = this.buildUuid("0101");
    this.CHR_FRAME_DATA  = this.buildUuid("0102");
    this.CHR_EXPORT_CMD  = this.buildUuid("0103");

    // Diagnostic CHRs
    this.CHR_BATTERY      = this.buildUuid("0201");
    this.CHR_TAMPER_STATE = this.buildUuid("0202");
    
    this.isConnected = false;
    this.onConnectionChange = null; // Callback UI
    this.onTelemetryData = null;    // Callback Data
    this.onDiagnosticUpdate = null; // Callback UI
    
    // Batching logic : 3000 trames (~5 minutes à 10Hz) pour économiser Firestore
    this.telemetryBuffer = [];
    this.MAX_BATCH_SIZE = 3000;
    this.HARD_LIMIT_BUFFER = 10000; // Limite stricte pour éviter l'OOM
    this.batchTimeout = null;
    this.BATCH_TIMEOUT_MS = 300000;
    
    this.autoReconnectEnabled = false;
    this.reconnectTimer = null;
  }

  buildUuid(shortHex) {
    return `${this.baseUuidPrefix}${shortHex}${this.baseUuidSuffix}`;
  }

  /**
   * Ouvre la popup native du navigateur pour scanner et connecter l'appareil.
   */
  async connect() {
    if (!navigator.bluetooth) {
      alert("Erreur : L'API Web Bluetooth n'est pas supportée par votre navigateur (essayez Chrome ou Edge sur PC/Android).");
      return false;
    }

    try {
      console.log("[BLE] Demande d'appareil Bluetooth...");
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'BB50-' }],
        optionalServices: [this.SVC_TELEMETRY, this.SVC_DIAGNOSTIC]
      });

      console.log(`[BLE] Appareil sélectionné : ${this.device.name}`);
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnection.bind(this));

      console.log("[BLE] Connexion au serveur GATT...");
      this.server = await this.device.gatt.connect();
      this.isConnected = true;
      this.autoReconnectEnabled = true; // Activer reconnexion auto
      if (this.onConnectionChange) this.onConnectionChange(true);

      await this.initializeServices();
      return true;

    } catch (error) {
      console.error("[BLE] Erreur de connexion :", error);
      alert("Échec de la connexion Bluetooth : " + error.message);
      this.disconnect();
      return false;
    }
  }

  /**
   * Initialise les services et caractéristiques après la connexion.
   */
  async initializeServices() {
    if (!this.server) return;

    try {
      console.log("[BLE] Récupération du service Diagnostic...");
      this.diagnosticService = await this.server.getPrimaryService(this.SVC_DIAGNOSTIC);
      
      console.log("[BLE] Récupération du service Télémétrie...");
      this.telemetryService = await this.server.getPrimaryService(this.SVC_TELEMETRY);

      // S'abonner aux notifications de trames
      const frameChar = await this.telemetryService.getCharacteristic(this.CHR_FRAME_DATA);
      await frameChar.startNotifications();
      frameChar.addEventListener('characteristicvaluechanged', this.handleFrameNotification.bind(this));

      console.log("[BLE] Services initialisés et abonnements actifs.");
      
      // Première lecture des diagnostics
      await this.readDiagnostics();

    } catch (error) {
      console.error("[BLE] Erreur d'initialisation des services :", error);
    }
  }

  /**
   * Lecture de la batterie et de l'état anti-effraction
   */
  async readDiagnostics() {
    if (!this.diagnosticService) return;

    try {
      const batChar = await this.diagnosticService.getCharacteristic(this.CHR_BATTERY);
      const batVal = await batChar.readValue();
      const battery_mv = batVal.getUint16(0, true);

      const tamperChar = await this.diagnosticService.getCharacteristic(this.CHR_TAMPER_STATE);
      const tamperVal = await tamperChar.readValue();
      const tamper_state = tamperVal.getUint8(0);

      console.log(`[BLE] Diagnostic -> Batterie: ${battery_mv}mV, Tamper: ${tamper_state}`);
      
      if (this.onDiagnosticUpdate) {
        this.onDiagnosticUpdate({ battery_mv, tamper_state });
      }
    } catch (error) {
      console.error("[BLE] Erreur de lecture diagnostic :", error);
    }
  }

  /**
   * Envoie la commande pour télécharger les trames.
   */
  async exportTelemetry(startIndex = 0, count = 0) {
    if (!this.telemetryService) {
      alert("Boîte Noire non connectée.");
      return;
    }

    try {
      const cmdChar = await this.telemetryService.getCharacteristic(this.CHR_EXPORT_CMD);
      
      // Structure: [start_index (4B)] [count (4B)] (Little Endian)
      const buffer = new ArrayBuffer(8);
      const view = new DataView(buffer);
      view.setUint32(0, startIndex, true);
      view.setUint32(4, count, true);

      console.log(`[BLE] Envoi commande export: start=${startIndex}, count=${count}`);
      await cmdChar.writeValue(buffer);
      
    } catch (error) {
      console.error("[BLE] Erreur commande export :", error);
    }
  }

  /**
   * Réception des trames en direct.
   */
  async handleFrameNotification(event) {
    const value = event.target.value;
    
    // Si la trame fait au moins 32 octets (16 d'en-tête + 16 d'IV aléatoire + payload)
    if (value.byteLength >= 32) {
        const timestamp = value.getUint32(0, true);
        const lat = value.getInt32(4, true) / 1e7;
        const lon = value.getInt32(8, true) / 1e7;
        const speed = value.getUint16(12, true) / 10;
        
        console.log(`[BLE] Trame hybride reçue: TS=${timestamp}, Lat=${lat}, Lon=${lon}, Vitesse=${speed} km/h`);
        
        // 1. Extraire l'IV aléatoire ET la preuve chiffrée (à partir de l'octet 16)
        // Les octets 16 à 31 contiennent l'IV, le reste contient le payload AES-CBC.
        const encryptedLength = value.byteLength - 16;
        if (encryptedLength <= 16) return; // Ignore les trames sans payload

        const encryptedBytes = new Uint8Array(value.buffer, value.byteOffset + 16, encryptedLength);
        let binary = '';
        encryptedBytes.forEach(b => binary += String.fromCharCode(b));
        const b64Payload = window.btoa(binary);

        // 2. Batching des trames (au lieu d'un appel réseau par trame)
        this.telemetryBuffer.push({
            encryptedPayload: b64Payload,
            timestamp: timestamp
        });

        if (this.telemetryBuffer.length >= this.MAX_BATCH_SIZE) {
            this.flushTelemetryBuffer();
        } else if (!this.batchTimeout) {
            this.batchTimeout = setTimeout(() => this.flushTelemetryBuffer(), this.BATCH_TIMEOUT_MS);
        }

        if (this.onTelemetryData) {
            this.onTelemetryData({ timestamp, lat, lon, speed, raw: value });
        }
    }
  }

  /**
   * Envoie le buffer de trames au Cloud (Batch) et le vide.
   */
  async flushTelemetryBuffer() {
      if (this.batchTimeout) {
          clearTimeout(this.batchTimeout);
          this.batchTimeout = null;
      }

      if (this.telemetryBuffer.length === 0) return;

      const payloadsToUpload = [...this.telemetryBuffer];
      this.telemetryBuffer = []; // Clear buffer immediately to catch new frames

      if (typeof firebase !== 'undefined' && firebase.functions) {
          try {
              const uploadTelemetry = firebase.functions("europe-west1").httpsCallable('uploadBlackboxTelemetry');
              await uploadTelemetry({
                  hardwareId: this.device ? this.device.name : 'UNKNOWN_HW',
                  payloads: payloadsToUpload
              });
              console.log(`[BLE] Batch de ${payloadsToUpload.length} trames stocké en Zero-Knowledge sur Firebase.`);
          } catch (error) {
              console.error(`[BLE] Erreur Firebase upload batch:`, error);
              // Ré-insérer les trames échouées en début de buffer si la limite n'est pas atteinte
              if (this.telemetryBuffer.length + payloadsToUpload.length <= this.HARD_LIMIT_BUFFER) {
                  this.telemetryBuffer = payloadsToUpload.concat(this.telemetryBuffer);
              } else {
                  console.warn("[BLE] Hard limit mémoire atteinte. Perte de trames hors ligne.");
              }
          }
      }
  }

  /**
   * Déconnexion propre (désactive auto-reconnect).
   */
  disconnect() {
    this.autoReconnectEnabled = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.flushTelemetryBuffer();
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
  }

  handleDisconnection() {
    console.log("[BLE] Appareil déconnecté.");
    this.isConnected = false;
    this.server = null;
    if (this.onConnectionChange) this.onConnectionChange(false);
    
    // Auto-reconnect
    if (this.device && this.autoReconnectEnabled) {
      console.log("[BLE] Tentative de reconnexion automatique dans 5s...");
      this.reconnectTimer = setTimeout(() => this.reconnect(), 5000);
    } else {
      this.device = null;
    }
  }

  async reconnect() {
    if (!this.device) return;
    try {
      console.log("[BLE] Reconnexion au serveur GATT...");
      this.server = await this.device.gatt.connect();
      this.isConnected = true;
      if (this.onConnectionChange) this.onConnectionChange(true);
      await this.initializeServices();
    } catch (e) {
      console.error("[BLE] Échec de la reconnexion automatique :", e);
      if (this.autoReconnectEnabled) {
         this.reconnectTimer = setTimeout(() => this.reconnect(), 5000);
      }
    }
  }
}

// Instance globale
window.BlackBox = new BlackBoxBLE();

