import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';
import { distanceMeters, createSpeedSmoother, isNightHour, vehicleIconFor } from './geo-math.js';
import { weatherIsStale } from './weather-advice.js';
import { speak, vibrate } from './voice-engine.js';
import {
  configureGps, hasLocationConsent, checkLegalConsent, showGpsBanner, hideGpsBanner,
  startGeolocation, activateLowAccuracyFallback, stopLowAccuracyFallback,
} from './gps-tracking.js';

// Positions GPS → updatePosition ; démarrage du GPS → écran maintenu allumé
// (fonctions déclarées plus bas, disponibles dès maintenant)
configureGps({ onPosition: updatePosition, onWakeLock: requestWakeLock });

// Synchronous session hydration to prevent guest locks for admins/logged-in riders
try {
  const cachedSession = (typeof window.cacheGetItem === "function" && window.cacheGetItem("session")) ||
                        (typeof secureGetItem === "function" && secureGetItem("session")) ||
                        localStorage.getItem("session");
  if (cachedSession && !window.session) {
    window.session = typeof cachedSession === "string" ? JSON.parse(cachedSession) : cachedSession;
  }
} catch (e) {
  console.warn("[app-core] Synchronous session restore failed:", e);
}

import './lite-mode.js';
import './menu-navigation.js';
import './i18n.js';
import './pwa-install.js';
// escapeHTML est maintenant défini dans auth.js (global)

// --- BOOT (Shared Global State across ES Modules) ---

window.map = null;
window.geocoder = null;
window.trafficLayer = null;

window.userMarker = null;
window.accuracyCircle = null;
window.currentPosition = null;
window.routeFerries = [];
window.lastSpokenFerryIndex = -1;
window.hazardMarkers = [];
window.officialPoiMarkers = [];
window.wakeLock = null;
window.isRiding = false;
window.lastSpokenHazard = null;
window.nightModeActive = false;
window.isParkingMode = false;
window.parkingStartPos = null;
window.perfStartTime = null;
window.isPerfTracking = false;

window.isRodageActive = false;
window.isGarageVisible = false;
window.garageStatus = "dispo";
window.getVehicleIcon = vehicleIconFor;

// --- SECURITY SYSTEMS STATE ---
window.lastMovementTime = Date.now();
window.isGuardianPromptActive = false;
window.guardianCheckInterval = null;
window.gForceThreshold = 4.5; // G force for impact detection
window.currentLeanAngle = 0;
window.maxLeanAngle = 0;
window.isTelemetryActive = false;

// --- INITIALIZATION ---

