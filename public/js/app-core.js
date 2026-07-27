// --- LITE MODE (PERFORMANCE) ---
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
