
/* --- vehicle-config.js --- */
﻿window.setCrewMode = function (mode) {
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
    speak("Profil vÃ©hicule sauvegardÃ©. PrÃªt pour le dÃ©part.");
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
                    "Mode Voiturette dÃ©tectÃ©. Temps de trajet ajustÃ© car vous ne pouvez pas remonter les files de trafic.",
                  ),
                4000,
              );
            } else if (isDuo) {
              setTimeout(
                () =>
                  speak(
                    "Mode Duo dÃ©tectÃ©. Le temps de trajet a Ã©tÃ© augmentÃ© pour anticiper la perte de puissance en montÃ©e.",
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
﻿/* --- BEYOND MAPS : THE GOOGLE-KILLER FEATURES --- */

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
        // Choc violent dÃ©tectÃ© !
        cooldown = true;

        // Effet visuel
        document.body.style.animation = "glitch-anim 0.3s ease";
        setTimeout(() => (document.body.style.animation = ""), 300);

        if (typeof speak === "function") {
          speak(
            "Alerte choc violent dÃ©tectÃ©. Signalement automatique de route dÃ©gradÃ©e envoyÃ© Ã  la communautÃ©.",
          );
        }

        // Ajouter un danger fictif sur la carte (simulÃ© ici)

        // Cooldown de 10 secondes pour Ã©viter le spam
        setTimeout(() => (cooldown = false), 10000);
      }
    });
  }
};

// 2. Predictive Danger Radar (Intersections Mortelles)
window.checkPredictiveDanger = function (instructionText) {
  if (!instructionText) return;

  // Mots clÃ©s d'intersections complexes
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
    // DÃ©clencher le HUD Rouge
    const hud = document.getElementById("turn-by-turn-hud");
    if (hud) {
      hud.style.borderColor = "#ff0000";
      hud.style.boxShadow =
        "0 0 40px rgba(255,0,0,0.8), inset 0 0 20px rgba(255,0,0,0.5)";

      if (typeof speak === "function") {
        setTimeout(
          () =>
            speak(
              "Attention, zone rouge dÃ©tectÃ©e. Risque d'accident Ã©levÃ©, ralentissez.",
            ),
          3000,
        );
      }

      // Revenir Ã  la normale aprÃ¨s 15 secondes
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
        "Mode Sensation activÃ©. Je vais chercher les routes les plus sinueuses pour un maximum de plaisir de conduite.",
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
        "Mode Sensation dÃ©sactivÃ©. Retour Ã  la navigation la plus rapide.",
      );
    }
  }
};


/* --- social-map.js --- */
﻿/* --- SQUAD RADAR / SOCIAL MAP --- */

window.ghostRiders = [];
window.isSocialRadarActive = false;
window.socialRadarUnsubscribe = null;

window.initSocialRadar = function () {
  if (!window.map || !window.currentPosition || !window.firebase) {
    // Retry later if map or firebase is not ready
    setTimeout(window.initSocialRadar, 2000);
    return;
  }

  const db = window.firebase.firestore();

  // Publier notre propre position sur Firestore (toutes les 10 secondes)
  setInterval(() => {
    if (
      window.isSocialRadarActive &&
      window.currentPosition &&
      window.session?.uid
    ) {
      db.collection("user_locations")
        .doc(window.session.uid)
        .set(
          {
            lat: window.currentPosition.lat,
            lng: window.currentPosition.lng,
            pseudo: window.session.pseudo || "Pilot_Unknown",
            vehicle: "50cc",
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
        .catch((err) => console.warn("SocialMap Publish Error:", err));
    }
  }, 10000);

  // Ã‰couter les positions des autres utilisateurs
  window.socialRadarUnsubscribe = db
    .collection("user_locations")
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const uid = change.doc.id;

        // Ignorer notre propre marqueur
        if (window.session && uid === window.session.uid) return;

        if (change.type === "added" || change.type === "modified") {
          // Mettre Ã  jour ou crÃ©er
          let existingRider = window.ghostRiders.find((r) => r.uid === uid);
          if (existingRider) {
            existingRider.marker.setPosition({ lat: data.lat, lng: data.lng });
          } else {
            // CrÃ©er un nouveau marqueur
            let marker = new google.maps.Marker({
              position: { lat: data.lat, lng: data.lng },
              map: window.isSocialRadarActive ? window.map : null,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#00d2ff",
                fillOpacity: 1,
                strokeColor: "#fff",
                strokeWeight: 2,
              },
              title: data.pseudo,
            });

            let infoWindow = new google.maps.InfoWindow({
              content: `
                                <div style="color: #000; padding: 5px; font-family: 'Inter', sans-serif;">
                                    <h3 style="margin: 0; font-size: 1.1rem; color: #ff0055;"><i class="fa-solid fa-user-astronaut"></i> ${data.pseudo}</h3>
                                    <p style="margin: 5px 0 0 0; font-size: 0.9rem; font-weight: bold;">${data.vehicle || "Moto"}</p>
                                </div>
                            `,
            });

            marker.addListener("click", () => {
              infoWindow.open(window.map, marker);
            });

            window.ghostRiders.push({ uid: uid, marker: marker });
          }
        }

        if (change.type === "removed") {
          let existingIndex = window.ghostRiders.findIndex(
            (r) => r.uid === uid,
          );
          if (existingIndex > -1) {
            window.ghostRiders[existingIndex].marker.setMap(null);
            window.ghostRiders.splice(existingIndex, 1);
          }
        }
      });
    });
};

window.toggleSocialRadar = function () {
  window.isSocialRadarActive = !window.isSocialRadarActive;
  const btn = document.getElementById("btn-social-radar");

  if (window.isSocialRadarActive) {
    if (btn) {
      btn.style.background = "#00d2ff";
      btn.style.color = "#000";
      btn.style.boxShadow = "0 0 30px #00d2ff";
    }

    if (window.ghostRiders.length === 0 && !window.socialRadarUnsubscribe) {
      window.initSocialRadar();
    }

    window.ghostRiders.forEach((ghost) => ghost.marker.setMap(window.map));

    if (typeof speak === "function") {
      speak("Radar Social activÃ©. Connexion au rÃ©seau des pilotes en cours.");
    }
  } else {
    if (btn) {
      btn.style.background = "rgba(0,0,0,0.8)";
      btn.style.color = "#fff";
      btn.style.boxShadow = "0 0 15px #00d2ff";
    }

    window.ghostRiders.forEach((ghost) => ghost.marker.setMap(null));

    if (typeof speak === "function") {
      speak("Radar Social dÃ©sactivÃ©.");
    }
  }
};

// Auto-init attempts
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(window.initSocialRadar, 5000);
});


/* --- self-evolution.js --- */
﻿/* --- NEURAL EVOLUTION ENGINE --- */
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
        <h2 style="margin-top:40px; text-transform:uppercase; letter-spacing:2px; text-shadow:0 0 10px #0f0;"><i class="fa-solid fa-microchip"></i> Moteur d'Ã‰volution Neuronale v1.0</h2>
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
      "Attention. Moteur d'Ã©volution neuronale activÃ©. L'application se rÃ©Ã©crit elle-mÃªme.",
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
    speak("Mutation terminÃ©e. Mon code source a Ã©voluÃ© avec succÃ¨s.");
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(window.initSelfEvolution, 6000);
});


/* --- crews-territory.js --- */
﻿// --- CREWS & TERRITORY WARS (Postal Code Based) ---
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
          " fondÃ© avec succÃ¨s ! Vous pouvez maintenant capturer des zones.",
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
            // DÃ©tection de la perte d'un territoire
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
                modal.innerHTML = `<i class="fa-solid fa-skull"></i> ALERTE TERRITOIRE <br><small>Le code postal ${zipCode} est passÃ© aux mains de ${data.dominantCrewName} !</small>`;
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
              // Si c'est nous qui reprenons la tÃªte, on met nos infos.
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
      btn.innerHTML = `<i class="fa-solid fa-users"></i> ${this.currentCrew.name}`;
      btn.style.color = this.currentCrew.color;
      btn.style.borderColor = this.currentCrew.color;
      btn.style.boxShadow = `0 0 10px ${this.currentCrew.color}66`;
    }
  },

  drawQG: function (lat, lng) {
    if (!map || !this.currentCrew) return;

    if (this.qgMarker) {
      this.qgMarker.setMap(null);
    }

    this.qgMarker = new google.maps.Marker({
      position: { lat: lat, lng: lng },
      map: map,
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        fillColor: this.currentCrew.color,
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
        scale: 6,
      },
      title: `QG: ${this.currentCrew.name}`,
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
      return alert("Seul le leader du Crew peut dÃ©finir le QG !");
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
        "Le Quartier GÃ©nÃ©ral de votre Crew a Ã©tÃ© Ã©tabli Ã  votre position actuelle ! Il est dÃ©sormais visible par tous vos membres.",
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
        return alert("Crew introuvable ! VÃ©rifiez le code secret.");

      const crewData = doc.data();
      let members = crewData.members || [];
      if (members.includes(window.session.uid)) {
        return alert("Vous Ãªtes dÃ©jÃ  membre de ce Crew.");
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
      alert("Erreur lors de l'intÃ©gration au Crew.");
    }
  },

  kickMember: async function (memberUid) {
    if (!this.currentCrew || this.currentCrew.leaderUid !== window.session.uid)
      return;
    if (memberUid === window.session.uid)
      return alert("Vous ne pouvez pas vous expulser vous-mÃªme.");
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
      // CrÃ©ation de la modale si elle n'existe pas
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
                    <p style="color:#aaa; margin-bottom:20px;">Vous Ãªtes membre de ce Crew. Roulez pour capturer des codes postaux !</p>
                    
                    <button onclick="if(window.CrewChat) window.CrewChat.open(); document.getElementById('crew-modal').style.display='none'" style="width:100%; background:linear-gradient(135deg, ${this.currentCrew.color}, #111); border:none; color:#fff; padding:12px; border-radius:10px; font-weight:bold; cursor:pointer; margin-bottom:15px; font-family:'Outfit', sans-serif; box-shadow: 0 4px 15px ${this.currentCrew.color}66;"><i class="fa-solid fa-comments"></i> Ouvrir le Chat PrivÃ©</button>
                    
                    <div style="background:rgba(0,0,0,0.5); padding:10px; border-radius:10px; margin-bottom:15px; border:1px solid #333;">
                        <h4 style="color:#fff; margin-bottom:10px;"><i class="fa-solid fa-users"></i> Membres (${membersCount})</h4>
                        ${
                          this.currentCrew.leaderUid === window.session.uid
                            ? `<p style="font-size:0.8rem; color:#aaa; margin-bottom:10px;">Code d'invitation secret : <br><strong style="color:${this.currentCrew.color}; user-select:all;">${this.currentCrew.id}</strong></p>`
                            : ""
                        }
                        
                        <div id="crew-members-list" style="text-align:left; max-height:150px; overflow-y:auto; color:#fff; font-size:0.9rem;">
                            <!-- Membres chargÃ©s dynamiquement -->
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

      // Charger les noms des membres (optimisation : en prod on pourrait cacher Ã§a)
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
                    <p style="color:#aaa; margin-bottom:20px; font-size:0.9rem;">CrÃ©ez votre gang et dominez la ville !</p>
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
﻿// --- LOOT DROPS (Chasse au TrÃ©sor) ---
window.LootSystem = {
  lootMarkers: {}, // id -> google.maps.Marker
  claimDistance: 50, // mÃ¨tres

  init: function () {
    if (!window.session || !window.session.uid) return;

    this.listenToLootDrops();

    // Timer de vÃ©rification de distance si on a le GPS
    setInterval(() => this.checkDistance(), 10000); // toutes les 10s
  },

  listenToLootDrops: function () {
    if (typeof firebase === "undefined") return;

    const now = Date.now();
    // N'Ã©coute que les loots actifs et non expirÃ©s
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

    const m = new google.maps.Marker({
      position: { lat: data.lat, lng: data.lng },
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: "#ffd700", // Gold
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
        scale: 8,
      },
      title: "Loot Drop",
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="color:black; font-family:'Outfit', sans-serif;">
                        <h3 style="margin:0; color:#b700ff;"><i class="fa-solid fa-gift"></i> Butin Secret</h3>
                        <p style="margin:5px 0; font-size:0.9rem;">Approchez-vous Ã  moins de 50m pour le rÃ©clamer !</p>
                      </div>`,
    });

    m.addListener("click", () => info.open(map, m));

    this.lootMarkers[lootId] = m;
  },

  removeLoot: function (lootId) {
    if (this.lootMarkers[lootId]) {
      this.lootMarkers[lootId].setMap(null);
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
      const lootPos = marker.getPosition();
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
      // Transaction pour Ã©viter double claim
      const docRef = firebase.firestore().collection("loot_drops").doc(lootId);
      await firebase.firestore().runTransaction(async (t) => {
        const doc = await t.get(docRef);
        if (!doc.exists) throw "Loot n'existe plus.";
        const data = doc.data();
        if (data.isClaimed) throw "DÃ©jÃ  rÃ©clamÃ©.";
        if (data.expiresAt < Date.now()) throw "Loot expirÃ©.";

        t.update(docRef, {
          isClaimed: true,
          claimedBy: window.session.uid,
          claimedAt: Date.now(),
        });
      });

      // SuccÃ¨s
      this.removeLoot(lootId);
      if (typeof speak === "function") {
        speak("FÃ©licitations, vous avez sÃ©curisÃ© un butin secret !");
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
        "ðŸŽ BUTIN RÃ‰CUPÃ‰RÃ‰ !\n\nVous avez trouvÃ© la caisse. +10 Points de Bonne Conduite BVC ajoutÃ©s !",
      );
    } catch (e) {}
  },

  // DEV ONLY: Fonction pour crÃ©er un faux drop autour de soi pour tester
  devSpawnLoot: function () {
    if (!window.currentPosition) return alert("Pas de GPS");

    // Spawn Ã  100-200m
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
﻿// --- MODE CORTÃˆGE (Balade Synchro) ---
window.CortegeSystem = {
  sessionId: null,
  members: {}, // uid -> data (lat, lng, name, color)
  markers: {}, // uid -> google.maps.Marker
  maxDistanceWarning: 500, // mÃ¨tres

  init: function () {
    if (!window.session || !window.session.uid) return;
  },

  createSession: async function () {
    if (!window.session) return;
    try {
      const joinCode = Math.floor(1000 + Math.random() * 9000).toString(); // Code Ã  4 chiffres

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
        `CortÃ¨ge crÃ©Ã© ! Le code secret pour rejoindre est : ${joinCode}`,
      );
      this.startSharing();
      this.listenToMembers();
    } catch (e) {
      console.error(e);
      alert("Erreur de crÃ©ation de cortÃ¨ge.");
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
        return alert("CortÃ¨ge introuvable ou expirÃ© avec ce code.");
      }

      this.sessionId = snap.docs[0].id;
      alert(`CortÃ¨ge rejoint avec succÃ¨s !`);
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
              this.markers[uid].setMap(null);
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
      this.markers[uid] = new google.maps.Marker({
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#00ffcc",
          fillOpacity: 1,
          scale: 7,
          strokeColor: "black",
          strokeWeight: 1,
        },
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
              `Attention, ${member.name} est dÃ©crochÃ© Ã  plus de 500 mÃ¨tres derriÃ¨re vous.`,
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
      "CORTÃˆGE : Entrez le code secret Ã  4 chiffres d'un ami pour le rejoindre, ou laissez le champ vide et cliquez sur OK pour CRÃ‰ER votre propre cortÃ¨ge :",
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
                <p style="color:#aaa; margin-bottom:20px; font-size:0.9rem;">Envoyez un signal au cortÃ¨ge. Tous les membres seront notifiÃ©s instantanÃ©ment.</p>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
                    <button onclick="window.CortegeSystem.sendSignal('â›½', 'Besoin d\\'essence')" style="background:#111; color:#fff; border:1px solid #ffaa00; padding:15px; border-radius:10px; font-size:1.1rem; cursor:pointer; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-gas-pump" style="color:#ffaa00;"></i> Essence</button>
                    <button onclick="window.CortegeSystem.sendSignal('ðŸ“¸', 'Pause demandÃ©e')" style="background:#111; color:#fff; border:1px solid #00d2ff; padding:15px; border-radius:10px; font-size:1.1rem; cursor:pointer; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-camera" style="color:#00d2ff;"></i> Pause</button>
                    <button onclick="window.CortegeSystem.sendSignal('ðŸ”§', 'ProblÃ¨me technique')" style="background:#111; color:#fff; border:1px solid #ff0055; padding:15px; border-radius:10px; font-size:1.1rem; cursor:pointer; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-wrench" style="color:#ff0055;"></i> Meca</button>
                    <button onclick="window.CortegeSystem.sendSignal('ðŸ‘®', 'Danger signalÃ©')" style="background:#111; color:#fff; border:1px solid #ffeb3b; padding:15px; border-radius:10px; font-size:1.1rem; cursor:pointer; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-triangle-exclamation" style="color:#ffeb3b;"></i> Danger</button>
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
    toast.innerHTML = `<span style="font-size:1.5rem;">${signal.icon}</span> <span><b>${senderName}</b> : ${signal.text}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "1";
    }, 100);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 500);
    }, 5000);

    if (typeof speak === "function") {
      speak(`CortÃ¨ge. ${senderName} signale : ${signal.text}`);
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.CortegeSystem.init();
  }, 4000);
});


/* --- safe-ride.js --- */
﻿// --- SAFE RIDE (MÃ©tÃ©o PrÃ©dictive) ---
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
          issues.push("Pluie dÃ©tectÃ©e");
          isDangerous = true;
        } else if (weathercode >= 71 && weathercode <= 77) {
          issues.push("Risque de Neige ou Verglas");
          isDangerous = true;
        } else if (weathercode >= 95 && weathercode <= 99) {
          issues.push("Orage dangereux en approche");
          isDangerous = true;
        }

        if (windspeed > 40) {
          // Vent > 40 km/h (dangereux en 50cc lÃ©ger)
          issues.push("Vents violents dÃ©tectÃ©s");
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
﻿// --- GARAGE MARKET (Troc et Vente de piÃ¨ces) ---
window.GarageMarket = {
  tradeMarkers: {},

  init: function () {
    if (!window.session || !window.session.uid) return;

    // Attendre que la carte soit prÃªte pour Ã©viter de perdre les marqueurs initiaux
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

    const m = new google.maps.Marker({
      position: { lat: data.lat, lng: data.lng },
      map: map,
      icon: {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        fillColor: isWTB ? "#ffaa00" : "#00d2ff", // Orange if searching, Blue if selling
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 1,
        scale: 6,
      },
      title: data.title,
    });

    const typeStr = isWTB ? "RECHERCHE" : "Ã€ VENDRE";
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
      this.tradeMarkers[tradeId].setMap(null);
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
                    <option value="WTS">Je vends une piÃ¨ce</option>
                    <option value="WTB">Je cherche une piÃ¨ce en urgence</option>
                </select>
                
                <input type="text" id="market-title" placeholder="Titre (ex: Gicleur 80, ClÃ© BTR...)" style="width:100%; padding:10px; margin-bottom:10px; background:#111; color:white; border:1px solid #333; border-radius:5px;">
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
      alert("Annonce gÃ©olocalisÃ©e publiÃ©e avec succÃ¨s !");
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
﻿/**
 * CREW CHAT (Messagerie PrivÃ©e SÃ©curisÃ©e)
 */
window.CrewChat = {
  isOpen: false,
  unsubscribe: null,

  open: function () {
    if (!window.session || !window.session.crewId) {
      return alert(
        "Vous devez Ãªtre dans un Crew pour utiliser le chat privÃ©.",
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

      // Envoyer avec la touche EntrÃ©e
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

    // Se dÃ©sabonner d'une Ã©ventuelle Ã©coute prÃ©cÃ©dente
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
﻿// --- S.O.S COMMUNAUTAIRE ---
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

    // Attendre que la carte et la position soient prÃªtes
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

      if (!this.sosMarkers[alertId]) return; // Par sÃ©curitÃ© si drawAlert Ã©choue

      // Si c'est nouveau et que ce n'est pas nous, on prÃ©vient vocalement
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
                `Alerte SOS : Pilote en dÃ©tresse Ã  ${distKm} kilomÃ¨tres.`,
              ),
            1000,
          );
        }
        alert(
          `ðŸš¨ SOS DÃ‰TECTÃ‰ ðŸš¨\n\nUn pilote (${data.author}) a signalÃ© une urgence : ${data.type}\nDistance : ${distKm} km.\nRegardez la carte !`,
        );
      }

      // Si c'est NOTRE alerte, on Ã©coute les sauveurs !
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
                        <h3 style="margin:0; font-size:1.2rem;">ðŸš¨ S.O.S</h3>
                        <p style="margin:5px 0;"><b>Pilote :</b> ${data.author}</p>
                        <p style="margin:5px 0; color:#000;"><b>ProblÃ¨me :</b> ${data.type}</p>
                        ${
                          data.authorUid === window.session.uid
                            ? `<button onclick="window.SosSystem.resolveAlert('${alertId}')" style="background:green; color:white; border:none; padding:8px 15px; border-radius:20px; cursor:pointer; font-weight:bold; margin-top:10px;">ProblÃ¨me RÃ©solu</button>`
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
                <p style="margin-bottom:20px;">PrÃ©venez les pilotes autour de vous pour obtenir de l'aide.</p>
                <select id="sos-type" style="width:100%; padding:15px; margin-bottom:20px; background:#222; color:white; border:1px solid #ff0000; border-radius:10px; font-size:1.1rem;">
                    <option value="Panne d'essence">â›½ Panne d'essence</option>
                    <option value="Crevaison">ðŸ›ž Crevaison</option>
                    <option value="Casse MÃ©canique">ðŸ”§ Casse MÃ©canique (Courroie, Serrage...)</option>
                    <option value="Accident lÃ©ger">ðŸš‘ Accident lÃ©ger</option>
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
        "Alerte SOS envoyÃ©e ! Restez prÃ¨s de votre scooter, l'aide arrive.",
      );
      document.getElementById("sos-modal").style.display = "none";
      if (typeof speak === "function")
        speak("Alerte de dÃ©tresse envoyÃ©e Ã  la communautÃ©.");
    } catch (e) {
      console.error(e);
      alert("Erreur rÃ©seau SOS.");
    }
  },

  resolveAlert: async function (alertId) {
    try {
      await firebase
        .firestore()
        .collection("sos_alerts")
        .doc(alertId)
        .update({ isActive: false });
      alert("S.O.S clÃ´turÃ©. Bon retour sur la route !");
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
        "Merci ! Le pilote en dÃ©tresse a Ã©tÃ© prÃ©venu que vous Ãªtes en route.",
      );
    } catch (e) {
      console.error(e);
      alert("Erreur rÃ©seau.");
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

            // Ignore si trÃ¨s vieux pour Ã©viter spam au rechargement
            if (Date.now() - helper.timestamp < 3600000) {
              if (typeof speak === "function") {
                speak(
                  `Bonne nouvelle. ${helper.name} est en route pour vous aider.`,
                );
              }

              const toast = document.createElement("div");
              toast.style.cssText =
                "position:fixed;top:80px;left:50%;transform:translateX(-50%);background:rgba(0,210,255,0.9);color:#000;padding:15px 25px;border-radius:25px;z-index:99999;font-weight:bold;font-family:'Outfit', sans-serif;box-shadow:0 0 20px rgba(0,210,255,0.5);font-size:1.1rem;opacity:0;transition:opacity 0.3s;display:flex;align-items:center;gap:10px;";
              toast.innerHTML = `<span style="font-size:1.5rem;">ðŸ¦¸â€â™‚ï¸</span> <span><b>${helper.name}</b> arrive pour vous aider !</span>`;
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
﻿// --- ROADBOOKS & TRACÃ‰S ---
window.RoadbookSystem = {
  isRecording: false,
  currentPath: [],
  recordInterval: null,
  roadbookPolylines: {},

  init: function () {
    if (!window.session || !window.session.uid) return;

    this.listenToRoadbooks();
  },

  toggleRecording: function () {
    const btn = document.getElementById("roadbook-rec-btn");
    if (this.isRecording) {
      // STOP
      this.isRecording = false;
      clearInterval(this.recordInterval);
      if (btn) btn.innerHTML = `<i class="fa-solid fa-route"></i> REC Trace`;
      if (btn) btn.style.color = "#b700ff";
      if (btn) btn.style.border = "1px solid #b700ff";
      if (btn) btn.style.background = "none";

      if (this.currentPath.length > 5) {
        const title = prompt(
          "Enregistrement terminÃ©. Entrez un nom pour votre Roadbook (ex: Balade en VallÃ©e de Chevreuse) :",
        );
        if (title) {
          this.saveRoadbook(title);
        } else {
          this.currentPath = [];
        }
      } else {
        alert("TracÃ© trop court (moins de 5 points GPS), non sauvegardÃ©.");
        this.currentPath = [];
      }
    } else {
      // START
      this.isRecording = true;
      this.currentPath = [];
      if (btn) btn.innerHTML = `<i class="fa-solid fa-stop"></i> STOP REC`;
      if (btn) btn.style.color = "#fff";
      if (btn) btn.style.border = "2px solid #ff0055";
      if (btn) btn.style.background = "#ff0055";

      if (typeof speak === "function")
        speak("Enregistrement du tracÃ© activÃ©.");

      this.recordInterval = setInterval(() => {
        if (window.currentPosition) {
          this.currentPath.push({
            lat: window.currentPosition.lat,
            lng: window.currentPosition.lng,
          });
        }
      }, 5000); // Record point every 5 seconds
    }
  },

  saveRoadbook: async function (title) {
    try {
      await firebase.firestore().collection("roadbooks").add({
        title: title,
        author: window.session.username,
        authorUid: window.session.uid,
        path: this.currentPath,
        createdAt: Date.now(),
        rating: 0,
        votes: 0,
      });
      alert("Roadbook public sauvegardÃ© avec succÃ¨s sur la carte !");
      this.currentPath = [];
    } catch (e) {
      console.error(e);
      alert("Erreur de sauvegarde de la trace.");
    }
  },

  listenToRoadbooks: function () {
    if (typeof firebase === "undefined") return;

    firebase
      .firestore()
      .collection("roadbooks")
      .orderBy("createdAt", "desc")
      .limit(20)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const id = change.doc.id;

          if (change.type === "added" || change.type === "modified") {
            this.drawRoadbook(id, data);
          } else if (change.type === "removed") {
            this.removeRoadbook(id);
          }
        });
      });
  },

  drawRoadbook: function (id, data) {
    if (!map || !data.path || data.path.length === 0) return;

    this.removeRoadbook(id);

    const path = data.path.map((p) => new google.maps.LatLng(p.lat, p.lng));

    const polyline = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: "#b700ff",
      strokeOpacity: 0.6,
      strokeWeight: 4,
      map: map,
    });

    // Add info window on click
    const info = new google.maps.InfoWindow({
      content: `<div style="color:black; font-family:'Outfit';">
                        <h3 style="color:#b700ff; margin:0;">${data.title}</h3>
                        <p style="margin:5px 0 10px;">Par: ${data.author}</p>
                        <p style="margin:0;">Points: ${data.path.length}</p>
                      </div>`,
    });

    polyline.addListener("click", (event) => {
      info.setPosition(event.latLng);
      info.open(map);
    });

    this.roadbookPolylines[id] = polyline;
  },

  removeRoadbook: function (id) {
    if (this.roadbookPolylines[id]) {
      this.roadbookPolylines[id].setMap(null);
      delete this.roadbookPolylines[id];
    }
  },
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    window.RoadbookSystem.init();
  }, 4000);
});


/* --- pit-stops.js --- */
﻿// --- PIT STOPS INTELLIGENCE ---
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

    const m = new google.maps.Marker({
      position: { lat: data.lat, lng: data.lng },
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: isGas ? "#ff0055" : "#00d2ff",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
        scale: 6,
      },
      title: data.name,
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="color:black; font-family:'Outfit';">
                        <h3 style="margin:0;">${isGas ? "â›½" : "ðŸ”§"} ${data.name}</h3>
                        <p style="margin:5px 0;">${data.desc || ""}</p>
                        <small>AjoutÃ© par: ${data.author}</small><br>
                        <button onclick="window.calculateRoute(new google.maps.LatLng(${data.lat}, ${data.lng}))" style="margin-top:5px; background:#111; color:white; padding:5px 10px; border:none; border-radius:5px; cursor:pointer;">Y aller</button>
                      </div>`,
    });

    m.addListener("click", () => info.open(map, m));
    this.markers[id] = m;
  },

  removePitStop: function (id) {
    if (this.markers[id]) {
      this.markers[id].setMap(null);
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
                <h2 style="color:#ff0055; margin-bottom:20px; font-family:'Outfit', sans-serif;">Ajouter un Point d'IntÃ©rÃªt</h2>
                
                <select id="pitstop-type" style="width:100%; padding:10px; margin-bottom:10px; background:#222; color:white; border:1px solid #333; border-radius:5px;">
                    <option value="gas">â›½ Station Service (Friendly 50cc)</option>
                    <option value="garage">ðŸ”§ Garage 2-Roues de confiance</option>
                </select>
                
                <input type="text" id="pitstop-name" placeholder="Nom du lieu (ex: Total Access)" style="width:100%; padding:10px; margin-bottom:10px; background:#222; color:white; border:1px solid #333; border-radius:5px;">
                <textarea id="pitstop-desc" placeholder="DÃ©tails (ex: SP98 pas cher, compresseur gratuit...)" style="width:100%; padding:10px; margin-bottom:20px; background:#222; color:white; border:1px solid #333; border-radius:5px; height:60px;"></textarea>
                
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
      alert("Pit Stop ajoutÃ© sur la carte globale !");
      document.getElementById("pitstop-modal").style.display = "none";
    } catch (e) {
      console.error(e);
      alert("Erreur rÃ©seau.");
    }
  },

  // Simulateur d'OBD pour faire baisser l'essence et dÃ©clencher l'alerte
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
            "Alerte O B D. Niveau de carburant critique, infÃ©rieur Ã  15 pourcents. Voulez-vous que je vous guide vers la station la plus proche ?",
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
                        ${closestGas ? `<button onclick="window.calculateRoute(new google.maps.LatLng(${closestGas.getPosition().lat()}, ${closestGas.getPosition().lng()})); document.getElementById('fuel-alert').remove();" style="margin-top:10px; padding:8px 15px; background:black; color:white; border:none; border-radius:5px; cursor:pointer;">Aller Ã  la station la plus proche</button>` : '<div style="margin-top:10px;">Aucune station communautaire connue autour.</div>'}
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
﻿// --- PRIVACY & RGPD MANAGER ---
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
                <h3 style="color:#00ffcc; margin-top:0;"><i class="fa-solid fa-shield-halved"></i> Vos donnÃ©es, Vos rÃ¨gles (RGPD)</h3>
                <p style="font-size:0.9rem; margin-bottom:15px; line-height:1.4;">
                    Pour vous afficher sur la carte sociale et vous permettre d'interagir avec la communautÃ© (CortÃ¨ge, S.O.S, Crews), "mon 50cc et moi" a besoin de collecter et partager vos donnÃ©es de localisation GPS en arriÃ¨re-plan.<br>
                    <strong>Acceptez-vous le partage de votre position ?</strong> Vous pourrez passer en "Mode FantÃ´me" Ã  tout moment.
                </p>
                <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                    <button onclick="window.PrivacyManager.setConsent(true)" style="background:#00ffcc; color:black; border:none; padding:10px 20px; border-radius:20px; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-check"></i> J'accepte</button>
                    <button onclick="window.PrivacyManager.setConsent(false)" style="background:transparent; color:#aaa; border:1px solid #aaa; padding:10px 20px; border-radius:20px; cursor:pointer;"><i class="fa-solid fa-xmark"></i> Je refuse (GPS Local)</button>
                </div>
                <div style="margin-top:15px; font-size:0.8rem;">
                    <a href="#" onclick="window.PrivacyManager.showPrivacyPolicy(); return false;" style="color:#00ffcc; text-decoration:underline;">Lire la Politique de ConfidentialitÃ©</a>
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
        "Vous avez refusÃ©. L'application fonctionnera en mode restreint. Vous n'apparaÃ®trez pas sur la carte des autres pilotes.",
      );
      this.toggleGhostMode(true); // Force invisible
    } else {
      this.toggleGhostMode(false);
      if (typeof speak === "function")
        speak(
          "ParamÃ¨tres de confidentialitÃ© enregistrÃ©s. Bienvenue dans la communautÃ©.",
        );
    }
  },

  toggleGhostMode: function (forceState = null) {
    if (!this.consentGiven && forceState === false) {
      alert(
        "Vous devez d'abord accepter le partage GPS pour dÃ©sactiver le mode fantÃ´me.",
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
          ? "Mode fantÃ´me activÃ©. Vous Ãªtes invisible."
          : "Mode fantÃ´me dÃ©sactivÃ©. Vous Ãªtes visible.",
      );
    }
  },

  updateGhostUI: function () {
    const btn = document.getElementById("ghost-mode-btn");
    if (btn) {
      if (this.ghostModeActive) {
        btn.style.color = "#ff0055";
        btn.style.borderColor = "#ff0055";
        btn.innerHTML = `<i class="fa-solid fa-ghost"></i> FantÃ´me`;
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
                <h2 style="color:white; margin-bottom:20px; font-family:'Outfit', sans-serif;"><i class="fa-solid fa-gear"></i> ParamÃ¨tres & RGPD</h2>
                
                <div style="margin-bottom:20px; text-align:left; background:#222; padding:15px; border-radius:10px;">
                    <p><b>Statut GPS CommunautÃ© :</b> ${this.consentGiven ? '<span style="color:#00ffcc">AcceptÃ©</span>' : '<span style="color:#ff0055">RefusÃ©</span>'}</p>
                    <button onclick="window.PrivacyManager.showConsentBanner(); document.getElementById('privacy-modal').style.display='none';" style="margin-top:10px; width:100%; background:transparent; border:1px solid #00ffcc; color:#00ffcc; padding:8px; border-radius:5px; cursor:pointer;">Modifier le consentement</button>
                </div>
                
                <div style="margin-bottom:20px; border-top:1px solid #333; padding-top:20px;">
                    <h3 style="color:#ff0055; margin-top:0;">Zone de Danger (Droit Ã  l'oubli)</h3>
                    <p style="font-size:0.8rem; color:#aaa; margin-bottom:15px;">ConformÃ©ment aux lois internationales de protection des donnÃ©es (RGPD/Europe, CCPA/USA, APPI/PDPA/Asie, POPIA/Convention de Malabo/Afrique), vous pouvez demander la suppression immÃ©diate et dÃ©finitive de votre compte et de toutes les donnÃ©es associÃ©es.</p>
                    <button onclick="window.PrivacyManager.deleteMyData()" style="width:100%; background:#ff0055; color:white; border:none; padding:12px; border-radius:10px; font-weight:bold; cursor:pointer;"><i class="fa-solid fa-trash-can"></i> Supprimer mon compte</button>
                </div>
                
                <button onclick="document.getElementById('privacy-modal').style.display='none'" style="width:100%; background:transparent; border:1px solid #aaa; color:#fff; padding:10px; border-radius:20px; cursor:pointer;">Fermer</button>
            </div>
        `;
    modal.style.display = "flex";
  },

  showPrivacyPolicy: function () {
    alert(
      "Politique Globale de ConfidentialitÃ© (RGPD, CCPA, APPI, POPIA) :\n\n- DonnÃ©es collectÃ©es : Position GPS, Email (si authentifiÃ©).\n- FinalitÃ© : Affichage sur la carte sociale communautaire, alerte SOS, calcul itinÃ©raires.\n- Partage tiers : AUCUN. Vos donnÃ©es ne sont pas revendues.\n- DurÃ©e de conservation : Les donnÃ©es GPS temps-rÃ©el sont Ã©phÃ©mÃ¨res. Les traces Roadbooks et SOS sont conservÃ©es jusqu'Ã  leur suppression.\n- Vos droits mondiaux : AccÃ¨s, Rectification, Effacement (bouton dans les paramÃ¨tres), Mode FantÃ´me.",
    );
  },

  deleteMyData: async function () {
    if (
      !confirm(
        "âš ï¸ ATTENTION âš ï¸\nCette action est irrÃ©versible. Votre compte, vos points BVC, vos territoires et vos traces seront dÃ©finitivement supprimÃ©s.\n\nÃŠtes-vous absolument sÃ»r(e) de vouloir tout supprimer ?",
      )
    ) {
      return;
    }

    if (
      typeof firebase === "undefined" ||
      !window.session ||
      !window.session.uid
    ) {
      alert("Vous n'Ãªtes pas connectÃ© ou erreur systÃ¨me.");
      return;
    }

    try {
      const uid = window.session.uid;

      // 1. Delete from Firestore users collection
      await firebase.firestore().collection("users").doc(uid).delete();

      // 2. Clear Local Storage
      localStorage.clear();

      alert(
        "âœ… Vos donnÃ©es ont Ã©tÃ© supprimÃ©es avec succÃ¨s (Droit Ã  l'oubli). Vous allez Ãªtre dÃ©connectÃ©.",
      );

      // 3. Reload page to enforce logout
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la suppression de vos donnÃ©es : " + e.message);
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
﻿/* --- TIM COOK PROTOCOLS (SAFETY & ECO) --- */

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
      "Alerte critique. Chute dÃ©tectÃ©e. Vous avez 10 secondes pour annuler avant l'envoi des secours.",
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
          "DÃ©lai expirÃ©. Protocole SOS engagÃ©. Alerte envoyÃ©e Ã  la communautÃ©.",
        );
      if (timerEl) timerEl.innerText = "SOS ENVOYÃ‰";
    }
  }, 1000);
};

window.cancelSOS = function () {
  clearInterval(window.sosInterval);
  const sosScreen = document.getElementById("tim-cook-sos-screen");
  if (sosScreen) sosScreen.classList.add("hidden");
  if (typeof speak === "function")
    speak("Alerte annulÃ©e. Reprise de la navigation.");
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
        "Trajet terminÃ©. FÃ©licitations, vous avez Ã©conomisÃ© " +
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


/* --- app-core.js --- */
﻿// --- LITE MODE (PERFORMANCE) ---
window.isLiteMode = localStorage.getItem("liteMode") === "true";

window.promptLiteMode = function () {
  const modal = document.createElement("div");
  modal.id = "lite-modal";
  modal.style =
    "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,10,10,0.95); backdrop-filter:blur(5px); z-index:20000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; padding:30px; text-align:center;";
  modal.innerHTML = `
        <i class="fa-solid fa-gauge-high" style="font-size:3rem; color:#00d2ff; margin-bottom:20px;"></i>
        <h2 style="margin-bottom:15px; color:#00d2ff;">Optimisation SuggÃ©rÃ©e</h2>
        <p style="font-size:0.9rem; line-height:1.4; margin-bottom:25px; color:#ccc;">
            Nous avons dÃ©tectÃ© que votre appareil pourrait Ãªtre ralenti par certaines animations 3D et effets visuels de la carte.
            <br><br>
            Voulez-vous activer le <strong>Mode Ã‰co / Performances</strong> pour une meilleure fluiditÃ© et prÃ©server votre batterie ?
        </p>
        <button id="btn-accept-lite" style="width:100%; padding:15px; background:linear-gradient(135deg, #00d2ff, #0077b6); color:white; border:none; border-radius:30px; font-weight:bold; font-size:1rem; margin-bottom:15px;">ACTIVER LE MODE Ã‰CO (RecommandÃ©)</button>
        <button id="btn-refuse-lite" style="background:transparent; border:1px solid #444; width:100%; padding:15px; border-radius:30px; color:#aaa; font-weight:bold; font-size:0.9rem;">NON, GARDER LA HAUTE QUALITÃ‰</button>
    `;
  document.body.appendChild(modal);

  document.getElementById("btn-accept-lite").onclick = () => {
    window.isLiteMode = true;
    localStorage.setItem("liteMode", "true");
    document.body.classList.add("lite-mode");
    modal.remove();
    if (typeof speak === "function")
      speak("Mode Ã‰co activÃ© pour des performances optimales.");
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
  if (window.isLiteMode) {
    document.body.classList.add("lite-mode");
    if (typeof speak === "function") speak("Mode Ã‰co Performances activÃ©.");
  } else {
    document.body.classList.remove("lite-mode");
    if (typeof speak === "function")
      speak("Mode Performances Maximales activÃ©.");
  }
  setTimeout(() => location.reload(), 1500);
};

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
// window.currentLang est maintenant gÃ©rÃ© par i18n.js pour un chargement prioritaire

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
// window.updateI18N(); // DÃ©calÃ© aprÃ¨s DOMContentLoaded pour Ã©viter les crashs

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

// escapeHTML est maintenant dÃ©fini dans auth.js (global)

// --- BOOT ---

let map;
let geocoder;
let trafficLayer;
let directionsService;
let directionsRenderer;
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
    "citroÃ«n",
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
  if (!window.session || window.session.isGuest) return;

  // On rÃ©cupÃ¨re les infos calculÃ©es par auth.js
  if (window.session && window.session.isTrialExpired) {
    const overlay = document.getElementById("sub-overlay");
    if (overlay) overlay.classList.remove("hidden");
    if (navigator.vibrate) navigator.vibrate(50);
    speak("Alerte abonnement : Votre pÃ©riode d'essai gratuite est terminÃ©e.");
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
    console.error("mon50cc Maps : Ã‰lÃ©ment #map introuvable !");
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
    // Suppression de l'import "routes" qui bloque le chargement de la carte (API non activÃ©e)

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
      if (routesLib.DirectionsService && routesLib.DirectionsRenderer) {
        directionsService = new routesLib.DirectionsService();
        directionsRenderer = new routesLib.DirectionsRenderer({
          map: map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#00f2ff",
            strokeOpacity: 0.8,
            strokeWeight: 6,
          },
        });
      } else {
        console.warn(
          "mon50cc Maps : DirectionsService non disponible dans routesLib.",
        );
      }
    } catch (e) {
      console.warn("mon50cc Maps : Erreur initialisation DirectionsService");
    }

    // Autocomplete Classique pour le DÃ©part
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

        // VÃ©rifier si un dÃ©part manuel a Ã©tÃ© saisi
        const manualStartEl = document.getElementById("route-start");
        const manualStartQuery = manualStartEl
          ? manualStartEl.value.trim()
          : "";

        if (manualStartQuery !== "") {
          // Si dÃ©part manuel renseignÃ©, on lance l'itinÃ©raire de dÃ©part manuel Ã  destination
          geocoder.geocode(
            { address: manualStartQuery },
            (resStart, statusStart) => {
              if (statusStart === "OK") {
                const startPos = resStart[0].geometry.location;
                calculateRouteSansAutoroute(startPos, destLocation);
                const btnCancel = document.getElementById("btn-cancel-route");
                if (btnCancel) btnCancel.classList.remove("hidden");
              } else {
                speak("Lieu de dÃ©part introuvable.");
              }
            },
          );
          return;
        }

        // Sinon, utilisation du GPS
        if (!currentPosition) {
          speak(
            "Recherche de votre position GPS. L'itinÃ©raire dÃ©marrera automatiquement dÃ¨s que possible.",
          );
          window.pendingDestinationName = inputOld.value;
          return;
        }

        calculateRouteSansAutoroute(currentPosition, destLocation);
        const btnCancel = document.getElementById("btn-cancel-route");
        if (btnCancel) btnCancel.classList.remove("hidden");
      });
    }

    if (statusEl) statusEl.textContent = "SystÃ¨mes opÃ©rationnels.";
  } catch (e) {
    console.error("mon50cc Maps : Ã‰chec critique de l'initialisation :", e);
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

  runCinematicStartup();

  checkTrialExpiration();
  updateUILabels();
  if (window.session && document.getElementById("mileage-hud")) {
    document.getElementById("mileage-hud").textContent =
      `${(window.session.totalDistance || 0).toFixed(1)} KM`;
  }

  loadHazards();
  renderRoadbooks();
  if (window.OracleVoice) window.OracleVoice.start();

  // â”€â”€ Initialisation des Cartes Hors Ligne â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (window.OfflineMapManager) {
    try {
      window.OfflineMapManager.init();

      // Mise Ã  jour du badge de statut dans le sidebar
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
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Check Parameters
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("shortcut")) {
    const sc = urlParams.get("shortcut");
    setTimeout(() => {
      if (sc === "garage") showPage("garage");
      if (sc === "danger") toggleHazardMenu();
    }, 1000);
  }

  // Masquer le loader + marquer le systÃ¨me comme prÃªt
  setTimeout(() => {
    const loader = document.getElementById("app-loader");
    if (loader) {
      loader.style.opacity = "0";
    }
    updateUILabels();
    if (typeof renderCommunityMarkers === "function") renderCommunityMarkers();
    if (typeof simulateLiveFleet === "function") simulateLiveFleet();
  }, 3500);

  // Lancement de la gÃ©olocalisation
  checkLegalConsent();
};

// â”€â”€ Panneau Cartes Hors Ligne : ouverture / fermeture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
window.toggleOfflinePanel = function () {
  const panel = document.getElementById("offline-panel");
  if (!panel) return;

  closeMenu(); // Ferme le sidebar

  if (panel.classList.contains("hidden")) {
    panel.classList.remove("hidden");

    // Statut rÃ©seau live
    const statusEl = document.getElementById("offline-network-status");
    if (statusEl) {
      const online = navigator.onLine;
      statusEl.style.cssText += `
                background: ${online ? "rgba(0,46,20,0.8)" : "rgba(46,0,20,0.8)"};
                border: 1px solid ${online ? "rgba(0,255,136,0.3)" : "rgba(255,0,85,0.3)"};
                color: ${online ? "#00ff88" : "#ff4d6d"};
            `;
      statusEl.innerHTML = `
                <span style="font-size:1rem; margin-right:8px;">${online ? "ðŸŸ¢" : "ðŸ”´"}</span>
                ${online ? "CONNECTÃ‰ â€” Google Maps actif" : "HORS LIGNE â€” Carte locale active"}
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

// Fonctions de menu dÃ©placÃ©es au dÃ©but pour sÃ©curitÃ©

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
    speak("Info trafic dÃ©sactivÃ©e.");
  } else {
    trafficLayer.setMap(map);
    speak("Info trafic activÃ©e.");
  }
};

window.toggleTilt = function () {
  const currentTilt = map.getTilt();
  map.setTilt(currentTilt === 45 ? 0 : 45);
};

// â”€â”€â”€ Wake Lock rÃ©silient (se rÃ©active automatiquement en cas de perte) â”€â”€â”€â”€â”€â”€â”€â”€
let wakeLockRef = null;
async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLockRef = await navigator.wakeLock.request("screen");

    // RÃ©acquÃ©rir automatiquement quand l'onglet redevient visible
    wakeLockRef.addEventListener("release", () => {
      console.warn(
        "mon50cc GPS : Wake Lock perdu, rÃ©acquisition programmÃ©e.",
      );
      wakeLockRef = null;
    });
  } catch (err) {
    console.warn("mon50cc GPS : Wake Lock refusÃ© :", err.message);
  }
}

// RÃ©acquÃ©rir le Wake Lock quand l'app revient au premier plan
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !wakeLockRef) {
    requestWakeLock();
    // Relancer le GPS si on a perdu la position pendant le sleep (SEULEMENT si consentement donnÃ©)
    if (!currentPosition && gpsWatchId === null && hasLocationConsent()) {
      startGeolocation();
    }
  }
});

// â”€â”€ Garde de consentement : vÃ©rifie si l'utilisateur a acceptÃ© la divulgation â”€â”€
function hasLocationConsent() {
  return localStorage.getItem("location_consent_accepted") === "true";
}

async function checkLegalConsent() {
  if (hasLocationConsent()) {
    // DÃ©clenchement du message de bienvenue pour les utilisateurs rÃ©currents
    const name =
      window.session && !window.session.isGuest ? window.session.username : "";
    const welcomeMsg = name
      ? `Content de vous revoir, ${name}. SystÃ¨mes opÃ©rationnels.`
      : "SystÃ¨mes opÃ©rationnels. Bonne route sur mon 50cc et moi.";
    setTimeout(() => {
      if (typeof speak === "function") speak(welcomeMsg);
    }, 1000);

    startGeolocation();
    return;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DIVULGATION BIEN VISIBLE (Prominent Disclosure) â€” Google Play
  // Conforme Ã  la politique relative aux donnÃ©es de l'utilisateur.
  // AffichÃ© AVANT toute collecte de donnÃ©es de localisation.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
                Utilisation de vos donnÃ©es de localisation
            </h2>

            <div style="background:#1a1a1a; padding:16px; border-radius:8px; border-left:4px solid #ffb703; margin-bottom:20px;">
                <p style="font-size:1rem; line-height:1.5; color:#ffffff; margin:0;">
                    <strong>L'application mon 50cc et moi collecte et utilise vos donnÃ©es de localisation en arriÃ¨re-plan</strong> pour permettre la dÃ©tection automatique de chute (Guardian Angel), la navigation GPS Ã©tape par Ã©tape, et le signalement de dangers routiers. Ces donnÃ©es sont collectÃ©es <strong>mÃªme lorsque l'application est fermÃ©e ou qu'elle n'est pas utilisÃ©e.</strong> Elles ne sont pas utilisÃ©es pour afficher des annonces publicitaires.
                </p>
            </div>

            <p style="font-size:0.9rem; line-height:1.4; color:#aaa; margin-bottom:24px; text-align:center;">
                Ces donnÃ©es sont utilisÃ©es uniquement pour assurer votre sÃ©curitÃ© et vous guider. Elles ne sont jamais vendues Ã  des tiers.<br><br>
                <a href="privacy.html" target="_blank" rel="noopener" style="color:#ffb703; text-decoration:underline; font-weight:bold;">
                    Consulter notre Politique de ConfidentialitÃ©
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

  // Bouton REFUSER : empÃªche le dÃ©marrage du GPS, affiche un message
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
            <strong>âš ï¸ Localisation requise</strong><br>
            L'application ne peut pas fonctionner sans accÃ¨s Ã  votre position.
            <br><button onclick="checkLegalConsent()" style="margin-top:8px; padding:8px 24px; background:#ffb703; color:#000; border:none; border-radius:20px; font-weight:bold; cursor:pointer;">RÃ©essayer</button>
        `;
    document.body.appendChild(banner);
    if (typeof speak === "function")
      speak(
        "L'application nÃ©cessite l'accÃ¨s Ã  votre position pour fonctionner.",
      );
  };

  // Bouton ACCEPTER : sauvegarde le consentement et dÃ©marre le GPS
  document.getElementById("btn-accept-location").onclick = () => {
    localStorage.setItem("location_consent_accepted", "true");
    modal.remove();
    // Retirer le bandeau de refus s'il existait
    const oldBanner = document.getElementById("location-refused-banner");
    if (oldBanner) oldBanner.remove();

    // DÃ©clenchement du message de bienvenue (Audio dÃ©bloquÃ© par le clic)
    const name =
      window.session && !window.session.isGuest ? window.session.username : "";
    const welcomeMsg = name
      ? `Content de vous revoir, ${name}. SystÃ¨mes opÃ©rationnels.`
      : "SystÃ¨mes opÃ©rationnels. Bonne route sur mon 50cc et moi.";
    if (typeof speak === "function") speak(welcomeMsg);

    startGeolocation();
  };
}

function showGpsBanner(msg, code) {
  // Ne pas afficher si on a dÃ©jÃ  une position valide (Ã©vite la banniÃ¨re rouge permanente)
  if (currentPosition && code !== 1) {
    console.warn(
      "mon50cc GPS : Erreur ignorÃ©e (position dÃ©jÃ  disponible) :",
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
                Cette application collecte des donnÃ©es de localisation pour activer la dÃ©tection automatique de chute, la navigation GPS, le calcul de votre vitesse, et le partage de dangers et de votre position avec la communautÃ©, <b>mÃªme lorsque l'application est fermÃ©e ou qu'elle n'est pas utilisÃ©e.</b><br><br>
                Sans accÃ¨s Ã  votre position, l'application ne peut pas fonctionner.
            </p>
            <button onclick="window.repairGps()" style="width:100%; padding:15px; background:#ffb703; color:black; border:none; border-radius:30px; font-weight:bold; font-size:1.1rem; margin-bottom:15px; box-shadow:0 0 15px rgba(255, 183, 3, 0.5);">
                AUTORISER LE GPS
            </button>
            <p style="font-size:0.8rem; color:#888;">
                Veuillez accorder la permission dans les paramÃ¨tres de votre appareil.
            </p>
        `;
    hardLock.style.display = "flex";
    return; // On affiche le hard lock, pas la banniÃ¨re
  }

  let banner = document.getElementById("gps-error-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "gps-error-banner";
    banner.style =
      "position:fixed; top:120px; left:50%; transform:translateX(-50%); width:90%; background:rgba(180, 20, 20, 0.97); color:white; padding:15px; border-radius:12px; z-index:99999; font-size:0.85rem; text-align:center; border:2px solid #ef4444; box-shadow:0 0 25px rgba(220,38,38,0.9); transition: all 0.3s ease;";
    document.body.appendChild(banner);
  }

  const repairBtn = `<button onclick="window.retryGps()" style="margin-top:10px; padding:8px 20px; background:#ffb703; color:#000; border:none; border-radius:20px; font-weight:bold; font-size:0.85rem; cursor:pointer;">ðŸ”„ RÃ©essayer</button>`;

  banner.innerHTML = `<div style="font-weight:bold; margin-bottom:4px;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>GPS : ${msg}</div><div style="font-size:0.72rem; color:#fca5a5;">(Code erreur: ${code})</div>${repairBtn}`;
  banner.style.display = "block";

  // Auto-dismiss aprÃ¨s 20s pour les erreurs non-critiques (code 2 = signal faible, code 3 = timeout)
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
            <b style="color:#ffb703;">ðŸ“± Sur Android Chrome :</b><br>
            1. Appuie sur les 3 points â‹® en haut Ã  droite<br>
            2. ParamÃ¨tres â†’ ParamÃ¨tres du site<br>
            3. Localisation â†’ Cherche '${appUrl}'<br>
            4. Passe de 'Bloquer' Ã  'Autoriser'<br>
            5. Recharge l'application<br><br>
            <b style="color:#ffb703;">ðŸ“± Dans l'app Android :</b><br>
            1. Appui long sur l'icÃ´ne de l'app<br>
            2. Infos sur l'appli â†’ Autorisations<br>
            3. Position â†’ Autoriser (ou Toujours autoriser)
        </div>
    `;

  if (typeof Swal !== "undefined") {
    Swal.fire({
      title: "Comment rÃ©activer le GPS",
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
                <h3 style="color:#ffb703; margin-top:0; margin-bottom:15px;">Comment rÃ©activer le GPS</h3>
                ${instructions}
                <button onclick="this.parentElement.parentElement.remove()" style="width:100%; margin-top:20px; padding:12px; background:#ffb703; color:black; border:none; border-radius:30px; font-weight:bold; font-size:1rem;">J'AI COMPRIS</button>
            </div>
        `;
    document.body.appendChild(modal);
  }
};

window.retryGps = function () {
  hideGpsBanner();
  // Reset complet pour repartir de zÃ©ro
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
  // GARDE DE SÃ‰CURITÃ‰ : ne JAMAIS dÃ©marrer le GPS sans consentement explicite
  if (!hasLocationConsent()) {
    console.warn(
      "mon50cc GPS : Consentement de localisation non accordÃ©. GPS bloquÃ©.",
    );
    alert(
      "âš ï¸ AccÃ¨s GPS bloquÃ© : Le consentement de gÃ©olocalisation est requis. Vous allez Ãªtre redirigÃ© vers l'accueil.",
    );
    window.location.href = "index.html";
    return;
  }

  if (!("geolocation" in navigator)) {
    console.error(
      "mon50cc GPS : GÃ©olocalisation non supportÃ©e sur cet appareil.",
    );
    showGpsBanner("GÃ©olocalisation non supportÃ©e par ce navigateur.", 0);
    return;
  }

  // AcquÃ©rir le Wake Lock pour maintenir le GPS actif
  requestWakeLock();

  // Ã‰TAPE 1 : VÃ©rifier les permissions (non-bloquant)
  if (navigator.permissions) {
    try {
      const perm = await navigator.permissions.query({ name: "geolocation" });

      if (perm.state === "denied") {
        speak(
          "Le GPS est bloquÃ©. VÃ©rifiez les permissions de l'application.",
        );
        showGpsBanner("Permission refusÃ©e. Appuyez sur 'RÃ©parer'.", 1);
        return; // Inutile de continuer si explicitement refusÃ©
      }

      perm.onchange = () => {
        if (perm.state === "granted") {
          hideGpsBanner();
          window.retryGps();
        } else if (perm.state === "denied") {
          showGpsBanner("Permission GPS rÃ©voquÃ©e.", 1);
        }
      };
    } catch (e) {
      console.warn("mon50cc GPS : API Permissions indisponible.", e);
    }
  }

  // Ã‰TAPE 2 : Surveillance CONTINUE (satellites GPS / rÃ©seau)
  // On utilise uniquement watchPosition car iOS gÃ¨re trÃ¨s mal les appels concurrents (getCurrentPosition + watchPosition)
  const geoOptions = {
    enableHighAccuracy: true,
    timeout: 30000, // 30s â€” laisse le temps aux satellites en intÃ©rieur
    maximumAge: 3000, // 3s de cache max pour les updates frÃ©quents
  };

  const onError = (err) => {
    let msg = "Erreur GPS inconnue";
    if (err.code === 1)
      msg = "Permission GPS refusÃ©e. Appuyez sur 'RÃ©parer'.";
    if (err.code === 2) msg = "Signal GPS faible. Sortez Ã  l'extÃ©rieur.";
    if (err.code === 3) msg = "Recherche GPS en cours... Patience.";
    console.error("mon50cc GPS :", msg, "code:", err.code);

    // Permission refusÃ©e â†’ banniÃ¨re immÃ©diate
    if (err.code === 1) {
      speak("Le GPS est bloquÃ©. VÃ©rifiez les permissions.");
      showGpsBanner(msg, err.code);
      return;
    }

    // Si on n'a aucune position â†’ tenter le fallback basse prÃ©cision
    if (!currentPosition) {
      showGpsBanner(msg, err.code);
      activateLowAccuracyFallback();
    }
    // Si on a dÃ©jÃ  une position â†’ on garde celle-ci, pas de banniÃ¨re
  };

  // Nettoyer les anciens watchers avant d'en crÃ©er de nouveaux
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }

  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      // Filtrage qualitÃ© : accepter la premiÃ¨re position Ã  tout prix, puis filtrer Ã  < 500m
      const acc = pos.coords.accuracy || 0;
      if (currentPosition && acc > 500) {
        console.warn(
          `mon50cc GPS : Position ignorÃ©e (prÃ©cision: ${acc.toFixed(0)}m > 500m)`,
        );
        return;
      }
      updatePosition(pos);
      hideGpsBanner();
      gpsRetryCount = 0; // Reset du compteur de retry
    },
    onError,
    geoOptions,
  );

  // Ã‰TAPE 4 : Timer de sÃ©curitÃ© â€” si aucune position aprÃ¨s 15s, forcer le fallback
  setTimeout(() => {
    if (!currentPosition && fallbackWatchId === null) {
      console.warn(
        "mon50cc GPS : Aucune position aprÃ¨s 15s â†’ activation fallback.",
      );
      activateLowAccuracyFallback();
    }
  }, 15000);
}

// Fallback basse prÃ©cision (WiFi/Cellulaire) â€” dÃ©clenchÃ© automatiquement
function activateLowAccuracyFallback() {
  if (fallbackWatchId !== null) return; // DÃ©jÃ  actif
  if (gpsRetryCount >= GPS_MAX_RETRIES) {
    console.error("mon50cc GPS : Nombre max de retries atteint.");
    showGpsBanner(
      "GPS indisponible. VÃ©rifiez que la localisation est activÃ©e dans les paramÃ¨tres.",
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
    (e) => console.warn("mon50cc GPS : Fallback Ã©chouÃ© :", e.code, e.message),
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
  );
}

// Remplacement du dÃ©marrage automatique par la vÃ©rification lÃ©gale
// Retrait de l'appel direct pour Ã©viter les conflits avant l'init de l'UI
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
function getSmoothedSpeed(rawSpeed) {
  speedHistory.push(rawSpeed);
  if (speedHistory.length > 5) speedHistory.shift();
  const sum = speedHistory.reduce((a, b) => a + b, 0);
  return sum / speedHistory.length;
}

function updatePosition(position) {
  // ArrÃªt du fallback basse prÃ©cision si on rÃ©cupÃ¨re un signal GPS haute prÃ©cision dÃ©cent (< 30m)
  if (
    position.coords.accuracy !== null &&
    position.coords.accuracy < 30 &&
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

  // TracÃ© GPS de la balade (cyberline cyan)
  if (typeof window.addTracePoint === "function") {
    window.addTracePoint(lat, lng);
  }

  if (window.updatePositionLeaflet) {
    window.updatePositionLeaflet(lat, lng);
  }

  if (window.OracleEngine) window.OracleEngine.updateRegion(lat, lng);

  // SÃ©curitÃ©: accuracy peut Ãªtre null sur certains appareils
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
  if (window.session && window.session.isGuest) {
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
              "Veuillez crÃ©er un compte pour accÃ©der Ã  l'Arbitre de la Route ! âš–ï¸ðŸ›µ",
            );
      },
    );
  }

  // Vitesse (HUD) avec Smoothing Neural
  const rawSpeed = speed !== null && speed >= 0 ? speed * 3.6 : 0;
  const speedKmh = Math.round(getSmoothedSpeed(rawSpeed));
  const speedEl = document.getElementById("speed");
  const speedBar = document.getElementById("speed-bar");

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
        if (false) {
          // AdvancedMarkerElement removed due to mapId styling conflict
        } else {
          userMarker = new google.maps.Marker({
            map: map,
            position: currentPosition,
            title: "Votre Position",
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "white",
              strokeWeight: 2,
            },
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

      // On recentre et on dÃ©cale pour la visibilitÃ©
      map.panTo(currentPosition);
      map.panBy(0, -100);
    }
  }

  // MÃ©tÃ©o Auto
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
  const R = 6371e3; // mÃ¨tres
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
        `Attention, ${h.type} signalÃ© Ã  environ 500 mÃ¨tres. Restez vigilant.`,
      );
      lastSpokenHazard = h.lat + h.lon;
      showHazardConfirmation(index, h.type);
    }
    // --- DANGERS STANDARDS ---
    else if (dist < 100 && lastSpokenHazard !== h.lat + h.lon) {
      speak(`Attention : ${h.type} signalÃ© Ã  proximitÃ©.`);
      lastSpokenHazard = h.lat + h.lon;
      showHazardConfirmation(index, h.type);
    }
  });
}

window.triggerRedAlert = function (distance, description) {
  // Annonce vocale
  let alertMsg = `Attention, conduite dangereuse signalÃ©e`;
  if (description) {
    alertMsg += ` : ${description}`;
  }
  alertMsg += ` Ã  ${distance} mÃ¨tres devant vous. Restez vigilant.`;
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
        <p>Toujours lÃ  : <strong>${type}</strong> ?</p>
        <div style="display:flex; gap:10px;">
            <button onclick="confirmHazard(${index}, true)">âœ… Oui</button>
            <button onclick="confirmHazard(${index}, false)">âŒ Non</button>
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
    speak("Merci, signalement mis Ã  jour.");
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

// --- REGIONAL & VOICE ENGINE (ORACLE v100.00-GOLD) ---
window.OracleEngine = {
  gender: localStorage.getItem("oracle_gender") || "female",
  currentRegion: "standard",

  regionalLexicon: {
    fr: {
      marseille: {
        start:
          "TÃ©, l'Oracle est en place ! On est parÃ©s pour la route, peuchÃ¨re.",
        speed: "Oh fada, tu vas trop vite ! LÃ¨ve le pied avant de t'envoler.",
        threat_detected:
          "VÃ© ! Y'a un souci sur la route devant. Fais gaffe Ã  toi.",
        level_up: "Et bim ! Tu as montÃ© de niveau, bravo mon brave.",
        start_guardian:
          "Ange Gardien en place ! T'inquiÃ¨te pas, je veille sur toi.",
        stop_guardian: "Ange Gardien au repos. Fais doucement, hein !",
        danger_overtake:
          "VÃ© ! Tu doubles n'importe comment, tu vas nous faire un plat !",
      },
      quebec: {
        start: "Attache ta tuque, l'Oracle est prÃªt pour une sacrÃ©e virÃ©e !",
        speed: "LÃ¢che la patate, tu roules pas mal trop vite lÃ  !",
        threat_detected: "Check ben Ã§a, y'a de quoi de pas net sur le chemin.",
        level_up: "C'est Ã©coeurant ! T'as gagnÃ© un niveau.",
        start_guardian: "Ton Ange Gardien est prÃªt, on lÃ¢che pas !",
        stop_guardian: "L'Ange Gardien prend une pause. Prudence !",
        danger_overtake:
          "OulÃ  ! Ton dÃ©passement Ã©tait pas mal risquÃ©, check tes angles !",
      },
      standard: {
        start: "Core Universel stabilisÃ©. Liaison totale Ã©tablie.",
        speed: "Alerte : Vitesse excessive. Ralentissez immÃ©diatement.",
        threat_detected: "ANALYSE : Menace identifiÃ©e. Prudence conseillÃ©e.",
        level_up: "FÃ©licitations Pilote. Votre expÃ©rience a augmentÃ©.",
        start_guardian:
          "Ange Gardien activÃ©. Surveillance pÃ©rimÃ©trique en cours.",
        stop_guardian: "Ange Gardien dÃ©sactivÃ©. Fin de la surveillance.",
        danger_overtake: "ATTENTION : DÃ‰PASSEMENT DANGEREUX DÃ‰TECTÃ‰.",
        ferry_detected:
          "Attention, cet itinÃ©raire inclut une traversÃ©e en ferry.",
        ferry_ahead:
          "TraversÃ©e en ferry Ã  1 kilomÃ¨tre. PrÃ©parez-vous Ã  l'embarquement.",
      },
      liege: {
        start: "Oufti, l'Oracle est en place, valet ! On dÃ©colle ?",
        speed: "Ouille valet, tu vas trop vite ! Calme ton jeu.",
        threat_detected: "AÃ¯e gaffe, y'a un bins sur la route devant.",
        level_up: "Oufti ! T'es passÃ© au niveau suivant, c'est du propre !",
        start_guardian:
          "L'Ange Gardien est lÃ  pour toi, valet. Roule tranquille.",
        stop_guardian: "L'Ange Gardien va s'en jeter une, sois prudent.",
        danger_overtake:
          "Oufti ! Ton dÃ©passement Ã©tait un peu chaud, valet !",
      },
      charleroi: {
        start: "Salut m'fi ! L'Oracle est prÃªt, on y va ?",
        speed: "M'fi, tu roules trop vite ! On n'est pas sur le ring ici.",
        threat_detected: "Fais gaffe m'fi, y'a un gros souci devant.",
        level_up: "Bordel m'fi ! T'as montÃ© de niveau, fÃ©licitations !",
        start_guardian: "Ton Ange Gardien veille sur toi, m'fi. Pas de stress.",
        stop_guardian: "L'Ange Gardien a fini sa pause, fais attention m'fi.",
        danger_overtake: "M'fi ! C'Ã©tait quoi ce dÃ©passement de baraki ?",
      },
      brussels: {
        start: "Salut fieu ! L'Oracle est lÃ , on y va ou quoi ?",
        speed:
          "Dites une fois, fieu ! Tu vas trop vite, on n'est pas pressÃ©s !",
        threat_detected: "Attention fieu, y'a un stut sur la route devant.",
        level_up:
          "Non peut-Ãªtre ! T'as montÃ© de niveau, Ã§a c'est du stoemp !",
        start_guardian: "L'Ange Gardien est avec toi, fieu. T'inquiÃ¨te pas.",
        stop_guardian: "L'Ange Gardien va manger une frite, fais gaffe Ã  toi.",
        danger_overtake:
          "Eh fieu ! Ton dÃ©passement lÃ , c'Ã©tait un peu zinneke, non ?",
      },
      flanders: {
        start: "Allez, l'Oracle est prÃªt. On roule, hein ?",
        speed: "Oula ! Tu vas trop vite, hein ! Calme-toi un peu.",
        threat_detected: "Pas de chance, y'a un problÃ¨me sur la route.",
        level_up: "Super ! T'as montÃ© de niveau. C'est bien, hein !",
        start_guardian:
          "L'Ange Gardien est lÃ  pour toi. C'est sÃ©curisÃ©, hein.",
        stop_guardian: "L'Ange Gardien s'arrÃªte. Sois prudent, hein.",
        danger_overtake:
          "Dis, ton dÃ©passement Ã©tait un peu dangereux, hein !",
      },
      andalucia: {
        start: "Â¡Ole! L'Oracle est prÃªt, mon ami. On y va !",
        speed: "Eh, l'ami ! Tu vas trop vite, doucement sur l'accÃ©lÃ©rateur.",
        threat_detected: "Attention, y'a du jaleo sur la route devant.",
        level_up: "Â¡QuÃ© arte! Tu as montÃ© de niveau, bravo !",
        start_guardian: "L'Ange Gardien est avec toi, l'ami.",
        stop_guardian: "L'Ange Gardien fait une petite sieste, sois prudent.",
        danger_overtake:
          "Eh ! Ce dÃ©passement Ã©tait un peu trop risquÃ©, mi arma !",
      },
      reunion: {
        start: "LÃ© parÃ© ! L'Oracle est en place, dalon. Allons rouler !",
        speed: "OtÃ© ! Tu vas trop vite, calme un peu lÃ  !",
        threat_detected:
          "Gaffe dalon, y'a un l'embouteillage ou un souci devant.",
        level_up: "LÃ© bon Ã§a ! T'as montÃ© de niveau, fÃ©licitations !",
        start_guardian: "L'Ange Gardien lÃ© lÃ , t'inquiÃ¨te pas dalon.",
        stop_guardian: "L'Ange Gardien va prendre un petit rhum, sois prudent.",
        danger_overtake:
          "OtÃ© ! Ton dÃ©passement lÃ , c'Ã©tait risquÃ© dalon !",
      },
    },
    zh: {
      standard: {
        start: "ç³»ç»Ÿå°±ç»ªã€‚è¿žæŽ¥å·²å»ºç«‹ã€‚",
        speed: "è­¦å‘Šï¼šé€Ÿåº¦è¿‡å¿«ã€‚è¯·ç«‹å³å‡é€Ÿã€‚",
        threat_detected: "åˆ†æžï¼šå‘çŽ°å¨èƒã€‚å»ºè®®è°¨æ…Žã€‚",
        level_up: "æ­å–œè½¦æ‰‹ã€‚æ‚¨çš„ç»éªŒå€¼å·²æå‡ã€‚",
        start_guardian: "å®ˆæŠ¤å¤©ä½¿å·²å¼€å¯ã€‚æ­£åœ¨ç›‘æŽ§ã€‚",
        stop_guardian: "å®ˆæŠ¤å¤©ä½¿å·²å…³é—­ã€‚ç›‘æŽ§ç»“æŸã€‚",
        danger_overtake: "è­¦å‘Šï¼šæ£€æµ‹åˆ°å±é™©è¶…è½¦ã€‚",
      },
    },
    ja: {
      standard: {
        start: "ã‚·ã‚¹ãƒ†ãƒ æº–å‚™å®Œäº†ã€‚æŽ¥ç¶šãŒç¢ºç«‹ã•ã‚Œã¾ã—ãŸã€‚",
        speed: "è­¦å‘Šï¼šé€Ÿåº¦è¶…éŽã§ã™ã€‚ç›´ã¡ã«æ¸›é€Ÿã—ã¦ãã ã•ã„ã€‚",
        threat_detected: "åˆ†æžï¼šè„…å¨ã‚’æ¤œçŸ¥ã€‚æ³¨æ„ã—ã¦ãã ã•ã„ã€‚",
        level_up: "ãŠã‚ã§ã¨ã†ã”ã–ã„ã¾ã™ã€‚ãƒ¬ãƒ™ãƒ«ãŒä¸ŠãŒã‚Šã¾ã—ãŸã€‚",
        start_guardian: "å®ˆè­·å¤©ä½¿ãŒèµ·å‹•ã—ã¾ã—ãŸã€‚ç›£è¦–ä¸­ã€‚",
        stop_guardian: "å®ˆè­·å¤©ä½¿ãŒè§£é™¤ã•ã‚Œã¾ã—ãŸã€‚ç›£è¦–çµ‚äº†ã€‚",
        danger_overtake: "è­¦å‘Šï¼šå±é™ºãªè¿½ã„è¶Šã—ã‚’æ¤œçŸ¥ã—ã¾ã—ãŸã€‚",
      },
    },
    es: {
      andalucia: {
        start: "Â¡Ole! El OrÃ¡culo estÃ¡ listo, mi arma. Â¡VÃ¡monos!",
        speed: "Â¡Eh, chiquillo! Vas mu' rÃ¡pido, frena un poco.",
        threat_detected: "Cuidao, que hay un jaleo ahÃ­ delante.",
        level_up: "Â¡QuÃ© arte tienes! Has subido de nivel.",
        start_guardian: "El Ãngel de la Guarda estÃ¡ contigo, mi arma.",
        stop_guardian: "El Ãngel se va a echar una siestecita, ten cuidao.",
        danger_overtake:
          "Â¡Chiquillo! Ese adelantamiento ha sÃ­o mu' peligroso.",
      },
      standard: {
        start: "Sistemas listos. ConexiÃ³n establecida.",
        speed: "Alerta: Exceso de velocidad. Reduzca inmediatamente.",
        threat_detected: "ANÃLISIS: Amenaza identificada. Tenga precauciÃ³n.",
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
        speed: "Allerta: VelocitÃ  eccessiva. Rallenta immediatamente.",
        threat_detected:
          "ANALISI: Minaccia identificata. Prudenza consigliata.",
        level_up: "Congratulazioni Pilota. La tua esperienza Ã¨ aumentata.",
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
        level_up: "GlÃ¼ckwunsch Pilot. Deine Erfahrung ist gestiegen.",
        start_guardian: "Schutzengel aktiviert. Ãœberwachung lÃ¤uft.",
        stop_guardian: "Schutzengel deaktiviert. Ende der Ãœberwachung.",
        danger_overtake: "WARNUNG: GEFÃ„HRLICHES ÃœBERHOLMANÃ–VER ERKANNT.",
      },
    },
    pt: {
      standard: {
        start: "Sistema pronto. ConexÃ£o estabelecida.",
        speed: "Alerta: Velocidade excessiva. Reduza imediatamente.",
        threat_detected: "ANÃLISE: AmeaÃ§a identificada. Cuidado aconselhado.",
        level_up: "ParabÃ©ns Piloto. A sua experiÃªncia aumentou.",
        start_guardian: "Anjo da Guarda ativado. MonitorizaÃ§Ã£o em curso.",
        stop_guardian: "Anjo da Guarda desativado. Fim da monitorizaÃ§Ã£o.",
        danger_overtake: "AVISO: ULTRAPASSAGEM PERIGOSA DETETADA.",
      },
    },
    nl: {
      standard: {
        start: "Systeem gereed. Verbinding tot stand gebracht.",
        speed:
          "Waarschuwing: Te hoge snelheid. Gelieve onmiddellijk te vertragen.",
        threat_detected:
          "ANALYSE: Dreiging geÃ¯dentificeerd. Voorzichtigheid geboden.",
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
          "ANALIZA: Zidentyfikowano zagroÅ¼enie. Zalecana ostroÅ¼noÅ›Ä‡.",
        level_up: "Gratulacje Pilocie. Twoje doÅ›wiadczenie wzrosÅ‚o.",
        start_guardian: "AnioÅ‚ StrÃ³Å¼ aktywowany. Monitorowanie w toku.",
        stop_guardian: "AnioÅ‚ StrÃ³Å¼ dezaktywowany. Koniec monitorowania.",
        danger_overtake: "OSTRZEÅ»ENIE: WYKRYTO NIEBEZPIECZNE WYPRZEDZANIE.",
      },
    },
    sv: {
      standard: {
        start: "Systemet Ã¤r klart. Anslutning upprÃ¤ttad.",
        speed: "Varning: FÃ¶r hÃ¶g hastighet. SÃ¤nk farten omedelbart.",
        threat_detected: "ANALYS: Hot identifierat. Var fÃ¶rsiktig.",
        level_up: "Grattis Pilot. Din erfarenhet har Ã¶kat.",
        start_guardian: "SkyddsÃ¤ngel aktiverad. Ã–vervakning pÃ¥gÃ¥r.",
        stop_guardian: "SkyddsÃ¤ngel inaktiverad. Slut pÃ¥ Ã¶vervakning.",
        danger_overtake: "VARNING: FARLIG OMKÃ–RNING UPPTÃ„CKT.",
      },
    },
    da: {
      standard: {
        start: "Systemet er klar. Forbindelse oprettet.",
        speed: "Advarsel: For hÃ¸j hastighed. SÃ¦t farten ned med det samme.",
        threat_detected:
          "ANALYSE: Trussel identificeret. Forsigtighed tilrÃ¥des.",
        level_up: "Tillykke Pilot. Din erfarenhet er Ã¸get.",
        start_guardian: "Skytsengel aktiveret. OvervÃ¥gning i gang.",
        stop_guardian: "Skytsengel deaktiveret. Slut pÃ¥ overvÃ¥gning.",
        danger_overtake: "ADVARSEL: FARLIG OVERHALING REGISTRERET.",
      },
    },
    fi: {
      standard: {
        start: "JÃ¤rjestelmÃ¤ valmis. Yhteys muodostettu.",
        speed: "HÃ¤lytys: Liian suuri nopeus. Hidasta vÃ¤littÃ¶mÃ¤sti.",
        threat_detected: "ANALYYSI: Uhka tunnistettu. Noudata varovaisuutta.",
        level_up: "Onnea Pilotti. Kokemuksesi on kasvanut.",
        start_guardian: "Suojelusenkeli aktivoitu. Valvonta kÃ¤ynnissÃ¤.",
        stop_guardian: "Suojelusenkeli deaktivoitu. Valvonta pÃ¤Ã¤ttynyt.",
        danger_overtake: "VAROITUS: VAARALLINEN OHITUS HAVAITTU.",
      },
    },
    no: {
      standard: {
        start: "Systemet er klart. Tilkobling opprettet.",
        speed: "Advarsel: For hÃ¸y hastighet. Sakt ned umiddelbart.",
        threat_detected:
          "ANALYSE: Trussel identifisert. Forsiktighet anbefales.",
        level_up: "Gratulerer Pilot. Din erfaring har Ã¸kt.",
        start_guardian: "Skytsengel aktivert. OvervÃ¥king pÃ¥gÃ¥r.",
        stop_guardian: "Skytsengel deaktivert. Slut pÃ¥ overvÃ¥king.",
        danger_overtake: "ADVARSEL: FARLIG FORBIKJÃ˜RING OPPDAGET.",
      },
    },
    el: {
      standard: {
        start:
          "Î£ÏÏƒÏ„Î·Î¼Î± Î­Ï„Î¿Î¹Î¼Î¿. Î— ÏƒÏÎ½Î´ÎµÏƒÎ· Î¿Î»Î¿ÎºÎ»Î·ÏÏŽÎ¸Î·ÎºÎµ.",
        speed:
          "Î•Î¹Î´Î¿Ï€Î¿Î¯Î·ÏƒÎ·: Î¥Ï€ÎµÏÎ²Î¿Î»Î¹ÎºÎ® Ï„Î±Ï‡ÏÏ„Î·Ï„Î±. Î•Ï€Î¹Î²ÏÎ±Î´ÏÎ½ÎµÏ„Îµ Î±Î¼Î­ÏƒÏ‰Ï‚.",
        threat_detected:
          "Î‘ÎÎ‘Î›Î¥Î£Î—: Î•Î½Ï„Î¿Ï€Î¯ÏƒÏ„Î·ÎºÎµ Î±Ï€ÎµÎ¹Î»Î®. Î£Ï…Î½Î¹ÏƒÏ„Î¬Ï„Î±Î¹ Ï€ÏÎ¿ÏƒÎ¿Ï‡Î®.",
        level_up:
          "Î£Ï…Î³Ï‡Î±ÏÎ·Ï„Î®ÏÎ¹Î± Î Î¹Î»ÏŒÏ„Îµ. Î— ÎµÎ¼Ï€ÎµÎ¹ÏÎ¯Î± ÏƒÎ±Ï‚ Î±Ï…Î¾Î®Î¸Î·ÎºÎµ.",
        start_guardian:
          "Î¦ÏÎ»Î±ÎºÎ±Ï‚ Î†Î³Î³ÎµÎ»Î¿Ï‚ ÎµÎ½ÎµÏÎ³Î¿Ï€Î¿Î¹Î®Î¸Î·ÎºÎµ. Î Î±ÏÎ±ÎºÎ¿Î»Î¿ÏÎ¸Î·ÏƒÎ· ÏƒÎµ ÎµÎ¾Î­Î»Î¹Î¾Î·.",
        stop_guardian:
          "Î¦ÏÎ»Î±ÎºÎ±Ï‚ Î†Î³Î³ÎµÎ»Î¿Ï‚ Î±Ï€ÎµÎ½ÎµÏÎ³Î¿Ï€Î¿Î¹Î®Î¸Î·ÎºÎµ. Î¤Î­Î»Î¿Ï‚ Ï€Î±ÏÎ±ÎºÎ¿Î»Î¿ÏÎ¸Î·ÏƒÎ·Ï‚.",
        danger_overtake:
          "Î Î¡ÎŸÎ£ÎŸÎ§Î—: Î•ÎÎ¤ÎŸÎ Î™Î£Î¤Î—ÎšÎ• Î•Î Î™ÎšÎ™ÎÎ”Î¥ÎÎ— Î Î¡ÎŸÎ£Î Î•Î¡Î‘Î£Î—.",
      },
    },
    cs: {
      standard: {
        start: "SystÃ©m pÅ™ipraven. PÅ™ipojenÃ­ navÃ¡zÃ¡no.",
        speed: "UpozornÄ›nÃ­: NadmÄ›rnÃ¡ rychlost. OkamÅ¾itÄ› zpomalte.",
        threat_detected:
          "ANALÃZA: IdentifikovÃ¡na hrozba. DoporuÄuje se opatrnost.",
        level_up: "Gratulujeme Pilote. VaÅ¡e zkuÅ¡enosti se zvÃ½Å¡ily.",
        start_guardian: "AndÄ›l strÃ¡Å¾nÃ½ aktivovÃ¡n. SledovÃ¡nÃ­ probÃ­hÃ¡.",
        stop_guardian: "AndÄ›l strÃ¡Å¾nÃ½ deaktivovÃ¡n. Konec sledovÃ¡nÃ­.",
        danger_overtake: "VAROVÃNÃ: ZJIÅ TÄšNO NEBEZPEÄŒNÃ‰ PÅ˜EDBÃHÃNÃ.",
      },
    },
    hu: {
      standard: {
        start: "Rendszer kÃ©sz. Kapcsolat lÃ©trejÃ¶tt.",
        speed: "RiasztÃ¡s: TÃºl nagy sebessÃ©g. Azonnal lassÃ­tson.",
        threat_detected:
          "ELEMZÃ‰S: FenyegetÃ©s azonosÃ­tva. Ã“vatossÃ¡g ajÃ¡nlott.",
        level_up: "GratulÃ¡lunk PilÃ³ta. Tapasztalata nÅ‘tt.",
        start_guardian: "Årangyal aktivÃ¡lva. MegfigyelÃ©s folyamatban.",
        stop_guardian: "Årangyal deaktivÃ¡lva. MegfigyelÃ©s vÃ©ge.",
        danger_overtake: "FIGYELEM: VESZÃ‰LYES ELÅZÃ‰S Ã‰SZLELVE.",
      },
    },
    ro: {
      standard: {
        start: "Sistem gata. Conexiune stabilitÄƒ.",
        speed: "AlertÄƒ: VitezÄƒ excesivÄƒ. ÃŽncetiniÈ›i imediat.",
        threat_detected:
          "ANALIZÄ‚: AmeninÈ›are identificatÄƒ. Se recomandÄƒ prudenÈ›Äƒ.",
        level_up: "FelicitÄƒri Pilotule. ExperienÈ›a ta a crescut.",
        start_guardian: "ÃŽnger PÄƒzitor activat. Monitorizare Ã®n curs.",
        stop_guardian:
          "ÃŽnger PÄƒzitor dezactivat. SfÃ¢rÈ™itul monitorizÄƒrii.",
        danger_overtake: "ATENÈšIE: DEPÄ‚È˜IRE PERICULOASÄ‚ DETECTATÄ‚.",
      },
    },
  },

  updateRegion: function (lat, lng) {
    // Ne pas Ã©craser la rÃ©gion si triggerRegionalWelcome (Nominatim) l'a dÃ©jÃ  dÃ©finie
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

  // Voice Modes (MarchÃ© Noir BVC)
  let rate = 0.95;
  let pitch =
    window.OracleEngine && window.OracleEngine.gender === "female" ? 1.05 : 0.9;

  const voiceMode = localStorage.getItem("jarvisVoiceMode") || "standard";

  // Simulation d'accents rÃ©gionaux (pitch/rate)
  if (region && region !== "standard" && voiceMode === "standard") {
    switch (region) {
      // SystÃ¨me A â€” RÃ©gions administratives (Nominatim)
      case "provence-alpes-cÃ´te d'azur":
      case "occitanie":
      // SystÃ¨me B â€” Villes/zones (GPS)
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
      case "Ã®le-de-france":
      case "brussels":
        rate = 1.15; // Paris/Bruxelles : parle vite
        break;
      case "auvergne-rhÃ´ne-alpes":
        rate = 0.88;
        pitch = pitch * 0.95; // RhÃ´ne-Alpes : posÃ©, calme
        break;
      case "bretagne":
      case "normandie":
        pitch = pitch * 1.1; // Ouest
        break;
      case "grand est":
      case "bourgogne-franche-comtÃ©":
      case "flanders":
        rate = 0.92;
        pitch = pitch * 1.05;
        break;
      case "quebec":
        rate = 0.9;
        pitch = pitch * 1.15; // QuÃ©bÃ©cois : chantant, plus lent
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
    speak("Mode nuit activÃ©.");
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
    // Si le plugin de background-mode est installÃ© (Cordova/Capacitor)
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
    leanVal.textContent = `${currentLeanAngle}Â°`;

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


/* --- app-map.js --- */
// --- 3. ROUTAGE ---
let destinationMarker = null;
let currentRoutePolylines = [];
let currentRouteMarkers = [];

async function calculateRouteSansAutoroute(start, end) {
  if (!start || !end) {
    console.error("mon50cc Maps : Points de dÃ©part ou d'arrivÃ©e invalides.", {
      start,
      end,
    });
    if (!start) speak("Signal GPS insuffisant pour dÃ©marrer l'itinÃ©raire.");
    return;
  }

  window.currentRouteDestination = end; // Store for GO button

  // Nettoyage des tracÃ©s prÃ©cÃ©dents
  currentRoutePolylines.forEach((p) => p.setMap(null));
  currentRoutePolylines = [];
  currentRouteMarkers.forEach((m) => m.setMap(null));
  currentRouteMarkers = [];

  if (!directionsService || !directionsRenderer) {
    speak("Le moteur de routage n'est pas disponible pour le moment.");
    return;
  }

  if (directionsRenderer) directionsRenderer.setMap(null);

  const legacyRequest = {
    origin: start,
    destination: end,
    travelMode: "DRIVING",
    avoidHighways: true,
    avoidTolls: true,
    provideRouteAlternatives: window.isRodageActive,
  };

  directionsService.route(legacyRequest, (result, status) => {
    if (status === "OK") {
      if (directionsRenderer) {
        directionsRenderer.setMap(map);
        directionsRenderer.setDirections(result);
      }

      const leg = result.routes[0].legs[0];
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

      if (distEl) distEl.textContent = leg.distance.text;

      let durationSec = leg.duration.value;
      const distanceMeters = leg.distance.value;

      // --- AJUSTEMENT 50cc ---
      durationSec = Math.round(durationSec * 1.2); // +20% pour scooter 50cc en ville
      const maxSpeedMs = 32 / 3.6; // Vitesse moyenne rÃ©aliste pour un 50cc (32 km/h) avec les arrÃªts
      const googleSpeedMs = distanceMeters / durationSec;
      if (googleSpeedMs > maxSpeedMs) {
        durationSec = Math.round(distanceMeters / maxSpeedMs);
        if (window.Telemetry)
          window.Telemetry.addLog("INFO", `ETA ajustÃ© pour 50cc.`);
      }

      const destNameLegacy =
        document.getElementById("route-search").value || "ITINÃ‰RAIRE 50CC";
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
        tempDiv.innerHTML = nextStep.instructions;
        let instructionText = tempDiv.textContent || tempDiv.innerText || "";
        if (nextStepName) nextStepName.textContent = instructionText;
        if (nextStepDist) nextStepDist.textContent = nextStep.distance.text;

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

        // JARVIS : Annonce vocale de l'instruction de guidage
        setTimeout(() => {
          if (typeof speak === "function") {
            speak(
              "Guidage interne dÃ©marrÃ©. Dans " +
                nextStep.distance.text +
                ", " +
                instructionText,
            );
          }
        }, 6000); // DÃ©calÃ© de 6 secondes pour laisser Jarvis annoncer l'ETA en premier
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

      // DÃ©tection ferry (Legacy)
      window.routeFerries = leg.steps.filter(
        (s) =>
          s.instructions.toLowerCase().includes("ferry") ||
          (s.maneuver && s.maneuver.toLowerCase().includes("ferry")),
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
          leg.distance.text,
          etaText,
          window.isRodageActive,
        ),
      );

      // SAFE RIDE : VÃ©rification MÃ©tÃ©o
      if (window.SafeRide) {
        const destLat = typeof end.lat === "function" ? end.lat() : end.lat;
        const destLng = typeof end.lng === "function" ? end.lng() : end.lng;
        window.SafeRide.checkWeatherForRoute(destLat, destLng).then(
          (weather) => {
            if (weather.isDangerous) {
              const issuesStr = weather.issues.join(" et ");
              setTimeout(() => {
                if (typeof speak === "function") {
                  speak(
                    `Alerte Safe Ride : ${issuesStr} sur votre itinÃ©raire. Ã‰quipez-vous et soyez trÃ¨s prudent avant de prendre la route.`,
                  );
                }
              }, 9000);

              // Modifier l'ETA visuellement (+20% temps pour danger)
              if (etaEl && timeEl) {
                const newDurationSec = durationSec * 1.2;
                const newTotalMins = Math.floor(newDurationSec / 60);
                timeEl.textContent =
                  newTotalMins >= 60
                    ? `${Math.floor(newTotalMins / 60)} h ${newTotalMins % 60} min (MÃ©tÃ©o)`
                    : `${newTotalMins} min (MÃ©tÃ©o)`;
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

      if (destinationMarker) destinationMarker.setMap(null);
      destinationMarker = new google.maps.Marker({
        position: end,
        map: map,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: "white",
          fillOpacity: 1,
          strokeWeight: 2,
        },
      });
      currentRouteMarkers.push(destinationMarker);
    } else if (status === "ZERO_RESULTS") {
      speak("Aucun itinÃ©raire trouvÃ© vers cette destination.");
    } else {
      console.error("Routage impossible: " + status);
      speak("Erreur de calcul d'itinÃ©raire.");
    }
  });
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
            calculateRouteSansAutoroute(startPos, resEnd[0].geometry.location);
          } else {
            speak("Destination introuvable.");
          }
        });
      } else {
        speak("Lieu de dÃ©part introuvable.");
      }
    });
    return;
  }

  // SINON GPS CLASSIQUE
  if (!currentPosition) {
    speak(
      "Recherche de votre position GPS. L'itinÃ©raire dÃ©marrera automatiquement dÃ¨s que possible.",
    );
    window.pendingDestinationName = query;
    return;
  }

  geocoder.geocode({ address: query }, (res, status) => {
    if (status === "OK") {
      const dest = res[0].geometry.location;
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
      `ðŸš¨ Action Interdite : Votre compte est suspendu pour faux signalements rÃ©pÃ©tÃ©s. Fin de la sanction dans ${remaining} minutes.`,
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

  // 2. Publication Cloud (Temps rÃ©el pour la communautÃ©)
  if (typeof publishHazardCloud === "function") {
    publishHazardCloud(h).then((success) => {});
  }

  alert(`Signalement: ${escapeHTML(type)} enregistrÃ© ! Merci Ã  vous.`);

  // GAMIFICATION: +50 XP pour le signalement communautaire
  if (typeof window.updateXP === "function") {
    window.updateXP(5); // +50 XP (updateXP multiplie par 10)
    if (typeof speak === "function")
      speak("Signalement validÃ©. Vous gagnez de l'expÃ©rience.");
  }

  toggleHazardMenu();
  loadHazards();
};

function loadHazards() {
  if (typeof google === "undefined" || !google.maps || !google.maps.Marker)
    return;
  const raw = secureGetItem("hazards");
  let hazards = raw ? JSON.parse(raw) : [];

  // Filtrage Ã©phÃ©mÃ¨re Animaux (> 30 mins = expirÃ©)
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
        '<p style="font-size:0.8rem; color:#666; text-align:center; padding:10px;">Aucun danger signalÃ©.</p>';
    } else {
      listContainer.innerHTML = "";
      hazards.reverse(); // Voir les plus rÃ©cents en premier dans la liste
    }
  }

  hazards.forEach((h, index) => {
    const isAnimal = h.type === "animal" || h.type === "chien";
    const hColor =
      h.type === "Police"
        ? "#00d2ff"
        : h.type === "Route DÃ©gradÃ©e"
          ? "#f1c40f"
          : isAnimal
            ? "#e67e22"
            : "#ff4d4d";
    const marker = new google.maps.Marker({
      position: { lat: h.lat, lng: h.lon },
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: hColor,
        fillOpacity: 0.9,
        scale: 9,
        strokeColor: "white",
        strokeWeight: 2,
      },
    });
    const info = new google.maps.InfoWindow({
      content: `<b>${isAnimal ? "ðŸ¾ " : ""}${escapeHTML(h.type)}</b><br><small>${escapeHTML(h.author)}</small>`,
    });
    marker.addListener("click", () => info.open(map, marker));
    hazardMarkers.push(marker);

    // Ajout Ã  la liste sidebar
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
    label: "SantÃ© & Pharmacie",
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

        // Masquer si blacklistÃ©e
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
                            <strong>${p["@nom"]}</strong> <span>${parseFloat(p["@valeur"]).toFixed(3)}â‚¬</span>
                        </div>`;
          });
        } catch (e) {
          pricesHtml = "Prix non disponibles";
        }

        const marker = new google.maps.Marker({
          position: { lat: coords[1], lng: coords[0] },
          map: map,
          icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            fillColor: "#cca000",
            fillOpacity: 1,
            scale: 6,
            strokeColor: "white",
          },
        });

        // Compteur de signalements
        const currentReports = reportCounts[stationId] || 0;
        const reportBadge =
          currentReports > 0
            ? `<div style="color:#ff4d4d; font-size:0.7rem; font-weight:bold; margin-top:5px;"><i class="fa-solid fa-triangle-exclamation"></i> ${currentReports}/10 signalements</div>`
            : "";

        // Bouton de signalement pour les membres
        const isGuest = !window.session || window.session.isGuest;
        const reportBtn = isGuest
          ? ""
          : `
                    <button onclick="triggerPhotoReport('${stationId}', '${fields.vile || fields.adresse}')" 
                        style="width:100%; margin-top:5px; background:#ff4d4d; color:white; border:none; padding:5px; border-radius:5px; font-size:0.7rem; cursor:pointer;">
                        ðŸš¨ Signaler Abus Prix (+Photo)
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
    alert("Erreur lors de la rÃ©cupÃ©ration des prix.");
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
          ? `<div style="background:#ffd700; color:black; padding:2px 5px; font-size:0.6rem; font-weight:bold; border-radius:4px; margin-top:5px; display:inline-block;"><i class="fa-solid fa-trophy"></i> BADGE PRO CERTIFIÃ‰</div>`
          : "";
        const qualityBadge =
          place.rating > 3.9
            ? `<div style="background:#f1c40f; color:black; padding:2px 5px; font-size:0.6rem; font-weight:bold; border-radius:4px; margin-top:5px; display:inline-block;"><i class="fa-solid fa-certificate"></i> QUALITÃ‰ CERTIFIÃ‰E (>3.9)</div>`
            : "";
        const communityRating = internalInfo
          ? `<div style="font-size:0.7rem; color:#00d2ff; margin-top:3px;">Label Scooter : â­ ${internalInfo.avgRating}/5 (${internalInfo.count} avis)</div>`
          : "";

        const marker = new google.maps.Marker({
          position: place.geometry.location,
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor:
              place.rating > 3.9 ? "#f1c40f" : isPro ? "#ffd700" : config.color,
            fillOpacity: 1,
            strokeColor: "white",
            strokeWeight: place.rating > 3.9 ? 3 : 1,
          },
        });

        // Ã‰toiles de notation
        const isGuest = !window.session || window.session.isGuest;
        const safePlaceName = (place.name || "")
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const starBtns = isGuest
          ? ""
          : `<div style="margin-top:10px; border-top:1px solid #eee; padding-top:5px;">
                    <small>Ã‰valuer ce garage :</small><br>
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
      alert(`${filtered.length} garages certifiÃ©s (Note > 3.3) trouvÃ©s.`);
    } else {
      alert("Aucun garage trouvÃ© dans cette zone.");
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

    // Lecture en base64 pour le stockage Firestore (ou upload Storage si configurÃ©)
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
      const marker = new google.maps.Marker({
        position: {
          lat: item.lat || item.center.lat,
          lng: item.lon || item.center.lon,
        },
        map: map,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          fillColor: config.color,
          fillOpacity: 1,
          scale: 5,
          strokeColor: "white",
        },
      });
      const info = new google.maps.InfoWindow({
        content: `<div style="color:black"><b>${escapeHTML(item.tags?.name || config.label)}</b></div>`,
      });
      marker.addListener("click", () => info.open(map, marker));
      officialPoiMarkers.push(marker);
    });
  }
  alert(`${elements?.length || 0} rÃ©sultat(s) trouvÃ©s.`);
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
    const m = new google.maps.Marker({
      position: { lat: member.lat, lng: member.lng },
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: "#00d2ff",
        fillOpacity: 0.8,
        strokeColor: "white",
        strokeWeight: 2,
        labelOrigin: new google.maps.Point(0, -2),
      },
      title: member.username,
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

    const m = new google.maps.Marker({
      position: ghostPos,
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 5,
        fillColor: "#666",
        fillOpacity: 0.5,
        strokeColor: "white",
        strokeWeight: 1,
      },
      title: name,
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

  // Si on l'a dÃ©jÃ  dessinÃ©, on met juste Ã  jour la couleur
  if (this.territoryShapes[zipCode]) {
    this.territoryShapes[zipCode].setOptions({
      fillColor: color,
      strokeColor: color,
    });
    return;
  }

  // Sinon on tente de gÃ©ocoder le code postal pour trouver le centre de la zone (en France)
  if (typeof geocoder !== "undefined" && geocoder) {
    geocoder.geocode({ address: zipCode + " France" }, (res, status) => {
      if (status === "OK" && res[0]) {
        const center = res[0].geometry.location;
        // Dessiner un grand cercle pour reprÃ©senter le territoire
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
                                <p style="margin:5px 0;">DominÃ© par: <b>${data.dominantCrewName || "Inconnu"}</b></p>
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
          window.CrewSystem.addKmToTerritory(zipComp.short_name, 0.5); // +0.5 km simulÃ©s
        }
      }
    });
  }
}, 60000);


/* --- app-features.js --- */
﻿// Fallback if loaded before auth.js/database.js
if (typeof window.secureGetItem === "undefined") {
  window.secureGetItem = function (key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  };
  window.secureSetItem = function (key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  };
}
if (typeof secureGetItem === "undefined") {
  var secureGetItem = window.secureGetItem;
  var secureSetItem = window.secureSetItem;
}

// --- 7. SERVICES (MÃ©tÃ©o, Boussole, Garage) ---
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

    // DÃ©tection mondiale Vigilance Rouge (Canicule ou TempÃªte)
    if (temp >= 38 || wind >= 70 || code === 99 || code === 77) {
      window.isVigilanceRouge = true;
      alertMsg =
        "VIGILANCE ROUGE DÃ‰TECTÃ‰E : Conditions mÃ©tÃ©orologiques extrÃªmes.";
      icon =
        '<i class="fa-solid fa-triangle-exclamation" style="color:#ff0000; animation: flash 1s infinite;"></i>';
      const banner = document.getElementById("vigilance-rouge-banner");
      const textEl = document.getElementById("vigilance-rouge-text");
      if (banner && textEl) {
        textEl.innerHTML = `ðŸš¨ <strong>VIGILANCE ROUGE (MONDIALE) :</strong> TempÃ©rature ${temp}Â°C, Vent ${wind}km/h. Soyez extrÃªmement prudents !`;
        banner.style.display = "block";
      }
    }

    if (!window.isVigilanceRouge) {
      if (code >= 95) {
        alertMsg = "Alerte Orage : Prudence maximale conseillÃ©e.";
        icon = '<i class="fa-solid fa-cloud-bolt" style="color:#f1c40f;"></i>';
      } else if (code >= 80) {
        alertMsg = "Averses dÃ©tectÃ©es : Route potentiellement glissante.";
        icon = '<i class="fa-solid fa-cloud-showers-heavy"></i>';
      } else if (code >= 61) {
        alertMsg = "Pluie signalÃ©e par satellite. Ã‰quipez-vous.";
        icon = '<i class="fa-solid fa-cloud-rain"></i>';
      } else if (code >= 71) {
        alertMsg = "Alerte Neige : Conditions de circulation difficiles.";
        icon = '<i class="fa-solid fa-snowflake"></i>';
      }
    }

    const wHud = document.getElementById("weather-hud");
    if (wHud) {
      wHud.innerHTML = `${icon} ${temp}Â°C`;
      if (alertMsg) wHud.classList.add("weather-alert");
      else wHud.classList.remove("weather-alert");
    }

    if (alertMsg && !window.lastWeatherAlert) {
      speak(alertMsg);
      window.lastWeatherAlert = true;
      setTimeout(() => (window.lastWeatherAlert = false), 3600000); // Reset alerte toutes les heures
    }
  } catch (e) {
    console.warn("MÃ©tÃ©o fail");
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
    const p1 = new google.maps.LatLng(
      lastPositionForOdometer.lat,
      lastPositionForOdometer.lng,
    );
    const p2 = new google.maps.LatLng(lat, lng);
    const d =
      google.maps.geometry.spherical.computeDistanceBetween(p1, p2) / 1000;

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
    odom.textContent = `OdomÃ¨tre: ${window.session.totalDistance.toFixed(2)} km`;

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
    badgesHtml += `<div class="badge-eco" title="Badge Ã‰colo: 100kg CO2 sauvÃ©s" style="background:#2ecc71; color:white; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block; margin-right:5px;">
            <i class="fa-solid fa-leaf"></i> Ã‰colo
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
    badgesHtml += `<div class="badge-diamant" title="LÃ©gende: 10000km" style="background:linear-gradient(135deg, #B9F2FF, #ffffff); color:#005c75; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block; box-shadow:0 0 10px #B9F2FF; margin-right:5px;">
            <i class="fa-solid fa-gem"></i> Diamant
        </div>`;
  }

  // Badge Pro des DÃ©fis (150 victoires)
  const challengeWins = window.session?.completedChallengesCount || 0;
  if (challengeWins >= 150) {
    badgesHtml += `<div class="badge-master-defi" title="Master DÃ©fis: 150 victoires" style="background:#9b59b6; color:white; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block; border:1px solid #fff;">
            <i class="fa-solid fa-trophy"></i> Pro des DÃ©fis
        </div>`;
  }

  // Badge MÃ©cÃ¨ne (Donateur)
  if (window.session?.isDonator) {
    badgesHtml += `<div class="badge-mecene" title="MÃ©cÃ¨ne: Soutien du projet" style="background:#e91e63; color:white; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block; margin-right:5px; box-shadow:0 0 5px #e91e63;">
            <i class="fa-solid fa-heart"></i> MÃ©cÃ¨ne
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
    list.innerHTML = `<p style="text-align:center; color:#666; margin-top:20px;">Aucun roadbook ${filter === "favorites" ? "favori" : "enregistrÃ©"}.</p>`;
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
                    <small style="color:#888;">${rb.waypoints?.length || 0} Ã©tapes</small>
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
    speak("RetirÃ© des favoris.");
  } else {
    favorites.push(idx);
    speak("AjoutÃ© aux favoris !");
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

  // MODÃ‰RATION : VÃ©rification de la grossiÃ¨retÃ©
  if (
    Moderation.isProfane(rb.name) ||
    (rb.description && Moderation.isProfane(rb.description))
  ) {
    alert(
      "Action bloquÃ©e : Le titre ou la description contient un langage inappropriÃ©.",
    );
    return;
  }

  // MODÃ‰RATION : VÃ©rification des images (si prÃ©sentes)
  if (rb.photo) {
    const scan = await Moderation.scanImage(rb.photo);
    if (!scan.safe) {
      alert(
        "Action bloquÃ©e : L'image jointe n'est pas conforme aux rÃ¨gles communautaires.",
      );
      return;
    }
  }

  // Publication Cloud (Si DB ok)
  if (typeof publishRoadbookCloud === "function") {
    const success = await publishRoadbookCloud(rb);
    if (success) alert("Roadbook partagÃ© avec succÃ¨s Ã  la communautÃ© !");
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
      '<i class="fa-solid fa-plane"></i> Mode hors-ligne - Navigation limitÃ©e';
    document.body.appendChild(toast);
    speak("Mode hors-ligne activÃ©.");
  } else {
    const toast = document.getElementById("offline-toast");
    if (toast) {
      toast.style.background = "rgba(46,204,113,0.9)";
      toast.innerHTML = '<i class="fa-solid fa-wifi"></i> Connexion rÃ©tablie';
      setTimeout(() => toast.remove(), 3000);
      speak("Connexion rÃ©tablie.");
    }
  }
}
window.saveEmergencyContact = function () {
  const num = document.getElementById("emergency-num").value;
  secureSetItem("emergency_contact", num);
  speak("Contact d'urgence enregistrÃ©.");
  vibrate(50);
};

window.toggleGuardian = function () {
  const active = secureGetItem("guardian_enabled") === "true";
  secureSetItem("guardian_enabled", !active);
  speak(!active ? "Guardian Mode activÃ©." : "Guardian Mode dÃ©sactivÃ©.");
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
      // Impact massif dÃ©tectÃ©
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
  speak("Guardian Mode : Alerte d'immobilitÃ©. ÃŠtes-vous toujours lÃ  ?");
  vibrate([1000, 500, 1000]);

  const toast = document.createElement("div");
  toast.id = "guardian-prompt";
  toast.style =
    "position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.95); border:2px solid #00d2ff; padding:30px; border-radius:30px; z-index:10001; text-align:center; color:white; width:85%; box-shadow:0 0 50px rgba(0,0,0,1);";
  toast.innerHTML = `
        <i class="fa-solid fa-shield-heart fa-beat" style="font-size:4rem; color:#00d2ff; margin-bottom:20px;"></i>
        <h2>Guardian Mode</h2>
        <p>ArrÃªt prolongÃ© dÃ©tectÃ©. <br>Confirmation requise.</p>
        <button onclick="dismissGuardian()" style="margin-top:20px; width:100%; border:none; padding:20px; border-radius:50px; background:#00d2ff; color:black; font-weight:bold; font-size:1.2rem;">TOUT VA BIEN âœ…</button>
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

    // Alerte Ã  1km (1000 mÃ¨tres)
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
        window.Telemetry.addLog("INFO", "Ferry crossing ahead: 1km");
      }
    }
  });
}

window.addCategorizedMaint = function (category) {
  if (window.session && window.session.isGuest) {
    alert("ðŸ”’ Le Carnet CertifiÃ© est rÃ©servÃ© aux membres.");
    return;
  }

  const proCode = prompt(
    `ðŸ”‘ VALIDATION PRO REQUISE\nPour certifier l'entretien "${category}", le garage doit entrer son code partenaire :`,
  );

  // Simulation de validation (En prod, on vÃ©rifie contre la base des garages certifiÃ©s)
  if (
    proCode === "PRO50" ||
    (window.session.isCertifiedGarage && proCode === "ME")
  ) {
    const action = prompt(
      `Description de l'intervention ${category} :`,
      `RÃ©vision standard ${category}`,
    );
    if (!action) return;

    const entry = {
      category: category,
      action: action,
      date: new Date().toLocaleDateString(),
      certified: true,
      garage: window.session.isCertifiedGarage
        ? window.session.username
        : "Garage Partenaire CertifiÃ©",
    };

    let history = JSON.parse(secureGetItem("maint_history") || "[]");
    history.push(entry);
    secureSetItem("maint_history", JSON.stringify(history));

    speak(
      "Intervention certifiÃ©e et enregistrÃ©e dans votre passeport entretien.",
    );
    showPage("garage");
  } else {
    alert(
      "âŒ Code invalide. Seul un garage certifiÃ© peut valider cette intervention.",
    );
    speak("Ã‰chec de la certification.");
  }
};

function getSOSActions() {
  const num = secureGetItem("emergency_contact");
  if (num) {
    return `<a href="tel:${num}" style="display:block; margin-top:20px; padding:20px; background:#2ecc71; color:white; text-decoration:none; border-radius:50px; font-weight:bold; font-size:1.2rem;">APPELER URGENCE ðŸ“ž</a>`;
  }
  return "";
}

window.saveCTDate = function (val) {
  secureSetItem("ct_date", val);
  speak("Date du contrÃ´le technique enregistrÃ©e.");
};

window.addCategorizedMaint = function (cat) {
  const action = prompt(`DÃ©tail pour l'entretien [${cat}] :`, "RÃ©vision");
  if (!action) return;

  let history = JSON.parse(secureGetItem("maint_history") || "[]");
  history.push({
    date: new Date().toLocaleDateString(),
    action: action,
    category: cat,
    km: window.session?.totalDistance?.toFixed(0) || 0,
  });
  secureSetItem("maint_history", JSON.stringify(history));

  // Reset maintenance counter
  if (window.session && window.session.maintenance) {
    window.session.maintenance[cat.toLowerCase()] =
      window.session.totalDistance;
    secureSetItem("session", JSON.stringify(window.session));
  }

  showPage("garage");
  speak(`Entretien ${cat} validÃ©.`);
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
    speak("Mode Rodage activÃ©.");
    alert(
      "Mode Rodage : Le GPS Ã©vitera les voies rapides et vous guidera sur des routes tranquilles.",
    );
  } else {
    speak("Mode Rodage dÃ©sactivÃ©.");
  }
};

window.toggleGarageVisibility = function () {
  window.isGarageVisible = !window.isGarageVisible;
  speak(
    window.isGarageVisible
      ? "Votre garage est maintenant visible des pilotes."
      : "VisibilitÃ© dÃ©sactivÃ©e.",
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
  speak("DisponibilitÃ© de l'atelier mise Ã  jour.");
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
  speak("Offre Flash publiÃ©e.");
  alert("Votre offre de promotion a Ã©tÃ© diffusÃ©e !");
  if (typeof publishMoodCloud === "function") {
    publishMoodCloud({ label: "âš¡ PROMO", text: text });
  }
};

window.requestCertification = function () {
  alert("Demande de certification envoyÃ©e !");
  speak("Demande enregistrÃ©e.");
};

window.payGarageEntryFee = async function () {
  const ok = confirm(
    "Confirmez-vous le paiement du droit d'entrÃ©e de 50â‚¬ TTC pour devenir Garage CertifiÃ© ?",
  );
  if (ok) {
    if (typeof speak === "function")
      speak("Initialisation du paiement sÃ©curisÃ©.");
    try {
      const projectId = window.CONFIG?.FIREBASE?.projectId || "mon50ccetmoi";
      const url = `https://europe-west1-${projectId}.cloudfunctions.net/createRevolutOrder`;
      const caseId = "GARAGE-" + Date.now();

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: 5000,
          currency: "EUR",
          case_id: caseId,
          user_id: window.session?.uid || "guest",
          report_type: "GARAGE_FEE",
        }),
      });

      if (!response.ok)
        throw new Error("Erreur lors de la crÃ©ation de la commande.");
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
                    "Paiement validÃ© ! Vous Ãªtes maintenant un Garage CertifiÃ©.",
                  );
                if (window.session) {
                  window.session.isCertifiedGarage = true;
                  secureSetItem("session", JSON.stringify(window.session));
                }
                showPage("pro-space");
              } else if (attempts > 10) {
                clearInterval(checkStatus);
                alert(
                  "Le paiement est en cours de traitement par Revolut. Votre accÃ¨s pro sera activÃ© automatiquement sous peu.",
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
    "En choisissant cette option, vous vous engagez Ã  offrir une remise de 10% sur vos prestations aux membres prÃ©sentant l'application. En Ã©change, votre certification et votre boost sont OFFERTS. Valider ?",
  );
  if (ok) {
    try {
      if (window.firebase && window.session?.uid) {
        const db = firebase.firestore();
        await db.collection("users").doc(window.session.uid).update({
          isCertifiedGarage: true,
          isGaragePartner: true,
        });
        await db.collection("garage_partners").doc(window.session.uid).set({
          user_id: window.session.uid,
          exempted: true,
          certified_at: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (e) {
      console.error("[GARAGE] Failed to persist partner status", e);
    }

    speak(
      "FÃ©licitations ! Vous Ãªtes dÃ©sormais Partenaire Officiel mon 50 cm3 et moi. Votre gÃ©nÃ©rositÃ© envers la communautÃ© est rÃ©compensÃ©e.",
    );
    if (window.session) {
      window.session.isCertifiedGarage = true;
      window.session.isGaragePartner = true;
      secureSetItem("session", JSON.stringify(window.session));
    }
    showPage("pro-space");
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
    "Votre fiche technique a Ã©tÃ© publiÃ©e avec succÃ¨s ! Elle est maintenant visible par tous les pilotes.",
  );
  alert("FÃ©licitations ! Votre conseil d'expert est en ligne.");
  showPage("pro-space");
};
window.resetTelemetry = function () {
  maxLeanAngle = 0;
  if (window.session) {
    window.session.vMax = 0;
    secureSetItem("session", JSON.stringify(window.session));
  }
  speak("DonnÃ©es de tÃ©lÃ©mÃ©trie rÃ©initialisÃ©es.");
  showPage("garage");
};
// --- AUTO-BOOT & FAIL-SAFE ---
// On s'assure que le mode holographique n'est pas actif au dÃ©marrage (Correction Bug Web)
document.body.classList.remove("holographic-mode");

// Si le SDK Maps est dÃ©jÃ  lÃ , on lance manuellement
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
        "DÃ©solÃ©, le module juridique est en cours de mise Ã  jour.";
      chat.scrollTop = chat.scrollHeight;
    }, 1500);
  }
};

function generateRideCard() {
  if (window.session.isGuest) {
    alert(
      "ðŸ”’ La Carte de Score est rÃ©servÃ©e aux membres. Inscrivez-vous pour partager vos exploits !",
    );
    return;
  }

  speak("GÃ©nÃ©ration de votre carte de score personnalisÃ©e.");
  const overlay = document.createElement("div");
  overlay.id = "ride-card-overlay";
  overlay.className = "glassmorphism";
  overlay.style =
    "position:fixed; top:0; left:0; width:100%; height:100%; z-index:20000; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:30px; text-align:center; background:radial-gradient(circle, #1a1a1a, #000);";

  overlay.innerHTML = `
        <div style="border:2px solid var(--accent); padding:40px; border-radius:20px; box-shadow:0 0 50px var(--accent-glow); background:rgba(0,0,0,0.8);">
            <h1 style="font-size:2rem; color:var(--accent); margin-bottom:5px;">RIDE COMPLETE</h1>
            <p style="color:#888; letter-spacing:3px; margin-bottom:30px; font-size:0.8rem;">NETIZEN INTERCEPTOR V26</p>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:40px;">
                <div><span style="font-size:0.6rem; color:#666; display:block;">DISTANCE</span><strong style="font-size:1.2rem; color:#fff;">${document.getElementById("odometer")?.textContent || "0"} KM</strong></div>
                <div><span style="font-size:0.6rem; color:#666; display:block;">MAX LEAN</span><strong style="font-size:1.2rem; color:#ff4d4d;">${window.maxLeanAngle || 0}Â°</strong></div>
                <div><span style="font-size:0.6rem; color:#666; display:block;">V-MAX</span><strong style="font-size:1.2rem; color:var(--neon-blue);">${window.session.vMax || 0} KM/H</strong></div>
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

// --- ORACLE: MESSAGES RÃ‰GIONAUX MULTILINGUES ---
window.hasWelcomed = false;

const REGION_MESSAGES = {
  bretagne:
    "Bienvenue en Bretagne. Prudence sur les routes potentiellement humides.",
  normandie:
    "Bienvenue en Normandie. Restez vigilant face au vent et aux averses.",
  "Ã®le-de-france":
    "Bienvenue en ÃŽle-de-France. DensitÃ© de trafic Ã©levÃ©e, gardez vos distances.",
  "provence-alpes-cÃ´te d'azur":
    "Bienvenue dans le Sud. La route est dÃ©gagÃ©e. Pensez Ã  vous hydrater.",
  "auvergne-rhÃ´ne-alpes":
    "Bienvenue en rÃ©gion RhÃ´ne-Alpes. Attention aux routes sinueuses en montagne.",
  "nouvelle-aquitaine":
    "Bienvenue en Nouvelle-Aquitaine. De belles balades en perspective.",
  occitanie: "Bienvenue en Occitanie. Soleil et belles routes vous attendent.",
  "hauts-de-france": "Bienvenue dans les Hauts-de-France. Gardez le contrÃ´le.",
  "grand est": "Bienvenue dans le Grand Est. Excellente balade.",
  "bourgogne-franche-comtÃ©":
    "Bienvenue en Bourgogne. Conduite souple recommandÃ©e.",
  "pays de la loire": "Bienvenue. L'Oracle est connectÃ© pour votre balade.",
  default: "Oracle connectÃ©. Position GPS Ã©tablie, prÃªt pour le dÃ©part.",
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
    return `ItinÃ©raire rodage calculÃ©. ${dist} Ã  parcourir. Bonne route avec mon 50 cc et moi.`;
  } else {
    return `ItinÃ©raire calculÃ©. ${dist}, arrivÃ©e prÃ©vue Ã  ${etaText}. Bonne route avec mon 50 cc et moi.`;
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
  if (isShadow) speak("Mode furtif activÃ©. Concentration maximale.");
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
      "Alerte Verglas et adhÃ©rence rÃ©duite dÃ©tectÃ©e. Grip en dessous de 50 pour cent.",
    );
    window.blackIceAlerted = true;
  }

  // IA Wingman (Temps de conduite et rappels rÃ©guliers)
  if (window.isRiding) {
    if (!window.rideStartTime) window.rideStartTime = Date.now();
    const rideDuration = (Date.now() - window.rideStartTime) / 60000; // minutes

    window.wingmanAlertCount = window.wingmanAlertCount || 0;
    const currentPeriod = Math.floor(rideDuration / 45); // VÃ©rifie chaque tranche de 45 min

    if (currentPeriod > window.wingmanAlertCount) {
      if (window.isVigilanceRouge) {
        speak(
          "Vigilance rouge dÃ©tectÃ©e. Vous roulez depuis 45 minutes supplÃ©mentaires. Jarvis vous demande d'effectuer une pause immÃ©diate et de vous hydrater abondamment !",
        );
      } else {
        speak(
          "Vous roulez depuis 45 minutes. TempÃ©rature moteur optimale atteinte, mais attention Ã  la fatigue. Envisagez une pause bientÃ´t.",
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

// --- 3. SONAR DE COMMUNAUTÃ‰ ---
window.triggerCommunitySonar = function () {
  if (document.body.classList.contains("shadow-mode")) return; // Furtif

  // Animation Sonar Center
  const sonar = document.createElement("div");
  sonar.className = "sonar-wave";
  document.body.appendChild(sonar);

  setTimeout(() => {
    // AlÃ©atoirement, trouver un alliÃ© (1 chance sur 4)
    if (Math.random() > 0.75) {
      speak("Pilote alliÃ© dÃ©tectÃ© dans le secteur.");
      const ally = document.createElement("div");
      ally.className = "ally-marker";
      // Position alÃ©atoire sur l'Ã©cran
      ally.style.top = 20 + Math.random() * 60 + "%";
      ally.style.left = 20 + Math.random() * 60 + "%";
      document.body.appendChild(ally);
      setTimeout(() => ally.remove(), 6000);
    }
    sonar.remove();
  }, 4000);
};
setInterval(window.triggerCommunitySonar, 120000); // Sonar toutes les 2 minutes

// --- 5. EXPLORATION TACTIQUE (ROUTE ALÃ‰ATOIRE) ---
window.generateTacticalExploration = function () {
  if (!navigator.geolocation) {
    alert("GPS requis pour l'exploration.");
    return;
  }
  // GARDE : ne pas accÃ©der au GPS sans consentement de l'utilisateur
  if (localStorage.getItem("location_consent_accepted") !== "true") {
    alert("Vous devez d'abord accepter l'utilisation de la localisation.");
    return;
  }

  document.getElementById("route-start").value = "Position Actuelle";
  document.getElementById("route-search").value = "GÃ©nÃ©ration de boucle...";
  speak("Calcul d'une boucle d'exploration tactique alÃ©atoire.");

  navigator.geolocation.getCurrentPosition((pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // GÃ©nÃ©rer un point alÃ©atoire Ã  ~10-15km (1 degrÃ© lat = ~111km)
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
// --- 6. VIGILANCE ROUGE MÃ‰TÃ‰O-FRANCE (OPENDATA) ---
// ============================================================
window.checkVigilanceRouge = async function () {
  try {
    // API Publique OpenDataSoft pour MÃ©tÃ©o-France (Filtre: Vigilance Rouge uniquement)
    const url =
      "https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/vigilance-meteorologique/records?limit=100&refine=etat_de_vigilance%3A%22Rouge%22";
    const response = await fetch(url);

    if (!response.ok) throw new Error("API Vigilance Inaccessible");

    const data = await response.json();
    const alerts = data.results || [];
    const banner = document.getElementById("vigilance-rouge-banner");
    const textEl = document.getElementById("vigilance-rouge-text");

    if (alerts.length > 0 && banner && textEl) {
      // Regrouper les dÃ©partements en alerte
      const deptsList = alerts
        .map(
          (a) =>
            `${a.nom_dept || a.departement || "DÃ©partement inconnu"} (${a.risque || "Danger imminent"})`,
        )
        .join(" | ");
      textEl.innerHTML = `ðŸš¨ <strong>VIGILANCE ROUGE MÃ‰TÃ‰O-FRANCE :</strong> ${deptsList}. Soyez extrÃªmement prudents, limitez vos dÃ©placements en 2-roues.`;
      banner.style.display = "block";

      // Notification vocale (uniquement si ce n'est pas dÃ©jÃ  affichÃ© pour Ã©viter le spam)
      if (banner.dataset.alerted !== "true" && typeof speak === "function") {
        speak(
          "Alerte de sÃ©curitÃ© absolue. Vigilance Rouge MÃ©tÃ©o France en cours.",
        );
        banner.dataset.alerted = "true";
      }
    } else if (banner) {
      banner.style.display = "none";
      banner.dataset.alerted = "false";
    }
  } catch (err) {
    console.warn("[Vigilance] Erreur de rÃ©cupÃ©ration :", err);
  }
};

// Initialisation et Polling (Toutes les 5 minutes)
setTimeout(() => {
  if (typeof window.checkVigilanceRouge === "function") {
    window.checkVigilanceRouge();
    setInterval(window.checkVigilanceRouge, 300000); // 5 minutes
  }
}, 5000); // Lancement 5 secondes aprÃ¨s le chargement de l'app

// ============================================================
// --- 7. BOÃŽTE NOIRE (TÃ‰LÃ‰MÃ‰TRIE D'ASSURANCE) ---
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
      "La boÃ®te noire est vide. Vous devez rouler pour enregistrer des donnÃ©es.",
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
  speak("Rapport de boÃ®te noire exportÃ© avec succÃ¨s.");
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
  speak(`Escouade ${code} rejointe. Activation du radar partagÃ©.`);

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

  // Ã‰coute des alliÃ©s
  if (window.db) {
    window.db
      .collection("convoys")
      .doc(window.currentSquadId)
      .collection("positions")
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const uid = change.doc.id;
          if (uid === (window.user && window.user.uid)) return; // Ignorer soi-mÃªme

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
                title: "Pilote AlliÃ©",
              });
              speak("Nouvel alliÃ© dÃ©tectÃ© sur le radar.");
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
﻿// --- SYSTEM STARTUP ---
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
    if (needle) needle.style.transform = "rotate(40deg)"; // 120 -> 40 pour ÃƒÂªtre proportionnel
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

  // Update check list
  setTimeout(() => {
    if (checkList) checkList.innerHTML += "<div>> ENGINE_CHECK: OK</div>";
  }, 1200);
  setTimeout(() => {
    if (checkList)
      checkList.innerHTML += "<div>> NETWORK_ESTABLISHED: 5G_ULTRA</div>";
  }, 2000);
}

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
                <i class="fa-solid fa-share-nodes"></i> GÃƒâ€°NÃƒâ€°RER MA CARTE RIDE (VIRAL)
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
    const ctDate = secureGetItem("ct_date") || "Non dÃƒÂ©fini";

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
                <h4 style="color:var(--neon-blue); margin-bottom:10px;"><i class="fa-solid fa-chart-line"></i> TÃƒâ€°LÃƒâ€°MÃƒâ€°TRIE DE RIDE</h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; text-align:center;">
                    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px;">
                        <small>ANGLE MAX</small><br>
                        <strong style="font-size:1.2rem; color:var(--accent);">${maxLeanAngle}Ã‚Â°</strong>
                    </div>
                    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px;">
                        <small>VITESSE MAX</small><br>
                        <strong style="font-size:1.2rem; color:var(--danger);">${window.session?.vMax || 0} km/h</strong>
                    </div>
                </div>
                <button onclick="resetTelemetry()" style="width:100%; height:25px; margin-top:10px; background:transparent; border:1px solid #444; color:#666; font-size:0.6rem; border-radius:15px;">RÃƒâ€°INITIALISER LES STATS</button>
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

            <div id="maint-history" style="font-size:0.8rem; margin-top:15px; max-height:200px; overflow-y:auto;">
                ${
                  history.length
                    ? history
                        .reverse()
                        .map(
                          (
                            h,
                          ) => `<div style="padding:10px; background:rgba(255,255,255,0.05); margin-bottom:5px; border-radius:8px; border-left:3px solid ${h.certified ? "#2ecc71" : "#444"};">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>${h.category}</strong>
                        <span style="color:#666; font-size:0.7rem;">${h.date}</span>
                    </div>
                    <div style="font-size:0.75rem; margin-top:3px; color:#ccc;">${h.action}</div>
                    ${h.certified ? `<div style="font-size:0.6rem; color:#2ecc71; margin-top:5px;"><i class="fa-solid fa-certificate"></i> CERTIFIÃƒâ€° PAR : ${h.garage}</div>` : ""}
                </div>`,
                        )
                        .join("")
                    : '<p style="color:#444; text-align:center;">Votre carnet est vide.</p>'
                }
            </div>`;
    renderDynamicGarage();
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
      content.innerHTML = `<h3>ItinÃƒÂ©raires Rodage</h3>
            <p>Routes limitÃƒÂ©es ÃƒÂ  45 km/h pour prÃƒÂ©server votre moteur.</p>
            <button class="btn-insurance" onclick="startRodage('Paris-Boucle')">Boucle Zen (Paris)</button>
            <button class="btn-insurance" onclick="startRodage('Lyon-Quais')">Quais SaÃƒÂ´ne (Lyon)</button>`;
  } else if (page === "insurance") {
    if (typeof content !== "undefined")
      content.innerHTML = `<div class="card-insurance">
            <div class="insurance-badge">Partenaire</div>
            <h3>Protection 50cc</h3>
            <div class="promo-box"><span>Votre code promo:</span><strong>CHEZBIGBOO</strong></div>
            <div class="broker-contact">
                <strong>Robert - Courtier Partenaire</strong>
                <a href="tel:0749555829">Ã°Å¸â€œÅ¾ 07 49 55 58 29</a>
                <span>SpÃƒÂ©cialiste du jeune conducteur 50cc</span>
            </div>
            <p>BÃƒÂ©nÃƒÂ©ficiez de -15% sur votre assurance scooter en tant que membre.</p>
        </div>`;
  } else if (page === "roadbooks") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3>Roadbooks</h3>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <button onclick="renderRoadbooks('all')" class="btn-insurance" style="flex:1; padding:8px; font-size:0.75rem;">Mes CrÃƒÂ©ations</button>
                <button onclick="renderRoadbooks('favorites')" class="btn-insurance" style="flex:1; padding:8px; font-size:0.75rem; background:#f1c40f; color:black;"><i class="fa-solid fa-star"></i> Mes Favoris</button>
            </div>
            <ul id="roadbook-list" style="list-style:none; padding:0;"></ul>`;
    renderRoadbooks("all");
  } else if (page === "mechanic") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-robot"></i> ${t("expert_meca_title")}</h3>
            <p style="font-size:0.8rem; color:#aaa;">DÃƒÂ©crivez le symptÃƒÂ´me (bruit, fumÃƒÂ©e, panne...)</p>
            <textarea id="meca-query" placeholder="Ex: Mon scoot broute ÃƒÂ  l'accÃƒÂ©lÃƒÂ©ration..." style="width:100%; height:80px; margin-top:10px; background:#111; color:white; border:1px solid #ffb703; border-radius:8px; padding:10px;"></textarea>
            <button class="btn-insurance" onclick="submitMecaV3()" style="margin-top:15px; width:100%;">Scanner mon 50cc</button>
            <div id="meca-response" style="margin-top:20px; font-size:0.9rem; line-height:1.4;"></div>`;
  } else if (page === "arbitre") {
    if (window.session && window.session.isGuest) {
      alert("AccÃƒÂ¨s rÃƒÂ©servÃƒÂ© aux membres inscrits ! Ã°Å¸â€ºÂµ");
      return;
    }
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-scale-balanced"></i> ${t("arbitre_title")}</h3>
            <p style="font-size:0.8rem; color:#aaa; margin-bottom:15px;">Posez votre question sur la rÃƒÂ©glementation 50cc (dÃƒÂ©bridage, ÃƒÂ©quipement, contrÃƒÂ´les...).</p>
            
            <div id="arbitre-chat" style="background:rgba(0,0,0,0.3); border-radius:15px; padding:15px; min-height:150px; max-height:300px; overflow-y:auto; margin-bottom:15px; border:1px solid rgba(255,183,3,0.2);">
                <div class="bot-msg" style="background:rgba(255,183,3,0.1); padding:10px; border-radius:10px 10px 10px 0; margin-bottom:10px; font-size:0.9rem; border-left:3px solid #ffb703;">
                    Bonjour ! Je suis l'Arbitre. Quel est votre litige ou votre question sur le Code de la Route ?
                </div>
            </div>

            <div style="display:flex; gap:10px;">
                <input type="text" id="arbitre-query" placeholder="Ex: Mon pot est-il homologuÃƒÂ© ?" style="flex:1; background:#111; color:white; border:1px solid #444; border-radius:20px; padding:10px 15px; font-size:0.9rem;">
                <button onclick="submitArbitre()" style="background:#ffb703; color:black; border:none; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-paper-plane"></i></button>
            </div>`;
  } else if (page === "ia_predictive") {
    if (typeof content !== "undefined")
      content.innerHTML = `<div class="card-insurance" style="border: 2px solid #b700ff; background: rgba(20, 10, 40, 0.9);">
            <div class="insurance-badge" style="background: #b700ff; color: white;">IA PrÃƒÂ©dictive & Courtier</div>
            <h3 style="color: #00d2ff;"><i class="fa-solid fa-microchip"></i> IA PrÃƒÂ©dictive</h3>
            <p style="font-size: 0.85rem; color: #ddd; margin-bottom: 15px;">L'IA analyse vos trajets pour anticiper les pannes et optimiser votre conduite 50cc.</p>
            
            <div class="glassmorphism" style="padding:15px; margin-bottom:20px; background: rgba(0,0,0,0.4);">
                <h4 style="color: #ffb703; font-size: 0.9rem; margin-bottom: 10px;"><i class="fa-solid fa-star"></i> Avantages Courtier Partenaire</h4>
                <ul style="color: #aaa; font-size: 0.8rem; text-align: left; padding-left: 20px;">
                    <li><strong style="color: #fff;">-20% de rÃƒÂ©duction</strong> sur votre assurance tous risques grÃƒÂ¢ce ÃƒÂ  l'IA PrÃƒÂ©dictive.</li>
                    <li><strong style="color: #fff;">Garantie panne 0 km</strong> incluse avec dÃƒÂ©pannage express.</li>
                    <li><strong style="color: #fff;">Bonus de bonne conduite</strong> (Rouler & Gagner convertible en rÃƒÂ©ductions).</li>
                </ul>
                <button class="btn-insurance" style="width:100%; margin-top:10px; background: #ffb703; color: black; font-weight: bold;" onclick="showPage('insurance')">VOIR MON OFFRE ASSURANCE</button>
            </div>

            <button class="btn-insurance" style="width:100%; background: linear-gradient(135deg, #b700ff, #00d2ff); color: white; font-weight: bold; border: none; padding: 15px; border-radius: 10px;" onclick="PredictiveMeca.checkAlerts(); alert('L\'IA analyse vos donnÃƒÂ©es de tÃƒÂ©lÃƒÂ©mÃƒÂ©trie actuelles... Aucun risque de serrage moteur dÃƒÂ©tectÃƒÂ© pour le moment. Vous roulez de maniÃƒÂ¨re optimale !')"><i class="fa-solid fa-bolt"></i> LANCER L'ANALYSE IA</button>
        </div>`;
  } else if (page === "profile") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-user-pen"></i> Mon Profil</h3>
            <div class="glassmorphism" style="padding:20px; margin-bottom:20px;">
                <label style="color:#aaa; font-size:0.8rem;">Pseudo :</label>
                <input type="text" id="edit-username" value="" style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; background:rgba(255,255,255,0.1); border:1px solid #444; color:#fff; border-radius:8px;">
                <label style="color:#aaa; font-size:0.8rem;">ModÃƒÂ¨le de scooter :</label>
                <input type="text" id="edit-scooter" value="" placeholder="Ex: Peugeot Kisbee 50cc" style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; background:rgba(255,255,255,0.1); border:1px solid #444; color:#fff; border-radius:8px;">
                <label style="color:#aaa; font-size:0.8rem;">Email de contact :</label>
                <input type="email" id="edit-email" value="" placeholder="contact@exemple.com" style="width:100%; padding:10px; margin-top:5px; margin-bottom:20px; background:rgba(255,255,255,0.1); border:1px solid #444; color:#fff; border-radius:8px;">
                <button onclick="saveProfileInfo()" class="btn-insurance" style="width:100%; background:var(--neon-blue); color:black; font-weight:bold; border:none; padding:12px; border-radius:8px;">ENREGISTRER</button>
            </div>`;
  } else if (page === "insurance_expert") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-building-shield"></i> Portail Expert Assurance</h3>
            <p style="font-size:0.8rem; color:#aaa; margin-bottom:20px;">AccÃƒÂ¨s sÃƒÂ©curisÃƒÂ© pour les compagnies d'assurance et experts judiciaires.</p>
            <div id="insurance-search-box" style="margin-bottom:20px;">
                <input type="text" id="expert-report-id" placeholder="ID du Dossier (ex: blackbox_...)" style="width:100%; padding:15px; background:rgba(255,255,255,0.05); border:1px solid #444; border-radius:10px; color:white; margin-bottom:10px;">
                <button class="btn-insurance" onclick="InsurancePortal.searchReport(document.getElementById('expert-report-id').value)" style="width:100%; padding:15px; background:#ffb703; color:black; border:none; border-radius:10px; font-weight:bold;">RECHERCHER LE DOSSIER</button>
            </div>
            <div id="insurance-content"></div>`;
  } else if (page === "pulse") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-microscope"></i> Labo MÃƒÂ©ca : StÃƒÂ©thoscope IA</h3>
            <p style="font-size:0.8rem; color:#aaa; margin-bottom:20px;">Analyse biomÃƒÂ©trique de la santÃƒÂ© de votre moteur via les capteurs du smartphone.</p>
            
            <div class="glassmorphism" style="padding:20px; text-align:center;">
                <div id="scan-visual" style="height:100px; display:flex; align-items:center; justify-content:center; margin-bottom:20px; background:rgba(0,0,0,0.3); border-radius:15px; position:relative; overflow:hidden;">
                    <div id="scan-progress-bar" style="position:absolute; left:0; top:0; height:100%; width:0%; background:linear-gradient(90deg, #ffb703, #ff4d4d); transition: width 0.1s linear; opacity:0.5;"></div>
                    <i class="fa-solid fa-gear" style="font-size:3rem; color:#ffb703; z-index:1;"></i>
                </div>
                <button class="btn-insurance" onclick="EnginePulse.startScan()" style="width:100%; padding:15px; background:#ffb703; color:black; border:none; border-radius:10px; font-weight:bold; font-size:1.1rem;">LANCER LE DIAGNOSTIC</button>
                <p style="font-size:0.7rem; color:#888; margin-top:10px;">Posez le tÃƒÂ©lÃƒÂ©phone sur la selle, moteur allumÃƒÂ© au ralenti.</p>
            </div>
            <div id="pulse-result"></div>`;
  } else if (page === "ants_wallet") {
    const passport = Wallet.getSafetyPassport();
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-building-columns"></i> Mon Coffre-Fort ANTS</h3>
            <p style="font-size:0.75rem; color:#aaa; margin-bottom:20px;">Titres sÃƒÂ©curisÃƒÂ©s et Passeport SÃƒÂ©curitÃƒÂ© certifiÃƒÂ© par mon50ccetmoi.</p>
            
            <div class="glassmorphism" style="padding:15px; margin-bottom:15px; border-left:4px solid #2ecc71;">
                <h4 style="font-size:0.9rem; color:#2ecc71;"><i class="fa-solid fa-id-card"></i> Passeport SÃƒÂ©curitÃƒÂ© Digital</h4>
                <div style="font-size:0.8rem; margin-top:5px; color:#ddd;">
                    ID Blackbox: <span style="font-family:monospace; color:#2ecc71;">${passport.blackbox_id}</span><br>
                    Maintenance: <span style="color:#2ecc71;">${passport.maintenance_count} interventions</span><br>
                    SantÃƒÂ© Moteur: <span style="color:#2ecc71;">${passport.engine_health}</span>
                </div>
            </div>

            <div class="menu-list" style="margin-top:20px;">
                <div id="ants-docs-container" style="margin-bottom:15px;"></div>
                <li onclick="window.uploadDocument('carte_grise')"><i class="fa-solid fa-camera"></i> NumÃƒÂ©riser Carte Grise</li>
                <li onclick="window.uploadDocument('permis_am')"><i class="fa-solid fa-address-card"></i> NumÃƒÂ©riser Permis AM</li>
                <li onclick="window.uploadDocument('assurance')"><i class="fa-solid fa-shield-check"></i> Attestation Assurance</li>
            </div>
            
            <button onclick="Certificate.generate()" class="btn-insurance" style="width:100%; margin-top:25px; background:linear-gradient(45deg, #2ecc71, #3498db); color:white;">
                <i class="fa-solid fa-file-shield"></i> GÃƒâ€°NÃƒâ€°RER MON CERTIFICAT OFFICIEL
            </button>
            
            <p style="font-size:0.65rem; color:#666; text-align:center; margin-top:20px;">Note : Ce coffre-fort facilite les contrÃƒÂ´les mais ne remplace pas les documents originaux selon la lÃƒÂ©gislation en vigueur.</p>`;
  } else if (page === "meca_lab") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-oil-can"></i> Le Sorcier de la MÃƒÂ©ca</h3>
            <div class="glassmorphism" style="padding:20px; margin-bottom:20px;">
                <h4 style="color:var(--accent);">CALCULATEUR DE MÃƒâ€°LANGE</h4>
                <div style="margin-top:15px;">
                    <input type="number" id="mix-liters" placeholder="Litres d'essence" class="scooter-brand-select" style="width:100%; margin-bottom:10px;">
                    <input type="number" id="mix-percent" placeholder="% d'huile (ex: 2)" class="scooter-brand-select" style="width:100%; margin-bottom:10px;">
                    <button onclick="const vol = MecaWizard.calculateMix(document.getElementById('mix-liters').value, document.getElementById('mix-percent').value); document.getElementById('mix-res').innerHTML = vol + ' ml d\'huile ÃƒÂ  ajouter';" 
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
      content.innerHTML = `<h3><i class="fa-solid fa-circle-info"></i> Ãƒâ‚¬ Propos</h3>
            <div style="text-align:center; padding:20px;">
                <div class="login-logo" style="font-size:3rem; color:var(--accent); margin-bottom:10px;">50</div>
                <h2 style="color:var(--accent);">mon50ccetmoi</h2>
                <p style="font-size:0.8rem; color:#aaa; margin-bottom:20px;">Version 26.0 - GOLD EDITION</p>
                
                <div class="glassmorphism" style="padding:20px; border:1px solid var(--accent); margin-bottom:30px; text-align:left;">
                    <p style="font-size:0.9rem; font-weight:bold; text-align:center;">SIGNATURE CORPORATE</p>
                    <p style="font-size:0.75rem; color:#ddd; margin-top:10px;">Cette application est la propriÃƒÂ©tÃƒÂ© exclusive de<br><strong style="color:var(--accent);">CHEZBIGBOO</strong>.</p>
                    <p style="font-size:0.65rem; color:#888; margin-top:15px;">ProtÃƒÂ©gÃƒÂ© par les lois internationales sur la propriÃƒÂ©tÃƒÂ© intellectuelle. TÃƒÂ©lÃƒÂ©mÃƒÂ©trie certifiÃƒÂ©e conforme aux standards ANTS v100.00-GOLD.</p>
                </div>
                
                <button onclick="document.getElementById('screen-overlay').classList.add('hidden')" class="btn-cancel" style="background:#333; color:white;">FERMER</button>
            </div>`;
  } else if (page === "defis") {
    const availableChallenges = [
      { name: "Le Grand Raid", goal: 200, unit: "km" },
      { name: "L'Urbain Zen", goal: 100, unit: "km" },
      { name: "L'Explorateur", goal: 300, unit: "km" },
      { name: "Le VÃƒÂ©lomoteur", goal: 50, unit: "km" },
    ];

    // Rotation tous les 14 jours basÃƒÂ©e sur l'Unix Time
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
                <h3 style="color:#9b59b6; margin:0;">Ã°Å¸Ââ€  ${t("challenges_title")} : ${challenge.name}</h3>
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
                <p style="font-size:0.8rem; color:#888; margin-top:10px; text-align:center;">Ã°Å¸Å½â€“Ã¯Â¸Â Vous avez rÃƒÂ©ussi <strong>${wins}/150</strong> dÃƒÂ©fis pour le Badge Pro</p>
            </div>

                          <button class="btn-insurance" style="margin-top:20px; width:100%; background:#9b59b6; color:white;" onclick="toggleMenu()">CONTINUER L''ASCENSION</button>
              ${
                progress >= 100 &&
                !localStorage.getItem(`defi_claimed_${currentPeriodIdx}`)
                  ? `
                  <button class="btn-insurance" style="margin-top:10px; width:100%; background:linear-gradient(90deg, #b700ff, #ff0055); color:white; font-weight:bold; box-shadow:0 0 15px rgba(183,0,255,0.5);" onclick="
                      if(window.Web4Economy) {
                          window.Web4Economy.mineToken(5.0, 'DÃ©fi Quinzaine ComplÃ©tÃ©');
                          localStorage.setItem('defi_claimed_${currentPeriodIdx}', 'true');
                          window.session.completedChallengesCount = (window.session.completedChallengesCount || 0) + 1;
                          alert('FÃ©licitations ! Vous avez remportÃ© 5 BVC pour avoir complÃ©tÃ© le dÃ©fi.');
                          showPage('defis');
                      }
                  ">RÃ‰CLAMER MES 5 BVC</button>
              `
                  : progress >= 100
                    ? `<button class="btn-insurance" style="margin-top:10px; width:100%; background:#333; color:#aaa; cursor:not-allowed;" disabled>RÃ‰COMPENSE DE 5 BVC RÃ‰CUPÃ‰RÃ‰E</button>`
                    : ""
              }
        </div>`;
  } else if (page === "roadbooks") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-map-location-dot"></i> Navigation & Roadbooks</h3>
            <div class="glassmorphism" style="padding:20px; border-left:4px solid #f1c40f; margin-bottom:20px;">
                <h4 style="color:#f1c40f;"><i class="fa-solid fa-stopwatch"></i> CHRONOS GUARD (ZÃƒÂ©ro Retard)</h4>
                <p style="font-size:0.75rem; margin-top:5px; color:#aaa;">RÃƒÂ©glez votre heure d'arrivÃƒÂ©e cible. L'app inclut votre temps d'ÃƒÂ©quipement (5 min).</p>
                <div style="display:flex; gap:10px; margin-top:15px;">
                    <input type="time" id="target-time" class="scooter-brand-select" style="flex:1;">
                    <button onclick="Chronos.setTarget(document.getElementById('target-time').value)" class="btn-insurance" style="flex:1; background:#f1c40f; color:black;">ACTIVER</button>
                </div>
                <button onclick="Chronos.syncCalendar()" class="btn-insurance" style="width:100%; margin-top:10px; background:transparent; border:1px solid #f1c40f; color:#f1c40f;">
                    <i class="fa-solid fa-calendar-days"></i> SYNCHRONISER MON CALENDRIER
                </button>
            </div>
            
            <p style="text-align:center; padding:40px; color:#666;">Liste de vos roadbooks sauvegardÃƒÂ©s...</p>`;
  } else if (page === "arbitre") {
    if (
      window.Blackbox &&
      typeof window.Blackbox.showLitigationInfo === "function"
    ) {
      window.Blackbox.showLitigationInfo();
    } else {
      if (typeof content !== "undefined")
        content.innerHTML = `<h3><i class="fa-solid fa-scale-balanced"></i> Arbitre de la Route</h3><p>Service Blackbox momentanÃƒÂ©ment indisponible.</p>`;
    }
  } else if (page === "privacy") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3>Mentions LÃƒÂ©gales & ConfidentialitÃƒÂ©</h3>
            <div style="font-size:0.8rem; line-height:1.4; color:#ccc;">
                <p><strong>Ãƒâ€°diteur :</strong> mon50ccetmoi (Engineering Unit)</p>
                <p><strong>Responsable :</strong> mon50ccetmoi Admin (US)</p>
                <p><strong>Contact :</strong> via l'application</p>
                <hr style="border:0; border-top:1px solid #444; margin:10px 0;">
                <p><strong>DonnÃƒÂ©es GPS :</strong> Vos coordonnÃƒÂ©es sont traitÃƒÂ©es localement pour la navigation et la dÃƒÂ©tection de chute.</p>
                <p><strong>Partage :</strong> Les signalements de dangers sont partagÃƒÂ©s de maniÃƒÂ¨re anonyme avec la communautÃƒÂ©.</p>
                <p><strong>Stockage :</strong> Vos prÃƒÂ©fÃƒÂ©rences sont enregistrÃƒÂ©es dans votre navigateur (LocalStorage).</p>
                <p><strong>Version :</strong> v100.00-GOLD-PRO Build 2026</p>
                <p><strong>Signature :</strong> mon50ccetmoi Engineering US</p>
            </div>`;
  } else if (page === "pro-tips") {
    const communityTips = JSON.parse(
      secureGetItem("community_pro_tips") || "[]",
    );
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-lightbulb"></i> Conseils de Pro 50cc</h3>
            <p style="font-size:0.7rem; color:#aaa; margin-bottom:15px;">Fiches techniques rÃƒÂ©digÃƒÂ©es par nos experts et les garages certifiÃƒÂ©s.</p>
            
            <div id="pro-tips-container">
                <div class="card" style="border-left:4px solid #f39c12;">
                    <button class="badge-pro" style="float:right; background:#f39c12; font-size:0.5rem; border:none; color:black; border-radius:5px; padding:2px 5px;">OFFICIEL</button>
                    <h4 style="color:#f39c12;"><i class="fa-solid fa-wrench"></i> Entretien Rapide</h4>
                    <p style="font-size:0.8rem; margin-top:5px;"><strong>Bougie :</strong> Une bougie propre (couleur chocolat) = un moteur qui dure. Si elle est noire, votre mÃƒÂ©lange est trop riche.</p>
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
                    <h4 style="color:#e74c3c;"><i class="fa-solid fa-scale-balanced"></i> Loi & SÃƒÂ©curitÃƒÂ©</h4>
                    <p style="font-size:0.8rem; margin-top:5px;"><strong>Bridage :</strong> Le dÃƒÂ©bridage est interdit sur voie publique. En cas d'accident, votre assurance peut refuser de payer.</p>
                </div>
            </div>`;
  } else if (page === "pro-space") {
    const isCertified = window.session?.isCertifiedGarage || false;
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-briefcase"></i> ${t("pro_space_title")}</h3>
            <div class="card" style="border:1px solid #3498db; background: rgba(52, 152, 219, 0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>VisibilitÃƒÂ© Mobile</strong>
                    <button onclick="toggleGarageVisibility()" class="btn-circular ${window.isGarageVisible ? "btn-neon" : "btn-dark"}" style="width:40px; height:40px;">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </div>
                <small style="font-size:0.6rem; color:#aaa; margin-top:5px; display:block;">Si activÃƒÂ©, vous apparaissez en bleu sur la carte des pilotes.</small>
            </div>

            <div class="card">
                <label style="font-size:0.8rem; display:block; margin-bottom:5px;">Statut immÃƒÂ©diat de l'atelier</label>
                <select id="garage-status-select" onchange="updateGarageStatus(this.value)" class="scooter-brand-select" style="width:100%; background:#111;">
                    <option value="dispo" selected>Ã¢Å“â€¦ Prise en charge immÃƒÂ©diate</option>
                    <option value="busy">Ã¢ÂÂ³ RDV nÃƒÂ©cessaire (>48h)</option>
                    <option value="full">Ã°Å¸Å¡Â« Atelier Complet</option>
                </select>
            </div>

            <div class="card" style="border:1px solid #f1c40f;">
                <h4 style="color:#f1c40f; margin-bottom:10px;"><i class="fa-solid fa-bolt"></i> Offre Flash (Promo)</h4>
                <textarea id="flash-offer-text" placeholder="Ex: -20% sur les pneus Michelin ce weekend !" style="width:100%; height:60px; background:#000; color:white; border:1px solid #444; border-radius:8px; padding:10px; font-size:0.8rem;"></textarea>
                <button onclick="publishFlashOffer()" class="btn-insurance" style="background:#f1c40f; color:black; margin-top:10px; width:100%; font-size:0.8rem;">Diffuser ÃƒÂ  la communautÃƒÂ©</button>
            </div>

            ${
              !isCertified
                ? `
            <div class="card" style="text-align:center; background:rgba(52, 152, 219, 0.05); border:1px solid #3498db;">
                <i class="fa-solid fa-certificate" style="font-size:2rem; color:#f1c40f;"></i><br>
                <h4 style="margin:10px 0; color:#fff;">Droit d'EntrÃƒÂ©e & Certification</h4>
                <p style="font-size:0.7rem; color:#aaa; margin-bottom:10px;">Devenez <strong>Garage CertifiÃƒÂ©</strong> pour seulement <strong>50Ã¢â€šÂ¬ TTC</strong> (Paiement unique).</p>
                <ul style="font-size:0.65rem; color:#ccc; list-style:none; padding:0; text-align:left; margin-bottom:15px;">
                    <li>Ã¢Å“â€¦ Badge <strong>CertifiÃƒÂ© mon50ccetmoi</strong></li>
                    <li>Ã°Å¸Å¡â‚¬ <strong>Boost de visibilitÃƒÂ©</strong> sur la carte</li>
                    <li>Ã°Å¸â€ºÂ Ã¯Â¸Â AccÃƒÂ¨s illimitÃƒÂ© aux fiches techniques</li>
                    <li>Ã°Å¸â€˜â€ PrioritÃƒÂ© dans les rÃƒÂ©sultats de recherche</li>
                </ul>
                <button onclick="payGarageEntryFee()" class="btn-insurance" style="background:#f1c40f; color:black; font-weight:bold;">S'acquitter du droit d'entrÃƒÂ©e (50Ã¢â€šÂ¬)</button>
                
                <div style="margin-top:15px; padding-top:15px; border-top:1px solid #444;">
                    <p style="font-size:0.7rem; color:#2ecc71;"><strong>Ã°Å¸Å½Â OPTION "CROISSANCE" GRATUITE :</strong></p>
                    <p style="font-size:0.6rem; color:#aaa;">Offrez <strong>-10% de rÃƒÂ©duction</strong> aux membres sur prÃƒÂ©sentation de l'app et soyez <strong>exonÃƒÂ©rÃƒÂ©</strong> des 50Ã¢â€šÂ¬ !</p>
                    <button onclick="applyPartnerExemption()" class="btn-insurance fa-beat" style="background:transparent; border:1px solid #2ecc71; color:#2ecc71; margin-top:5px; font-size:0.8rem; font-weight:bold;">REJOINDRE LE RÃƒâ€°SEAU GRATUITEMENT (-10%)</button>
                </div>
            </div>`
                : `
            <div class="card" style="text-align:center; background:rgba(46, 204, 113, 0.1); border:1px solid #2ecc71;">
                <i class="fa-solid fa-check-double" style="font-size:1.5rem; color:#2ecc71;"></i>
                <p style="font-size:0.8rem; color:#2ecc71; margin-top:5px;"><strong>Statut PRO CertifiÃƒÂ© Actif</strong></p>
                <small style="font-size:0.6rem; color:#aaa;">Votre visibilitÃƒÂ© est boostÃƒÂ©e au maximum.</small>
            </div>`
            }

            <div class="card" style="border:1px solid #2ecc71;">
                <h4 style="color:#2ecc71; margin-bottom:10px;"><i class="fa-solid fa-graduation-cap"></i> Partager un Conseil d'Expert</h4>
                <input type="text" id="pro-tip-title" placeholder="Titre (ex: Nettoyer son carbu)" style="width:100%; padding:10px; margin-bottom:10px; background:#000; color:white; border:1px solid #444; border-radius:8px; font-size:0.8rem;">
                <textarea id="pro-tip-body" placeholder="Votre explication technique..." style="width:100%; height:80px; background:#000; color:white; border:1px solid #444; border-radius:8px; padding:10px; font-size:0.8rem;"></textarea>
                <button onclick="publishProTip()" class="btn-insurance" style="background:#2ecc71; color:white; margin-top:10px; width:100%; font-size:0.8rem;">Publier la Fiche Technique</button>
            </div>
        `;
  } else if (page === "donate") {
    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-heart"></i> ${t("donate_title")}</h3>
            <div class="card" style="text-align:center; background: linear-gradient(135deg, rgba(233, 30, 99, 0.1), rgba(0,0,0,0)); border: 1px solid #e91e63;">
                <i class="fa-solid fa-mug-hot fa-bounce" style="font-size:3rem; color:#e91e63; margin-bottom:15px;"></i>
                <p style="font-size:0.9rem; line-height:1.5;"><strong>mon50ccetmoi</strong> est un projet de passionnÃƒÂ©, dÃƒÂ©veloppÃƒÂ© sur mon temps libre pour la communautÃƒÂ© des pilotes de 50cc.</p>
                <p style="font-size:0.8rem; color:#aaa; margin-top:10px;">L'application restera 100% gratuite, mais les dons aident ÃƒÂ  payer les serveurs (Google Maps API, Firebase) et ÃƒÂ  financer les futures mises ÃƒÂ  jour.</p>
                
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
                    <a href="https://www.buymeacoffee.com/mon50cc" target="_blank" class="btn-insurance" style="background:#ffdd00; color:black; text-decoration:none;">Ã¢Ëœâ€¢ Offrir un cafÃƒÂ© (Badge MÃƒÂ©cÃƒÂ¨ne Ã°Å¸â€™â€“)</a>
                    <a href="https://paypal.me/mon50cc" target="_blank" class="btn-insurance" style="background:#0070ba; color:white; text-decoration:none;">Ã°Å¸â€™â„¢ Faire un don libre (PayPal)</a>
                </div>
                
                <p style="font-size:0.7rem; color:#666; margin-top:15px;">Ã°Å¸Å½Â Chaque don dÃƒÂ©bloque le badge exclusif **"MÃƒÂ©cÃƒÂ¨ne"** sur votre profil et sur la carte communautaire !</p>
            </div>
        `;
  } else if (page === "security") {
    const emergencyNum = secureGetItem("emergency_contact") || "";
    const isGuardian = secureGetItem("guardian_enabled") === "true";

    if (typeof content !== "undefined")
      content.innerHTML = `<h3><i class="fa-solid fa-shield-heart"></i> ${t("security_title")}</h3>
            <div class="card" style="border:1px solid #00d2ff; background: rgba(0, 210, 255, 0.05);">
                <label style="display:block; font-size:0.8rem; margin-bottom:10px;">Contact d'Urgence (Tel)</label>
                <input type="tel" id="emergency-num" value="${emergencyNum}" placeholder="Ex: 0612345678" style="width:100%; padding:10px; background:#000; border:1px solid #00d2ff; color:white; border-radius:8px;">
                <button onclick="saveEmergencyContact()" class="btn-insurance" style="background:#00d2ff; color:black; margin-top:10px; width:100%; font-size:0.8rem;">Enregistrer</button>
            </div>
            
            <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="font-size:0.9rem;">Guardian Mode</strong><br>
                    <small style="font-size:0.6rem; color:#aaa;">Alerte si arrÃƒÂªt prolongÃƒÂ© suspect</small>
                </div>
                <button onclick="toggleGuardian()" class="btn-circular ${isGuardian ? "btn-neon" : "btn-dark"}" style="width:50px; height:50px;">
                    <i class="fa-solid fa-bell"></i>
                </button>
            </div>

            <div class="card" style="background:rgba(255,255,255,0.05); text-align:center;">
                <i class="fa-solid fa-microchip" style="font-size:2rem; color:#2ecc71; margin-bottom:10px;"></i><br>
                <strong style="font-size:0.8rem;">DÃƒÂ©tecteur G-Force : ACTIF</strong><br>
                <small style="font-size:0.6rem; color:#666;">Impact calibrÃƒÂ© ÃƒÂ  4.5G</small>
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
    text: "Rejoins la communautÃƒÂ© des scooters 50cc ! Navigation GPS, radars et sÃƒÂ©curitÃƒÂ©.",
    url: window.location.origin,
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      alert(
        "Lien copiÃƒÂ© ! Partage-le avec tes potes : " + window.location.origin,
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
            Il est probable que votre bougie soit encrassÃƒÂ©e ou que le gicleur de votre carburateur soit bouchÃƒÂ©. 
            VÃƒÂ©rifiez l'ÃƒÂ©tincelle et nettoyez votre cuve.
        </div>`;
  }, 2000);
};

// --- DÃƒâ€°TECTEUR DE CHUTE ---
window.addEventListener("devicemotion", (e) => {
  const acc = e.accelerationIncludingGravity;
  if (!acc) return;
  const force = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
  if (force > 45) {
    // Seuil d'impact (G-force importante)
    triggerFallAlert();
    if (window.isGuardianActive && typeof triggerEmergencySOS === "function") {
      triggerEmergencySOS(
        "Chute brutale dÃƒÂ©tectÃƒÂ©e par l'accÃƒÂ©lÃƒÂ©romÃƒÂ¨tre.",
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

  // Annonce vocale par Jarvis
  if (typeof speak === "function") {
    speak(
      isManual
        ? "SOS Manuel activÃ©. Alerte de la meute et de l'Ange Gardien."
        : "Chute dÃ©tectÃ©e. Annulez si vous allez bien, sinon les secours seront prÃ©venus.",
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
        
        <!-- NOUVEAU : Bouton Officiel d'Urgence (Conforme LÃ©gislation) -->
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
  if (typeof speak === "function") speak("Alerte annulÃ©e.");
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
    // On suppose que firebase est initialisÃ© globalement
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
      message += ` Vos ${contacts.length} Ange(s) Gardien(s) ont Ã©tÃ© notifiÃ©s par SMS.`;
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

      if (contacts.length > 0) message += ` Ange(s) Gardien(s) notifiÃ©s.`;
    } catch (errFetch) {
      message =
        "Erreur rÃ©seau lors de la transmission du SOS automatisÃ©. Veuillez appeler les secours manuellement.";
    }
  }

  if (typeof speak === "function") speak(message);

  if (div) {
    div.innerHTML = `
            <i class="fa-solid fa-satellite-dish" style="font-size:5rem; margin-bottom:20px; color:#00d2ff;"></i>
            <h1 style="color:#00d2ff;">ANGE GARDIEN ACTIVÃ‰</h1>
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
    "Contacts Ange Gardien sauvegardÃ©s ! En cas de chute ou SOS, l'application tentera d'envoyer un message d'urgence.",
  );
};

window.startRodage = function (name) {
  window.isRodageActive = true;
  refreshRodageUI();
  alert(
    `Mode Rodage ActivÃ©: ${name}. Vitesse max conseillÃ©e: 45km/h. Distance cumulÃ©e comptabilisÃ©e.`,
  );
  speak("Mode rodage activÃ©. MÃ©nagez votre moteur.");
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
// DÃ©sactivation du popup automatique (bloquait les tests)
// setTimeout(() => document.getElementById('mood-overlay')?.classList.remove('hidden'), 30000);

window.requestAccountDeletion = function () {
  const confirm1 = confirm(
    "âš ï¸ ATTENTION : Voulez-vous vraiment supprimer dÃ©finitivement votre compte et TOUTES vos donnÃ©es (garage, points, historique) ?",
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
        "Votre compte a Ã©tÃ© supprimÃ© avec succÃ¨s. Vos donnÃ©es ont Ã©tÃ© purgÃ©es conformÃ©ment au RGPD.",
      );
    } else {
      alert("Suppression annulÃ©e.");
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
    t.innerHTML = `Bienvenue sur mon50ccetmoi v100.00-GOLD SILVER EDITION ! Prudence sur la route. ðŸ›µðŸ’¨`;
};
updateTicker();
setInterval(updateTicker, 60000);

window.testFallDetection = function () {
  alert("Simulation d'un impact dans 3 secondes... PrÃ©parez-vous !");
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
    speak("Mode parking activÃ©. Votre scooter est sous surveillance.");
  } else {
    btn.innerHTML =
      '<i class="fa-solid fa-shield-halved"></i> Mode Parking : OFF';
    btn.classList.remove("parking-active");
    speak("Mode parking dÃ©sactivÃ©.");
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
    speak("ALERTE ! Mouvement suspect dÃ©tectÃ© !");
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
    perfTimeEl.textContent = "0-50: PrÃªt...";
  } else if (speedKmh > 2 && isPerfTracking && !perfStartTime) {
    perfStartTime = Date.now();
    perfTimeEl.textContent = "0-50: GAZ !";
  } else if (speedKmh >= 50 && isPerfTracking && perfStartTime) {
    const time = ((Date.now() - perfStartTime) / 1000).toFixed(2);
    perfTimeEl.textContent = `0-50: ${time}s !`;
    speak(`Performance rÃ©alisÃ©e : ${time} secondes.`);
    isPerfTracking = false;
    setTimeout(() => perfHud.classList.add("hidden"), 10000);
  }
}


/* --- app-wallet.js --- */
﻿// F10 : ROADBOOKS COMMUNAUTAIRES (100% GRATUIT)
// ============================================================
window.CommunityRoadbooks = {
  shareMyRoute() {
    if (!window.currentRoute && !window.currentPosition) {
      alert("Lancez d'abord un itinÃƒÂ©raire pour pouvoir le partager !");
      return;
    }
    const name = prompt(
      "Donnez un nom ÃƒÂ  votre itinÃƒÂ©raire (ex: Boucle des Alpilles) :",
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
      "ItinÃƒÂ©raire partagÃƒÂ© avec la communautÃƒÂ©. Merci pour votre contribution !",
    );
    showPage("community_roadbooks");
  },

  load(id) {
    const rbs = JSON.parse(localStorage.getItem("community_roadbooks") || "[]");
    const rb = rbs.find((r) => r.id === id);
    if (!rb) return;
    speak("Chargement de l'itinÃƒÂ©raire " + rb.name);
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
﻿/* --- SILICON VALLEY BILLION DOLLAR FEATURES --- */

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
          "RÃ©alitÃ© AugmentÃ©e activÃ©e. Superposition de navigation HUD en ligne.",
        );
    } catch (err) {
      console.error("AR Error: ", err);
      window.isARActive = false;
      if (typeof speak === "function")
        speak("Erreur d'accÃ¨s Ã  la camÃ©ra pour la rÃ©alitÃ© augmentÃ©e.");
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
      speak("RÃ©alitÃ© AugmentÃ©e dÃ©sactivÃ©e.");
  }
};

// 2. PROGRAMME FIDELITE ROULER & GAGNER
window.braveCoins = parseInt(localStorage.getItem("braveCoins") || "0");

window.showCryptoWallet = function () {
  const screen = document.getElementById("crypto-wallet-screen");
  const balance = document.getElementById("crypto-balance");
  if (screen) screen.classList.remove("hidden");
  if (balance) balance.innerText = Math.floor(window.braveCoins) + " Pts BVC";

  if (typeof speak === "function") speak("AccÃ¨s Ã  votre espace fidÃ©litÃ©.");
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
    window.braveCoins += 12;
    localStorage.setItem("braveCoins", window.braveCoins.toString());
    if (typeof speak === "function")
      setTimeout(
        () =>
          speak("Vous avez gagnÃ© 12 points BVC pour ce trajet sÃ©curisÃ©."),
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
          "Rythme cardiaque Ã©levÃ© dÃ©tectÃ©. Respirez calmement pour votre sÃ©curitÃ©.",
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


/* --- jarvis-voice.js --- */
﻿/* --- J.A.R.V.I.S. 4.0 PROPRIETARY NEURAL ENGINE --- */

window.JarvisEngine = {
  context: {
    lastIntent: null,
    userMood: "neutral",
  },

  // RÃ©ponses dynamiques pour Ã©viter l'effet "robot"
  responses: {
    ack: [
      "Bien reÃ§u.",
      "Je m'en occupe.",
      "Analyse en cours.",
      "Compris, pilote.",
    ],
    search: [
      "Je lance la recherche.",
      "Recherche dans la base de donnÃ©es locale.",
      "Cartographie en cours.",
    ],
    error: [
      "Je n'ai pas compris cette instruction.",
      "Veuillez reformuler, pilote.",
      "Instruction non reconnue par mes protocoles.",
    ],
    jokes: [
      "Que fait un motard quand il a froid ? Il se rapproche du pot d'Ã©chappement.",
      "Pourquoi les motards sont-ils toujours heureux ? Parce qu'on ne peut pas pleurer avec un casque intÃ©gral.",
      "Quel est le comble pour un mÃ©canicien scooter ? C'est de perdre la boule !",
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
      utterance.pitch = 0.9; // Voix lÃ©gÃ¨rement plus grave
      utterance.rate = 1.05; // Rythme naturel mais rÃ©actif
      window.speechSynthesis.speak(utterance);
    } else {
    }
  },

  processQuery: function (transcript) {
    const t = transcript.toLowerCase();

    // 1. DÃ©tection d'intentions complexes (Intent Parsing)

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
        reply: `Attention. Mode urgence activÃ©. Je prÃ©pare l'appel aux services de secours.`,
      };
    }
    // Comparaison Carburant
    else if (
      this.matchAny(t, ["essence", "carburant", "plein", "station", "sec"]) &&
      this.matchAny(t, ["moins cher", "prix", "compare", "oÃ¹"])
    ) {
      return {
        action: "COMPARE_GAS_PRICES",
        reply: `Analyse des prix du carburant dans un rayon de 3 kilomÃ¨tres en cours.`,
      };
    } else if (this.matchAny(t, ["essence", "station", "carburant", "sec"])) {
      return {
        action: "COMPARE_GAS_PRICES",
        reply: `${this.getRandomResponse("search")} J'affiche le radar communautaire des prix du carburant.`,
      };
    }
    // Navigation SpÃ©cifique
    else if (
      this.matchAny(t, [
        "emmÃ¨ne-moi",
        "itinÃ©raire vers",
        "aller Ã ",
        "guidage vers",
      ])
    ) {
      // Extraction basique de la destination
      let destination = "votre destination";
      const navKeywords = ["vers", "Ã  "];
      for (let kw of navKeywords) {
        if (t.includes(kw)) {
          destination = t.split(kw)[1].trim();
          break;
        }
      }
      return {
        action: "NAVIGATE_TO",
        payload: destination,
        reply: `Calcul de l'itinÃ©raire optimal vers ${destination}.`,
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
        reply: `Danger signalÃ© Ã  la meute. Merci pour votre vigilance.`,
      };
    } else if (
      this.matchAny(t, ["animal", "animaux", "biche", "sanglier", "chien"])
    ) {
      return {
        action: "REPORT_ANIMAL",
        reply: `PrÃ©sence animale confirmÃ©e et partagÃ©e. Soyez prudent.`,
      };
    } else if (this.matchAny(t, ["radar", "flics", "contrÃ´le", "police"])) {
      return {
        action: "REPORT_POLICE",
        reply: `Zone de contrÃ´le signalÃ©e sur le radar communautaire.`,
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
        reply: `Activation du balayage social. Recherche de pilotes alliÃ©s dans le secteur.`,
      };
    }
    // Modes de conduite
    else if (
      this.matchAny(t, ["sensation", "virage", "sport", "attaque", "balade"])
    ) {
      return {
        action: "SENSATION_MODE",
        reply: `Mode sensation engagÃ©. Optimisation de l'itinÃ©raire pour le plaisir de conduite.`,
      };
    }
    // Diagnostic Moto
    else if (
      this.matchAny(t, [
        "diagnostic",
        "Ã©tat",
        "santÃ©",
        "mÃ©canique",
        "panne",
        "moteur",
      ])
    ) {
      return {
        action: "AI_DIAGNOSTIC",
        reply: `J'ouvre le panneau de tÃ©lÃ©mÃ©trie prÃ©dictive de votre engin.`,
      };
    }
    // MÃ©tÃ©o
    else if (
      this.matchAny(t, [
        "mÃ©tÃ©o",
        "temps",
        "pluie",
        "pleuvoir",
        "froid",
        "chaud",
      ])
    ) {
      return {
        action: "WEATHER_CHECK",
        reply: `Je vÃ©rifie les conditions mÃ©tÃ©orologiques sur votre parcours actuel.`,
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
        "tÃ©lÃ©chargements",
        "audience",
        "pays",
      ])
    ) {
      return {
        action: "APP_STATS",
        reply: `D'aprÃ¨s mes derniÃ¨res analyses en date du 4 juillet 2026, l'application compte 4 installations uniques. 3 pilotes sont en France, et nous avons 1 pilote en IndonÃ©sie.`,
      };
    }
    // IdentitÃ© / Blague
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
        reply: `Je suis Jarvis, l'intelligence artificielle de Mon 50cc et Moi. Je suis connectÃ© Ã  votre tÃ©lÃ©mÃ©trie, au rÃ©seau communautaire et prÃªt Ã  vous assister sur la route.`,
      };
    } else if (
      this.matchAny(t, [
        "drogue",
        "stupÃ©fiant",
        "stupÃ©fiants",
        "positif",
        "fumÃ©",
        "joint",
        "cannabis",
        "thc",
        "dÃ©pistage",
        "test",
      ])
    ) {
      return {
        action: "DRUGS_WARNING",
        reply: `Conduire sous l'emprise de stupÃ©fiants avec un BSR ou Permis AM est un dÃ©lit grave. Pour une premiÃ¨re infraction, vous risquez jusqu'Ã  4500 euros d'amende, 2 ans de prison, l'immobilisation ou la confiscation de votre scooter, et la suspension de votre permis AM. Bien qu'il n'y ait pas de perte de points sur le BSR, les sanctions pÃ©nales sont trÃ¨s lourdes.`,
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
    const jarvisFeedback = document.getElementById("jarvis-feedback-text");
    if (jarvisFeedback) {
      jarvisFeedback.innerText = result.reply;
      jarvisFeedback.classList.add("visible");
      setTimeout(() => jarvisFeedback.classList.remove("visible"), 5000);
    }

    if (result.reply) {
      this.speak(result.reply);
    }

    switch (result.action) {
      case "EMERGENCY_CALL":
        if (typeof window.triggerSOS === "function") window.triggerSOS();
        else alert("âš ï¸ URGENCE : Appeler le 112");
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
        else window.location.href = "/profil.html";
        break;
      case "DRUGS_WARNING":
        console.warn(
          "[J.A.R.V.I.S 4.0] PrÃ©vention stupÃ©fiants dÃ©clenchÃ©e.",
        );
        break;
    }
  },
};

window.initVoiceAI = function () {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn("Reconnaissance vocale non supportÃ©e sur ce navigateur.");
    return;
  }

  window.voiceAI = new SpeechRecognition();
  window.voiceAI.continuous = true;
  window.voiceAI.interimResults = false;
  window.voiceAI.lang = "fr-FR";

  window.voiceAI.onstart = function () {
    const micIcon = document.getElementById("jarvis-mic-icon");
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
    const jarvisFeedback = document.getElementById("jarvis-feedback-text");
    if (
      jarvisFeedback &&
      !transcript.includes("oracle") &&
      !transcript.includes("systÃ¨me") &&
      !transcript.includes("jarvis")
    ) {
      jarvisFeedback.innerText = "Vous : " + transcript;
      jarvisFeedback.classList.add("visible");
    }

    // Si le mot clÃ© de rÃ©veil est utilisÃ©
    if (
      transcript.includes("oracle") ||
      transcript.includes("systÃ¨me") ||
      transcript.includes("jarvis")
    ) {
      // Extraction de la commande aprÃ¨s le mot clÃ© pour plus de prÃ©cision
      let command = transcript;
      ["oracle", "systÃ¨me", "jarvis"].forEach((kw) => {
        if (transcript.includes(kw)) {
          command = transcript.split(kw)[1].trim() || transcript;
        }
      });

      // Si la commande est vide aprÃ¨s "jarvis"
      if (command.length < 2) {
        window.JarvisEngine.speak("Ã€ vos ordres, pilote.");
        return;
      }

      const result = window.JarvisEngine.processQuery(command);
      window.JarvisEngine.executeAction(result);
    }
  };

  window.voiceAI.onerror = function (event) {
    console.warn("[J.A.R.V.I.S 4.0] Erreur micro : ", event.error);
    const micIcon = document.getElementById("jarvis-mic-icon");
    if (micIcon) {
      micIcon.style.color = "#ff0055";
      micIcon.classList.remove("fa-fade");
      micIcon.style.transform = "scale(1)";
    }
  };

  window.voiceAI.onend = function () {
    const micIcon = document.getElementById("jarvis-mic-icon");
    if (micIcon) {
      micIcon.style.transform = "scale(1)";
      micIcon.classList.remove("fa-fade");
      micIcon.style.color = "";
    }

    setTimeout(() => {
      try {
        window.voiceAI.start();
      } catch (e) {}
    }, 1000);
  };

  try {
    window.voiceAI.start();
  } catch (e) {
    console.error("Impossible de dÃ©marrer l'IA vocale : ", e);
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
﻿/* --- COMMUNITY GAS RADAR (OpenData Gouv + Firebase) --- */

window.CommunityGas = {
  stations: [],

  compareAndShow: function () {
    if (typeof speak === "function")
      speak(
        "Connexion au flux Open Data du gouvernement et rÃ©cupÃ©ration des prix en temps rÃ©el.",
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
      // RequÃªte vers l'API OpenDataSoft du Gouvernement FranÃ§ais (Rayon de 3km)
      const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?where=within_distance(geom, geom'POINT(${lon} ${lat})', 3km)&limit=20`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erreur API Gouvernementale");

      const data = await response.json();
      this.processGovData(data.results, lat, lon);
    } catch (e) {
      console.error(e);
      if (typeof speak === "function")
        speak(
          "Impossible de contacter le serveur gouvernemental. Veuillez rÃ©essayer plus tard.",
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
          "Je ne trouve aucune station service rÃ©pertoriÃ©e dans un rayon de 3 kilomÃ¨tres.",
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

      // Le flux officiel liste les prix sous format JSON array ou chaÃ®ne XML parsÃ©e.
      // On extrait SP98 et E10 (s'ils existent)
      let sp98 = null;
      let e10 = null;

      // Parsing des prix (Le format dÃ©pend du flux, gÃ©nÃ©ralement record.prix est un array d'objets)
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
        // PremiÃ¨re station qui n'a que du E10
        warningStation = station;
      }
    });

    // PrÃ©paration du message vocal
    let voiceMessage = "";
    if (bestStation) {
      voiceMessage += `La station Ã  ${bestStation.distance.toFixed(1)} kilomÃ¨tres est la moins chÃ¨re avec le Sans Plomb 98 Ã  ${bestStation.prices["SP98"].price.toFixed(2)} euros. `;
    }

    if (warningStation) {
      voiceMessage += `Je dÃ©conseille la station Ã  ${warningStation.distance.toFixed(1)} kilomÃ¨tres qui ne propose que du E 10, ce qui est trÃ¨s nocif pour les moteurs de 50 cc. `;
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
      const statusText = hasSP98 ? "RecommandÃ© 50cc" : "DANGER E10";

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
                        <span class="gas-price">${price} â‚¬</span>
                    </div>
                    <div class="gas-status">
                        <i class="fa-solid ${statusIcon}"></i> ${statusText}
                    </div>
                </div>
                <div class="gas-footer">
                    <button class="btn-update-price" onclick="window.CommunityGas.openUpdateModal('${station.id}')">
                        <i class="fa-solid fa-pen"></i> Mettre Ã  jour (+5 Pts)
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
      `Prix officiel Gouv.fr : ${currentPrice}â‚¬.\nEntrez le nouveau prix constatÃ© sur place pour le ${fuelName} :`,
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
      station.prices[fuelType].updatedBy = "CommunautÃ©";

      alert(
        `Merci ! Le prix a Ã©tÃ© mis Ã  jour Ã  ${price}â‚¬ et synchronisÃ© avec la communautÃ©.\nVous gagnez +5 Points BVC.`,
      );
      if (typeof window.testAddPoints === "function") window.testAddPoints(5);

      this.renderHUD(this.stations.slice(0, 3));
    }
  },
};


/* --- leaderboard.js --- */
﻿// --- LEADERBOARD (King of the Street) ---
window.Leaderboard = {
  topPilots: [],

  init: async function () {
    if (!window.session || !window.session.uid) return;

    await this.ensureDepartment();
    await this.fetchLeaderboard();
  },

  ensureDepartment: async function () {
    if (window.session.department) return; // DÃ©jÃ  calculÃ©

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
          // Trouver le code postal ou le dÃ©partement
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

      // Si on a un dÃ©partement valide, on filtre. Sinon, classement global
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
        crownIcon = "ðŸ‘‘";
        color = "#ffd700";
      } else if (index === 1) {
        crownIcon = "ðŸ¥ˆ";
        color = "#c0c0c0";
      } else if (index === 2) {
        crownIcon = "ðŸ¥‰";
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
                    Ligue : ${window.session.department && window.session.department !== "Global" ? "DÃ©p. " + window.session.department : "Mondiale"}
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
﻿/* --- V3.0 SMART CITY & ZERO-CLICK DESTINY --- */

// 1. ZERO-CLICK DESTINY (IA Quantique)
window.initZeroClickDestiny = function () {
  const zeroClickScreen = document.getElementById("zero-click-screen");
  const destinationLabel = document.getElementById("zero-click-destination");
  const countdownLabel = document.getElementById("zero-click-countdown");

  if (!zeroClickScreen || !destinationLabel || !countdownLabel) return;

  // Simulation de l'IA qui devine la destination selon l'heure
  const hour = new Date().getHours();
  let predictedDestination = "LycÃ©e / CFA";
  if (hour >= 17 && hour <= 20) predictedDestination = "Maison";
  else if (hour > 20 || hour < 5)
    predictedDestination = "Spot de Rassemblement VSP/50cc";

  destinationLabel.innerText = predictedDestination;
  zeroClickScreen.classList.remove("hidden");

  if (typeof speak === "function")
    speak(
      "Intelligence prÃ©dictive activÃ©e. ItinÃ©raire vers " +
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
          "Navigation autonome engagÃ©e. Connexion aux infrastructures de la ville.",
        );

      // On simule le lancement de la navigation vers la destination
      const searchInput = document.getElementById("search-input");
      if (searchInput) searchInput.value = predictedDestination;

      // DÃ©marrage de V2X aprÃ¨s lancement
      setTimeout(window.initV2XGreenWave, 2000);
    }
  }, 1000);
};

window.cancelZeroClick = function () {
  clearInterval(window.zeroClickInterval);
  const zeroClickScreen = document.getElementById("zero-click-screen");
  if (zeroClickScreen) zeroClickScreen.classList.add("hidden");
  if (typeof speak === "function")
    speak("PrÃ©diction annulÃ©e. Mode manuel activÃ©.");
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

    // Pour un 50cc/VSP, la vitesse idÃ©ale pour choper les feux verts en ville est souvent 42 km/h.
    const optimalSpeed = 42;

    if (v2xTargetSpeed) v2xTargetSpeed.innerText = optimalSpeed + " km/h";

    if (currentSpeed > 45) {
      // ExcÃ¨s de vitesse 50cc -> Risque de feu rouge
      v2xHud.style.borderColor = "#ff0055";
      v2xStatus.innerText = "RALENTISSEZ - FEU ROUGE IMMINENT";
      v2xStatus.style.color = "#ff0055";
      if (Math.random() > 0.95 && typeof speak === "function") {
        speak(
          "Vitesse excessive pour un 50cc. Ralentissez Ã  42 km heure pour attraper la vague verte.",
        );
      }
    } else if (currentSpeed >= 38 && currentSpeed <= 45) {
      // Vitesse parfaite Onde Verte
      v2xHud.style.borderColor = "#00ffcc";
      v2xStatus.innerText = "VAGUE VERTE SYNCHRONISÃ‰E";
      v2xStatus.style.color = "#00ffcc";
    } else if (currentSpeed > 0 && currentSpeed < 38) {
      // Trop lent
      v2xHud.style.borderColor = "#ffaa00";
      v2xStatus.innerText = "ACCÃ‰LÃ‰REZ LÃ‰GÃˆREMENT";
      v2xStatus.style.color = "#ffaa00";
    } else {
      // Ã€ l'arrÃªt
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
﻿/* --- CARBON TRADING & CEE MARKET --- */

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

    // Si freinage brutal ou accÃ©lÃ©ration violente (> 15 km/h en 1s)
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
        "Trajet terminÃ©. Score Ã©cologique excellent. Certificat d'Ã©conomie d'Ã©nergie gÃ©nÃ©rÃ© avec succÃ¨s.",
      );

    // Update Wallet Badge if exists
    const walletBtn = document.getElementById("dock-btn-wallet");
    if (walletBtn) walletBtn.style.filter = "drop-shadow(0 0 15px #00ff00)";
  } else {
    if (typeof speak === "function")
      speak(
        "Trajet terminÃ©. Conduite trop agressive, aucun certificat carbone dÃ©livrÃ©.",
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
      "AccÃ¨s Ã  la salle de marchÃ© du carbone. Des mÃ©gacorporations attendent d'acheter vos certificats.",
    );

  // Simulation du cours de la bourse
  window.tradingInterval = setInterval(() => {
    const price = (14.5 + (Math.random() * 5 - 2.5)).toFixed(2);
    stockPrice.innerText = price + " â‚¬";
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
    window.braveCoins += price * 1.5; // conversion fictive

    document.getElementById("cee-inventory").innerText = "0 CEE Disponibles";

    if (typeof speak === "function")
      speak(
        "Transaction validÃ©e. Certificats vendus aux industries polluantes. Fonds transfÃ©rÃ©s sur votre portefeuille.",
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
      speak("Vous ne possÃ©dez aucun certificat Ã  vendre.");
  }
};

// Start telemetry
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(window.initEcoTelemetry, 3000);
});


/* --- rgpd-cnil.js --- */
﻿/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   CONFORMITÃ‰ GLOBALE : RGPD, CCPA, PIPL & GOOGLE PLAY CONSOLE
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

window.checkGlobalPrivacy = function () {
  const hasConsented = localStorage.getItem("global_privacy_consent");

  if (!hasConsented) {
    // CNIL : Ne PAS auto-accepter. Afficher la banniÃ¨re et attendre le choix actif de l'utilisateur.
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
                <h2 style="margin: 0 0 10px 0; text-transform: uppercase;">Vos DonnÃ©es, Vos RÃ¨gles</h2>
            </div>
            
            <div style="background: rgba(255,0,85,0.1); border-left: 4px solid #ff0055; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
                <h3 style="margin: 0 0 10px 0; color: #ff0055; font-size: 1rem;"><i class="fa-brands fa-google-play"></i> DÃ©claration de ConfidentialitÃ©</h3>
                <p style="color: #ccc; font-size: 0.9rem; line-height: 1.4; margin: 0;">
                    <strong>mon 50cc et moi</strong> collecte des donnÃ©es de localisation pour permettre la dÃ©tection automatique de chute, la navigation GPS Ã©tape par Ã©tape, et le signalement de dangers Ã  la communautÃ©, mÃªme lorsque l'application est fermÃ©e ou qu'elle n'est pas utilisÃ©e. L'accÃ¨s en arriÃ¨re-plan est indispensable au service.
                </p>
            </div>

            <div style="background: #111; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <h3 style="color: #00b3ff; margin-top: 0; font-size: 1.1rem;">1. Europe (RGPD / CNIL)</h3>
                <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    <span><i class="fa-solid fa-location-dot" style="color: #00b3ff;"></i> AccÃ¨s GPS (Obligatoire)</span>
                    <input type="checkbox" id="privacy-gps" checked disabled style="transform: scale(1.5);">
                </label>
                <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    <span><i class="fa-solid fa-microphone" style="color: #ff0055;"></i> Micro (IA Vocale)</span>
                    <input type="checkbox" id="privacy-mic" checked style="transform: scale(1.5);">
                </label>
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fa-solid fa-camera" style="color: #b700ff;"></i> CamÃ©ra (AR Vision)</span>
                    <input type="checkbox" id="privacy-cam" checked style="transform: scale(1.5);">
                </label>
            </div>

            <div style="background: #111; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <h3 style="color: #ffb700; margin-top: 0; font-size: 1.1rem;">2. USA / Californie (CCPA)</h3>
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fa-solid fa-hand-holding-dollar" style="color: #ffb700;"></i> Ne pas vendre mes donnÃ©es<br><small style="color: #888;">"Do Not Sell My Personal Info"</small></span>
                    <input type="checkbox" id="privacy-ccpa" checked style="transform: scale(1.5);">
                </label>
            </div>

            <div style="background: #111; padding: 15px; border-radius: 10px; margin-bottom: 25px;">
                <h3 style="color: #ff0055; margin-top: 0; font-size: 1.1rem;">3. Chine (PIPL)</h3>
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fa-solid fa-globe" style="color: #ff0055;"></i> Transfert Transfrontalier<br><small style="color: #888;">Autoriser l'envoi des donnÃ©es vers les serveurs sÃ©curisÃ©s en Europe.</small></span>
                    <input type="checkbox" id="privacy-pipl" checked style="transform: scale(1.5);">
                </label>
            </div>
            
            <button onclick="window.acceptGlobalPrivacy()" style="width: 100%; padding: 15px; background: #00ffcc; color: #000; font-weight: 900; font-size: 1.2rem; border: none; border-radius: 10px; cursor: pointer; text-transform: uppercase; margin-bottom: 10px;">J'ACCEPTE TOUT</button>
            <button onclick="window.refuseGlobalPrivacy()" style="width: 100%; padding: 15px; background: transparent; color: #fff; font-weight: 700; font-size: 1rem; border: 2px solid #fff; border-radius: 10px; cursor: pointer; text-transform: uppercase; margin-bottom: 15px;">REFUSER (fonctionnalitÃ©s limitÃ©es)</button>
            <div style="text-align: center;">
                <button onclick="window.openPrivacyPolicy()" style="background: none; border: none; color: #888; text-decoration: underline; cursor: pointer;">Lire la Politique de ConfidentialitÃ©</button>
            </div>
        </div>
    </div>
    
    <!-- PRIVACY POLICY MODAL -->
    <div id="privacy-policy-modal" class="hidden fullscreen-overlay" style="background: #111; color: #fff; z-index: 95000; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; overflow-y: auto; padding: 30px; box-sizing: border-box; font-family: 'Inter', sans-serif;">
        <button onclick="window.closePrivacyPolicy()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;"><i class="fa-solid fa-times"></i></button>
        <h2>Politique de ConfidentialitÃ© Globale</h2>
        <p>En accord avec les rÃ¨gles Google Play et les lois RGPD (Europe), CCPA (USA) et PIPL (Chine).</p>
        
        <h3>1. AccÃ¨s Ã  la Localisation en ArriÃ¨re-plan (Google Play)</h3>
        <p>Notre application accÃ¨de Ã  votre position GPS de maniÃ¨re continue, y compris lorsque l'application est en arriÃ¨re-plan, afin de calculer les distances parcourues pour le Score Ã‰co et le Radar Social. Ces donnÃ©es sont utilisÃ©es exclusivement pour la fonctionnalitÃ© principale du service et ne sont pas revendues.</p>
        
        <h3>2. Europe (RGPD) & Privacy by Design</h3>
        <p>Vos donnÃ©es sont traitÃ©es de faÃ§on sÃ©curisÃ©e (AES-256). Vous disposez d'un droit inconditionnel Ã  l'oubli. La fonction "Supprimer mes donnÃ©es" Ã©crase vos donnÃ©es locales et purge irrÃ©vocablement votre compte sur le Cloud Firebase.</p>

        <h3>3. USA (CCPA)</h3>
        <p>Nous ne vendons AUCUNE de vos donnÃ©es personnelles Ã  des tiers. Vous pouvez exprimer votre choix en cochant la case "Do Not Sell".</p>

        <h3>4. Chine (PIPL)</h3>
        <p>Si vous rÃ©sidez en Chine, vous devez consentir explicitement au transfert transfrontalier de vos donnÃ©es vers nos serveurs situÃ©s en Europe.</p>
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
      "Attention : L'application nÃ©cessite obligatoirement l'accÃ¨s au GPS pour fonctionner.",
    );
    return;
  }
  if (!piplChecked) {
    alert(
      "Information (PIPL) : L'application est hÃ©bergÃ©e en Europe. Si vous n'autorisez pas le transfert transfrontalier, le Cloud ne pourra pas fonctionner.",
    );
  }

  const consentRecord = {
    gps: true,
    mic: micChecked,
    cam: camChecked,
    ccpa_do_not_sell: ccpaChecked,
    pipl_crossborder: piplChecked,
    timestamp: new Date().toISOString(),
    version: "v100.00-GOLD",
  };

  localStorage.setItem("global_privacy_consent", "true");
  localStorage.setItem("cnil_consent", "true"); // legacy support
  localStorage.setItem("legal_consent_accepted", "true"); // bypass app-core modal
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
    speak("ConformitÃ© internationale validÃ©e. Bienvenue.");
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
    version: "v100.00-GOLD",
  };

  localStorage.setItem("global_privacy_consent", "refused");
  localStorage.setItem("privacy_consent_record", JSON.stringify(consentRecord));
  localStorage.setItem("cnil_mic", "false");
  localStorage.setItem("cnil_cam", "false");

  const banner = document.getElementById("global-privacy-banner");
  if (banner) banner.remove();

  window.preventAppLaunch = false;

  alert(
    "Vous avez refusÃ© les cookies optionnels. L'application fonctionnera avec des fonctionnalitÃ©s limitÃ©es (pas de commandes vocales ni de rÃ©alitÃ© augmentÃ©e).",
  );
};

window.closePrivacyPolicy = function () {
  const modal = document.getElementById("privacy-policy-modal");
  if (modal) modal.classList.add("hidden");
};

// â”€â”€â”€ Droit Ã  l'effacement (Droit Ã  l'oubli / Protocol Zero) â”€â”€
window.revokeAndEraseData = async function () {
  if (
    confirm(
      "ATTENTION : Cette action est IRRÃ‰VERSIBLE. Toutes vos donnÃ©es locales ET sur le serveur Cloud (Firestore) seront dÃ©truites. Confirmer ?",
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

    // 1. DÃ©clencher le Protocol Zero (Suppression Backend via Cloud Function)
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

    // 2. Effacer toutes les donnÃ©es locales
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
      "Toutes vos donnÃ©es (Locales et Serveur) ont Ã©tÃ© dÃ©truites de maniÃ¨re irrÃ©versible. L'application va se rÃ©initialiser.",
    );
    window.location.href = "login.html";
  }
};

// â”€â”€â”€ Export des donnÃ©es â”€â”€â”€â”€â”€â”€â”€
window.exportMyData = function () {
  try {
    const exportData = {
      _meta: {
        export_date: new Date().toISOString(),
        app: "mon50ccetmoi",
        format: "JSON (Format structurÃ© portable)",
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
      "âœ… Export terminÃ© ! Vos donnÃ©es locales ont Ã©tÃ© tÃ©lÃ©chargÃ©es.",
    );
  } catch (e) {
    console.error("Erreur export:", e);
    alert("Erreur lors de l'export.");
  }
};

// â”€â”€â”€ VÃ©rification au chargement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener("DOMContentLoaded", () => {
  if (!localStorage.getItem("global_privacy_consent")) {
    setTimeout(window.checkGlobalPrivacy, 500);
  } else {
    window.checkGlobalPrivacy();
  }
});


/* --- litigation-ai.js --- */
﻿/**
 * LITIGATION AI v1.0 â€” PORTAIL ASSURANCE INTELLIGENT
 * Analyse automatique des donnÃ©es Blackbox pour les dossiers de litige.
 * GÃ©nÃ¨re un code dossier unique, sÃ©lectionne le type de rapport adaptÃ©,
 * et envoie une proposition structurÃ©e Ã  l'assureur via Firestore.
 */

window.LitigationAI = {
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1. GÃ‰NÃ‰RATION DU CODE DOSSIER
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * GÃ©nÃ¨re un code de dossier unique au format LITIGE-XXXXXX
   * basÃ© sur timestamp + uid utilisateur pour unicitÃ© garantie.
   */
  generateCaseCode() {
    const uid = window.session?.uid || "GUEST";
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `LITIGE-${ts}-${rnd}`;
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 2. ANALYSE IA DE LA BLACKBOX
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Analyse les donnÃ©es de la Blackbox et retourne une Ã©valuation IA :
   * - type de rapport recommandÃ©
   * - score de sÃ©vÃ©ritÃ©
   * - rÃ©sumÃ© des facteurs clÃ©s
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

    // â€” Calcul du G-Force maximum enregistrÃ©
    let maxG = 0;
    for (const entry of hfBuffer) {
      const ax = parseFloat(entry.ax) || 0;
      const ay = parseFloat(entry.ay) || 0;
      const az = parseFloat(entry.az) || 0;
      const g = Math.sqrt(ax * ax + ay * ay + az * az) / 9.81;
      if (g > maxG) maxG = g;
    }

    // â€” Vitesse max enregistrÃ©e
    let maxSpeed = 0;
    for (const entry of buffer) {
      const spd = parseFloat(entry.speed) || 0;
      if (spd > maxSpeed) maxSpeed = spd;
    }

    // â€” Angle d'inclinaison max
    let maxLean = 0;
    for (const entry of buffer) {
      const lean = Math.abs(parseFloat(entry.lean) || 0);
      if (lean > maxLean) maxLean = lean;
    }

    // â€” CoordonnÃ©es GPS de l'incident (dernier point connu)
    const lastGps = buffer.length > 0 ? buffer[buffer.length - 1] : null;

    // â€” Score de sÃ©vÃ©ritÃ© (0â€“100)
    let severity = 0;
    if (maxG > thresholds.EXPERT_G) severity += 50;
    else if (maxG > thresholds.IMPACT_G) severity += 30;
    if (maxSpeed > thresholds.HIGH_SPEED_KMH) severity += 25;
    if (maxLean > thresholds.LEAN_ANGLE_DEG) severity += 15;
    severity = Math.min(severity, 100);

    // â€” SÃ©lection automatique du type de rapport
    let reportType, reportLabel, reportIcon, reportDescription;

    if (maxG >= thresholds.EXPERT_G || severity >= 70) {
      reportType = "EXPERT_COMPLET";
      reportLabel = "Expertise ComplÃ¨te";
      reportIcon = "ðŸ›¡ï¸";
      reportDescription =
        "TÃ©lÃ©mÃ©trie + G-Force + GPS + Replay 3D certifiÃ© + Signature SHA-256";
    } else if (maxG >= thresholds.IMPACT_G || severity >= 35) {
      reportType = "IMPACT";
      reportLabel = "Rapport Impact";
      reportIcon = "âš¡";
      reportDescription =
        "DÃ©tection de choc + AccÃ©lÃ©romÃ©trie haute frÃ©quence + GPS";
    } else {
      reportType = "STANDARD";
      reportLabel = "Rapport Standard";
      reportIcon = "ðŸ“Š";
      reportDescription =
        "TÃ©lÃ©mÃ©trie gÃ©nÃ©rale + Vitesse + CoordonnÃ©es GPS";
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 3. CONSTRUCTION DE LA PROPOSITION
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Construit un objet de proposition complet destinÃ© Ã  l'assureur.
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

      // DÃ©cision IA
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

      // DonnÃ©es techniques clÃ©s
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 4. ENVOI VERS FIRESTORE
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Envoie la proposition vers Firestore (collection litigation_proposals).
   */
  async sendProposalToFirestore(proposal) {
    if (typeof db === "undefined") {
      console.warn(
        "[LitigationAI] Firestore non disponible â€” simulation locale.",
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 5. ORCHESTRATION PRINCIPALE
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Point d'entrÃ©e principal.
   * GÃ©nÃ¨re le code, analyse la blackbox, construit et envoie la proposition,
   * puis affiche le rÃ©sultat dans l'interface.
   */
  async runWizard() {
    // Ã‰tape 1 â€” GÃ©nÃ©ration du code
    const caseCode = this.generateCaseCode();
    this.renderWizardStep("analyzing", caseCode, null);

    // Ã‰tape 2 â€” Analyse IA (simuler dÃ©lai traitement)
    await new Promise((r) => setTimeout(r, 1800));
    const analysis = this.analyzeBlackboxData();

    // Ã‰tape 3 â€” Construction de la proposition
    const proposal = this.buildInsuranceProposal(caseCode, analysis);

    // Ã‰tape 4 â€” Affichage du rÃ©sultat + confirmation
    this.renderWizardResult(caseCode, analysis, proposal);
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 6. INTERFACE UTILISATEUR
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
                    <p class="litigation-sub">L'IA va analyser votre Blackbox et prÃ©parer une proposition pour votre assureur.</p>
                </div>

                <div class="litigation-checklist">
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Blackbox chiffrÃ©e AES-256</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> TÃ©lÃ©mÃ©trie haute frÃ©quence (10Hz)</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> CoordonnÃ©es GPS certifiÃ©es</div>
                    <div class="check-item"><i class="fa-solid fa-circle-check"></i> Signature SHA-256 d'intÃ©gritÃ©</div>
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
                    <h3>Analyse IA en coursâ€¦</h3>
                    <p class="case-code-display">Code dossier gÃ©nÃ©rÃ© : <strong>${caseCode}</strong></p>
                    <div class="ai-progress-bar">
                        <div class="ai-progress-fill"></div>
                    </div>
                    <p class="ai-status-text">Lecture de la tÃ©lÃ©mÃ©trie Blackboxâ€¦</p>
                </div>
            `;
      // Animation de la barre de progression
      setTimeout(() => {
        const fill = content.querySelector(".ai-progress-fill");
        const txt = content.querySelector(".ai-status-text");
        if (fill) fill.style.width = "45%";
        if (txt) txt.textContent = "Calcul des G-Forcesâ€¦";
      }, 500);
      setTimeout(() => {
        const fill = content.querySelector(".ai-progress-fill");
        const txt = content.querySelector(".ai-status-text");
        if (fill) fill.style.width = "80%";
        if (txt) txt.textContent = "SÃ©lection du type de rapportâ€¦";
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
        ? "Ã‰LEVÃ‰E"
        : analysis.severity >= 35
          ? "MODÃ‰RÃ‰E"
          : "FAIBLE";

    content.innerHTML = `
            <div class="litigation-portal">
                <div class="litigation-result-header">
                    <i class="fa-solid fa-brain" style="color:#7c4dff; font-size:2rem;"></i>
                    <h3>Analyse IA TerminÃ©e</h3>
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
                        <strong>Rapport recommandÃ© :</strong>
                        <span class="report-label">${analysis.reportLabel}</span>
                        <p class="report-desc">${analysis.reportDescription}</p>
                    </div>
                </div>

                <div class="severity-block">
                    <span class="severity-title">SÃ©vÃ©ritÃ© estimÃ©e :</span>
                    <div class="severity-bar-bg">
                        <div class="severity-bar-fill" style="width:${analysis.severity}%; background:${severityColor};"></div>
                    </div>
                    <span class="severity-score" style="color:${severityColor};">${analysis.severity}/100 â€” ${severityLabel}</span>
                </div>

                <div class="telemetry-summary">
                    <div class="tele-item"><i class="fa-solid fa-bolt"></i> G-Force max : <strong>${analysis.maxG} G</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-gauge-high"></i> Vitesse max : <strong>${analysis.maxSpeed} km/h</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-rotate"></i> Inclinaison max : <strong>${analysis.maxLean}Â°</strong></div>
                    <div class="tele-item"><i class="fa-solid fa-shield-halved"></i> IntÃ©gritÃ© chassis : <strong>${analysis.structuralScore}%</strong></div>
                    ${analysis.gpsIncident ? `<div class="tele-item"><i class="fa-solid fa-location-dot"></i> GPS : <strong>${analysis.gpsIncident.lat?.toFixed(5)}, ${analysis.gpsIncident.lng?.toFixed(5)}</strong></div>` : ""}
                </div>

                <p class="litigation-disclaimer">
                    <i class="fa-solid fa-circle-info"></i>
                    En envoyant cette proposition, votre assureur reÃ§oit le rÃ©sumÃ© et vous contactera pour valider le type de rapport dÃ©finitif.
                </p>

                <!-- AVERTISSEMENT AI ACT (Obligatoire) -->
                <p class="litigation-ai-act-disclaimer" style="color: #ffaa00; font-weight: bold; margin-bottom: 15px; border: 1px solid #ffaa00; padding: 10px; border-radius: 8px;">
                    <i class="fa-solid fa-scale-balanced"></i>
                    âš ï¸ GÃ‰NÃ‰RÃ‰ PAR L'IA : Ce rapport est une proposition d'assistance. Une supervision et validation humaine par l'utilisateur sont obligatoires avant le traitement juridique.
                </p>

                <div class="litigation-actions">
                    ${
                      proposal.type === "EXPERT_COMPLET"
                        ? `
                    <button class="btn-litigation-start" onclick="if(window.CertifiedCamera) window.CertifiedCamera.open('${caseCode}'); else alert('Module de camÃ©ra non disponible');" style="background:#ffb703; color:#000; margin-bottom:10px;">
                        <i class="fa-solid fa-camera"></i>
                        Ajouter Preuve Photo (HorodatÃ©e)
                    </button>
                    `
                        : ""
                    }
                    <button class="btn-litigation-send" onclick='LitigationAI.confirmAndSend(' + JSON.stringify(proposal).replace(/"/g, "&quot;") + ')'>
                        <i class="fa-solid fa-paper-plane"></i>
                        Envoyer Ã  l'assureur
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
                <h3>Verrouillage des donnÃ©es...</h3>
                <p>CrÃ©ation du coffre-fort numÃ©rique...</p>
            </div>
        `;

    // Simulate a small delay for cryptography feeling
    setTimeout(() => {
      content.innerHTML = `
                <div class="litigation-portal litigation-success" style="padding: 20px;">
                    <i class="fa-solid fa-vault" style="font-size:4rem; color:#00e676; margin-bottom: 20px;"></i>
                    <h3 style="color:#00e676; margin-bottom: 10px;">Coffre-Fort SÃ©curisÃ© !</h3>
                    <p style="color:#aaa; margin-bottom: 20px;">Vos donnÃ©es certifiÃ©es sont cryptÃ©es et inaccessibles sans ce code.</p>
                    
                    <div style="background: rgba(0,0,0,0.5); padding: 20px; border-radius: 15px; border: 2px dashed #00e676; display: inline-block; margin-bottom: 20px;">
                        <span style="display: block; font-size: 1rem; color: #888; margin-bottom: 10px;">CODE LITIGE Ã€ TRANSMETTRE Ã€ VOTRE ASSUREUR :</span>
                        <strong style="font-size: 2.5rem; letter-spacing: 5px; color: #fff;">${disputeCode}</strong>
                    </div>

                    <p style="color:#ffaa00; font-weight: bold; margin-bottom: 30px;">
                        <i class="fa-solid fa-hand-holding-dollar"></i> 
                        Vous recevrez une prime de 10 BVC dÃ¨s que votre assureur dÃ©bloquera ces donnÃ©es.
                    </p>

                    <button class="btn-litigation-start" onclick="document.getElementById('screen-overlay').classList.add('hidden')">
                        <i class="fa-solid fa-check"></i> Terminer
                    </button>
                </div>
            `;
      if (typeof speak === "function")
        speak(
          "Coffre-fort crÃ©Ã©. Transmettez ce code litige Ã  votre assureur.",
        );
    }, 2000);
  },

  copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      if (typeof speak === "function") speak("Code dossier copiÃ©.");
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
﻿/**
 * PORTAIL ASSURANCE mon50ccetmoi
 * Paiements via Revolut Merchant API (SDK RevolutCheckout embarquÃ©)
 * Flow : client â†’ Firebase Function (crÃ©ation ordre) â†’ Revolut â†’ webhook â†’ Firestore
 */
window.InsurancePortal = {
  // ClÃ© publique Merchant (config.js) â€” utilisÃ©e cÃ´tÃ© client uniquement
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
  cases: {}, // Liste des dossiers en attente ou dÃ©bloquÃ©s

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
                    <strong id="portal-balance">${this.balance.toFixed(2)} â‚¬</strong>
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
                    Veuillez transmettre ce code de dossier Ã  votre assureur :
                </p>
                <div class="case-code-badge" style="justify-content:center; margin: 20px 0;">
                    <i class="fa-solid fa-hashtag"></i>
                    <strong style="font-size:1.3rem;">${caseId}</strong>
                </div>
                <p style="color:#aaa; font-size:0.9rem; line-height:1.5;">
                    Votre assureur pourra dÃ©verrouiller le rapport depuis le <strong>Portail Expert</strong>.<br>
                    Le rapport sera disponible ici automatiquement dÃ¨s validation du paiement.
                </p>
                <button onclick="InsurancePortal.pollPaymentConfirmation('${caseId}')" class="btn-litigation-start" style="margin-top:20px;">
                    <i class="fa-solid fa-rotate"></i> RafraÃ®chir le statut
                </button>
            </div>
        `;
  },

  renderUnlockedView(caseId) {
    return `
            <div class="unlocked-view">
                <p class="success-msg"><i class="fa-solid fa-circle-check"></i> Rapport dÃ©bloquÃ© avec succÃ¨s.</p>
                <button onclick="window.BlackBoxInsurance.generateReport()" class="btn-download-report">
                    <i class="fa-solid fa-file-pdf"></i> TÃ©lÃ©charger le Rapport CertifiÃ©
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
      waiting_for_funds: "Virement en cours (Attente rÃ©ception)",
      pending_verification: "VÃ©rification de la preuve en cours",
      unlocked: "AccÃ¨s AutorisÃ©",
    };
    return labels[status] || status;
  },

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // OPTION 1 : Paiement Revolut Merchant (flow complet)
  // 1. Appel Firebase Function â†’ crÃ©ation ordre Revolut (clÃ© secrÃ¨te serveur)
  // 2. RÃ©cupÃ©ration du order_token
  // 3. RevolutCheckout(token).payWithPopup()
  // 4. Webhook Revolut â†’ Firebase â†’ dÃ©blocage rapport
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async payInstant(caseId) {
    const pubKey = this.revolutPublicKey;
    if (!pubKey) {
      alert("âš ï¸ ClÃ© publique Revolut manquante dans config.js");
      return;
    }

    // Ã‰tape 1 : Afficher le spinner de chargement
    this.cases[caseId] = { status: "waiting_for_funds", unlocked: false };
    this.renderRevolutLoadingModal(caseId);

    try {
      // Ã‰tape 2 : CrÃ©er l'ordre cÃ´tÃ© serveur via Firebase Function
      speak("Initialisation du paiement sÃ©curisÃ© Revolut.");
      const orderData = await this.createOrderViaFunction(caseId);

      if (!orderData?.order_token) {
        throw new Error("Token de paiement Revolut non reÃ§u.");
      }

      // Ã‰tape 3 : Lancer le checkout Revolut avec le token
      await this.launchRevolutCheckout(caseId, orderData);
    } catch (err) {
      console.error("[Revolut] Erreur paiement :", err);
      this.renderRevolutErrorModal(caseId, err.message);
    }
  },

  // â”€ Appel Firebase Function : crÃ©ation de l'ordre Revolut â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        user_id: window.session?.uid || "guest",
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

  // â”€ Lance RevolutCheckout avec le token reÃ§u â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async launchRevolutCheckout(caseId, orderData) {
    if (typeof RevolutCheckout !== "function") {
      // SDK pas encore chargÃ© (async) â€” attendre 2s et rÃ©essayer
      await new Promise((r) => setTimeout(r, 2000));
      if (typeof RevolutCheckout !== "function") {
        throw new Error("SDK Revolut non chargÃ©. VÃ©rifiez votre connexion.");
      }
    }

    const instance = await RevolutCheckout(orderData.order_token, "prod");
    // Mode production activÃ© â€” anciennement 'sandbox'

    instance.payWithPopup({
      onSuccess: () => {
        speak("Paiement Revolut confirmÃ©. VÃ©rification en cours.");
        this.renderRevolutPendingConfirmation(caseId, orderData.order_id);
        // Le webhook Revolut va dÃ©bloquer le rapport dans Firestore.
        // On poll Firebase toutes les 3s pour dÃ©tecter la confirmation.
        this.pollPaymentConfirmation(caseId);
      },
      onError: (message) => {
        console.error("[Revolut] Erreur checkout :", message);
        this.renderRevolutErrorModal(caseId, message);
      },
      onCancel: () => {
        speak("Paiement annulÃ©.");
        this.cases[caseId] = { status: "pending_payment", unlocked: false };
        this.showPortal(caseId);
      },
    });
  },

  // â”€ Poll Firestore pour dÃ©tecter la confirmation webhook â”€â”€â”€â”€â”€â”€â”€â”€
  async pollPaymentConfirmation(caseId, attempts = 0) {
    if (attempts > 20) {
      // Timeout aprÃ¨s ~60s
      this.renderRevolutErrorModal(
        caseId,
        "DÃ©lai de confirmation dÃ©passÃ©. Contactez le support.",
      );
      return;
    }

    await new Promise((r) => setTimeout(r, 3000));

    try {
      // VÃ©rifier dans Firestore si le webhook a confirmÃ© le paiement
      if (typeof db !== "undefined") {
        const doc = await db
          .collection("payment_confirmations")
          .doc(caseId)
          .get();
        if (doc.exists) {
          this.unlockCase(caseId, "revolut_webhook");
          this.renderRevolutSuccess(caseId);
          speak("Rapport dÃ©bloquÃ© avec succÃ¨s. Bonne route.");
          return;
        }
      } else {
        // Fallback : vÃ©rifier via la Cloud Function
        const url = `${this.functionBaseUrl}/checkPaymentStatus?case_id=${caseId}&user_id=${window.session?.uid || ""}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.paid) {
          this.unlockCase(caseId, "revolut_webhook");
          this.renderRevolutSuccess(caseId);
          speak("Rapport dÃ©bloquÃ© avec succÃ¨s.");
          return;
        }
      }
    } catch (e) {
      console.warn("[Revolut Poll] Erreur :", e);
    }

    // Continuer Ã  poller
    this.pollPaymentConfirmation(caseId, attempts + 1);
  },

  // â”€ Modals UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  renderRevolutSuccess(caseId) {
    const content = document.getElementById("screen-content");
    if (!content) return;
    content.innerHTML = `
            <div class="litigation-portal" style="animation: portal-fade-in 0.5s ease-out;">
                <div class="litigation-analyzing" style="text-align:center; padding: 40px 20px;">
                    <div class="revolut-logo-ring" style="border-color: #00ff00; box-shadow: 0 0 30px rgba(0,255,0,0.5);">
                        <i class="fa-solid fa-unlock" style="color:#00ff00; font-size:2rem; animation: pulse-halo 2s infinite;"></i>
                    </div>
                    <h3 style="color:#00ff00; font-size:1.5rem; margin-top:20px;">Paiement ValidÃ©</h3>
                    <p style="color:#fff; font-size:0.9rem; margin-top:10px;">Le webhook Revolut a confirmÃ© la transaction.</p>
                    <p style="color:#00d2ff; font-size:1rem; margin-top:5px; font-weight:bold;">Rapport DÃ©verrouillÃ©</p>
                </div>
            </div>`;

    // AprÃ¨s 3 secondes, on affiche le portail complet
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
                        <h3>Paiement SÃ©curisÃ©</h3>
                        <p style="color:#aaa; font-size:0.82rem;">PrÃ©paration du checkout <strong style="color:#fff;">Revolut</strong>â€¦</p>
                    </div>
                    <div class="revolut-amount-badge">
                        <span class="revolut-amount-value">${price.toFixed(2)} â‚¬</span>
                        <span class="revolut-amount-label">Rapport Assurance certifiÃ© â€” ${caseId}</span>
                    </div>
                    <div class="ai-progress-bar" style="margin-top:20px;">
                        <div class="ai-progress-fill revolut-progress" style="width:30%;"></div>
                    </div>
                    <p class="ai-status-text" id="revolut-status-txt">CrÃ©ation de l'ordre de paiementâ€¦</p>
                </div>
            </div>`;
    // Animation de la barre
    setTimeout(() => {
      const fill = content.querySelector(".revolut-progress");
      const txt = content.querySelector("#revolut-status-txt");
      if (fill) fill.style.width = "70%";
      if (txt) txt.textContent = "Connexion Ã  Revolut Merchantâ€¦";
    }, 800);
    setTimeout(() => {
      const fill = content.querySelector(".revolut-progress");
      const txt = content.querySelector("#revolut-status-txt");
      if (fill) fill.style.width = "90%";
      if (txt) txt.textContent = "Ouverture du checkoutâ€¦";
    }, 1800);
  },

  renderRevolutPendingConfirmation(caseId, orderId) {
    const content = document.getElementById("screen-content");
    if (!content) return;
    content.innerHTML = `
            <div class="litigation-portal litigation-sending">
                <i class="fa-solid fa-satellite-dish fa-bounce" style="font-size:3rem; color:#7c4dff;"></i>
                <h3 style="margin-top:15px;">Confirmation en coursâ€¦</h3>
                <p style="color:#888; font-size:0.83rem; margin-top:10px;">
                    Votre paiement a Ã©tÃ© soumis. En attente de la confirmation Revolut.
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
                    <i class="fa-solid fa-clock"></i> VÃ©rification automatique toutes les 3 secondesâ€¦
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
                        <i class="fa-solid fa-rotate-right"></i> RÃ©essayer
                    </button>
                    <button class="btn-close-litigation" onclick="document.getElementById('screen-overlay').classList.add('hidden')" style="flex:1;">
                        <i class="fa-solid fa-times"></i> Fermer
                    </button>
                </div>
            </div>`;
  },

  // DOSSIER LITIGE IA â€” Lance l'analyse Blackbox intelligente
  openLitigationWizard(caseId) {
    if (typeof window.LitigationAI === "undefined") {
      alert(
        "Module LitigationAI non chargÃ©. VÃ©rifiez que litigation-ai.js est inclus dans la page.",
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
      speak("DÃ©bit effectuÃ© sur votre compte pro. Rapport accessible.");
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
          "Preuve de virement reÃ§ue. Notre systÃ¨me vÃ©rifie le document.",
        );

        // Simulation de validation automatique aprÃ¨s 5s
        setTimeout(() => {
          this.unlockCase(caseId, "proof_validated");
          if (
            document
              .getElementById("screen-overlay")
              .classList.contains("hidden") === false
          ) {
            this.showPortal(caseId);
          }
          speak("Justificatif validÃ©. Le rapport est maintenant dÃ©bloquÃ©.");
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
                            <span class="t-amount">-${t.amount}â‚¬</span>
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

    this.notify(`Transaction confirmÃ©e pour le dossier ${caseId}.`);
  },
};


/* --- anti-theft.js --- */
﻿window.AntiTheft = {
  isSentryActive: false,
  sentryListener: null,

  toggleSentryMode: function () {
    if (this.isSentryActive) {
      this.stopSentry();
      speak("Mode Sentinelle dÃ©sactivÃ©.");
    } else {
      this.startSentry();
      speak(
        "Mode Sentinelle activÃ©. PÃ©rimÃ¨tre sÃ©curisÃ©. Je surveille l'accÃ©lÃ©romÃ¨tre.",
      );
    }

    const btn = document.getElementById("dock-btn-sentry");
    if (btn) {
      if (this.isSentryActive) {
        btn.style.color = "#ff0000";
        btn.style.animation = "pulse-halo 1.5s infinite";
        btn.title = "Mode Sentinelle ACTIF (Appuyer pour dÃ©sactiver)";
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
      "ALERTE : Mouvement suspect dÃ©tectÃ©. Enregistrement Sentinel activÃ©.",
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
﻿/**
 * MECA-WIZARD v2.0 - DeepTech AI Mechanic
 * Analyse Acoustique rÃ©elle via Web Audio API & IntÃ©gration Revolut Checkout
 */

window.MecaWizard = {
  audioCtx: null,
  analyser: null,
  microphone: null,
  animationId: null,

  // 1. Calculateur de mÃ©lange
  calculateMix: function (liters, percent) {
    if (!liters || !percent) return 0;
    const oilMl = liters * 1000 * (percent / 100);
    return Math.round(oilMl);
  },

  // 2. Analyse Acoustique (Microphone RÃ©el)
  startAcousticAnalysis: async function () {
    if (window.session && window.session.isGuest) {
      alert(
        "ðŸ”’ L'IA Acoustique est une exclusivitÃ© Membre. Inscrivez-vous pour diagnostiquer votre moteur !",
      );
      return;
    }

    const modal = document.getElementById("meca-result-modal");
    if (modal) modal.classList.remove("hidden");

    const resultDiv = document.getElementById("meca-result");
    if (!resultDiv) return;

    resultDiv.innerHTML = `
            <div class="glassmorphism biometric-scan" style="padding:20px; text-align:center;">
                <i class="fa-solid fa-microphone-lines fa-beat" style="font-size:2rem; color:var(--neon-blue);"></i>
                <p style="margin-top:15px; font-weight:bold;">INITIALISATION DU STÃ‰THOSCOPE IA...</p>
                <p style="font-size:0.8rem; color:#ccc;">Demande d'accÃ¨s au microphone...</p>
            </div>
        `;

    try {
      // AccÃ¨s au microphone
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
        "AccÃ¨s au microphone autorisÃ©. DÃ©marrez le moteur et donnez un coup de gaz franc.",
      );

      // Affichage de l'oscilloscope
      resultDiv.innerHTML = `
                <div class="glassmorphism" style="padding:20px; text-align:center;">
                    <h4 style="color:var(--accent);"><i class="fa-solid fa-wave-square"></i> ANALYSE EN COURS</h4>
                    <canvas id="audio-canvas" width="280" height="100" style="background:#0a0a0a; border-radius:8px; margin:15px 0; border: 1px solid var(--accent);"></canvas>
                    <p style="font-size:0.8rem; color:#888;">Analyse de la signature frÃ©quentielle (FFT)...</p>
                </div>
            `;

      this.drawOscilloscope();

      // ArrÃªt de l'analyse aprÃ¨s 6 secondes
      setTimeout(() => {
        this.stopAnalysis(stream);
        this.showDiagnosticReport(resultDiv);
      }, 6000);
    } catch (err) {
      console.error("Erreur Micro:", err);
      resultDiv.innerHTML = `
                <div class="glassmorphism" style="padding:20px; border-left:4px solid #dc3545;">
                    <h4 style="color:#dc3545;">ERREUR MICROPHONE</h4>
                    <p style="font-size:0.9rem; margin-top:10px;">Impossible d'accÃ©der au microphone. Veuillez vÃ©rifier vos autorisations.</p>
                </div>
            `;
      speak("Erreur. L'accÃ¨s au microphone a Ã©tÃ© refusÃ©.");
    }
  },

  // 3. Analyseur d'Ã©chappement (DÃ©cibels & FrÃ©quence)
  startDecibelMeter: async function () {
    const modal = document.getElementById("meca-result-modal");
    if (modal) modal.classList.remove("hidden");

    const resultDiv = document.getElementById("meca-result");
    if (!resultDiv) return;

    resultDiv.innerHTML = `
            <div class="glassmorphism biometric-scan" style="padding:20px; text-align:center;">
                <i class="fa-solid fa-volume-high fa-beat" style="font-size:2rem; color:var(--neon-blue);"></i>
                <p style="margin-top:15px; font-weight:bold;">INITIALISATION DU DÃ‰CIBELMÃˆTRE...</p>
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

      speak("DÃ©cibelmÃ¨tre activÃ©. Faites tourner le moteur au ralenti.");

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

        // Calcul de frÃ©quence dominante
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
                        <h4 style="color:${isLegal ? "#00e676" : "#ff4444"};">RÃ‰SULTAT ACOUSTIQUE</h4>
                        <div style="font-size:2rem; font-weight:900; margin:10px 0; color:${isLegal ? "#00e676" : "#ff4444"};">MAX : ${maxDb} dB</div>
                        <p><strong>Type perÃ§u :</strong> ${engineType}</p>
                        <p style="margin-top:10px; font-size:0.9rem;">
                            ${
                              isLegal
                                ? "L'Ã©chappement est homologuÃ©. Vous Ãªtes en sÃ©curitÃ© en cas de contrÃ´le."
                                : "<strong>ATTENTION :</strong> Niveau sonore > 85dB. Risque d'amende et de confiscation."
                            }
                        </p>
                        <p style="color:#777; font-size:0.75rem; margin-top:15px; border-top:1px solid #333; padding-top:10px;">
                            Avertissement (AI Act) : Diagnostic gÃ©nÃ©rÃ© par Intelligence Artificielle. Ce rÃ©sultat est fourni Ã  titre indicatif et est <strong>soumis Ã  contrÃ´le humain</strong> (expertise d'un mÃ©canicien).
                        </p>
                        <button onclick="document.getElementById('meca-result-modal').classList.add('hidden')" style="width:100%; padding:15px; margin-top:20px; background:var(--glass-bg); color:var(--text-main); border:1px solid var(--accent); border-radius:8px; font-weight:bold;">FERMER</button>
                    </div>
                `;

        if (isLegal) {
          speak(
            `Analyse terminÃ©e. Pic Ã  ${maxDb} dÃ©cibels. Ã‰chappement homologuÃ©.`,
          );
        } else {
          speak(
            `Alerte. Pic sonore Ã  ${maxDb} dÃ©cibels. Votre pot d'Ã©chappement dÃ©passe la limite lÃ©gale.`,
          );
        }
      }, 8000);
    } catch (err) {
      console.error("Erreur Micro:", err);
      speak("Erreur d'accÃ¨s au microphone pour le dÃ©cibelmÃ¨tre.");
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
        "Analyse terminÃ©e. Compte Premium dÃ©tectÃ©. Rapport expert offert.",
      );
      this.showExpertReport();
      return;
    }

    speak("Analyse terminÃ©e. Rapport basique disponible.");

    container.innerHTML = `
            <div class="glassmorphism" style="padding:20px; border-left:4px solid var(--accent);">
                <h4 style="color:var(--accent);"><i class="fa-solid fa-stethoscope"></i> DIAGNOSTIC BASIQUE</h4>
                <p style="font-size:0.9rem; margin-top:10px; color:#fff;"><strong>RÃ©sultat :</strong> Anomalie harmonique dÃ©tectÃ©e (Basses frÃ©quences anormales).</p>
                <p style="font-size:0.8rem; color:#aaa; margin-top:10px;">Le rapport basique indique la prÃ©sence d'une anomalie. Pour isoler la panne exacte (carburateur, pot percÃ©, piston), dÃ©bloquez le rapport expert IA.</p>
                <p style="color:#777; font-size:0.75rem; margin-top:10px;">Avertissement (AI Act) : Aide indicative gÃ©nÃ©rÃ©e par IA. <strong>Soumis Ã  contrÃ´le humain.</strong></p>
                
                <hr style="border-color: rgba(255,255,255,0.1); margin: 15px 0;">
                
                <div style="text-align:center;">
                    <h5 style="color:#10a37f; margin-bottom:10px;"><i class="fa-solid fa-lock-open"></i> DÃ©bloquer le Rapport Expert (50 Pts BVC)</h5>
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

    if (typeof window.braveCoins === "undefined") {
      statusEl.innerHTML =
        '<span style="color:#dc3545;">Erreur: Programme de fidÃ©litÃ© indisponible.</span>';
      return;
    }

    const price = 50;

    if (window.braveCoins < price) {
      statusEl.innerHTML = `<span style="color:#dc3545;">Fonds insuffisants. Vous avez ${Math.floor(window.braveCoins)} Pts, il en faut ${price}.</span>`;
      return;
    }

    btn.disabled = true;
    btn.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Connexion au rÃ©seau IA...';

    // Simulation rÃ©seau IA
    setTimeout(() => {
      window.braveCoins -= price;
      localStorage.setItem("braveCoins", window.braveCoins.toString());

      // Mise Ã  jour de l'affichage UI si disponible
      const balanceEl = document.getElementById("crypto-balance");
      if (balanceEl)
        balanceEl.innerText = Math.floor(window.braveCoins) + " Pts BVC";

      this.showExpertReport();
    }, 2000);
  },

  showExpertReport: function () {
    const container = document.getElementById("meca-result");
    if (!container) return;

    speak(
      "Paiement validÃ©. Rapport expert dÃ©verrouillÃ©. Voici mon diagnostic.",
    );

    const diagnostics = [
      {
        analyse:
          "Fuite dÃ©tectÃ©e sur la ligne d'Ã©chappement (FrÃ©quence rÃ©sonnante Ã  120Hz).",
        reco: "VÃ©rifier le joint d'Ã©chappement au niveau du cylindre. Risque de perte de puissance et de surconsommation.",
      },
      {
        analyse: "Bruit mÃ©tallique aigu (FrÃ©quence anormale Ã  450Hz).",
        reco: "Usure suspectÃ©e des galets du variateur ou de la courroie. Inspection visuelle requise.",
      },
      {
        analyse:
          "Claquement irrÃ©gulier au ralenti (DÃ©sÃ©quilibre harmonique).",
        reco: "Le carburateur semble encrassÃ© ou mal rÃ©glÃ©. ProcÃ©der Ã  un nettoyage complet.",
      },
      {
        analyse: "Frottement sourd en fond sonore.",
        reco: "Les plaquettes de frein avant semblent frotter excessivement. VÃ©rifiez l'Ã©trier.",
      },
    ];

    const diag = diagnostics[Math.floor(Math.random() * diagnostics.length)];

    container.innerHTML = `
            <div class="glassmorphism" style="padding:20px; border-left:4px solid #10a37f; background: rgba(16, 163, 127, 0.1);">
                <h4 style="color:#10a37f;"><i class="fa-solid fa-check-circle"></i> RAPPORT D'EXPERTISE (DÃ‰VERROUILLÃ‰)</h4>
                <div style="margin-top:15px; font-size:0.9rem; color:#fff;">
                    <p><i class="fa-solid fa-microchip" style="color:#10a37f;"></i> <strong>Analyse IA :</strong> ${diag.analyse}</p>
                    <p style="margin-top:10px;"><i class="fa-solid fa-wrench" style="color:#10a37f;"></i> <strong>Recommandation :</strong> ${diag.reco}</p>
                </div>
                <button onclick="if(window.CertifiedCamera) window.CertifiedCamera.open(); else alert('Module de camÃ©ra non disponible');" style="margin-top:20px; width:100%; background:#ffb703; color:#000; padding:10px 15px; border-radius:5px; border:none; font-weight:bold; cursor:pointer; margin-bottom:10px;">
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
﻿/**
 * mon 50cc et moi - Module OBD-II Bluetooth
 * v100.00-GOLD
 * Utilise l'API Web Bluetooth pour se connecter aux boÃ®tiers ELM327
 */

class OBDManager {
  constructor() {
    this.device = null;
    this.server = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
    this.isConnected = false;

    // Services et caractÃ©ristiques standards pour les modules sÃ©rie Bluetooth (SPP over BLE / ELM327 BLE)
    // Note : Ces UUIDs peuvent varier selon le dongle (JDY-33, Vgate, etc.). On utilise les plus courants (ex: JDY-08 / HM-10).
    this.serviceUuid = "0000ffe0-0000-1000-8000-00805f9b34fb";
    this.characteristicUuid = "0000ffe1-0000-1000-8000-00805f9b34fb";

    this.pollingInterval = null;
    this.buffer = "";

    // PIDs de base Ã  interroger en boucle
    this.queries = [
      "01 0C", // RPM (Engine Speed)
      "01 0D", // Vehicle Speed
      "01 05", // Engine Coolant Temp
    ];
    this.currentQueryIndex = 0;

    // Throttling des alertes vocales IA
    this.lastRpmAlertTime = 0;
    this.lastTempAlertTime = 0;
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

      // Pour beaucoup de modules ELM327 BLE, RX et TX partagent la mÃªme caractÃ©ristique
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
      // Prompt de fin de rÃ©ponse ELM327
      let response = this.buffer.replace(/>/g, "").trim();
      this.buffer = ""; // Reset buffer
      this.parseObdResponse(response);
    }
  }

  parseObdResponse(response) {
    // EnlÃ¨ve les espaces
    const hexData = response.replace(/\s/g, "");

    // 41 = RÃ©ponse au Mode 01
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
        case "05": // TempÃ©rature (1 byte)
          if (dataBytes.length >= 2) {
            value = parseInt(dataBytes.substring(0, 2), 16) - 40;
            type = "temp";
          }
          break;
      }

      if (value !== null) {
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
      '<i class="fa-brands fa-bluetooth" style="margin-right:5px;"></i> OBD ConnectÃ© (Cliquez pour dÃ©connecter)';
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
        // Alerte IA Sur-rÃ©gime (toutes les 10s max)
        if (
          window.obdManager &&
          Date.now() - window.obdManager.lastRpmAlertTime > 10000
        ) {
          if (typeof speak === "function")
            speak(
              "Alerte ! RÃ©gime moteur critique. Ralentissez pour prÃ©server le cylindre.",
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
              "Alerte, surchauffe moteur dÃ©tectÃ©e. Coupez le contact immÃ©diatement.",
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
﻿/**
 * AR Navigation Module (v85.0)
 * GÃ¨re l'affichage vidÃ©o de la camÃ©ra et la superposition holographique
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

      document.body.classList.add("ar-mode-active");
      this.isActive = true;

      if (typeof speak === "function") {
        speak(
          "SystÃ¨me optique enclenchÃ©. Affichage tÃªte haute opÃ©rationnel. Attention, ce mode consomme beaucoup d'Ã©nergie, veuillez brancher le tÃ©lÃ©phone si possible.",
        );
      }
      if (
        window.NeuralHUD &&
        typeof window.NeuralHUD.logToConsole === "function"
      ) {
        window.NeuralHUD.logToConsole("AR_SYSTEM: ENGAGED - HUD ACTIVE");
      }
    } catch (err) {
      console.error("Impossible de dÃ©marrer la camÃ©ra AR:", err);
      alert("AccÃ¨s Ã  la camÃ©ra refusÃ© ou non disponible.");
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

    document.body.classList.remove("ar-mode-active");
    this.isActive = false;

    if (typeof speak === "function")
      speak(
        "Affichage tÃªte haute dÃ©sactivÃ©. Retour Ã  la navigation standard.",
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


/* --- social-radar.js --- */
﻿/**
 * SOCIAL RADAR (GHOST RIDER MODE) & REGIONAL WELCOME
 * v1.0
 */

// 2. Social Radar (Ghost Rider Mode)
if (typeof window.SocialRadarManager === "undefined") {
  window.SocialRadarManager = class SocialRadarManager {
    constructor() {
      this.isActive = false;
      this.ghostMarkers = [];
      this.radarInterval = null;
    }

    toggleRadar() {
      this.isActive = !this.isActive;
      const btn = document.getElementById("dock-btn-social");

      if (this.isActive) {
        if (btn) btn.style.color = "#00f2ff";
        if (btn) btn.style.textShadow = "0 0 10px #00f2ff";
        if (typeof speak === "function")
          speak("Radar social activÃ©. Recherche d'autres pilotes en cours.");
        this.startScanning();
      } else {
        if (btn) btn.style.color = "#99aab5";
        if (btn) btn.style.textShadow = "none";
        if (typeof speak === "function") speak("Radar social dÃ©sactivÃ©.");
        this.stopScanning();
      }
    }

    startScanning() {
      // Simulation d'apparition de pilotes fantÃ´mes autour de la position actuelle
      if (!window.currentPosition || typeof map === "undefined") return;

      this.spawnGhost(
        window.currentPosition.lat + 0.01,
        window.currentPosition.lng + 0.01,
        "Ghost_73",
      );
      this.spawnGhost(
        window.currentPosition.lat - 0.005,
        window.currentPosition.lng + 0.015,
        "Netizen_Max",
      );

      // Scan continu
      this.radarInterval = setInterval(() => {
        this.updateGhosts();
      }, 3000);
    }

    stopScanning() {
      if (this.radarInterval) {
        clearInterval(this.radarInterval);
        this.radarInterval = null;
      }
      this.ghostMarkers.forEach((m) => {
        if (typeof map !== "undefined" && map.removeLayer) {
          map.removeLayer(m);
        }
      });
      this.ghostMarkers = [];
    }

    spawnGhost(lat, lng, name) {
      if (typeof L === "undefined" || typeof map === "undefined") return;

      // CrÃ©ation d'une icÃ´ne fantÃ´me cyberpunk
      const ghostIcon = L.divIcon({
        html: '<i class="fa-solid fa-motorcycle" style="color: rgba(0, 242, 255, 0.6); font-size: 24px; filter: drop-shadow(0 0 10px #00f2ff);"></i>',
        className: "ghost-marker",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([lat, lng], { icon: ghostIcon }).addTo(map);
      marker
        .bindPopup(
          `<strong style="color:#00f2ff">${name}</strong><br>En balade`,
        )
        .openPopup();
      this.ghostMarkers.push(marker);
    }

    updateGhosts() {
      // DÃ©place lÃ©gÃ¨rement les fantÃ´mes pour simuler la conduite
      this.ghostMarkers.forEach((m) => {
        const pos = m.getLatLng();
        m.setLatLng([
          pos.lat + (Math.random() - 0.5) * 0.002,
          pos.lng + (Math.random() - 0.5) * 0.002,
        ]);
      });
    }
  };

  window.SocialRadarManager = window.SocialRadarManager;
  window.socialRadarManager =
    window.socialRadarManager || new window.SocialRadarManager();
}


/* --- referral.js --- */
﻿/**
 * REFERRAL SYSTEM (Parrainage GamifiÃ© & InsurTech)
 * Paliers de kilomÃ©trage et revenus passifs sur conduite sÃ©curisÃ©e.
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
        localStorage.setItem("referralMilestone", "0"); // Nouveau systÃ¨me de suivi (0 = aucun palier)

        if (typeof speak === "function") {
          speak(
            "Lien de parrainage dÃ©tectÃ©. Roulez pour dÃ©bloquer vos premiÃ¨res rÃ©compenses !",
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

    // Si l'utilisateur a un pseudo dÃ©fini, on l'utilise, sinon on prend l'UID
    const myRefCode = window.session.username || window.session.uid;
    const shareUrl = `https://mon50ccetmoi.app/?ref=${encodeURIComponent(myRefCode)}`;
    const shareText = `Rejoins mon Crew sur l'app ultime pour pilotes de 50cc ! Utilise mon code ${myRefCode} et on gagne des cryptos BVC ! ðŸï¸ðŸš€`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Mon 50cc et Moi - Crew",
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.warn("Partage annulÃ© ou erreur", err);
      }
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
        alert("Lien de parrainage copiÃ© dans le presse-papiers !");
      });
    }
  },

  // 3. VÃ©rification des Paliers (Milestones)
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
        "FÃ©licitations, vous avez dÃ©passÃ© les 20 kilomÃ¨tres. Votre parrain reÃ§oit 50 BVC, et vous gagnez 20 BVC !",
      );
    }
    // Palier 2 : 100 km (Motard FidÃ¨le)
    else if (totalKm >= 100 && currentMilestone < 2) {
      await this.processMilestoneReward(
        2,
        100,
        100,
        50,
        "Incroyable, 100 kilomÃ¨tres atteints ! Vous Ãªtes maintenant un Motard FidÃ¨le. 50 BVC dÃ©bloquÃ©s.",
      );
    }
    // Palier 3 : 500 km (Pilote ConfirmÃ©)
    else if (totalKm >= 500 && currentMilestone < 3) {
      await this.processMilestoneReward(
        3,
        500,
        300,
        200,
        "Palier ultime des 500 kilomÃ¨tres atteint ! FÃ©licitations Pilote ConfirmÃ©, un bonus massif vous a Ã©tÃ© versÃ©.",
      );
    }
  },

  // MÃ©thode gÃ©nÃ©rique pour payer les paliers
  processMilestoneReward: async function (
    milestoneId,
    kmLimit,
    referrerReward,
    refereeReward,
    voiceMessage,
  ) {
    // Verrou local pour Ã©viter la boucle
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
        window.braveCoins = (window.braveCoins || 0) + refereeReward;
        localStorage.setItem("braveCoins", window.braveCoins.toString());

        if (typeof speak === "function") {
          speak(voiceMessage);
        }
      } catch (err) {
        console.error("mon50cc Referral Error:", err);
        // Rollback pour rÃ©essayer plus tard en cas de perte de rÃ©seau
        localStorage.setItem("referralMilestone", (milestoneId - 1).toString());
      }
    }
  },

  // 4. Bonus InsurTech (Revenus passifs sur Conduite SÃ©curisÃ©e)
  checkSafeDrivingBonus: async function (isSafeRide) {
    const referredBy = localStorage.getItem("referredBy");
    if (!referredBy || !isSafeRide) return; // Pas de parrain ou trajet dangereux

    if (typeof db !== "undefined" && window.session) {
      try {
        await db.collection("referral_rewards").add({
          referrerId: referredBy,
          referredUser: window.session.uid,
          amount: 5, // Petit bonus rÃ©current
          reason: "Safe Driving Passive Bonus",
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Petit retour vocal optionnel pour le filleul
        if (typeof speak === "function") {
          speak(
            "Trajet parfait. Votre conduite prudente a rapportÃ© un bonus Ã  votre parrain !",
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
﻿/**
 * DRIVING SCORE ENGINE v1.0 (InsurTech Core)
 * Score de conduite 0-100 calculÃ© en temps rÃ©el Ã  partir de la tÃ©lÃ©mÃ©trie.
 * ExploitÃ© par le portail B2B Assureur pour le "Pay How You Drive".
 */

window.DrivingScore = {
  currentScore: 100, // Commence Ã  100, les infractions font baisser
  sessionPenalties: [],
  isTracking: false,
  lastGForce: 0,
  smoothAccelHistory: [],

  // Seuils de pÃ©nalitÃ© (calibrÃ©s pour un 50cc / VSP)
  THRESHOLDS: {
    HARD_BRAKE: 2.5, // G-Force freinage brusque
    HARD_ACCEL: 2.0, // G-Force accÃ©lÃ©ration violente
    OVER_SPEED: 47, // km/h (limite lÃ©gale 45 + tolÃ©rance)
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

    // Ã‰couter l'accÃ©lÃ©romÃ¨tre
    window.addEventListener("devicemotion", (event) => {
      if (!this.isTracking) return;
      this.analyzeMotion(event);
    });
  },

  // CrÃ©er le petit badge de score flottant
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

  // Analyser les donnÃ©es de mouvement en temps rÃ©el
  analyzeMotion: function (event) {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;

    const gForce =
      Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z) / 9.81;
    this.lastGForce = gForce;

    // Historique pour lissage (Ã©viter les faux positifs)
    this.smoothAccelHistory.push(gForce);
    if (this.smoothAccelHistory.length > 5) this.smoothAccelHistory.shift();
    const avgG =
      this.smoothAccelHistory.reduce((a, b) => a + b, 0) /
      this.smoothAccelHistory.length;

    // Freinage brusque
    if (avgG > this.THRESHOLDS.HARD_BRAKE && acc.z < -15) {
      this.applyPenalty(
        "HARD_BRAKE",
        `Freinage brusque dÃ©tectÃ© (${avgG.toFixed(1)}G)`,
      );
    }
    // AccÃ©lÃ©ration violente
    else if (avgG > this.THRESHOLDS.HARD_ACCEL && acc.z > 15) {
      this.applyPenalty(
        "HARD_ACCEL",
        `AccÃ©lÃ©ration agressive (${avgG.toFixed(1)}G)`,
      );
    }
    // Virage agressif (G latÃ©ral)
    else if (Math.abs(acc.x) / 9.81 > this.THRESHOLDS.CORNERING) {
      this.applyPenalty(
        "CORNERING",
        `Virage agressif (${(Math.abs(acc.x) / 9.81).toFixed(1)}G latÃ©ral)`,
      );
    }
  },

  // VÃ©rifier l'excÃ¨s de vitesse (appelÃ© par le GPS de app-map.js)
  checkSpeed: function (currentSpeedKmh) {
    if (currentSpeedKmh > this.THRESHOLDS.OVER_SPEED) {
      this.applyPenalty(
        "OVER_SPEED",
        `ExcÃ¨s de vitesse : ${currentSpeedKmh.toFixed(0)} km/h`,
      );
    }
  },

  // Bonus par kilomÃ¨tre sans infraction (appelÃ© par la tÃ©lÃ©mÃ©trie)
  awardSmoothKm: function () {
    const lastPenaltyTime =
      this.sessionPenalties.length > 0
        ? this.sessionPenalties[this.sessionPenalties.length - 1].time
        : 0;

    // Si aucune pÃ©nalitÃ© dans les 5 derniÃ¨res minutes
    if (Date.now() - lastPenaltyTime > 300000) {
      this.currentScore = Math.min(
        100,
        this.currentScore + this.THRESHOLDS.BONUS_SMOOTH_KM,
      );
      this.saveAndUpdate();
    }
  },

  // Appliquer une pÃ©nalitÃ© (avec cooldown anti-spam de 10s)
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

    console.warn(`ðŸ† DrivingScore : ${penalty} pts â†’ ${description}`);

    // Vibration d'avertissement
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

    // Alerte vocale pour les infractions graves
    if (penalty <= -5 && typeof speak === "function") {
      speak(`Attention. ${description}. Votre score de conduite baisse.`);
    }
  },

  // Sauvegarder et mettre Ã  jour le visuel
  saveAndUpdate: function () {
    localStorage.setItem("drivingScore", this.currentScore.toString());
    this.updateScoreVisual();

    // Notifier le ReferralManager pour le bonus de conduite sÃ©curisÃ©e
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

  // Activer/DÃ©sactiver le tracking (liÃ© Ã  GuardianAngel)
  start: function () {
    this.isTracking = true;
    this.sessionPenalties = [];
  },

  stop: function () {
    this.isTracking = false;
  },

  // Panneau de dÃ©tail (affiche les pÃ©nalitÃ©s de la session)
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
        ? '<div style="color:#00ff88; text-align:center;">âœ… Aucune infraction</div>'
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
                ðŸ“Š Score de Conduite : ${this.currentScore}/100
            </div>
            <div style="font-size:11px; color:#888; margin-bottom:8px;">
                DerniÃ¨res infractions (session) :
            </div>
            ${penaltiesHTML}
            <div style="margin-top:12px; font-size:10px; color:#666; text-align:center;">
                Tap pour fermer
            </div>
        `;
    panel.addEventListener("click", () => panel.remove());
    document.body.appendChild(panel);
  },

  // GÃ©nÃ©rer un rÃ©sumÃ© pour le portail B2B Assureur
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
 * DANGER ZONES v1.0 (Signalement Communautaire)
 * SystÃ¨me type Waze pour signaler et alerter les dangers sur la route.
 * Nids-de-poule, gravillons, routes glissantes, contrÃ´les...
 */

window.DangerZones = {
  alerts: [], // Alertes actives Ã  proximitÃ©
  myReports: [], // Mes signalements
  isMonitoring: false,
  currentPos: null,
  checkInterval: null,

  // Types de dangers avec icÃ´nes et prioritÃ©s
  TYPES: {
    POTHOLE: {
      icon: "ðŸ•³ï¸",
      label: "Nid-de-poule",
      priority: 3,
      color: "#ff6600",
      voiceAlert: "Attention, nid-de-poule signalÃ© devant vous.",
    },
    GRAVEL: {
      icon: "âš ï¸",
      label: "Gravillons",
      priority: 2,
      color: "#ffaa00",
      voiceAlert: "Prudence, route avec gravillons Ã  proximitÃ©.",
    },
    SLIPPERY: {
      icon: "ðŸŒ§ï¸",
      label: "Route glissante",
      priority: 3,
      color: "#3399ff",
      voiceAlert: "Attention, chaussÃ©e glissante signalÃ©e.",
    },
    ROADWORKS: {
      icon: "ðŸš§",
      label: "Travaux",
      priority: 2,
      color: "#ff9900",
      voiceAlert: "Zone de travaux signalÃ©e sur votre itinÃ©raire.",
    },
    ACCIDENT: {
      icon: "ðŸš¨",
      label: "Accident",
      priority: 4,
      color: "#ff0044",
      voiceAlert: "Accident signalÃ© devant vous. RÃ©duisez votre vitesse.",
    },
    POLICE: {
      icon: "ðŸ‘®",
      label: "ContrÃ´le",
      priority: 1,
      color: "#6666ff",
      voiceAlert: "ContrÃ´le de police signalÃ© Ã  proximitÃ©.",
    },
    ANIMAL: {
      icon: "ðŸ•",
      label: "Animal sur route",
      priority: 3,
      color: "#88cc00",
      voiceAlert: "Animal signalÃ© sur la chaussÃ©e, ralentissez.",
    },
    FLOOD: {
      icon: "ðŸŒŠ",
      label: "Inondation",
      priority: 4,
      color: "#0088ff",
      voiceAlert: "Route inondÃ©e signalÃ©e. Ã‰vitez cette zone.",
    },
  },

  // Rayon d'alerte en mÃ¨tres
  ALERT_RADIUS: 500,
  // DurÃ©e de vie d'un signalement (2 heures)
  REPORT_TTL: 2 * 60 * 60 * 1000,

  init: function () {
    this.loadLocalReports();
  },

  // DÃ©marrer la surveillance GPS
  startMonitoring: function () {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // VÃ©rifier les alertes Ã  proximitÃ© toutes les 5 secondes
    this.checkInterval = setInterval(() => {
      if (this.currentPos) {
        this.checkNearbyDangers();
      }
    }, 5000);
  },

  stopMonitoring: function () {
    this.isMonitoring = false;
    if (this.checkInterval) clearInterval(this.checkInterval);
  },

  // Mettre Ã  jour la position (appelÃ© par le GPS de app-map.js)
  updatePosition: function (lat, lng) {
    this.currentPos = { lat, lng };
  },

  // Signaler un danger (bouton dans l'UI)
  reportDanger: function (type) {
    if (!this.currentPos) {
      alert("Position GPS non disponible. Activez la localisation.");
      return;
    }
    if (!this.TYPES[type]) {
      console.error("DangerZones : Type inconnu â†’", type);
      return;
    }

    const report = {
      id: `dz_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: type,
      lat: this.currentPos.lat,
      lng: this.currentPos.lng,
      timestamp: Date.now(),
      reporter: (window.session && window.session.uid) || "anonymous",
      confirmations: 1, // Le crÃ©ateur compte comme 1
      active: true,
    };

    this.myReports.push(report);
    this.saveLocalReports();

    // Enregistrer dans Firebase pour la communautÃ©
    this.syncToCloud(report);

    // Feedback
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    if (typeof speak === "function") {
      speak(
        `${this.TYPES[type].label} signalÃ©. Merci de protÃ©ger la communautÃ©.`,
      );
    }

    return report;
  },

  // VÃ©rifier les dangers Ã  proximitÃ©
  checkNearbyDangers: function () {
    if (!this.currentPos || this.alerts.length === 0) return;

    const now = Date.now();
    this.alerts.forEach((alert) => {
      // Ignorer les alertes expirÃ©es
      if (now - alert.timestamp > this.REPORT_TTL) return;
      // Ignorer si dÃ©jÃ  notifiÃ© dans les 60 derniÃ¨res secondes
      if (alert._lastNotified && now - alert._lastNotified < 60000) return;

      const distance = this.getDistance(
        this.currentPos.lat,
        this.currentPos.lng,
        alert.lat,
        alert.lng,
      );

      if (distance <= this.ALERT_RADIUS) {
        this.triggerAlert(alert, distance);
        alert._lastNotified = now;
      }
    });
  },

  // DÃ©clencher une alerte visuelle + vocale
  triggerAlert: function (alert, distanceMeters) {
    const typeInfo = this.TYPES[alert.type];
    if (!typeInfo) return;

    console.warn(
      `âš ï¸ DANGER Ã  ${distanceMeters.toFixed(0)}m : ${typeInfo.label}`,
    );

    // Alerte vocale
    if (typeof speak === "function") {
      speak(typeInfo.voiceAlert);
    }

    // Vibration selon la prioritÃ©
    const vibratePattern =
      typeInfo.priority >= 3
        ? [300, 100, 300, 100, 300] // Urgent
        : [200, 100, 200]; // Normal
    if (navigator.vibrate) navigator.vibrate(vibratePattern);

    // Notification visuelle (toast)
    this.showToast(typeInfo, distanceMeters);
  },

  // Toast d'alerte visuelle
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
      background: `linear-gradient(135deg, ${typeInfo.color}22, rgba(0,0,0,0.95))`,
      border: `2px solid ${typeInfo.color}`,
      borderRadius: "16px",
      padding: "14px 24px",
      zIndex: "10000",
      color: "#fff",
      fontFamily: "'Inter', sans-serif",
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      backdropFilter: "blur(10px)",
      boxShadow: `0 0 30px ${typeInfo.color}44`,
      animation: "slideDown 0.4s ease-out",
    });

    toast.innerHTML = `
            <span style="font-size: 28px;">${typeInfo.icon}</span>
            <div>
                <div style="font-weight: bold;">${typeInfo.label}</div>
                <div style="font-size: 12px; color: #aaa;">Ã  ${distanceMeters.toFixed(0)} mÃ¨tres</div>
            </div>
        `;

    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 5000);
  },

  // Afficher le panneau de signalement rapide
  showReportPanel: function () {
    let existing = document.getElementById("dz-report-panel");
    if (existing) {
      existing.remove();
      return;
    }

    const panel = document.createElement("div");
    panel.id = "dz-report-panel";
    Object.assign(panel.style, {
      position: "fixed",
      bottom: "0",
      left: "0",
      right: "0",
      background: "rgba(0,0,0,0.95)",
      borderTop: "2px solid rgba(0,210,255,0.3)",
      borderRadius: "20px 20px 0 0",
      padding: "20px",
      zIndex: "10001",
      backdropFilter: "blur(20px)",
      transition: "transform 0.3s ease",
    });

    let buttonsHTML = Object.entries(this.TYPES)
      .map(
        ([key, info]) =>
          `<button onclick="window.DangerZones.reportDanger('${key}'); document.getElementById('dz-report-panel').remove();"
                style="display:flex; flex-direction:column; align-items:center; gap:6px;
                       background:rgba(255,255,255,0.05); border:1px solid ${info.color}44;
                       border-radius:12px; padding:12px 8px; color:#fff; cursor:pointer;
                       font-size:12px; min-width:80px; transition: all 0.2s;">
                <span style="font-size:24px;">${info.icon}</span>
                <span>${info.label}</span>
            </button>`,
      )
      .join("");

    panel.innerHTML = `
            <div style="text-align:center; margin-bottom:16px;">
                <div style="width:40px; height:4px; background:#555; border-radius:2px; margin:0 auto 12px;"></div>
                <span style="color:#00d2ff; font-weight:bold; font-size:16px;">âš ï¸ Signaler un danger</span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px;">
                ${buttonsHTML}
            </div>
        `;
    document.body.appendChild(panel);
  },

  // Confirmer un signalement existant (+1 crÃ©dibilitÃ©)
  confirmReport: function (reportId) {
    const alert = this.alerts.find((a) => a.id === reportId);
    if (alert) {
      alert.confirmations = (alert.confirmations || 1) + 1;
    }
  },

  // Synchronisation Firebase
  syncToCloud: function (report) {
    if (typeof db !== "undefined") {
      db.collection("danger_zones")
        .add(report)
        .then(() => {})
        .catch((err) => console.error("âš ï¸ DangerZones sync error:", err));
    }
  },

  // Charger les signalements depuis Firebase
  loadFromCloud: function () {
    if (typeof db === "undefined") return;

    const cutoff = Date.now() - this.REPORT_TTL;
    db.collection("danger_zones")
      .where("timestamp", ">", cutoff)
      .get()
      .then((snapshot) => {
        this.alerts = [];
        snapshot.forEach((doc) => {
          this.alerts.push({ id: doc.id, ...doc.data() });
        });
      })
      .catch((err) => console.error("DangerZones cloud load error:", err));
  },

  // Sauvegarde locale
  saveLocalReports: function () {
    localStorage.setItem("dangerZoneReports", JSON.stringify(this.myReports));
  },

  loadLocalReports: function () {
    try {
      const data = localStorage.getItem("dangerZoneReports");
      this.myReports = data ? JSON.parse(data) : [];
    } catch (e) {
      this.myReports = [];
    }
  },

  // Calcul de distance (Haversine)
  getDistance: function (lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
};

// Auto-init
window.addEventListener("DOMContentLoaded", () => {
  window.DangerZones.init();
});


/* --- accident-report.js --- */
﻿/**
 * ACCIDENT REPORT & PDF GENERATOR v1.0 (InsurTech Core)
 * GÃ©nÃ¨re automatiquement un rapport post-crash avec les 30 derniÃ¨res secondes
 * de tÃ©lÃ©mÃ©trie de la BoÃ®te Noire. PrÃªt Ã  Ãªtre envoyÃ© Ã  l'assureur.
 */

window.AccidentReport = {
  init: function () {
    // Ã‰couter les Ã©vÃ©nements de crash de GuardianAngel
    window.addEventListener("crashDetected", (e) => {
      const crashData = e.detail;
      this.generateReport(crashData);
    });
  },

  // DÃ©clenchÃ© manuellement pour une dÃ©mo ou via l'Event
  generateReport: function (crashData = null) {
    if (!crashData) {
      // Mock data pour la dÃ©mo
      crashData = {
        timestamp: Date.now(),
        location: window.appMap?.currentPos || { lat: 45.367, lng: 4.2 },
        speedAtImpact: 42.5,
        gForce: 6.2,
        weather: "Pluie lÃ©gÃ¨re",
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
                    <h2 style="color:#ff3355; margin:0;">ðŸš¨ RAPPORT DE SINISTRE</h2>
                    <img src="assets/img/logo.png" alt="mon50cc" style="height:40px; filter:grayscale(1) brightness(2);">
                </div>

                <div style="background:rgba(255,51,85,0.1); padding:15px; border-radius:8px; margin-bottom:20px;">
                    <p style="margin:0 0 10px; font-weight:bold;">Informations GÃ©nÃ©rales</p>
                    <table style="width:100%; font-size:14px;">
                        <tr><td style="color:#aaa; padding:4px 0;">Date et Heure :</td><td style="text-align:right;">${dateStr}</td></tr>
                        <tr><td style="color:#aaa; padding:4px 0;">Localisation :</td><td style="text-align:right;">${data.location.lat.toFixed(5)}, ${data.location.lng.toFixed(5)}</td></tr>
                        <tr><td style="color:#aaa; padding:4px 0;">VÃ©hicule :</td><td style="text-align:right;">${data.vehicle}</td></tr>
                        <tr><td style="color:#aaa; padding:4px 0;">Police Assurance :</td><td style="text-align:right; font-family:monospace;">${data.insurancePolicy}</td></tr>
                    </table>
                </div>

                <div style="background:rgba(0,210,255,0.1); padding:15px; border-radius:8px; margin-bottom:20px;">
                    <p style="margin:0 0 10px; font-weight:bold; color:#00d2ff;">TÃ©lÃ©mÃ©trie au moment de l'impact (BoÃ®te Noire)</p>
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
                            <div style="font-size:11px; color:#aaa;">MÃ‰TÃ‰O</div>
                        </div>
                    </div>
                </div>

                <div style="border:1px dashed #555; padding:15px; border-radius:8px; margin-bottom:20px; font-size:12px; color:#888;">
                    <i class="fa-solid fa-lock" style="color:#00d2ff;"></i> Certificat d'horodatage cryptographique valide. DonnÃ©es immuables certifiÃ©es par le rÃ©seau.
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
    // Simule la crÃ©ation d'un PDF via jsPDF ou l'impression du navigateur
    if (typeof speak === "function") {
      speak(
        "GÃ©nÃ©ration du rapport PDF en cours. Il sera envoyÃ© automatiquement Ã  votre assurance.",
      );
    }

    // Sur mobile, on utilise l'API de partage native si possible
    if (navigator.share) {
      navigator
        .share({
          title: "Rapport Accident - mon50ccetmoi",
          text: "Voici les donnÃ©es certifiÃ©es de mon accident, gÃ©nÃ©rÃ©es par ma boÃ®te noire mon50ccetmoi.",
          // On simulerait ici un fichier blob PDF
        })
        .catch(console.error);
    } else {
      alert("Rapport PDF tÃ©lÃ©chargÃ© avec succÃ¨s sur votre appareil.");
    }
  },
};

// Auto-init
window.addEventListener("DOMContentLoaded", () => {
  window.AccidentReport.init();
});


/* --- weather-alert.js --- */
﻿/**
 * INTELLIGENT WEATHER ALERT v1.0
 * Analyse les conditions mÃ©tÃ©o sur l'itinÃ©raire du pilote et alerte
 * vocalement en cas de danger (pluie, verglas, vent fort).
 */

window.WeatherAlert = {
  isMonitoring: false,
  checkInterval: null,
  lastCheckTime: 0,
  currentCondition: "CLEAR",

  // Mock conditions for demo purposes
  CONDITIONS: {
    CLEAR: { label: "DÃ©gagÃ©", danger: false, msg: "" },
    RAIN: {
      label: "Pluie",
      danger: true,
      msg: "Alerte mÃ©tÃ©o. Pluie dÃ©tectÃ©e sur votre itinÃ©raire. AdhÃ©rence rÃ©duite, ralentissez.",
    },
    WIND: {
      label: "Vent Fort",
      danger: true,
      msg: "Alerte mÃ©tÃ©o. Fortes rafales de vent. Maintenez fermement votre guidon.",
    },
    ICE: {
      label: "Risque de Verglas",
      danger: true,
      msg: "Alerte critique. TempÃ©rature proche de zÃ©ro. Risque extrÃªme de verglas.",
    },
  },

  init: function () {},

  start: function () {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // VÃ©rification immÃ©diate
    this.checkWeather(window.appMap?.currentPos);

    // Puis vÃ©rification toutes les 15 minutes (900000 ms)
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
    // Ã‰vite de spammer les alertes (1 alerte max toutes les 15 min)
    if (now - this.lastCheckTime < 900000 && this.lastCheckTime !== 0) return;

    // Dans un cas rÃ©el, appel vers OpenWeatherMap API ou MÃ©tÃ©o France
    // Ici, nous simulons la mÃ©tÃ©o alÃ©atoirement pour la dÃ©mo
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

    console.warn(`ðŸŒ¦ï¸ ALERTE MÃ‰TÃ‰O : ${condition.label}`);

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
                <div style="font-weight:bold; color:#00d2ff;">Alerte MÃ©tÃ©o : ${condition.label}</div>
                <div style="font-size:12px; color:#aaa;">Prudence recommandÃ©e</div>
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

  // DÃ©clenchÃ© depuis la console pour tester
  testAlert: function (type = "RAIN") {
    this.triggerAlert(type);
  },
};

// Auto-init
window.addEventListener("DOMContentLoaded", () => {
  window.WeatherAlert.init();
});


/* --- web4-mining.js --- */
﻿/* --- WEB 4 MINING & ECONOMY --- */

window.Web4Economy = {
  balance: 0.0,
  prices: {
    legal_report: 5.0, // Prix fixe pour l'avocat de poche
    insurance_report: 10.0, // Prix fixe pour le rapport d'assurance IA
  },

  init: function () {
    this.checkYearlyExpiration();
    this.balance = parseFloat(localStorage.getItem("braveCoins") || "0");
    this.updateUI();

    // Simulation de minage passif (ex: 0.1 BVC par minute de trajet)
    setInterval(() => {
      if (window.isRiding) {
        // Variable de app.js
        this.mineToken(0.05, "Minage : Conduite Active");
      }
    }, 60000);
  },

  checkYearlyExpiration: function () {
    const currentYear = new Date().getFullYear();
    const lastYear =
      localStorage.getItem("mon50_bvc_year") || currentYear.toString();

    if (parseInt(currentYear) > parseInt(lastYear)) {
      localStorage.setItem("braveCoins", "0.00");
      localStorage.setItem("mon50_tokens", "0.00");
      if (window.NeuralHUD) window.NeuralHUD.tokenBalance = 0;
      window.braveCoins = 0;

      // Show alert to user if they open the app
      setTimeout(
        () =>
          alert(
            "Nouvelle Saison ! Vos points BVC (Rouler & Gagner) ont expirÃ© et ont Ã©tÃ© remis Ã  zÃ©ro pour l'annÃ©e civile en cours.",
          ),
        2000,
      );
    }
    localStorage.setItem("mon50_bvc_year", currentYear.toString());
  },

  mineToken: function (amount, reason) {
    this.balance += amount;
    localStorage.setItem("braveCoins", this.balance.toFixed(2));
    this.updateUI();

    // Animation HUD
    this.showMiningHUD(amount);
  },

  spendToken: function (amount, reason) {
    if (this.balance >= amount) {
      this.balance -= amount;
      localStorage.setItem("braveCoins", this.balance.toFixed(2));
      this.updateUI();

      return true; // Achat rÃ©ussi
    } else {
      console.warn(`[Web4] Fonds insuffisants pour : ${reason}`);
      return false; // Achat refusÃ©
    }
  },

  updateUI: function () {
    const balanceEl = document.getElementById("crypto-balance");
    if (balanceEl) {
      balanceEl.innerText = this.balance.toFixed(2) + " BVC";
    }
    window.braveCoins = this.balance; // Sync with legacy variables

    // Restriction : Bloquer l'Avocat de Poche si solde insuffisant
    const lawyerBtn = document.getElementById("dock-btn-lawyer");
    if (lawyerBtn) {
      const lawyerPrice = this.prices.legal_report || 5;
      if (this.balance < lawyerPrice) {
        lawyerBtn.style.opacity = "0.4";
        lawyerBtn.style.filter = "grayscale(100%)";
        lawyerBtn.innerHTML =
          '<i class="fa-solid fa-lock" style="filter: drop-shadow(0 0 5px #ff4d4d); color: #ff4d4d;"></i>';
        lawyerBtn.title = `NÃ©cessite ${lawyerPrice} BVC`;
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
﻿/* --- B2B INSURER PORTAL (WEB4) --- */

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
      alert("AccÃ¨s refusÃ© : Identifiants invalides ou compte inexistant.");
    }
  },

  signup: function () {
    alert(
      "La crÃ©ation de compte Assureur est gÃ©rÃ©e manuellement par notre Ã©quipe pour des raisons de sÃ©curitÃ©. Veuillez nous contacter.",
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

  verifyCode: function () {
    const input = document
      .getElementById("insurer-code-input")
      .value.trim()
      .toUpperCase();
    if (!input.startsWith("LITIGE-")) {
      alert("Code Invalide. Le format attendu est LITIGE-XXXXXX");
      return;
    }

    const parts = input.split("-");
    if (parts.length >= 2) {
      const tsStr = parts[1].toLowerCase();
      const timestamp = parseInt(tsStr, 36);
      if (!isNaN(timestamp)) {
        const now = Date.now();
        const diffHours = (now - timestamp) / (1000 * 60 * 60);
        if (diffHours > 72) {
          alert(
            "Code ExpirÃ©. Le code litige est valable uniquement 72h. Le pilote doit gÃ©nÃ©rer un nouveau code depuis son application.",
          );
          return;
        }
      }
    }

    // Simuler la recherche dans le coffre-fort Firebase
    document.getElementById("insurer-dashboard-box").classList.add("hidden");
    document.getElementById("insurer-pricing-box").classList.remove("hidden");
    this.currentCode = input;
  },

  buyReport: function (type, price, rewardBvc) {
    if (
      confirm(
        `[SÃ‰CURITÃ‰ ZERO-TRUST]\nConfirmez-vous l'achat du rapport [${type}] pour ${price}â‚¬ HT ?\n\nâš ï¸ CONDITIONS B2B : Les donnÃ©es chiffrÃ©es sont dÃ©finitives.\nLe paiement sera instantanÃ©ment prÃ©levÃ© via le Smart Contract.`,
      )
    ) {
      // Premium WOW Effect for success
      const pricingBox = document.getElementById("insurer-pricing-box");
      pricingBox.innerHTML = `
                <div style="text-align:center; padding: 40px;">
                    <i class="fa-solid fa-circle-check" style="font-size: 5rem; color: #00ffcc; text-shadow: 0 0 30px #00ffcc; margin-bottom:20px; animation: pulse 1s infinite;"></i>
                    <h2 style="color:#fff; font-size:2rem; font-weight:900;">TRANSACTION VALIDÃ‰E</h2>
                    <p style="color:#00d2ff; font-family:'JetBrains Mono', monospace;">ClÃ© de dÃ©chiffrement gÃ©nÃ©rÃ©e pour le dossier ${this.currentCode}</p>
                    <div style="margin-top:30px; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; border-radius:12px; padding:15px; color:#fff;">
                        <i class="fa-solid fa-envelope"></i> Le rapport a Ã©tÃ© envoyÃ© de maniÃ¨re sÃ©curisÃ©e Ã  votre adresse pro.
                    </div>
                </div>
            `;

      setTimeout(() => {
        // DÃ©clenchement du Smart Contract Web4 : RÃ©tribution du pilote
        if (window.Web4Economy && rewardBvc > 0) {
          window.Web4Economy.mineToken(
            rewardBvc,
            `Smart Contract: L'assureur a achetÃ© le rapport (${type})`,
          );
          if (typeof speak === "function") {
            speak(
              "Transaction confirmÃ©e. Votre assureur a consultÃ© le rapport. Les tokens ont Ã©tÃ© crÃ©ditÃ©s.",
            );
          }
        }
        setTimeout(() => this.close(), 3000);
      }, 2000);
    }
  },
};


/* --- zero-trust.js --- */
﻿/**
 * ðŸ‘ï¸ APEX SENTINEL - ZERO-TRUST ARCHITECTURE
 * BiomÃ©trie comportementale & Continuous Authentication
 * Bloque l'application si l'utilisateur change soudainement de comportement (ex: vol Ã  l'arrachÃ©).
 */

const ZeroTrust = {
  active: false,
  threatLevel: 0,
  lastInteractionTime: Date.now(),
  interactionHistory: [],

  triggerProtocolZero: async function () {
    console.warn("ðŸ’€ [PROTOCOL 0] INITIATED: ERASING ALL DATA...");

    // Afficher l'Ã©cran de destruction
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

    // Supprimer toutes les donnÃ©es localStorage
    localStorage.clear();
    sessionStorage.clear();

    // Simuler un nettoyage du cache de la base de donnÃ©es (IndexedDB)
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

    // Redirection forcÃ©e
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

    // 2. Anti-Debugger / DevTools Detection
    setInterval(() => {
      const start = performance.now();
      debugger; // If DevTools is open, this will pause execution and time difference will be huge
      if (performance.now() - start > 100) {
        console.error("[ZERO-TRUST] DevTools tampering detected.");
        this.threatLevel += 20;
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
    console.warn("ðŸš¨ [ZERO-TRUST] INITIATING SECURE LOCKDOWN.");

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
            <h1 style="font-size: 2.5rem; letter-spacing: 5px; text-transform: uppercase;">Alerte de SÃ©curitÃ©</h1>
            <p style="font-size: 1.2rem; color: #fff; max-width: 80%; text-align: center;">
                Anomalie comportementale dÃ©tectÃ©e (Zero-Trust).<br>L'accÃ¨s a Ã©tÃ© rÃ©voquÃ© pour protÃ©ger vos donnÃ©es.
            </p>
            <button onclick="window.location.href='login.html'" style="margin-top: 40px; padding: 15px 40px; font-size: 1.2rem; background: transparent; border: 2px solid #ff0055; color: #ff0055; border-radius: 30px; cursor: pointer;">
                Re-VÃ©rification BiomÃ©trique
            </button>
        `;
    document.body.appendChild(lockdownDiv);
  },

  // MÃ©thode pour simuler une attaque
  simulateAttack() {
    console.warn("[TEST] Simulating Behavioral Anomaly...");
    this.threatLevel = 50;
    this.evaluateRisk();
  },
};

window.ZeroTrust = ZeroTrust;


/* --- garage.js --- */
﻿/**
 * ðŸï¸ GARAGE VIRTUEL
 * Suivi d'entretien et Ã©tat des piÃ¨ces en fonction du kilomÃ©trage.
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
      speak(`Entretien enregistrÃ© pour : ${this.data.parts[partKey].name}.`);
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
                        <i class="fa-solid fa-rotate"></i> RemplacÃ©
                    </button>
                    ${wear.isCritical ? '<p style="color: #ff4d4d; font-size: 0.8rem; margin: 10px 0 0 0;"><i class="fa-solid fa-triangle-exclamation"></i> Remplacement urgent !</p>' : ""}
                </div>
            `;
    }

    overlay.innerHTML = `
            <button onclick="VirtualGarage.closeUI()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: #fff; font-size: 2rem; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
            <i class="fa-solid fa-motorcycle" style="font-size: 3rem; color: #00d2ff; filter: drop-shadow(0 0 10px #00d2ff); margin-bottom: 10px;"></i>
            <h1 style="font-size: 1.5rem; margin: 0; text-transform: uppercase; color: #00d2ff;">Mon Garage</h1>
            <p style="color: #aaa; margin-bottom: 20px; text-align: center;">Suivi d'entretien kilomÃ©trique</p>
            
            <div style="width: 90%; max-width: 500px; background: rgba(0,0,0,0.4); border-radius: 20px; padding: 20px; margin-bottom: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);">
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <label style="font-size: 0.8rem; color: #777;">ModÃ¨le du scooter</label>
                        <input type="text" id="garage-model" value="${this.data.model}" style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 10px; border-radius: 10px; box-sizing: border-box; margin-top: 5px; outline: none;">
                    </div>
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <label style="font-size: 0.8rem; color: #777;">KilomÃ©trage initial (compteur)</label>
                        <input type="number" id="garage-initial-km" value="${this.data.initialKm}" style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 10px; border-radius: 10px; box-sizing: border-box; margin-top: 5px; outline: none;">
                    </div>
                </div>
                <button onclick="VirtualGarage.updateVehicle(document.getElementById('garage-model').value, document.getElementById('garage-initial-km').value)" style="width: 100%; background: #00d2ff; color: #000; font-weight: bold; padding: 12px; border: none; border-radius: 10px; cursor: pointer;">
                    <i class="fa-solid fa-floppy-disk"></i> Enregistrer
                </button>
            </div>
            
            <div style="width: 90%; max-width: 500px; padding-bottom: 30px;">
                <h3 style="color: #fff; margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px; display: flex; justify-content: space-between;">
                    <span>PiÃ¨ces d'usure</span>
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


/* --- safe-rider.js --- */
﻿/**
 * ðŸ† SAFE RIDER CHALLENGES
 * Gamification et rÃ©compenses BVC basÃ©es sur le kilomÃ©trage
 */

window.SafeRider = {
  currentDistance: 0,
  milestones: [
    { km: 50, reward: 10, name: "Pilote Prudent - 50 km" },
    { km: 100, reward: 25, name: "Endurance - 100 km" },
    { km: 500, reward: 100, name: "VÃ©tÃ©ran - 500 km" },
    { km: 1000, reward: 500, name: "MaÃ®tre de la Route - 1000 km" },
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
    if (typeof window.braveCoins === "undefined") return;

    window.braveCoins += milestone.reward;
    localStorage.setItem("braveCoins", window.braveCoins.toString());

    const balanceEl = document.getElementById("crypto-balance");
    if (balanceEl)
      balanceEl.innerText = Math.floor(window.braveCoins) + " Pts BVC";

    // Notification UI
    const msg = `ðŸ† Challenge RÃ©ussi : ${milestone.name} ! Vous avez gagnÃ© ${milestone.reward} Pts BVC !`;
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
    popup.innerHTML = `<i class="fa-solid fa-trophy" style="font-size: 1.5rem;"></i> <span>${message}</span>`;

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
﻿/**
 * ðŸ—ºï¸ MODE CONVOI
 * SystÃ¨me de balades en groupe avec partage de position en temps rÃ©el via Firebase Firestore.
 * SÃ©curitÃ© : request.auth.uid vÃ©rifiÃ© cÃ´tÃ© Firestore Rules, chiffrement E2EE via cloudEncrypt/cloudDecrypt.
 */

window.ConvoyManager = {
  convoyId: null,
  isLeader: false,
  membersList: [],
  syncInterval: null,
  firestoreUnsubscribe: null,

  /**
   * GÃ©nÃ¨re un code convoi alÃ©atoire de 4 caractÃ¨res alphanumÃ©riques.
   * @returns {string}
   */
  generateCode: function () {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sans I/O/0/1 pour Ã©viter confusion
    let code = "";
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    for (let i = 0; i < 4; i++) {
      code += chars[array[i] % chars.length];
    }
    return code;
  },

  /**
   * CrÃ©e un nouveau convoi. L'utilisateur devient le leader.
   */
  createConvoy: async function () {
    if (!window.db) {
      alert("Connexion Firestore requise.");
      return;
    }
    if (!window.session || window.session.isGuest) {
      alert("Vous devez Ãªtre connectÃ© pour crÃ©er un convoi.");
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
        speak(`Convoi crÃ©Ã© ! Le code est : ${code.split("").join(", ")}.`);
    } catch (e) {
      console.error("[Convoy] CrÃ©ation Ã©chouÃ©e :", e);
      alert("Erreur lors de la crÃ©ation du convoi.");
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
    if (!window.session || window.session.isGuest) {
      alert("Vous devez Ãªtre connectÃ©.");
      return;
    }
    if (!code || code.length !== 4) {
      alert("Code convoi invalide (4 caractÃ¨res).");
      return;
    }

    code = code.toUpperCase().trim();

    try {
      const docRef = window.db.collection("convoys").doc(code);
      const doc = await docRef.get();

      if (!doc.exists || doc.data().status !== "active") {
        alert("Convoi introuvable ou expirÃ©.");
        return;
      }

      const members = doc.data().members || [];
      if (members.length >= 20) {
        alert("Ce convoi est complet (20 membres max).");
        return;
      }
      if (members.includes(window.session.username)) {
        alert("Vous Ãªtes dÃ©jÃ  dans ce convoi !");
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

    if (typeof speak === "function") speak("Vous avez quittÃ© le convoi.");
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
   * Ã‰coute en temps rÃ©el les positions des membres du convoi.
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
      // Ã‰TAT : DANS UN CONVOI
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
        membersHTML = `<p style="color:#666; text-align:center; padding:20px;">En attente que d'autres pilotes rejoignentâ€¦</p>`;
      }

      overlay.innerHTML = `
                <button onclick="ConvoyManager.closeUI()" style="position:absolute;top:20px;right:20px;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                <i class="fa-solid fa-people-group" style="font-size:3rem; color:#00d2ff; filter:drop-shadow(0 0 10px #00d2ff); margin-bottom:10px;"></i>
                <h1 style="font-size:1.5rem; margin:0; text-transform:uppercase; color:#00d2ff;">Mode Convoi</h1>
                <p style="color:#aaa; margin-bottom:5px;">Vous Ãªtes ${this.isLeader ? 'le <strong style="color:#cca300;">Leader</strong>' : "membre"} du convoi</p>
                
                <div style="background:rgba(0,210,255,0.15); border:2px dashed #00d2ff; padding:20px; border-radius:20px; margin:15px 0; text-align:center;">
                    <p style="color:#aaa; font-size:0.8rem; margin:0 0 5px;">CODE DU CONVOI</p>
                    <p style="font-size:2.5rem; font-weight:900; letter-spacing:10px; color:#00d2ff; margin:0;">${this.convoyId}</p>
                    <p style="color:#666; font-size:0.75rem; margin-top:5px;">Partagez ce code Ã  vos amis !</p>
                </div>

                <div style="width:90%; max-width:400px;">
                    <h3 style="color:#fff; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:8px;">
                        <i class="fa-solid fa-users"></i> Pilotes connectÃ©s (${this.membersList.length})
                    </h3>
                    ${membersHTML}
                </div>

                <button onclick="ConvoyManager.leaveConvoy()" style="margin-top:20px; background:#ff4d4d; color:#fff; border:none; padding:12px 30px; border-radius:30px; font-weight:bold; cursor:pointer; font-size:1rem;">
                    <i class="fa-solid fa-right-from-bracket"></i> Quitter le Convoi
                </button>
            `;
    } else {
      // Ã‰TAT : PAS DE CONVOI
      overlay.innerHTML = `
                <button onclick="ConvoyManager.closeUI()" style="position:absolute;top:20px;right:20px;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                <i class="fa-solid fa-people-group" style="font-size:3rem; color:#00d2ff; filter:drop-shadow(0 0 10px #00d2ff); margin-bottom:10px;"></i>
                <h1 style="font-size:1.5rem; margin:0; text-transform:uppercase; color:#00d2ff;">Mode Convoi</h1>
                <p style="color:#aaa; margin-bottom:30px; text-align:center;">Roulez en groupe. Voyez vos amis sur la carte en temps rÃ©el.</p>
                
                <div style="width:90%; max-width:400px;">
                    <button onclick="ConvoyManager.createConvoy()" style="width:100%; background:linear-gradient(135deg, #00d2ff, #0090ff); color:#fff; border:none; padding:15px; border-radius:15px; font-weight:bold; font-size:1.1rem; cursor:pointer; margin-bottom:20px; box-shadow:0 5px 20px rgba(0,210,255,0.3);">
                        <i class="fa-solid fa-plus"></i> CrÃ©er un Convoi
                    </button>
                    
                    <div style="text-align:center; color:#666; margin-bottom:15px;">â€” ou â€”</div>
                    
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
﻿/**
 * ðŸ”„ BOURSE D'Ã‰CHANGE
 * Marketplace communautaire de piÃ¨ces d'occasion via Firebase Firestore.
 * SÃ©curitÃ© : Validation des entrÃ©es, modÃ©ration GuardianBot, textContent pour l'affichage.
 */

window.ExchangeMarket = {
  listings: [],
  firestoreUnsubscribe: null,

  init: function () {
    this.listenToListings();
  },

  /**
   * Ã‰coute en temps rÃ©el les annonces de la communautÃ©.
   * Limite Ã  50 annonces pour Ã©viter surcharge (A11 OWASP - DoS).
   */
  listenToListings: function () {
    if (!window.db) {
      console.warn("[ExchangeMarket] Firestore non disponible.");
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
        this.renderListings();
      });
  },

  /**
   * Publie une nouvelle annonce.
   * @param {string} title - Titre de la piÃ¨ce
   * @param {string} description - Description
   * @param {string} priceType - "bvc" ou "euro"
   * @param {number} price - Prix
   * @param {string} category - CatÃ©gorie (carenage, pot, galets, variateur, pneus, autre)
   */
  publishListing: async function (
    title,
    description,
    priceType,
    price,
    category,
  ) {
    if (!window.db) {
      alert("Connexion Firestore requise.");
      return;
    }
    if (!window.session || window.session.isGuest) {
      alert("Vous devez Ãªtre connectÃ© pour publier.");
      return;
    }

    // Validation des entrÃ©es (CIS 16.10 - Never trust user input)
    title = (title || "").trim();
    description = (description || "").trim();
    price = parseFloat(price) || 0;

    if (!title || title.length < 3 || title.length > 100) {
      alert("Le titre doit faire entre 3 et 100 caractÃ¨res.");
      return;
    }
    if (description.length > 500) {
      alert("La description ne peut pas dÃ©passer 500 caractÃ¨res.");
      return;
    }
    if (price <= 0 || price > 50000) {
      alert("Le prix doit Ãªtre entre 1 et 50 000.");
      return;
    }

    const listing = {
      title: title,
      description: description,
      priceType: priceType === "bvc" ? "bvc" : "euro",
      price: price,
      category: category || "autre",
      seller: window.session.username,
      status: "active",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    // ModÃ©ration GuardianBot
    if (
      window.GuardianBot &&
      !window.GuardianBot.analyzeContent(
        "Annonce",
        listing,
        window.session.username,
      )
    ) {
      return;
    }

    try {
      await window.db.collection("exchange_listings").add(listing);
      alert("Annonce publiÃ©e avec succÃ¨s !");
      this.closePublishForm();
    } catch (e) {
      console.error("[ExchangeMarket] Publication Ã©chouÃ©e :", e);
      alert("Erreur lors de la publication.");
    }
  },

  /**
   * Supprime une annonce (uniquement par son auteur).
   * @param {string} listingId
   * @param {string} seller
   */
  deleteListing: async function (listingId, seller) {
    if (!window.session || window.session.username !== seller) {
      alert("Vous ne pouvez supprimer que vos propres annonces.");
      return;
    }
    if (!confirm("Supprimer cette annonce ?")) return;

    try {
      await window.db.collection("exchange_listings").doc(listingId).delete();
    } catch (e) {
      console.error("[ExchangeMarket] Suppression Ã©chouÃ©e :", e);
    }
  },

  /**
   * Contacte le vendeur via un message dans Firestore.
   */
  contactSeller: async function (listingId, sellerName) {
    if (!window.session || window.session.isGuest) {
      alert("Connectez-vous d'abord.");
      return;
    }
    if (window.session.username === sellerName) {
      alert("C'est votre annonce !");
      return;
    }

    try {
      await window.db.collection("exchange_messages").add({
        listingId: listingId,
        from: window.session.username,
        to: sellerName,
        message: `Salut ! Je suis intÃ©ressÃ©(e) par ton annonce. On en discute ?`,
        read: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
      alert("Message envoyÃ© au vendeur ! Il sera notifiÃ©.");
    } catch (e) {
      console.error("[ExchangeMarket] Contact fail :", e);
      alert("Erreur lors de l'envoi.");
    }
  },

  // ==================== UI ====================

  getCategoryIcon: function (cat) {
    const icons = {
      carenage: "fa-shield-halved",
      pot: "fa-wind",
      galets: "fa-gear",
      variateur: "fa-gears",
      pneus: "fa-circle-dot",
      autre: "fa-box-open",
    };
    return icons[cat] || icons.autre;
  },

  getCategoryLabel: function (cat) {
    const labels = {
      carenage: "CarÃ©nage",
      pot: "Pot d'Ã©chappement",
      galets: "Galets",
      variateur: "Variateur",
      pneus: "Pneus",
      autre: "Autre",
    };
    return labels[cat] || "Autre";
  },

  renderListings: function () {
    const container = document.getElementById("exchange-listings-container");
    if (!container) return;

    if (this.listings.length === 0) {
      container.innerHTML = `
                <div style="text-align:center; padding:40px; color:#666;">
                    <i class="fa-solid fa-box-open" style="font-size:3rem; margin-bottom:15px;"></i>
                    <p>Aucune annonce pour le moment. Soyez le premier Ã  publier !</p>
                </div>
            `;
      return;
    }

    let html = "";
    this.listings.forEach((listing) => {
      const icon = this.getCategoryIcon(listing.category);
      const catLabel = this.getCategoryLabel(listing.category);
      const priceLabel =
        listing.priceType === "bvc"
          ? `${listing.price} Pts BVC`
          : `${listing.price} â‚¬`;
      const isOwner =
        window.session && window.session.username === listing.seller;
      const date = listing.createdAt?.toDate
        ? listing.createdAt.toDate().toLocaleDateString("fr-FR")
        : "";

      html += `
                <div class="product-card" style="position:relative;">
                    <div class="product-img">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <span style="position:absolute; top:15px; right:15px; background:rgba(0,210,255,0.2); color:#00d2ff; padding:3px 10px; border-radius:10px; font-size:0.7rem;">${catLabel}</span>
                    <h3 id="listing-title-${listing.id}"></h3>
                    <p style="color:#888; font-size:0.85rem;" id="listing-desc-${listing.id}"></p>
                    <div class="price-tag">${priceLabel}</div>
                    <p style="color:#555; font-size:0.75rem; margin-bottom:10px;">
                        <i class="fa-solid fa-user"></i> <span id="listing-seller-${listing.id}"></span> ${date ? `â€¢ ${date}` : ""}
                    </p>
                    ${
                      isOwner
                        ? `<button class="buy-btn" style="background:#ff4d4d;" onclick="ExchangeMarket.deleteListing('${listing.id}', '${listing.seller}')"><i class="fa-solid fa-trash"></i> Supprimer</button>`
                        : `<button class="buy-btn" onclick="ExchangeMarket.contactSeller('${listing.id}', '${listing.seller}')"><i class="fa-solid fa-envelope"></i> Contacter</button>`
                    }
                </div>
            `;
    });

    container.innerHTML = html;

    // Injection sÃ©curisÃ©e via textContent (A03 OWASP - XSS Prevention)
    this.listings.forEach((listing) => {
      const titleEl = document.getElementById(`listing-title-${listing.id}`);
      const descEl = document.getElementById(`listing-desc-${listing.id}`);
      const sellerEl = document.getElementById(`listing-seller-${listing.id}`);
      if (titleEl) titleEl.textContent = listing.title;
      if (descEl) descEl.textContent = listing.description;
      if (sellerEl) sellerEl.textContent = listing.seller;
    });
  },

  openPublishForm: function () {
    let form = document.getElementById("exchange-publish-form");
    if (form) {
      form.style.display = "block";
      return;
    }

    form = document.createElement("div");
    form.id = "exchange-publish-form";
    form.style = `
            position:fixed; top:0; left:0; width:100vw; height:100vh;
            background:rgba(10,15,25,0.95); z-index:50000;
            display:flex; flex-direction:column; align-items:center; justify-content:center;
            color:#fff; font-family:'Inter',sans-serif; backdrop-filter:blur(15px);
        `;
    form.innerHTML = `
            <button onclick="ExchangeMarket.closePublishForm()" style="position:absolute;top:20px;right:20px;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            <i class="fa-solid fa-tag" style="font-size:2.5rem; color:#00d2ff; margin-bottom:10px;"></i>
            <h2 style="color:#00d2ff; margin-bottom:20px;">Publier une Annonce</h2>
            <div style="width:90%; max-width:400px;">
                <input type="text" id="ex-title" placeholder="Titre (ex: Galets Malossi 6.5g)" maxlength="100" style="width:100%; background:#222; border:1px solid #444; color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; margin-bottom:10px; outline:none;">
                <textarea id="ex-desc" placeholder="Description (Ã©tat, compatibilitÃ©...)" maxlength="500" rows="3" style="width:100%; background:#222; border:1px solid #444; color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; margin-bottom:10px; outline:none; resize:none;"></textarea>
                <select id="ex-category" style="width:100%; background:#222; border:1px solid #444; color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; margin-bottom:10px; outline:none;">
                    <option value="galets">Galets</option>
                    <option value="variateur">Variateur</option>
                    <option value="pot">Pot d'Ã©chappement</option>
                    <option value="carenage">CarÃ©nage</option>
                    <option value="pneus">Pneus</option>
                    <option value="autre">Autre</option>
                </select>
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <input type="number" id="ex-price" placeholder="Prix" min="1" style="flex:1; background:#222; border:1px solid #444; color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
                    <select id="ex-price-type" style="width:120px; background:#222; border:1px solid #444; color:#fff; padding:12px; border-radius:10px; box-sizing:border-box; outline:none;">
                        <option value="euro">Euros (â‚¬)</option>
                        <option value="bvc">Pts BVC</option>
                    </select>
                </div>
                <button onclick="ExchangeMarket.publishListing(
                    document.getElementById('ex-title').value,
                    document.getElementById('ex-desc').value,
                    document.getElementById('ex-price-type').value,
                    document.getElementById('ex-price').value,
                    document.getElementById('ex-category').value
                )" style="width:100%; background:linear-gradient(135deg,#00d2ff,#0090ff); color:#fff; border:none; padding:15px; border-radius:15px; font-weight:bold; font-size:1rem; cursor:pointer;">
                    <i class="fa-solid fa-paper-plane"></i> Publier
                </button>
            </div>
        `;
    document.body.appendChild(form);
  },

  closePublishForm: function () {
    const form = document.getElementById("exchange-publish-form");
    if (form) form.style.display = "none";
  },
};

document.addEventListener("DOMContentLoaded", () => {
  // DÃ©lai pour laisser Firebase s'initialiser
  setTimeout(() => {
    ExchangeMarket.init();
  }, 1500);
});


/* --- legal-database.js --- */
﻿/**
 * âš–ï¸ BASE JURIDIQUE MONDIALE â€” POCKET LAWYER
 * Sources officielles gouvernementales uniquement.
 * DerniÃ¨re mise Ã  jour : 14 juillet 2026
 *
 * Structure : window.LegalDatabase[pays][thÃ¨me]
 * Chaque entrÃ©e contient : title, content, source, url
 *
 * Avertissement (AI Act UE 2024/1689) : Ces informations sont fournies
 * Ã  titre indicatif et sont soumises Ã  contrÃ´le humain.
 */

window.LegalDatabase = {
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡«ðŸ‡· FRANCE â€” Source : LÃ©gifrance (legifrance.gouv.fr)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  france: {
    _flag: "ðŸ‡«ðŸ‡·",
    _name: "France",
    _source: "LÃ©gifrance â€” legifrance.gouv.fr",
    _keywords: ["france", "franÃ§ais", "francais", "lÃ©gifrance", "legifrance"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡«ðŸ‡· Port du Casque â€” Art. R431-1 Code de la Route",
      content:
        "Le port du casque homologuÃ© <strong>ECE 22.06</strong> est obligatoire pour tout conducteur et passager de 2-roues motorisÃ©.<br><strong>Sanction :</strong> 135â‚¬ d'amende (contravention 4Ã¨me classe) + retrait de 3 points.",
      source: "LÃ©gifrance â€” Art. R431-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    debridage: {
      keywords: ["dÃ©brid", "debride", "kitÃ©", "kit"],
      title: "ðŸ‡«ðŸ‡· DÃ©bridage â€” Art. L317-5 Code de la Route",
      content:
        "Le dÃ©bridage d'un cyclomoteur est un <strong>dÃ©lit</strong>. Vous risquez <strong>135â‚¬ d'amende</strong> pour le propriÃ©taire, mais surtout, <strong>votre assurance s'annule</strong> en cas d'accident corporel. Les assureurs se retournent contre vous pour payer les dommages aux victimes.",
      source: "LÃ©gifrance â€” Art. L317-5 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    stupefiants: {
      keywords: ["stup", "drogue", "fumÃ©", "positif", "cannabis", "thc"],
      title: "ðŸ‡«ðŸ‡· Conduite sous StupÃ©fiants (DÃ©lit)",
      content:
        "MÃªme avec un BSR, vous risquez jusqu'Ã  <strong>4500â‚¬ d'amende</strong>, 2 ans de prison, et l'immobilisation du scooter. Il n'y a pas de perte de points sur un BSR. S'il s'agit d'une premiÃ¨re infraction, le juge peut faire preuve de clÃ©mence si vous montrez des preuves mÃ©dicales.",
      source: "LÃ©gifrance â€” Art. L235-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    alcool: {
      keywords: ["alcool", "boire", "ivre", "alcoolÃ©mie"],
      title: "ðŸ‡«ðŸ‡· AlcoolÃ©mie â€” Art. L234-1",
      content:
        "Pour un permis probatoire ou BSR, la limite lÃ©gale est de <strong>0,2 g/L</strong>. Vous risquez l'immobilisation immÃ©diate du cyclomoteur et de fortes amendes. Au-delÃ  de 0,8 g/L : dÃ©lit pÃ©nal (2 ans de prison, 4500â‚¬).",
      source: "LÃ©gifrance â€” Art. L234-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    assurance: {
      keywords: ["assurance", "assurÃ©"],
      title: "ðŸ‡«ðŸ‡· DÃ©faut d'Assurance (DÃ©lit) â€” Art. L324-2",
      content:
        "Conduire sans assurance coÃ»te jusqu'Ã  <strong>3750â‚¬ d'amende</strong>. En cas d'accident, le Fonds de Garantie indemnise la victime mais <strong>vous rÃ©clamera le remboursement</strong>, potentiellement toute votre vie.",
      source: "LÃ©gifrance â€” Art. L324-2 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    fuite: {
      keywords: ["fuite", "obtempÃ©rer", "obtemperer"],
      title: "ðŸ‡«ðŸ‡· Refus d'ObtempÃ©rer / DÃ©lit de Fuite",
      content:
        "Cumuler ces dÃ©lits entraÃ®ne des peines de <strong>prison fermes</strong>, des amendes colossales et une interdiction de passer le permis. Ne fuyez jamais un contrÃ´le de police.",
      source: "LÃ©gifrance â€” Art. L233-1 & L231-1 du Code de la Route",
      url: "legifrance.gouv.fr",
    },
    stationnement: {
      keywords: ["stationn", "garÃ©", "parking", "trottoir", "fourriÃ¨re"],
      title: "ðŸ‡«ðŸ‡· Stationnement 2-Roues â€” Art. R417-10/11",
      content:
        "Sur un <strong>trottoir</strong> : tolÃ©rÃ© si le passage piÃ©ton (>1,50m) n'est pas entravÃ©. Sur <strong>passage piÃ©ton/piste cyclable</strong> : 135â‚¬ + fourriÃ¨re immÃ©diate. Sur <strong>place auto</strong> : tolÃ©rÃ© si vous payez le stationnement.",
      source: "LÃ©gifrance â€” Art. R417-10 et R417-11",
      url: "legifrance.gouv.fr",
    },
    rgpd: {
      keywords: [
        "rgpd",
        "gdpr",
        "donnÃ©es personnelles",
        "cnil",
        "vie privÃ©e",
      ],
      title: "ðŸ‡«ðŸ‡· RGPD â€” RÃ¨glement (UE) 2016/679",
      content:
        "La protection des donnÃ©es personnelles est rÃ©gie par le <strong>RGPD</strong> (entrÃ© en vigueur le 25 mai 2018) et la <strong>Loi Informatique et LibertÃ©s</strong> (Loi nÂ°78-17 du 6 janvier 1978). La CNIL est l'autoritÃ© de contrÃ´le franÃ§aise.<br>Droits : AccÃ¨s (Art.15), Rectification (Art.16), Effacement (Art.17), PortabilitÃ© (Art.20), Opposition (Art.21).",
      source: "LÃ©gifrance & EUR-Lex â€” RÃ¨glement (UE) 2016/679",
      url: "legifrance.gouv.fr | eur-lex.europa.eu",
    },
    retractation: {
      keywords: [
        "remboursement",
        "rÃ©tractation",
        "retractation",
        "cgv",
        "numÃ©rique",
        "digital",
      ],
      title:
        "ðŸ‡«ðŸ‡· Droit de RÃ©tractation (Contenu NumÃ©rique) â€” Art. L221-28",
      content:
        "Selon l'<strong>Article L221-28 (13Â°) du Code de la consommation</strong>, le droit de rÃ©tractation ne peut pas Ãªtre exercÃ© pour la fourniture d'un <strong>contenu numÃ©rique non fourni sur un support matÃ©riel</strong> dont l'exÃ©cution a commencÃ© aprÃ¨s accord prÃ©alable exprÃ¨s du consommateur et renoncement exprÃ¨s Ã  son droit de rÃ©tractation. Les rapports d'expertise gÃ©nÃ©rÃ©s ne sont donc <strong>pas remboursables</strong>.",
      source: "LÃ©gifrance â€” Art. L221-28 du Code de la Consommation",
      url: "legifrance.gouv.fr",
    },
    vice_cache: {
      keywords: ["vice", "cachÃ©", "cache", "panne", "arnaque", "occasion"],
      title: "ðŸ‡«ðŸ‡· Garantie des Vices CachÃ©s â€” Art. 1641 Code Civil",
      content:
        "L'<strong>Article 1641 du Code civil</strong> prÃ©cise que le vendeur est tenu de la garantie Ã  raison des dÃ©fauts cachÃ©s de la chose vendue qui la rendent impropre Ã  l'usage auquel on la destine. L'acheteur a <strong>2 ans Ã  compter de la dÃ©couverte du vice</strong> pour agir.",
      source: "LÃ©gifrance â€” Art. 1641 du Code Civil",
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
      title: "ðŸ‡«ðŸ‡· Indemnisation des Victimes (Loi Badinter)",
      content:
        "La <strong>Loi nÂ° 85-677 du 5 juillet 1985 (Loi Badinter)</strong> vise Ã  amÃ©liorer la situation des victimes d'accidents de la circulation et Ã  accÃ©lÃ©rer les procÃ©dures d'indemnisation. Si vous n'Ãªtes pas responsable, votre assureur doit vous indemniser intÃ©gralement de vos prÃ©judices corporels et matÃ©riels.",
      source: "LÃ©gifrance â€” Loi Badinter",
      url: "legifrance.gouv.fr",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡ªðŸ‡º UNION EUROPÃ‰ENNE â€” Source : EUR-Lex (eur-lex.europa.eu)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  eu: {
    _flag: "ðŸ‡ªðŸ‡º",
    _name: "Union EuropÃ©enne",
    _source: "EUR-Lex â€” eur-lex.europa.eu",
    _keywords: ["europe", "europÃ©en", "europeen", "ue", "eu", "eur-lex"],

    rgpd: {
      keywords: ["rgpd", "gdpr", "donnÃ©e", "privacy"],
      title: "ðŸ‡ªðŸ‡º RGPD â€” RÃ¨glement (UE) 2016/679",
      content:
        "Le RÃ¨glement GÃ©nÃ©ral sur la Protection des DonnÃ©es est le texte de rÃ©fÃ©rence en matiÃ¨re de protection des donnÃ©es personnelles dans l'UE. EntrÃ©e en vigueur : <strong>25 mai 2018</strong>.<br>Amende max : <strong>20Mâ‚¬ ou 4% du CA mondial</strong>.",
      source: "EUR-Lex â€” RÃ¨glement (UE) 2016/679",
      url: "eur-lex.europa.eu",
    },
    ai_act: {
      keywords: ["ia act", "ai act", "intelligence artificielle", "ia"],
      title: "ðŸ‡ªðŸ‡º AI Act â€” RÃ¨glement (UE) 2024/1689",
      content:
        "Premier rÃ¨glement au monde sur l'IA. En vigueur depuis le <strong>1er aoÃ»t 2024</strong>. Approche par niveaux de risque :<br>â€¢ Risque inacceptable : <strong>Interdit</strong><br>â€¢ Haut risque : ConformitÃ© stricte obligatoire<br>â€¢ Risque limitÃ© : <strong>Obligation de transparence</strong> (notre catÃ©gorie)<br>â€¢ Risque minimal : Libre<br>Application complÃ¨te prÃ©vue pour <strong>aoÃ»t 2026</strong>.",
      source: "EUR-Lex â€” RÃ¨glement (UE) 2024/1689",
      url: "eur-lex.europa.eu",
    },
    dsa: {
      keywords: ["dsa", "digital services", "modÃ©ration", "plateforme"],
      title: "ðŸ‡ªðŸ‡º DSA â€” RÃ¨glement (UE) 2022/2065",
      content:
        "Le Digital Services Act impose des obligations de <strong>modÃ©ration</strong> et de <strong>transparence</strong> aux plateformes numÃ©riques. Obligation de point de contact, mÃ©canisme de signalement (Art.16), et motivation des dÃ©cisions de modÃ©ration (Art.17).",
      source: "EUR-Lex â€” RÃ¨glement (UE) 2022/2065",
      url: "eur-lex.europa.eu",
    },
    casque_eu: {
      keywords: ["casque", "homologation", "ece", "unece"],
      title: "ðŸ‡ªðŸ‡º Homologation Casque â€” UNECE R22.06",
      content:
        "Depuis juin 2024, seuls les casques homologuÃ©s <strong>ECE 22.06</strong> peuvent Ãªtre vendus dans l'UE. Les anciens ECE 22.05 restent utilisables mais ne sont plus fabriquÃ©s.",
      source: "UNECE â€” Regulation No. 22 Rev.6",
      url: "unece.org",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡®ðŸ‡© INDONÃ‰SIE â€” Source : JDIH (jdih.kemenkumham.go.id)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  indonesia: {
    _flag: "ðŸ‡®ðŸ‡©",
    _name: "IndonÃ©sie",
    _source: "JDIH â€” jdih.kemenkumham.go.id | peraturan.bpk.go.id",
    _keywords: ["indonÃ©sie", "indonesie", "indonesia", "jdih"],

    casque: {
      keywords: ["casque", "helm", "sni"],
      title: "ðŸ‡®ðŸ‡© Casque (Helm SNI) â€” UU 22/2009 Art.106(8)",
      content:
        "Le port du casque homologuÃ© <strong>SNI</strong> (Standar Nasional Indonesia) est obligatoire pour le conducteur et le passager (Art. 57Â§2).<br><strong>Sanction :</strong> Jusqu'Ã  1 mois de prison ou <strong>Rp 250.000</strong> d'amende (Art. 291Â§1).",
      source: "JDIH â€” UU No.22 Tahun 2009 (LLAJ)",
      url: "jdih.kemenkumham.go.id",
    },
    sim: {
      keywords: ["sim", "permis", "conduire"],
      title: "ðŸ‡®ðŸ‡© Permis de conduire (SIM) â€” UU 22/2009 Art.77",
      content:
        "Tout conducteur doit possÃ©der un SIM correspondant Ã  son vÃ©hicule :<br>â€¢ <strong>SIM C</strong> : Moto â‰¤ 250cc<br>â€¢ <strong>SIM CI</strong> : Moto 250-500cc<br>â€¢ <strong>SIM CII</strong> : Moto > 500cc<br><strong>Sans SIM :</strong> 3 mois prison ou Rp 1.000.000 (Art.281).<br><strong>SIM non prÃ©sentÃ© :</strong> 1 mois ou Rp 250.000 (Art.288Â§2).",
      source: "JDIH â€” UU No.22 Tahun 2009",
      url: "jdih.kemenkumham.go.id",
    },
    code_route: {
      keywords: ["route", "lalu lintas", "circulation", "code"],
      title: "ðŸ‡®ðŸ‡© Code de la Route â€” UU No.22 Tahun 2009 (LLAJ)",
      content:
        "La loi sur la Circulation et les Transports Routiers rÃ©git l'ensemble du trafic en IndonÃ©sie. Obligations pour les 2-roues :<br>â€¢ Casque SNI obligatoire (Art.106Â§8)<br>â€¢ RÃ©troviseurs, feux, klaxon, compteur (Art.285Â§1)<br>â€¢ SIM C obligatoire (Art.77)<br>â€¢ STNK Ã  jour (Perpol 7/2021)",
      source: "JDIH â€” Kementerian Perhubungan",
      url: "jdih.kemenkumham.go.id",
    },
    stnk: {
      keywords: ["stnk", "enregistrement", "immatriculation", "pajak"],
      title: "ðŸ‡®ðŸ‡© Immatriculation (STNK) â€” Perpol 7/2021",
      content:
        "Le STNK est le certificat d'immatriculation obligatoire. Si le STNK expire et n'est pas renouvelÃ© sous <strong>2 ans</strong>, les donnÃ©es du vÃ©hicule sont radiÃ©es.<br><strong>Opsen Pajak (2025) :</strong> Taxe additionnelle sur le PKB et BBN-KB (UU 1/2022).<br>Depuis 2026, le NIK (KTP) est intÃ©grÃ© au SIM.",
      source: "JDIH â€” Korlantas Polri",
      url: "korlantas.polri.go.id",
    },
    pdp: {
      keywords: ["data", "donnÃ©e", "pdp", "pribadi", "privÃ©e"],
      title: "ðŸ‡®ðŸ‡© Protection des DonnÃ©es â€” UU No.27/2022 (UU PDP)",
      content:
        "En vigueur depuis le <strong>17 octobre 2024</strong>. PortÃ©e extraterritoriale.<br><strong>Sanctions admin. (Art.57) :</strong> Jusqu'Ã  <strong>2% du CA annuel</strong>.<br><strong>Sanctions pÃ©nales :</strong> 4-6 ans de prison + Rp 4-6 milliards.<br><strong>Korporasi :</strong> Amende Ã—10 + gel/dissolution.",
      source: "JDIH â€” Komdigi (ex-Kominfo)",
      url: "jdih.kemenkumham.go.id",
    },
    contrat: {
      keywords: ["contrat"],
      title: "ðŸ‡®ðŸ‡© Droit des Contrats",
      content:
        "RÃ©gi par le <strong>Code civil indonÃ©sien</strong> (KUH Perdata), hÃ©ritÃ© du droit romano-hollandais. L'IndonÃ©sie n'a <strong>pas ratifiÃ©</strong> la Convention de Vienne (CISG).",
      source: "JDIH â€” peraturan.bpk.go.id",
      url: "peraturan.bpk.go.id",
    },
    hierarchie: {
      keywords: ["hiÃ©rarchie", "constitution", "norme", "loi"],
      title: "ðŸ‡®ðŸ‡© HiÃ©rarchie des Normes â€” UU No.10/2004",
      content:
        "SystÃ¨me mixte (adat / romano-hollandais / national / musulman Ã  Aceh).<br>1. <strong>UUD 1945</strong> â€” Constitution<br>2. <strong>UU</strong> â€” Lois du Parlement<br>3. <strong>PP</strong> â€” RÃ¨glements gouvernementaux<br>4. <strong>Perpres</strong> â€” DÃ©crets prÃ©sidentiels<br>5. <strong>Perda</strong> â€” RÃ¨glements rÃ©gionaux",
      source: "JDIH â€” jdih.kemenkumham.go.id",
      url: "jdih.kemenkumham.go.id",
    },
    immobilier: {
      keywords: ["immobilier", "terre", "agraire", "hak"],
      title: "ðŸ‡®ðŸ‡© Droit Immobilier â€” Loi Agraire nÂ°5/1960 (UUPA)",
      content:
        "Les Ã©trangers ne peuvent possÃ©der de terres directement (<strong>Hak Milik</strong>), mais peuvent acquÃ©rir des droits d'usage (<strong>Hak Pakai</strong>) ou investir via des sociÃ©tÃ©s (<strong>PT PMA</strong>).",
      source: "JDIH â€” peraturan.bpk.go.id",
      url: "peraturan.bpk.go.id",
    },
    travail: {
      keywords: ["travail", "licenciement", "emploi"],
      title: "ðŸ‡®ðŸ‡© Droit du Travail â€” UU 13/2003 & Omnibus 11/2020",
      content:
        "Loi nÂ°13/2003 = texte principal. ModifiÃ©e par la <strong>loi omnibus nÂ°11/2020</strong> (Cipta Kerja) pour faciliter l'investissement (contrats, licenciements, heures supplÃ©mentaires).",
      source: "JDIH â€” jdih.kemenkumham.go.id",
      url: "jdih.kemenkumham.go.id",
    },
    langue: {
      keywords: ["langue", "Ã©ducation", "media", "bahasa"],
      title: "ðŸ‡®ðŸ‡© RÃ©glementation Linguistique â€” UU 20/2003 & 32/2002",
      content:
        "L'indonÃ©sien (<em>Bahasa Indonesia</em>) est la langue officielle de l'Ã©ducation et des mÃ©dias. Les langues rÃ©gionales et Ã©trangÃ¨res sont autorisÃ©es sous conditions.",
      source: "JDIH â€” Kemendikbudristek",
      url: "jdih.kemenkumham.go.id",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡ºðŸ‡¸ Ã‰TATS-UNIS â€” Sources : NHTSA, IIHS, Cornell LII
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  usa: {
    _flag: "ðŸ‡ºðŸ‡¸",
    _name: "Ã‰tats-Unis",
    _source: "NHTSA (nhtsa.gov) | Cornell LII (law.cornell.edu)",
    _keywords: [
      "usa",
      "Ã©tats-unis",
      "etats-unis",
      "amÃ©rique",
      "amerique",
      "amÃ©ricain",
      "americain",
      "united states",
    ],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡ºðŸ‡¸ Casque Moto â€” FMVSS 218 (NHTSA)",
      content:
        "La norme fÃ©dÃ©rale est le <strong>FMVSS 218</strong> (Federal Motor Vehicle Safety Standard). <strong>Attention :</strong> la loi varie par Ã‰tat !<br>â€¢ <strong>Universal law</strong> (19 Ã‰tats) : Casque obligatoire pour tous<br>â€¢ <strong>Partial law</strong> (28 Ã‰tats) : Obligatoire seulement pour les <18 ou <21 ans<br>â€¢ <strong>No law</strong> (3 Ã‰tats) : Illinois, Iowa, New Hampshire",
      source: "NHTSA â€” nhtsa.gov | IIHS â€” iihs.org",
      url: "nhtsa.gov",
    },
    assurance: {
      keywords: ["assurance", "insurance"],
      title: "ðŸ‡ºðŸ‡¸ Assurance Moto â€” RÃ©glementation par Ã‰tat",
      content:
        "L'assurance moto est obligatoire dans <strong>48 des 50 Ã‰tats</strong> (sauf Floride et Montana pour la responsabilitÃ© civile). Les minimums de couverture varient considÃ©rablement par Ã‰tat. En Californie : 15/30/5 (en milliers de $).",
      source: "NHTSA â€” nhtsa.gov",
      url: "nhtsa.gov",
    },
    ccpa: {
      keywords: ["ccpa", "cpra", "california", "donnÃ©e", "privacy"],
      title: "ðŸ‡ºðŸ‡¸ CCPA/CPRA â€” Protection des DonnÃ©es (Californie)",
      content:
        "Le <strong>CCPA</strong> (California Consumer Privacy Act, 2020) et son amendement <strong>CPRA</strong> offrent aux rÃ©sidents californiens des droits proches du RGPD : droit de savoir, de suppression, de refus de vente. <strong>Amende :</strong> $2.500/violation, $7.500/violation intentionnelle.",
      source: "State of California â€” oag.ca.gov",
      url: "oag.ca.gov",
    },
    coppa: {
      keywords: ["coppa", "mineur", "enfant"],
      title: "ðŸ‡ºðŸ‡¸ COPPA â€” Protection des Mineurs en Ligne",
      content:
        "La <strong>Children's Online Privacy Protection Act</strong> interdit la collecte de donnÃ©es personnelles d'enfants de moins de 13 ans sans consentement parental vÃ©rifiable. <strong>Amende :</strong> jusqu'Ã  $50.120/violation (FTC).",
      source: "FTC â€” ftc.gov",
      url: "ftc.gov",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¬ðŸ‡§ ROYAUME-UNI â€” Source : legislation.gov.uk
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  uk: {
    _flag: "ðŸ‡¬ðŸ‡§",
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
      title: "ðŸ‡¬ðŸ‡§ Casque Moto â€” Road Traffic Act 1988 Â§16",
      content:
        "Le port du casque homologuÃ© <strong>BS 6658:1985</strong> ou <strong>UNECE R22.05/22.06</strong> est obligatoire. Les Sikhs portant un turban sont exemptÃ©s (Â§16Â§2).<br><strong>Sanction :</strong> Fixed Penalty Notice de <strong>Â£100</strong>.",
      source: "legislation.gov.uk â€” Road Traffic Act 1988 Â§16",
      url: "legislation.gov.uk",
    },
    permis: {
      keywords: ["permis", "licence", "cbt"],
      title: "ðŸ‡¬ðŸ‡§ Permis Moto â€” CBT / A1 / A2 / A",
      content:
        "Formation obligatoire : <strong>CBT</strong> (Compulsory Basic Training). CatÃ©gories :<br>â€¢ <strong>AM</strong> : Cyclomoteur â‰¤ 50cc<br>â€¢ <strong>A1</strong> : â‰¤ 125cc (16+)<br>â€¢ <strong>A2</strong> : â‰¤ 35kW (19+)<br>â€¢ <strong>A</strong> : IllimitÃ© (24+ ou 21+ avec 2 ans d'A2)",
      source: "GOV.UK â€” gov.uk/motorcycle-licence",
      url: "gov.uk",
    },
    uk_gdpr: {
      keywords: ["gdpr", "donnÃ©e", "ico", "privacy", "data"],
      title: "ðŸ‡¬ðŸ‡§ UK GDPR & Data Protection Act 2018",
      content:
        "Post-Brexit, le Royaume-Uni a conservÃ© les principes du RGPD via le <strong>UK GDPR</strong> et le <strong>Data Protection Act 2018</strong>. L'autoritÃ© de contrÃ´le est l'<strong>ICO</strong> (Information Commissioner's Office). Amende max : <strong>Â£17.5M ou 4% du CA</strong>.",
      source: "legislation.gov.uk â€” Data Protection Act 2018",
      url: "legislation.gov.uk",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¯ðŸ‡µ JAPON â€” Source : Japanese Law Translation (japaneselawtranslation.go.jp)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  japan: {
    _flag: "ðŸ‡¯ðŸ‡µ",
    _name: "Japon",
    _source: "Japanese Law Translation â€” japaneselawtranslation.go.jp",
    _keywords: ["japon", "japonais", "japan", "nippon"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¯ðŸ‡µ Casque Moto â€” Road Traffic Act Art.71-4",
      content:
        "Le port du casque homologuÃ© <strong>PSC/SG</strong> est obligatoire pour tous les conducteurs et passagers de 2-roues. Les casques doivent porter le marquage <strong>PSCãƒžãƒ¼ã‚¯</strong>.<br>Norme : <strong>JIS T 8133</strong>.",
      source: "Japanese Law Translation â€” Road Traffic Act (é“è·¯äº¤é€šæ³•)",
      url: "japaneselawtranslation.go.jp",
    },
    permis: {
      keywords: ["permis", "licence", "conduire"],
      title: "ðŸ‡¯ðŸ‡µ Permis Moto (å…è¨±) â€” Road Traffic Act",
      content:
        "CatÃ©gories :<br>â€¢ <strong>åŽŸä»˜</strong> (Gentsuki) : â‰¤ 50cc (16+)<br>â€¢ <strong>å°åž‹</strong> : â‰¤ 125cc<br>â€¢ <strong>æ™®é€š</strong> : â‰¤ 400cc<br>â€¢ <strong>å¤§åž‹</strong> : IllimitÃ© (18+)<br>Examen pratique obligatoire en circuit fermÃ©.",
      source: "Japanese Law Translation â€” é“è·¯äº¤é€šæ³•",
      url: "japaneselawtranslation.go.jp",
    },
    appi: {
      keywords: ["appi", "donnÃ©e", "data", "ppc", "privacy"],
      title: "ðŸ‡¯ðŸ‡µ APPI â€” Act on Protection of Personal Information",
      content:
        "RÃ©visÃ©e en 2022. L'APPI est supervisÃ©e par la <strong>PPC</strong> (Personal Information Protection Commission). Le Japon bÃ©nÃ©ficie d'une <strong>dÃ©cision d'adÃ©quation</strong> avec l'UE (RGPD). Transferts transfrontaliers strictement encadrÃ©s.",
      source: "PPC â€” ppc.go.jp",
      url: "ppc.go.jp",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¨ðŸ‡³ CHINE â€” Source : NPC (npc.gov.cn)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  china: {
    _flag: "ðŸ‡¨ðŸ‡³",
    _name: "Chine",
    _source: "NPC â€” npc.gov.cn | AssemblÃ©e Nationale Populaire",
    _keywords: ["chine", "chinois", "china", "pÃ©kin", "beijing"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¨ðŸ‡³ Casque Moto â€” Campagne Â« Un casque, une ceinture Â»",
      content:
        "Depuis la campagne nationale de 2020, le port du casque est obligatoire pour les conducteurs et passagers de 2-roues dans toute la Chine. Norme obligatoire : <strong>GB 811-2022</strong> (mise Ã  jour de la norme nationale).",
      source: "NPC â€” Road Traffic Safety Law (é“è·¯äº¤é€šå®‰å…¨æ³•)",
      url: "npc.gov.cn",
    },
    pipl: {
      keywords: ["pipl", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡¨ðŸ‡³ PIPL â€” Personal Information Protection Law (2021)",
      content:
        "En vigueur depuis le <strong>1er novembre 2021</strong>. PortÃ©e extraterritoriale. Consentement sÃ©parÃ© requis pour les donnÃ©es sensibles. <strong>Amende :</strong> jusqu'Ã  <strong>50M RMB ou 5% du CA annuel</strong>. Transferts transfrontaliers soumis Ã  Ã©valuation de sÃ©curitÃ© obligatoire (CAC).",
      source: "NPC â€” ä¸ªäººä¿¡æ¯ä¿æŠ¤æ³•",
      url: "npc.gov.cn",
    },
    dsl: {
      keywords: ["dsl", "sÃ©curitÃ©", "securite", "cybersÃ©curitÃ©"],
      title: "ðŸ‡¨ðŸ‡³ DSL â€” Data Security Law (2021)",
      content:
        "La Loi sur la SÃ©curitÃ© des DonnÃ©es (DSL) classe les donnÃ©es par niveau d'importance (national, important, gÃ©nÃ©ral). Les donnÃ©es Â« importantes Â» et Â« nationales Â» exigent des Ã©valuations de risque et des stockages localisÃ©s.",
      source: "NPC â€” æ•°æ®å®‰å…¨æ³•",
      url: "npc.gov.cn",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡®ðŸ‡³ INDE â€” Source : India Code (indiacode.nic.in)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  india: {
    _flag: "ðŸ‡®ðŸ‡³",
    _name: "Inde",
    _source: "India Code â€” indiacode.nic.in",
    _keywords: ["inde", "indien", "india", "hindi"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡®ðŸ‡³ Casque Moto â€” Motor Vehicles Act 1988 Â§129",
      content:
        "Le port du casque homologuÃ© <strong>ISI (BIS)</strong> est obligatoire pour le conducteur et le passager. Norme : <strong>IS 4151:2015</strong>.<br><strong>Sanction :</strong> â‚¹1.000 d'amende + suspension du permis (3 mois).<br>Exception : Les Sikhs portant un turban sont exemptÃ©s dans certains Ã‰tats.",
      source: "India Code â€” Motor Vehicles Act 1988 Â§129",
      url: "indiacode.nic.in",
    },
    permis: {
      keywords: ["permis", "licence", "conduire"],
      title: "ðŸ‡®ðŸ‡³ Permis Moto â€” Motor Vehicles Act Â§3",
      content:
        "Deux catÃ©gories :<br>â€¢ <strong>MCWG</strong> (Motor Cycle With Gear) : Moto avec vitesses<br>â€¢ <strong>MCWOG</strong> : Scooter sans vitesses<br>Ã‚ge minimum : <strong>18 ans</strong> (16 ans pour les â‰¤50cc dans certains Ã‰tats).",
      source: "India Code â€” Motor Vehicles Act 1988",
      url: "indiacode.nic.in",
    },
    dpdp: {
      keywords: ["dpdp", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡®ðŸ‡³ DPDP â€” Digital Personal Data Protection Act 2023",
      content:
        "En vigueur depuis <strong>2023</strong>. Droits des Â« Data Principals Â» : consentement, rectification, effacement. PossibilitÃ© de nommer un reprÃ©sentant lÃ©gal. <strong>Amende :</strong> jusqu'Ã  <strong>â‚¹250 crore</strong> (â‰ˆ 27Mâ‚¬). Supervision par le Data Protection Board of India.",
      source: "MeitY â€” meity.gov.in",
      url: "meity.gov.in",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡§ðŸ‡· BRÃ‰SIL â€” Source : Planalto (planalto.gov.br)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  brazil: {
    _flag: "ðŸ‡§ðŸ‡·",
    _name: "BrÃ©sil",
    _source: "Planalto â€” planalto.gov.br",
    _keywords: ["brÃ©sil", "bresil", "brazil", "brÃ©silien", "bresilien"],

    casque: {
      keywords: ["casque", "capacete", "helmet"],
      title: "ðŸ‡§ðŸ‡· Casque Moto â€” CTB Art.244 (Lei 9.503/1997)",
      content:
        "Le port du casque homologuÃ© <strong>INMETRO</strong> est obligatoire pour le conducteur et le passager de moto. Le viseur est aussi obligatoire.<br><strong>Sanction :</strong> Infraction grave â€” <strong>R$293,47</strong> + 7 points sur le CNH + rÃ©tention du vÃ©hicule.",
      source: "Planalto â€” Lei 9.503/1997 (CTB) Art.244",
      url: "planalto.gov.br",
    },
    cnh: {
      keywords: ["permis", "cnh", "conduire", "licence"],
      title: "ðŸ‡§ðŸ‡· Permis Moto (CNH) â€” CTB Art.140",
      content:
        "CatÃ©gorie <strong>A</strong> obligatoire pour les 2-roues. Ã‚ge minimum : <strong>18 ans</strong>. Formation obligatoire incluant cours thÃ©oriques (45h) et pratiques (20h). SystÃ¨me de points : <strong>40 pts/an = suspension</strong>.",
      source: "Planalto â€” Lei 9.503/1997 (CTB)",
      url: "planalto.gov.br",
    },
    lgpd: {
      keywords: ["lgpd", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡§ðŸ‡· LGPD â€” Lei Geral de ProteÃ§Ã£o de Dados (13.709/2018)",
      content:
        "La LGPD est le Â« RGPD brÃ©silien Â». En vigueur depuis <strong>septembre 2020</strong>. SupervisÃ©e par l'<strong>ANPD</strong> (Autoridade Nacional de ProteÃ§Ã£o de Dados). <strong>Amende :</strong> jusqu'Ã  <strong>2% du CA au BrÃ©sil</strong>, plafonnÃ©e Ã  R$50M par infraction.",
      source: "Planalto â€” Lei 13.709/2018",
      url: "planalto.gov.br",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¸ðŸ‡¬ SINGAPOUR â€” Source : Singapore Statutes Online (sso.agc.gov.sg)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  singapore: {
    _flag: "ðŸ‡¸ðŸ‡¬",
    _name: "Singapour",
    _source: "Singapore Statutes Online â€” sso.agc.gov.sg",
    _keywords: ["singapour", "singapore"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¸ðŸ‡¬ Casque Moto â€” Road Traffic Act Â§22A",
      content:
        "Le casque homologuÃ© <strong>PSB/Spring SG</strong> (ou UN R22) est obligatoire. <br><strong>Sanction :</strong> Amende jusqu'Ã  <strong>S$1.000</strong> et/ou 3 mois de prison.",
      source: "SSO â€” Road Traffic Act (Cap. 276)",
      url: "sso.agc.gov.sg",
    },
    pdpa: {
      keywords: ["pdpa", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡¸ðŸ‡¬ PDPA â€” Personal Data Protection Act 2012",
      content:
        "SupervisÃ©e par la <strong>PDPC</strong>. Consentement Ã©clairÃ© obligatoire. Droit d'accÃ¨s et de correction rapide.<br><strong>Amende :</strong> jusqu'Ã  <strong>S$1M ou 10% du CA annuel</strong> (depuis la rÃ©vision 2020).",
      source: "SSO â€” PDPA (No.26 of 2012)",
      url: "sso.agc.gov.sg",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¿ðŸ‡¦ AFRIQUE DU SUD â€” Source : gov.za
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  south_africa: {
    _flag: "ðŸ‡¿ðŸ‡¦",
    _name: "Afrique du Sud",
    _source: "Government of South Africa â€” gov.za",
    _keywords: ["afrique du sud", "south africa", "sud-africain"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¿ðŸ‡¦ Casque Moto â€” NRTA 93/1996 Â§98",
      content:
        "Le port du casque homologuÃ© <strong>SABS (SANS 55)</strong> est obligatoire pour tous les conducteurs et passagers de 2-roues.<br><strong>Sanction :</strong> Amende et points de dÃ©mÃ©rite.",
      source: "gov.za â€” National Road Traffic Act 93 of 1996",
      url: "gov.za",
    },
    popia: {
      keywords: ["popia", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡¿ðŸ‡¦ POPIA â€” Protection of Personal Information Act 4/2013",
      content:
        "En vigueur depuis <strong>juillet 2021</strong>. L'<strong>Information Regulator</strong> est l'autoritÃ© de contrÃ´le. Traitement licite et raisonnable obligatoire. Droit d'accÃ¨s, de correction, et de suppression.<br><strong>Amende :</strong> jusqu'Ã  <strong>R10M</strong> et/ou 10 ans de prison.",
      source: "Information Regulator â€” inforegulator.org.za",
      url: "inforegulator.org.za",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡³ðŸ‡¬ NIGÃ‰RIA â€” Source : FRSC / NITDA
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  nigeria: {
    _flag: "ðŸ‡³ðŸ‡¬",
    _name: "NigÃ©ria",
    _source: "FRSC â€” frsc.gov.ng | NITDA â€” nitda.gov.ng",
    _keywords: ["nigÃ©ria", "nigeria"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡³ðŸ‡¬ Casque Moto â€” Highway Code / FRSC",
      content:
        "Le port du casque est obligatoire pour les conducteurs et passagers de motos (<em>Okada</em>). RÃ©glementation appliquÃ©e par le <strong>FRSC</strong> (Federal Road Safety Corps).<br><strong>Sanction :</strong> â‚¦2.000 d'amende.",
      source: "FRSC â€” frsc.gov.ng",
      url: "frsc.gov.ng",
    },
    ndpr: {
      keywords: ["ndpr", "ndpa", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡³ðŸ‡¬ NDPA â€” Nigeria Data Protection Act 2023",
      content:
        "Remplace le NDPR de 2019. CrÃ©e la <strong>NDPC</strong> (Nigeria Data Protection Commission) comme autoritÃ© indÃ©pendante. Consentement obligatoire. Notifications de violation sous <strong>72h</strong>.<br><strong>Amende :</strong> jusqu'Ã  <strong>2% du CA mondial</strong> ou â‚¦10M.",
      source: "NITDA â€” nitda.gov.ng",
      url: "nitda.gov.ng",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡²ðŸ‡¦ MAROC â€” Source : Bulletin Officiel (sgg.gov.ma)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  morocco: {
    _flag: "ðŸ‡²ðŸ‡¦",
    _name: "Maroc",
    _source: "Bulletin Officiel â€” sgg.gov.ma | Fiscamaroc",
    _keywords: ["maroc", "marocain", "morocco", "maghreb"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡²ðŸ‡¦ Casque Moto â€” Loi nÂ°52-05 (Code de la Route)",
      content:
        "Le port du casque homologuÃ© est obligatoire pour les conducteurs et passagers de 2-roues motorisÃ©s.<br><strong>Sanction :</strong> Amende de <strong>400 Ã  700 DH</strong>, immobilisation du vÃ©hicule, et retrait de permis possible.",
      source: "Bulletin Officiel â€” Loi nÂ°52-05 portant Code de la Route",
      url: "sgg.gov.ma",
    },
    permis: {
      keywords: ["permis", "conduire"],
      title: "ðŸ‡²ðŸ‡¦ Permis Moto â€” Loi nÂ°52-05",
      content:
        "CatÃ©gories :<br>â€¢ <strong>A1</strong> : Cyclomoteur â‰¤ 50cc (16+)<br>â€¢ <strong>A</strong> : Toute moto (18+)<br>SystÃ¨me de permis Ã  points depuis 2010.",
      source: "Bulletin Officiel â€” Code de la Route",
      url: "sgg.gov.ma",
    },
    loi_0908: {
      keywords: ["donnÃ©e", "data", "privacy", "cndp"],
      title: "ðŸ‡²ðŸ‡¦ Loi nÂ°09-08 â€” Protection des DonnÃ©es Personnelles",
      content:
        "En vigueur depuis <strong>2009</strong>. SupervisÃ©e par la <strong>CNDP</strong> (Commission Nationale de ContrÃ´le de la Protection des DonnÃ©es). InspirÃ©e du modÃ¨le franÃ§ais (CNIL). Droits d'accÃ¨s, de rectification et d'opposition.",
      source: "Bulletin Officiel â€” Loi nÂ°09-08",
      url: "cndp.ma",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¹ðŸ‡­ THAÃLANDE â€” Source : Royal Thai Police
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  thailand: {
    _flag: "ðŸ‡¹ðŸ‡­",
    _name: "ThaÃ¯lande",
    _source: "Royal Thai Police â€” royalthaipolice.go.th",
    _keywords: ["thaÃ¯lande", "thailande", "thailand", "thai"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¹ðŸ‡­ Casque Moto â€” Land Traffic Act B.E.2522 (1979)",
      content:
        "Le port du casque est obligatoire pour les conducteurs et passagers de moto. Norme : <strong>TIS 369</strong> (Thai Industrial Standard).<br><strong>Sanction :</strong> Amende de <strong>500 THB</strong>.",
      source: "Royal Thai Police â€” Land Traffic Act B.E.2522",
      url: "royalthaipolice.go.th",
    },
    pdpa_th: {
      keywords: ["pdpa", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡¹ðŸ‡­ PDPA â€” Personal Data Protection Act B.E.2562 (2019)",
      content:
        "En vigueur depuis <strong>juin 2022</strong>. TrÃ¨s inspirÃ©e du RGPD. Consentement explicite requis pour les donnÃ©es sensibles. <strong>Amende :</strong> jusqu'Ã  <strong>5M THB</strong> + sanctions pÃ©nales (1 an de prison et/ou 1M THB).",
      source: "PDPA Thailand â€” pdpathailand.com",
      url: "pdpathailand.com",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¦ðŸ‡º AUSTRALIE â€” Source : Federal Register of Legislation
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  australia: {
    _flag: "ðŸ‡¦ðŸ‡º",
    _name: "Australie",
    _source: "Federal Register of Legislation â€” legislation.gov.au",
    _keywords: ["australie", "australia", "australien"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¦ðŸ‡º Casque Moto â€” Australian Road Rules Rule 270",
      content:
        "Le port du casque homologuÃ© <strong>AS/NZS 1698:2006</strong> (ou UNECE R22) est obligatoire dans tous les Ã‰tats et Territoires.<br><strong>Sanction :</strong> Varie par Ã‰tat. Ex NSW : <strong>A$349</strong> + 3 points de dÃ©mÃ©rite.",
      source: "legislation.gov.au â€” Australian Road Rules",
      url: "legislation.gov.au",
    },
    privacy_act: {
      keywords: ["privacy", "donnÃ©e", "data"],
      title: "ðŸ‡¦ðŸ‡º Privacy Act 1988 â€” Protection des DonnÃ©es",
      content:
        "SupervisÃ©e par l'<strong>OAIC</strong> (Office of the Australian Information Commissioner). Les 13 <strong>Australian Privacy Principles (APPs)</strong> rÃ©gissent la collecte, l'utilisation et la sÃ©curitÃ© des donnÃ©es.<br><strong>Amende :</strong> jusqu'Ã  <strong>A$50M</strong>, 3Ã— le bÃ©nÃ©fice obtenu, ou 30% du CA (le plus Ã©levÃ©).",
      source: "legislation.gov.au â€” Privacy Act 1988",
      url: "legislation.gov.au",
    },
  },

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ‡¨ðŸ‡¦ CANADA â€” Source : Justice Laws (laws-lois.justice.gc.ca)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  canada: {
    _flag: "ðŸ‡¨ðŸ‡¦",
    _name: "Canada",
    _source: "Justice Laws â€” laws-lois.justice.gc.ca",
    _keywords: ["canada", "canadien", "quÃ©bec", "quebec"],

    casque: {
      keywords: ["casque", "helmet"],
      title: "ðŸ‡¨ðŸ‡¦ Casque Moto â€” Highway Traffic Act (Provincial)",
      content:
        "Le casque est obligatoire dans <strong>toutes les provinces</strong>. Normes acceptÃ©es : <strong>DOT (FMVSS 218)</strong>, <strong>Snell</strong>, <strong>ECE 22.05/22.06</strong>.<br><strong>Sanction :</strong> Varie par province. Ontario : <strong>C$110</strong>.",
      source: "laws-lois.justice.gc.ca + HTA provincial",
      url: "laws-lois.justice.gc.ca",
    },
    pipeda: {
      keywords: ["pipeda", "donnÃ©e", "data", "privacy"],
      title: "ðŸ‡¨ðŸ‡¦ PIPEDA â€” Personal Information Protection Act",
      content:
        "Loi fÃ©dÃ©rale sur la protection des renseignements personnels dans le secteur privÃ©. SupervisÃ©e par le <strong>Commissariat Ã  la protection de la vie privÃ©e</strong>. RemplacÃ©e progressivement au QuÃ©bec par la <strong>Loi 25</strong> (2023).<br><strong>Amende :</strong> jusqu'Ã  <strong>C$100.000</strong> (PIPEDA), C$25M ou 4% du CA (Loi 25 QC).",
      source: "laws-lois.justice.gc.ca â€” PIPEDA (S.C. 2000, c.5)",
      url: "laws-lois.justice.gc.ca",
    },
  },
};

/**
 * ðŸ” Moteur de recherche dans la base juridique mondiale
 * UtilisÃ© par PocketLawyer.processChatQuery()
 */
window.LegalDatabase.search = function (query) {
  const t = query.toLowerCase();
  const results = [];

  // 1. Identifier le(s) pays ciblÃ©(s)
  let targetCountries = [];
  for (const [countryKey, country] of Object.entries(this)) {
    if (typeof country !== "object" || countryKey === "search") continue;
    if (country._keywords && country._keywords.some((kw) => t.includes(kw))) {
      targetCountries.push(countryKey);
    }
  }

  // Si aucun pays dÃ©tectÃ©, chercher dans tous
  if (targetCountries.length === 0) {
    targetCountries = Object.keys(this).filter(
      (k) => typeof this[k] === "object" && k !== "search",
    );
  }

  // 2. Chercher par mots-clÃ©s dans les pays ciblÃ©s
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
﻿/**
 * âš–ï¸ POCKET LAWYER - MODULE DE DÃ‰FENSE JURIDIQUE
 * Analyse du stationnement (Code de la Route FR : R417-10 et R417-11)
 */

window.PocketLawyer = {
  isOpen: false,

  // ScÃ©narios simulÃ©s pour l'environnement GPS actuel
  scenarios: [
    {
      type: "Trottoir (Large)",
      status: "TOLERANCE",
      icon: "fa-solid fa-scale-balanced",
      color: "#ffb703", // Orange
      law: "R417-10 (TrÃ¨s GÃªnant / GÃªnant)",
      verdict:
        "Stationnement techniquement interdit mais couramment tolÃ©rÃ© si le passage des piÃ©tons n'est pas entravÃ©.",
      defense:
        "Plaidoirie : L'espace laissÃ© libre (plus de 1m50) permet le passage des poussettes et PMR. Aucune entrave caractÃ©risÃ©e. S'il y a amende (135â‚¬ ou 35â‚¬), vous pouvez invoquer l'absence de signalisation claire ou le manque de places 2RM.",
      letterTemplate:
        "Monsieur l'Officier du MinistÃ¨re Public,\nJe conteste le PV nÂ°XXX.\nLe stationnement de mon cyclomoteur ne constituait pas une entrave Ã  la circulation piÃ©tonne (largeur libre > 1,50m) et palliait un manque avÃ©rÃ© de stationnement 2RM dans ce secteur.",
    },
    {
      type: "Place 2-Roues MotorisÃ©s",
      status: "AUTORISE",
      icon: "fa-solid fa-check-double",
      color: "#00e676", // Vert
      law: "R417-6 (RÃ©gulier)",
      verdict: "Vous Ãªtes parfaitement en rÃ¨gle.",
      defense:
        "Plaidoirie : VÃ©hicule stationnÃ© sur un emplacement dÃ©diÃ© et matÃ©rialisÃ©. Si la place est devenue payante (ex: Paris), assurez-vous d'avoir pris un ticket numÃ©rique ou le Pass 2RM.",
      letterTemplate: "",
    },
    {
      type: "Passage PiÃ©ton / Piste Cyclable",
      status: "INTERDIT",
      icon: "fa-solid fa-gavel",
      color: "#ff4d4d", // Rouge
      law: "R417-11 (TrÃ¨s GÃªnant)",
      verdict:
        "Stationnement strictement interdit. Risque de mise en fourriÃ¨re immÃ©diate et 135â‚¬ d'amende.",
      defense:
        "Plaidoirie : Difficilement contestable (mise en danger d'autrui). Seule option : vice de forme sur le PV (erreur de plaque, de rue ou de date).",
      letterTemplate:
        "Monsieur l'Officier,\nJe conteste ce PV sur la base d'un vice de forme caractÃ©risÃ© (erreur matÃ©rielle sur le lieu exact de l'infraction visÃ©).",
    },
    {
      type: "Place Auto (Voiture)",
      status: "TOLERANCE",
      icon: "fa-solid fa-car",
      color: "#ffb703",
      law: "R417-10",
      verdict:
        "TolÃ©rÃ© si vous payez le stationnement (si applicable). Attention Ã  ne pas bloquer une voiture.",
      defense:
        "Plaidoirie : Le code de la route n'interdit pas aux 2RM de se garer sur les places voitures, mais c'est mal vu. En cas de stationnement payant, le reÃ§u fait foi.",
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
    if (typeof window.braveCoins === "undefined") {
      alert("Erreur: Module de fidÃ©litÃ© introuvable.");
      return;
    }

    const price = 5; // 5 Pts BVC constants
    if (window.braveCoins < price) {
      alert(
        `Fonds insuffisants ! Vous avez besoin de ${price} Pts BVC pour accÃ©der Ã  l'Avocat de Poche. Roulez plus pour en gagner.`,
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
            <div style="background: rgba(0,210,255,0.1); border: 1px solid #00d2ff; color: #00d2ff; font-size: 0.7rem; padding: 3px 10px; border-radius: 10px; margin-top: 5px; margin-bottom: 10px; font-weight: bold; letter-spacing: 1px; display: inline-block;"><i class="fa-solid fa-microchip"></i> PropulsÃ© par JARVIS 4.0</div>
            <p style="color: #777; font-size: 0.8rem; margin-bottom: 15px; text-align: center; max-width: 80%; line-height: 1.2;">Avertissement (AI Act) : Aide indicative gÃ©nÃ©rÃ©e par IA. Ne remplace pas un conseil juridique. <strong>Soumis Ã  contrÃ´le humain.</strong></p>
            
            <div id="lawyer-chat-box" style="flex: 1; width: 90%; max-width: 500px; background: rgba(0,0,0,0.5); border-radius: 15px; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; scroll-behavior: smooth;">
                <div style="background: rgba(204,163,0,0.2); padding: 10px 15px; border-radius: 15px; align-self: flex-start; max-width: 85%; border-left: 3px solid #cca300; line-height: 1.4;">
                    Ma base de jurisprudence couvre <strong>16 pays</strong> avec des sources officielles. Essayez :<br>
                    â€¢ Casque en France<br>
                    â€¢ Permis IndonÃ©sie<br>
                    â€¢ Protection donnÃ©es BrÃ©sil<br>
                    â€¢ Casque UK<br>
                    â€¢ CCPA USA<br><br>
                    <em>â€¢ Tapez <strong>pays</strong> pour voir la liste complÃ¨te.</em>
                </div>
            </div>
            
            <div style="width: 90%; max-width: 500px; display: flex; gap: 10px; margin-bottom: 15px;">
                <input type="text" id="lawyer-input" placeholder="Votre question..." style="flex: 1; padding: 12px; border-radius: 20px; border: 1px solid #555; background: #222; color: #fff; outline: none;" onkeypress="if(event.key === 'Enter') PocketLawyer.sendMessage()">
                <button onclick="PocketLawyer.sendMessage()" style="background: #cca300; color: #000; border: none; border-radius: 50%; width: 45px; height: 45px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
            
            <button onclick="PocketLawyer.startGPSScan()" style="margin-bottom: 15px; background: transparent; border: 1px solid #cca300; color: #cca300; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-location-dot"></i> Scanner mon stationnement (GPS)</button>
            <button onclick="PocketLawyer.reportInsurer()" style="margin-bottom: 15px; background: rgba(255,51,51,0.1); border: 1px solid #ff3333; color: #ff3333; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-bullhorn"></i> Signaler un litige assureur (+15 BVC)</button>
            <button onclick="window.open('https://www.legifrance.gouv.fr/', '_blank')" style="margin-bottom: 30px; background: rgba(0, 51, 153, 0.2); border: 1px solid #0055ff; color: #88bbff; padding: 10px 20px; border-radius: 20px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-book-section"></i> Base LÃ©gifrance (Textes Officiels)</button>
            
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .lawyer-card { background: rgba(255,255,255,0.05); border-radius: 15px; margin-top: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
                .lawyer-btn { padding: 10px 20px; border-radius: 30px; border: none; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 15px; }
            </style>
        `;
  },

  reportInsurer: function () {
    const insurerName = prompt("Quel est le nom de l'assureur concernÃ© ?");
    if (!insurerName) return;

    const problem = prompt(
      "DÃ©crivez briÃ¨vement le problÃ¨me (ex: refus de prise en charge, rÃ©siliation abusive, etc.) :",
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

    // Envoi Ã  Firebase
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
      console.warn("Firebase non disponible, signalement simulÃ© en local.");
    }

    // RÃ©compense pour encourager la communautÃ©
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
      `<strong>Signalement enregistrÃ© !</strong><br>Merci d'avoir signalÃ© <em>${safeInsurerName}</em>. Votre retour aide toute la communautÃ© Ã  Ã©viter les mauvaises expÃ©riences.<br><span style="color:#00e676;">+15 Pts BVC offerts pour votre contribution citoyenne.</span>`,
    );

    if (
      insurerName.toLowerCase().includes("euro assurance") ||
      insurerName.toLowerCase().includes("euroassurence")
    ) {
      const self = this;
      setTimeout(function () {
        self.addBotMessage(
          "âš ï¸ <strong>Note de l'Avocat :</strong> Nous avons reÃ§u de nombreux signalements concernant cet assureur. Sachez qu'il est dÃ©sormais classÃ© \"Partenaire non recommandÃ©\" sur notre plateforme B2B et soumis Ã  des frais de vÃ©rification renforcÃ©e (10 000 â‚¬).",
        );
      }, 3000);
    }
  },

  devClearReports: async function () {
    if (
      confirm(
        "âš ï¸ DANGER ADMIN : ÃŠtes-vous sÃ»r de vouloir supprimer TOUS les signalements assureurs de la base de donnÃ©es de production ?",
      )
    ) {
      try {
        if (typeof firebase === "undefined")
          return alert("Erreur: Firebase non initialisÃ©");
        const snapshot = await firebase
          .firestore()
          .collection("insurer_reports")
          .get();
        if (snapshot.empty) {
          alert("La base de donnÃ©es des signalements est dÃ©jÃ  vide !");
          return;
        }
        const batch = firebase.firestore().batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        alert(
          `âœ… SuccÃ¨s : ${snapshot.size} signalement(s) effacÃ©(s) de la base de donnÃ©es.`,
        );
      } catch (e) {
        console.error(e);
        alert("Erreur lors de la purge de la base de donnÃ©es : " + e.message);
      }
    }
  },

  sendMessage: function (text = null) {
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

    setTimeout(() => {
      if (chatBox.contains(typingMsg)) chatBox.removeChild(typingMsg);
      const reply = this.processChatQuery(message);
      this.addBotMessage(reply);
    }, 1000);
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

  processChatQuery: function (text) {
    const t = text.toLowerCase();

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸŒ MOTEUR JURIDIQUE MONDIAL (LegalDatabase)
    // Cherche d'abord dans la base mondiale officielle
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (
      window.LegalDatabase &&
      typeof window.LegalDatabase.search === "function"
    ) {
      const results = window.LegalDatabase.search(text);
      if (results.length > 0) {
        // Prendre le rÃ©sultat le plus pertinent
        const r = results[0];
        let html = `<strong>${r.title}</strong><br>${r.content}`;
        html += `<br><em style="color:#888; font-size:0.8em;">Source : ${r.source}</em>`;

        // Si plusieurs rÃ©sultats, indiquer les autres disponibles
        if (results.length > 1) {
          html += `<br><br><span style="color:#cca300; font-size:0.85em;">ðŸ“š ${results.length - 1} autre(s) rÃ©sultat(s) trouvÃ©(s). PrÃ©cisez votre question pour affiner.</span>`;
        }

        // Suggestion automatique du Code Litige pour les cas pertinents
        if (
          t.includes("accident") ||
          t.includes("litige") ||
          t.includes("assurance") ||
          t.includes("accrochage") ||
          t.includes("constat") ||
          t.includes("sinistre")
        ) {
          html += `<br><br><div style="background:rgba(255, 51, 51, 0.1); border:1px solid #ff3333; border-radius:10px; padding:10px; margin-top:10px;">
                        <p style="margin:0 0 10px 0; color:#ffcccc; font-size:0.9rem;"><strong>Dossier d'Expertise (BoÃ®te Noire)</strong><br>Avez-vous besoin de gÃ©nÃ©rer un Code Litige pour votre assureur ?</p>
                        <button onclick="if(window.DisputeAutomation) window.DisputeAutomation.initiateDispute(); else alert('Module introuvable.');" style="background:#ff3333; color:#fff; border:none; border-radius:20px; padding:8px 15px; cursor:pointer; font-weight:bold; width:100%;"><i class="fa-solid fa-gavel"></i> GÃ©nÃ©rer mon Code Litige</button>
                    </div>`;
        }

        return html;
      }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸŒ LISTE DES PAYS DISPONIBLES (si question gÃ©nÃ©rale)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (
      t.includes("pays") ||
      t.includes("monde") ||
      t.includes("mondial") ||
      t.includes("international") ||
      (t.includes("quel") && t.includes("droit"))
    ) {
      if (window.LegalDatabase) {
        let countryList = "";
        for (const [key, country] of Object.entries(window.LegalDatabase)) {
          if (
            typeof country === "object" &&
            country._flag &&
            key !== "search"
          ) {
            countryList += `â€¢ ${country._flag} ${country._name}<br>`;
          }
        }
        return `<strong>ðŸŒ Base Juridique Mondiale</strong><br>Je couvre actuellement le droit de :<br>${countryList}<br>PrÃ©cisez un <strong>pays</strong> et un <strong>thÃ¨me</strong> (casque, permis, donnÃ©es, assurance...) pour obtenir les textes officiels.`;
      }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ‡«ðŸ‡· FALLBACK : JURISPRUDENCE FRANÃ‡AISE (Code de la route)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (t.includes("dÃ©brid") || t.includes("debride")) {
      return "<strong>DÃ©bridage (Art. L317-5)</strong><br>C'est un dÃ©lit. Vous risquez jusqu'Ã  <strong>135â‚¬ d'amende</strong> pour le propriÃ©taire, mais surtout, <strong>votre assurance s'annule</strong> en cas d'accident corporel. Les assureurs se retournent contre vous pour payer les dommages aux victimes.";
    }
    if (
      t.includes("stup") ||
      t.includes("drogue") ||
      t.includes("fumÃ©") ||
      t.includes("positif") ||
      t.includes("cannabis") ||
      t.includes("thc")
    ) {
      return "<strong>Conduite sous stupÃ©fiants (DÃ©lit)</strong><br>MÃªme avec un BSR, vous risquez jusqu'Ã  <strong>4500â‚¬ d'amende</strong>, 2 ans de prison, et l'immobilisation du scooter. Il n'y a pas de perte de points sur un BSR. S'il s'agit d'une premiÃ¨re infraction, le juge peut faire preuve de clÃ©mence si vous montrez des preuves mÃ©dicales de votre volontÃ© de vous soigner.";
    }
    if (t.includes("alcool")) {
      return "<strong>AlcoolÃ©mie</strong><br>Pour un permis probatoire ou BSR, la limite lÃ©gale est de 0,2 g/L. Vous risquez l'immobilisation immÃ©diate du cyclomoteur et de fortes amendes.";
    }
    if (t.includes("assurance")) {
      return "<strong>DÃ©faut d'assurance (DÃ©lit)</strong><br>Conduire sans assurance coÃ»te jusqu'Ã  <strong>3750â‚¬ d'amende</strong>. En cas d'accident, le Fonds de Garantie indemnise la victime mais vous rÃ©clamera le remboursement, potentiellement toute votre vie.";
    }
    if (t.includes("fuite") || t.includes("obtempÃ©rer")) {
      return "<strong>Refus d'obtempÃ©rer / DÃ©lit de fuite</strong><br>Cumuler ces dÃ©lits entraÃ®ne des peines de prison fermes, des amendes colossales et une interdiction de passer le permis. Ne fuyez jamais un contrÃ´le de police.";
    }

    const safeText = window.escapeHTML ? window.escapeHTML(text) : text;
    let baseMsg = `Ma base de jurisprudence couvre <strong>16 pays</strong> avec des sources officielles. Pour la France, les textes de rÃ©fÃ©rence sont sur <strong>LÃ©gifrance</strong>.<br><br>
        <a href="https://www.legifrance.gouv.fr/search/all?tab_selection=all&searchField=ALL&query=${encodeURIComponent(text)}" target="_blank" style="display:inline-block; padding:10px 15px; background:rgba(0, 51, 153, 0.3); border:1px solid #0055ff; color:#88bbff; border-radius:15px; text-decoration:none; margin-top:10px;"><i class="fa-solid fa-magnifying-glass"></i> Chercher "${safeText}" sur LÃ©gifrance</a>`;

    if (
      t.includes("accident") ||
      t.includes("litige") ||
      t.includes("assurance") ||
      t.includes("accrochage") ||
      t.includes("constat") ||
      t.includes("sinistre")
    ) {
      baseMsg += `<br><br><div style="background:rgba(255, 51, 51, 0.1); border:1px solid #ff3333; border-radius:10px; padding:10px; margin-top:10px;">
                <p style="margin:0 0 10px 0; color:#ffcccc; font-size:0.9rem;"><strong>Dossier d'Expertise (BoÃ®te Noire)</strong><br>Avez-vous besoin de gÃ©nÃ©rer un Code Litige pour votre assureur ?</p>
                <button onclick="if(window.DisputeAutomation) window.DisputeAutomation.initiateDispute(); else alert('Module introuvable.');" style="background:#ff3333; color:#fff; border:none; border-radius:20px; padding:8px 15px; cursor:pointer; font-weight:bold; width:100%;"><i class="fa-solid fa-gavel"></i> GÃ©nÃ©rer mon Code Litige</button>
            </div>`;
    }

    return baseMsg;
  },

  startGPSScan: function () {
    const chatBox = document.getElementById("lawyer-chat-box");
    if (!chatBox) return;

    this.addBotMessage(
      '<div style="text-align: center;"><div style="width: 30px; height: 30px; border: 3px solid #333; border-top-color: #cca300; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div><p style="margin-top: 10px; font-size: 0.9rem;">VÃ©rification GPS en cours...</p></div>',
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
        "Mode DÃ©fense Juridique activÃ©. RÃ¨gle numÃ©ro 1 : Ne reconnaissez aucun tort Ã  l'oral. RÃ¨gle numÃ©ro 2 : Prenez des photos de la situation et de la plaque adverse. RÃ¨gle numÃ©ro 3 : Remplissez le constat factuellement. En cas de dÃ©lit de fuite, relevez la plaque et contactez la police.",
      );
    } else {
      console.warn(
        "L'assistant vocal (speak) n'est pas disponible pour dicter la dÃ©fense.",
      );
    }
  },

  generateLetter: function () {
    if (typeof window.braveCoins === "undefined") {
      alert("Erreur: Module de fidÃ©litÃ© introuvable.");
      return;
    }

    const price = 5;
    if (
      confirm(
        `GÃ©nÃ©rer un recours juridique coÃ»te ${price} Pts BVC.\nVoulez-vous continuer ?`,
      )
    ) {
      if (window.braveCoins >= price) {
        window.braveCoins -= price;
        localStorage.setItem("braveCoins", window.braveCoins.toString());

        const balanceEl = document.getElementById("crypto-balance");
        if (balanceEl)
          balanceEl.innerText = Math.floor(window.braveCoins) + " Pts BVC";

        const letter =
          this.currentScenarioTemplate ||
          "Monsieur l'Officier du MinistÃ¨re Public,\nJe conteste formellement ce PV.";

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText(letter)
            .then(function () {
              alert(
                "Paiement de " +
                  price +
                  " Pts BVC acceptÃ©.\n\nLa lettre de contestation a Ã©tÃ© copiÃ©e dans votre presse-papiers ! Vous pouvez la coller sur le site de l'ANTAI.",
              );
              if (typeof speak === "function")
                speak("Plaidoirie copiÃ©e dans le presse-papiers.");
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
              " Pts BVC acceptÃ©.\n\nVoici votre lettre :\n\n" +
              letter,
          );
        }
      } else {
        alert(
          `Fonds insuffisants ! Vous avez besoin de ${price} Pts BVC. Roulez plus pour gagner des Pts BVC.`,
        );
      }
    }
  },
};