function updateUILabels() {
  if (typeof window.updateI18N === "function") {
    window.updateI18N();
  }
  const displayUser = document.getElementById("display-username");
  if (displayUser && window.session && window.session.username) {
    displayUser.textContent = window.session.username;
  }
}
window.updateUILabels = updateUILabels;

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
// gmaps-compat.js n'utilise « styles » que pour activer le thème sombre de la carte (liste non vide)
const DARK_MAP_STYLE = [{ theme: "dark" }];

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
      styles: window.isLiteMode ? [] : DARK_MAP_STYLE, // Retirer style lourd en lite
      disableDefaultUI: true,
      zoomControl: false,
      tilt: window.isLiteMode ? 0 : 45, // Pas de 3D en lite
      mapTypeId: window.isLiteMode ? "roadmap" : undefined,
      gestureHandling: "greedy",
    });

    // NEXUS ATLAS : Requêtes Spatiales - Recharger les hazards visibles lors du déplacement
    map.addListener("idle", () => {
      // Si la carte a bougé et est immobile on requête dynamiquement
      // On s'assure que la fonction est accessible via window. 
      // Puisque loadHazards() a été exporté / géré par registerAction, elle devrait être appelable 
      if (typeof window.executeAction === "function") {
         window.executeAction('loadHazards');
      } else if (typeof loadHazards === "function") {
         loadHazards();
      }

      // UX Moderne : Afficher le bouton "Rechercher dans cette zone" pour les POI payants
      if (typeof window.executeAction === "function") {
         window.executeAction('checkMapPanForRadar');
      } else if (typeof window.checkMapPanForRadar === "function") {
         window.checkMapPanForRadar();
      }
    });

    geocoder = new google.maps.Geocoder();
    trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);
    if (google.maps.DirectionsService) {
      window.directionsService = new google.maps.DirectionsService();
    }
    try {
      const routesLib = await google.maps.importLibrary("routes");
      window.googleLibraries.routes = routesLib;
    } catch (e) {
      console.info("mon50cc Maps : Routes API moderne non disponible, fallback vers DirectionsService/OSRM activé.");
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
    // eslint-disable-next-line no-restricted-syntax
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

  if (typeof runCinematicStartup === "function") runCinematicStartup();

  checkTrialExpiration();
  updateUILabels();
  if (window.session && document.getElementById("mileage-hud")) {
    document.getElementById("mileage-hud").textContent =
      `${(window.session.totalDistance || 0).toFixed(1)} KM`;
  }

  if (typeof loadHazards === "function") loadHazards();
  if (typeof renderRoadbooks === "function") renderRoadbooks();
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
      // eslint-disable-next-line no-restricted-syntax
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
// Le GPS dépend uniquement de l'écran « Utilisation de vos données de localisation »
// (divulgation exigée par Google Play), pas de la bannière de cookies Axeptio.
const getSmoothedSpeed = createSpeedSmoother(5);

function updatePosition(position) {
  // Arrêt du mode basse précision si on récupère un signal GPS correct (< 100 m)
  stopLowAccuracyFallback(position.coords.accuracy);
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
  const isGuest = !window.session || window.session.isGuest;
  const isAdmin = window.session && window.session.role === "admin";

  if (isGuest && !isAdmin) {
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
              "Veuillez créer un compte pour accéder à l'Arbitre de la Route ! ⚖️ 🛵",
            );
      },
    );
  } else {
    document.getElementById("menu-insurance")?.classList.remove("locked-feature");
    document.getElementById("menu-mechanic")?.classList.remove("locked-feature");
    document.getElementById("menu-garage")?.classList.remove("locked-feature");
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

    // Effet de vitesse sur le HUD adapté à la motorisation
    const motorType = window.session?.motor || "2t";
    const isMicroMobility = motorType === "trottinette" || motorType === "velo";
    const fastThreshold = isMicroMobility ? 24 : 40;
    const warnThreshold = isMicroMobility ? 18 : 25;

    if (speedKmh > fastThreshold) {
      speedEl.parentElement.classList.add("fast");
      speedEl.style.color = "var(--danger)";
      vibrate(50);
      if (window.NeuralHUD)
        window.NeuralHUD.logToConsole(`VELOCITY_ALERT: ${isMicroMobility ? 'EDPM_SPEED_LIMIT_EXCEEDED (25 km/h)' : 'HIGH_SPEED_DETECTED'} (${speedKmh} km/h)`);
    } else if (speedKmh > warnThreshold) {
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

    // vMax Tracking (NEW v25) — seulement avec un profil chargé. Sans ce test, un visiteur
    // non connecté provoquait une erreur qui interrompait la suite (météo, dangers proches).
    if (window.session && (!window.session.vMax || speedKmh > window.session.vMax)) {
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
      // eslint-disable-next-line no-restricted-syntax
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

  // Météo Auto : récupérée au premier fix GPS puis toutes les 15 min (avant : une seule fois
  // par session). Une tentative par minute au plus, même si la requête échoue.
  if (
    typeof window.fetchWeather === "function" &&
    weatherIsStale(window.currentWeather) &&
    Date.now() - (window.lastWeatherFetchAt || 0) > 60000
  ) {
    window.lastWeatherFetchAt = Date.now();
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

const getDistance = distanceMeters;

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
  // eslint-disable-next-line no-restricted-syntax
toast.innerHTML = `
        <p>Toujours là : <strong>${type}</strong> ?</p>
        <div style="display:flex; gap:10px;">
            <button data-action="confirmHazard(${index}, true)">✅ Oui</button>
            <button data-action="confirmHazard(${index}, false)">&#10060; Non</button>
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

// --- NEW: Auto Night Mode ---
function checkNightMode() {
  const isNight = isNightHour(new Date().getHours());
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
  if (currentLeanAngle > maxLeanAngle) {
    maxLeanAngle = currentLeanAngle;
    window.maxLeanAngle = maxLeanAngle;
  }

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

// --- Action Registry (ESM) ---
registerAction('updateUILabels', updateUILabels);
registerAction('checkTrialExpiration', checkTrialExpiration);
registerAction('requestWakeLock', requestWakeLock);
registerAction('hasLocationConsent', hasLocationConsent);
registerAction('checkLegalConsent', checkLegalConsent);
registerAction('showGpsBanner', showGpsBanner);
registerAction('hideGpsBanner', hideGpsBanner);
registerAction('startGeolocation', startGeolocation);
registerAction('activateLowAccuracyFallback', activateLowAccuracyFallback);
registerAction('getSmoothedSpeed', getSmoothedSpeed);
registerAction('updatePosition', updatePosition);
registerAction('getDistance', getDistance);
registerAction('checkHazardProximity', checkHazardProximity);
registerAction('showHazardConfirmation', showHazardConfirmation);
registerAction('vibrate', vibrate);
registerAction('speak', speak);
registerAction('checkNightMode', checkNightMode);
