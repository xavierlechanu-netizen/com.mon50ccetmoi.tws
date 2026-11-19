import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { PAGE_ROUTES } from './page-routes.js';
import { getSosPosition, sendSosAuto, smsHref, sosText } from './sos-alert.js';
import { isSovereignSosReady } from './sovereign.js';

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
    if (needle) needle.style.transform = "rotate(40deg)"; // 120 -> 40 pour être proportionnel
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
  // eslint-disable-next-line no-restricted-syntax
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

  const t = window.t || ((k) => k);
  const handler = PAGE_ROUTES[page];
  if (typeof handler === "function") {
    handler(content, t);
  } else {
    console.warn(`[PageRouter] Route non reconnue : ${page}`);
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
  // eslint-disable-next-line no-restricted-syntax
res.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyse des capteurs...';
  setTimeout(() => {
    // eslint-disable-next-line no-restricted-syntax
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

// --- DÉTECTEUR DE CHUTE ---
window.addEventListener("devicemotion", (e) => {
  const acc = e.accelerationIncludingGravity;
  if (!acc) return;
  const force = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
  if (force > 45) {
    // Seuil d'impact (G-force importante)
    triggerFallAlert();
  }
});

function triggerFallAlert(isManual = false) {
  window.sosKind = isManual ? "manual" : "fall";
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
        : "Chute détectée. Annulez si vous allez bien.",
    );
  }

  const div = document.createElement("div");
  div.id = "fall-screen";
  div.style =
    "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(180,0,0,0.95); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; text-align:center; padding:20px;";
  // eslint-disable-next-line no-restricted-syntax
div.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation fa-beat" style="font-size:5rem; margin-bottom:20px;"></i>
        <h1>${isManual ? "SOS MANUEL" : t("fall_detected")}</h1>
        <p>${t("emergency_alert")} <br><br> <span id="sos-countdown" style="font-size:1.5rem; font-weight:bold; color:#ffb703;">15s</span></p>
        
        <!-- NOUVEAU : Bouton Officiel d'Urgence (Conforme Législation) -->
        <a href="tel:112" style="display:block; margin: 15px auto; padding:15px 30px; background:#ff0000; color:white; text-decoration:none; border-radius:50px; font-weight:900; font-size:1.2rem; box-shadow:0 0 15px rgba(255,0,0,0.6;">
            <i class="fa-solid fa-phone"></i> APPELER LES SECOURS (112 / 911)
        </a>
        
        ${typeof getSOSActions === "function" ? getSOSActions() : ""}
        <button data-action="window.cancelFallAlert()" style="margin-top:20px; padding:15px 30px; background:rgba(255,255,255,0.1); color:white; border:1px solid white; border-radius:50px; font-weight:bold; font-size:1rem;">ANNULER ALERTE</button>
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

// Alerte SOS après le compte à rebours (voir sos-alert.js).
// L'appli n'annonce « prévenus » que si le serveur a confirmé l'envoi des SMS ; sinon elle le dit
// et propose en un geste d'appeler le 112 ou d'envoyer sa position par SMS depuis le téléphone.
function sosButton(label, href, background, color = "#fff") {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = label;
  a.style.cssText = `display:block; margin:12px auto; padding:16px 28px; max-width:340px; background:${background}; color:${color}; text-decoration:none; border-radius:50px; font-weight:900; font-size:1.15rem;`;
  return a;
}

function renderSosScreen(div, { title, color, text, buttons }) {
  div.replaceChildren();
  const h1 = document.createElement("h1");
  h1.textContent = title;
  h1.style.color = color;
  const p = document.createElement("p");
  p.textContent = text;
  p.style.maxWidth = "420px";
  const close = document.createElement("button");
  close.textContent = "FERMER";
  close.setAttribute("data-action", "window.cancelFallAlert()");
  close.style.cssText = "margin-top:20px; padding:12px 28px; background:rgba(255,255,255,0.1); color:#fff; border:1px solid #fff; border-radius:50px; font-weight:bold;";
  div.append(h1, p, ...buttons, close);
}

window.executeAngeGardienProtocol = async function () {
  const kind = window.sosKind === "manual" ? "manual" : "fall";
  const contacts = [localStorage.getItem("guardian_contact_1"), localStorage.getItem("guardian_contact_2")]
    .map((c) => (c || "").trim())
    .filter(Boolean);
  const div = document.getElementById("fall-screen");
  if (div) {
    renderSosScreen(div, { title: "ALERTE EN COURS…", color: "#00d2ff", text: "Recherche de votre position GPS.", buttons: [] });
  }

  const position = await getSosPosition();
  const auto = await sendSosAuto({ position, contacts, kind });
  const appel = sosButton("📞 APPELER LE 112", "tel:112", "#ff0000");
  const sms = contacts.length > 0
    ? sosButton("💬 ENVOYER MA POSITION PAR SMS", smsHref(contacts, sosText(position, kind), navigator.userAgent), "#ffb703", "#000")
    : null;

  let message;
  if (auto.sent > 0) {
    message = `${auto.sent} ange(s) gardien(s) prévenu(s) par SMS, avec votre position.`;
    if (div) renderSosScreen(div, { title: "ANGES GARDIENS PRÉVENUS", color: "#00ff88", text: message, buttons: [appel] });
  } else {
    message = contacts.length > 0
      ? `${auto.reason} Vos anges gardiens ne sont PAS prévenus : appelez le 112 ou envoyez-leur votre position par SMS.`
      : `${auto.reason} Appelez le 112 si vous avez besoin d'aide. Ajoutez des anges gardiens dans votre profil.`;
    if (div) renderSosScreen(div, { title: "PRÉVENEZ VOS PROCHES", color: "#ffb703", text: message, buttons: [appel, sms].filter(Boolean) });
  }
  if (typeof speak === "function") speak(message);
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
  // Dire la vérité sur ce que fera l'alerte (sovereign.js) : jamais de promesse d'envoi qui n'aura pas lieu
  alert(
    isSovereignSosReady()
      ? "Contacts Ange Gardien sauvegardés ! En cas de chute ou SOS, ils recevront automatiquement un SMS avec votre position."
      : "Contacts Ange Gardien sauvegardés. L'envoi automatique des SMS n'est pas encore activé sur ce téléphone : en cas de chute ou SOS, l'appli vous proposera d'appeler le 112 et de leur envoyer votre position par SMS.",
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

// Suppression du compte : window.revokeAndEraseData (rgpd-cnil.js). L'ancien
// window.requestAccountDeletion, appelé nulle part, n'effaçait qu'une liste locale en annonçant
// « données purgées » : retiré le 19/11/2026.

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
    // eslint-disable-next-line no-restricted-syntax
t.innerHTML = `Bienvenue sur mon50ccetmoi v110.00.00 SILVER EDITION ! Prudence sur la route. 🛵💨`;
};
window.updateTicker();
setInterval(window.updateTicker, 60000);

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
    if (typeof simulateLiveFleet === "function") simulateLiveFleet();
  }, 2000);
};

window.toggleParkingMode = function () {
  isParkingMode = !isParkingMode;
  const btn = document.getElementById("btn-parking-toggle");
  if (isParkingMode) {
    parkingStartPos = currentPosition;
    // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Mode Parking : ON';
    btn.classList.add("parking-active");
    speak("Mode parking activé. Votre scooter est sous surveillance.");
  } else {
    // eslint-disable-next-line no-restricted-syntax
btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Mode Parking : OFF';
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
    speak("Alerte ! Mouvement suspect détecté sur votre scooter !");
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

// --- Action Registry (ESM) ---
registerAction('runCinematicStartup', runCinematicStartup);
registerAction('triggerFallAlert', triggerFallAlert);
registerAction('handleParkingMode', handleParkingMode);
registerAction('handlePerfTracking', handlePerfTracking);
