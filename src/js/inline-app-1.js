import { db, auth, CONFIG, secureGetItem, secureSetItem } from './config.js';
import { registerAction } from './actionRegistry.js';

window.mapsSDKLoaded = false;

window.initMap = function () {
  console.log("mon50cc Maps : SDK chargé avec succès.");
  window.mapsSDKLoaded = true;
  if (typeof window.initMapController === "function") {
    window.initMapController();
  }
};

function loadMapsSDK() {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const selectedKey =
    typeof CONFIG !== "undefined" && CONFIG.MAPS
      ? isAndroid
        ? CONFIG.MAPS.ANDROID
        : CONFIG.MAPS.PC
      : "";

  if (!selectedKey) {
    console.error("mon50cc Loader : Clé API Maps manquante !");
    forceStartApp("ERREUR_CONFIG_API");
    return;
  }

  const injectGoogleMaps = () => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${selectedKey}&libraries=geometry,places,marker&v=beta&callback=initMap&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = function () {
      console.error(
        "mon50cc Loader : Échec critique du chargement Maps SDK.",
      );
      forceStartApp("ÉCHEC_RÉSEAU_SDK");
    };
    document.head.appendChild(script);
  };

  // Blocage Axeptio (RGPD)
  window._axcb = window._axcb || [];
  window._axcb.push(function(axeptio) {
    axeptio.on("cookies:complete", function(choices) {
      if (choices.google_maps || choices.$$all) {
        injectGoogleMaps();
      } else {
        console.warn("mon50cc Loader : Consentement Google Maps refusé par Axeptio.");
        forceStartApp("REFUS_RGPD");
      }
    });
  });
}

function initFallbackMap() {
  try {
    if (window.fallbackMapInitialized) return;
    if (typeof L === "undefined") return;
    window.fallbackMapInitialized = true;
    const mapEl = document.getElementById("map");
    if (!mapEl) return;

    // eslint-disable-next-line no-restricted-syntax
    mapEl.innerHTML = "";
    const leafletMap = L.map("map", {
      zoomControl: false,
      attributionControl: false,
    }).setView([48.8566, 2.3522], 14);
    window.leafletMap = leafletMap; // Rendre accessible globalement pour le suivi GPS

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      },
    ).addTo(leafletMap);

    const neonIcon = L.divIcon({
      html: '<div style="width:16px;height:16px;background:#00d2ff;border-radius:50%;box-shadow:0 0 10px #00d2ff, 0 0 20px #00d2ff;border:2px solid #fff;"></div>',
      className: "",
      iconSize: [16, 16],
    });
    window.leafletUserMarker = L.marker([48.8566, 2.3522], {
      icon: neonIcon,
    }).addTo(leafletMap);

    // Fonction de mise à jour GPS pour la carte Leaflet
    window.updatePositionLeaflet = function (lat, lng) {
      if (window.leafletMap) {
        window.leafletMap.panTo([lat, lng]);
      }
      if (window.leafletUserMarker) {
        window.leafletUserMarker.setLatLng([lat, lng]);
      }
    };

    console.log(
      "mon50cc : Fallback Leaflet Map Initialized (GPS-linked)",
    );
  } catch (e) {
    console.error("mon50cc : Leaflet Fallback failed", e);
  }
}

function forceStartApp(reason) {
  console.warn("mon50cc : Démarrage forcé (" + reason + ")");
  const statusEl = document.getElementById("loader-status");
  if (statusEl) statusEl.textContent = "Lancement (Mode Dégradé)...";

  // On s'assure que checkAuth est défini (fail-safe)
  if (typeof window.checkAuth !== "function") {
    window.checkAuth = () => {
      return { username: "Pilote", isGuest: true };
    };
  }

  setTimeout(initFallbackMap, 500);

  setTimeout(() => {
    if (typeof window.startApp === "function") window.startApp();
  }, 800);
}

// --- CORE NAVIGATION (ULTIMATE BYPASS) ---
window.toggleMenu = function () {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  if (sidebar) {
    sidebar.classList.toggle("active");
    if (overlay) overlay.classList.toggle("active");
    console.log("mon50cc : Menu Toggle (Bypass Mode)");
  }
};

// --- CACHE PURGE FORCE ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      if (window.location.search.includes("purge=true")) {
        registration.unregister();
        console.log("mon50cc : Service Worker Unregistered (Purge Mode)");
      }
    }
  });
}

// On lance le chargement dès que config.js est là
window.addEventListener("load", () => {
  // Pattern Promise : charger Maps avec fallback propre (plus de race conditions setTimeout)
  const mapsReady = new Promise((resolve) => {
    loadMapsSDK();
    // Vérifier périodiquement si Maps est chargé
    const check = setInterval(() => {
      if (window.mapsSDKLoaded) { clearInterval(check); resolve('maps'); }
    }, 200);
  });

  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve('timeout'), 5000);
  });

  Promise.race([mapsReady, timeout]).then((winner) => {
    if (winner === 'timeout' && !window.mapsSDKLoaded) {
      console.warn("mon50cc : Google Maps trop long, fallback sur Leaflet");
      forceStartApp("TIMEOUT_SDK");
    }
  });

  // Démarrage de l'app une fois les modules chargés
  Promise.resolve().then(() => {
    if (typeof window.startApp === "function") window.startApp();
  });

  // Masquer le loader après un délai raisonnable
  setTimeout(() => {
    const loader = document.getElementById("app-loader");
    if (loader && loader.style.visibility !== "hidden") {
      console.warn("mon50cc : Hiding Loader");
      loader.style.opacity = "0";
      setTimeout(() => (loader.style.visibility = "hidden"), 800);
    }
  }, 2000);
});
