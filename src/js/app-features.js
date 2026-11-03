import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

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
        // eslint-disable-next-line no-restricted-syntax
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
      // eslint-disable-next-line no-restricted-syntax
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
  c.replaceChildren();
  Object.keys(maintenanceIntervals).forEach((k) => {
    const total = window.session.totalDistance || 0;
    const last = (window.session.maintenance || {})[k] || 0;
    const percent = Math.min(
      ((total - last) / maintenanceIntervals[k]) * 100,
      100,
    );
    const item = document.createElement("div");
    item.className = "garage-item";
    const span = document.createElement("span");
    span.textContent = k.toUpperCase();
    const barBg = document.createElement("div");
    barBg.className = "garage-bar-bg";
    const barFill = document.createElement("div");
    barFill.className = "garage-bar-fill";
    barFill.style.width = `${percent}%`;
    barBg.appendChild(barFill);
    item.appendChild(span);
    item.appendChild(barBg);
    c.appendChild(item);
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
    // eslint-disable-next-line no-restricted-syntax
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

  // eslint-disable-next-line no-restricted-syntax
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
    // eslint-disable-next-line no-restricted-syntax
list.innerHTML = `<p style="text-align:center; color:#666; margin-top:20px;">Aucun roadbook ${filter === "favorites" ? "favori" : "enregistré"}.</p>`;
    return;
  }

  // eslint-disable-next-line no-restricted-syntax
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
                    <button data-action="toggleFavoriteRoadbook(${globalIdx})" style="background:transparent; color:${isFav ? "#f1c40f" : "#444"}; border:none; font-size:1.2rem; cursor:pointer;" title="Ajouter aux favoris">
                        <i class="fa-${isFav ? "solid" : "regular"} fa-star"></i>
                    </button>
                    <button data-action="loadRoadbook(${globalIdx})" style="background:#2ecc71; color:white; border:none; padding:5px 10px; border-radius:5px; font-size:0.7rem;">Go</button>
                    <button data-action="shareRoadbook(${globalIdx})" style="background:#00d2ff; color:black; border:none; padding:5px 10px; border-radius:5px; font-size:0.7rem;"><i class="fa-solid fa-share"></i></button>
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
    // eslint-disable-next-line no-restricted-syntax
toast.innerHTML = '<i class="fa-solid fa-plane"></i> Mode hors-ligne - Navigation limitée';
    document.body.appendChild(toast);
    speak("Mode hors-ligne activé.");
  } else {
    const toast = document.getElementById("offline-toast");
    if (toast) {
      toast.style.background = "rgba(46,204,113,0.9)";
      // eslint-disable-next-line no-restricted-syntax
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
  // eslint-disable-next-line no-restricted-syntax
toast.innerHTML = `
        <i class="fa-solid fa-shield-heart fa-beat" style="font-size:4rem; color:#00d2ff; margin-bottom:20px;"></i>
        <h2>Guardian Mode</h2>
        <p>Arrêt prolongé détecté. <br>Confirmation requise.</p>
        <button data-action="dismissGuardian()" style="margin-top:20px; width:100%; border:none; padding:20px; border-radius:50px; background:#00d2ff; color:black; font-weight:bold; font-size:1.2rem;">TOUT VA BIEN ✅</button>
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
      const caseId = "GARAGE-" + Date.now();

      if (!window.ApiClient) {
        throw new Error("Module API non chargé.");
      }

      const orderData = await window.ApiClient.authFetch("createRevolutOrder", {
        method: "POST",
        body: {
          case_id: caseId,
          report_type: "GARAGE_FEE",
        },
      });

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
              const data = await window.ApiClient.authFetch("checkPaymentStatus", {
                method: "GET",
                query: { case_id: caseId, user_id: window.session?.uid || "" }
              });
              if (data && data.paid) {
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
  alert(
    "Les demandes de partenariat Garage avec exonération font l'objet d'un audit de convention par l'équipe administrative mon50ccetmoi.\n\nVeuillez adresser votre KBIS et votre charte signée à contact@mon50ccetmoi.com pour instruction."
  );
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

  // eslint-disable-next-line no-restricted-syntax
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
      // eslint-disable-next-line no-restricted-syntax
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

    // eslint-disable-next-line no-restricted-syntax
container.innerHTML = html;
  } catch (e) {
    console.error("[MAINT-LOGS] Load error:", e);
    // Si l'index Firestore n'existe pas encore, afficher un message clair
    if (e.code === "failed-precondition") {
      // eslint-disable-next-line no-restricted-syntax
container.innerHTML = '<p style="color:#f39c12; text-align:center; font-size:0.7rem; padding:10px;"><i class="fa-solid fa-triangle-exclamation"></i> Index Firestore en cours de création. Réessayez dans quelques minutes.</p>';
    } else {
      // eslint-disable-next-line no-restricted-syntax
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
  // eslint-disable-next-line no-restricted-syntax
botDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyse des textes de loi...';
  chat.appendChild(botDiv);

  if (typeof window.processArbitreQuery === "function") {
    window.processArbitreQuery(query).then((response) => {
      // eslint-disable-next-line no-restricted-syntax
botDiv.innerHTML = response;
      chat.scrollTop = chat.scrollHeight;
    });
  } else {
    setTimeout(() => {
      // eslint-disable-next-line no-restricted-syntax
botDiv.innerHTML = "Désolé, le module juridique est en cours de mise à jour.";
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

  // eslint-disable-next-line no-restricted-syntax
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
            <button data-action="document.getElementById('ride-card-overlay').remove()" style="background:transparent; color:#555; border:none; cursor:pointer;">FERMER</button>
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
    // eslint-disable-next-line no-restricted-syntax
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
      const searchEl = document.getElementById("route-search");
      if (searchEl) searchEl.value = "Zone d'Exploration D-7";
      if (typeof calculateRouteSansAutoroute === "function") {
        calculateRouteSansAutoroute({ lat, lng }, { lat: destLat, lng: destLng });
      }
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
      // eslint-disable-next-line no-restricted-syntax
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

// --- Action Registry (ESM) ---
registerAction('calculateDistanceAndBadges', calculateDistanceAndBadges);
registerAction('saveSessionAndCheckBadges', saveSessionAndCheckBadges);
registerAction('checkUserBadges', checkUserBadges);
registerAction('updateOnlineStatus', updateOnlineStatus);
registerAction('startGuardianPrompt', startGuardianPrompt);
registerAction('checkFerryProximity', checkFerryProximity);
registerAction('getSOSActions', getSOSActions);
registerAction('generateRideCard', generateRideCard);
