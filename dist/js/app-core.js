// --- LITE MODE (PERFORMANCE) ---
window.isLiteMode = localStorage.getItem('liteMode') === 'true';

window.promptLiteMode = function() {
    const modal = document.createElement('div');
    modal.id = 'lite-modal';
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,10,10,0.95); backdrop-filter:blur(5px); z-index:20000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; padding:30px; text-align:center;";
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

    document.getElementById('btn-accept-lite').onclick = () => {
        window.isLiteMode = true;
        localStorage.setItem('liteMode', 'true');
        document.body.classList.add('lite-mode');
        modal.remove();
        if(typeof speak === 'function') speak("Mode Éco activé pour des performances optimales.");
        setTimeout(() => location.reload(), 500);
    };

    document.getElementById('btn-refuse-lite').onclick = () => {
        window.isLiteMode = false;
        localStorage.setItem('liteMode', 'false');
        modal.remove();
    };
};

if (localStorage.getItem('liteMode') === null) {
    const cores = navigator.hardwareConcurrency || 4;
    const ram = navigator.deviceMemory || 4; // deviceMemory is often undefined on iOS
    
    const ua = navigator.userAgent.toLowerCase();
    const isOldAndroid = ua.includes('android 6') || ua.includes('android 7') || ua.includes('android 8') || ua.includes('android 9');
    const isOldIOS = ua.includes('iphone os 11') || ua.includes('iphone os 12') || ua.includes('iphone os 13');
    const isOldOS = isOldAndroid || isOldIOS;

    // We consider it an old device if it has <= 4 cores, OR <= 3GB of RAM, OR an old OS version
    if (cores <= 4 || ram <= 3 || isOldOS) {
        console.log("Old device detected. Prompting for Lite Mode.");
        const showPrompt = () => { setTimeout(window.promptLiteMode, 500); };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showPrompt);
        } else {
            showPrompt();
        }
    } else {
        window.isLiteMode = false;
        localStorage.setItem('liteMode', 'false');
    }
}

window.toggleLiteMode = function() {
    window.isLiteMode = !window.isLiteMode;
    localStorage.setItem('liteMode', window.isLiteMode ? 'true' : 'false');
    if (window.isLiteMode) {
        document.body.classList.add('lite-mode');
        if(typeof speak === 'function') speak("Mode Éco Performances activé.");
    } else {
        document.body.classList.remove('lite-mode');
        if(typeof speak === 'function') speak("Mode Performances Maximales activé.");
    }
    setTimeout(() => location.reload(), 1500);
};

document.addEventListener("DOMContentLoaded", () => {
    if (window.isLiteMode) document.body.classList.add('lite-mode');
});

// --- CORE NAVIGATION (SAFE ZONE) ---
window.toggleMenu = function() {
    try {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        if (sidebar) {
            sidebar.classList.toggle('active');
            if (overlay) overlay.classList.toggle('active');
            console.log("mon50cc : Menu Toggle OK");
        }
    } catch(e) { console.error("Menu Crash:", e); }
};

window.closeMenu = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
};

// --- I18N SYSTEM ---
// window.currentLang est maintenant géré par i18n.js pour un chargement prioritaire

function updateUILabels() {
    window.updateI18N();
    const displayUser = document.getElementById('display-username');
    if (displayUser && window.session) {
        displayUser.textContent = window.session.username;
    }
}

window.updateI18N = function() {
    // Sidebar Menu
    const mGarage = document.getElementById('menu-garage'); if(mGarage) mGarage.innerHTML = `<i class="fa-solid fa-warehouse"></i> ${t('garage')}`;
    const mRoadbooks = document.getElementById('menu-roadbooks'); if(mRoadbooks) mRoadbooks.innerHTML = `<i class="fa-solid fa-map-location-dot"></i> Roadbooks`;
    const mSafety = document.getElementById('menu-rodage'); if(mSafety) mSafety.innerHTML = `<i class="fa-solid fa-gauge-high"></i> ${t('safety')}`;
    const mInsurance = document.getElementById('menu-insurance'); if(mInsurance) mInsurance.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${t('insurance')}`;
    const mMechanic = document.getElementById('menu-mechanic'); if(mMechanic) mMechanic.innerHTML = `<i class="fa-solid fa-robot"></i> ${t('maintenance')}`;
    const mArbitre = document.getElementById('menu-arbitre'); if(mArbitre) mArbitre.innerHTML = `<i class="fa-solid fa-scale-balanced"></i> ${t('arbitre')}`;
    const lStop = document.getElementById('label-stop-nav'); if(lStop) lStop.textContent = t('stop');
    const lReroute = document.getElementById('label-reroute'); if(lReroute) lReroute.textContent = t('reroute');

    // Map Radar Options
    const gasLabel = document.querySelector('[onclick="scanRadar(\'fuel\')"] span') || document.querySelector('[onclick="scanRadar(\'fuel\')"]');
    if(gasLabel) gasLabel.innerHTML = `<i class="fa-solid fa-gas-pump"></i> ${t('gas')}`;
    const emergencyLabel = document.querySelector('[onclick="scanRadar(\'doctors\')"] span') || document.querySelector('[onclick="scanRadar(\'doctors\')"]');
    if(emergencyLabel) emergencyLabel.innerHTML = `<i class="fa-solid fa-hospital"></i> ${t('emergency')}`;
    const bankLabel = document.querySelector('[onclick="scanRadar(\'atm\')"] span') || document.querySelector('[onclick="scanRadar(\'atm\')"]');
    if(bankLabel) bankLabel.innerHTML = `<i class="fa-solid fa-money-bill-1"></i> ${t('bank')}`;
};
// window.updateI18N(); // Décalé après DOMContentLoaded pour éviter les crashs

// PWA Installation Logic
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btnInstall = document.getElementById('btn-install-pwa');
    if(btnInstall) btnInstall.classList.remove('hidden');
});

window.installPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA Installation outcome: ${outcome}`);
    if (outcome === 'accepted') {
        const btnInstall = document.getElementById('btn-install-pwa');
        if(btnInstall) btnInstall.classList.add('hidden');
    }
    deferredPrompt = null;
};

// Gestion de la touche "Retour" sur Android (PWA)
window.addEventListener('popstate', (e) => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('screen-overlay');
    if (sidebar && !sidebar.classList.contains('sidebar-hidden')) {
        toggleMenu();
        history.pushState(null, null, window.location.pathname);
    } else if (overlay && !overlay.classList.contains('hidden')) {
        closeScreen();
        history.pushState(null, null, window.location.pathname);
    }
});
history.pushState(null, null, window.location.pathname);

// escapeHTML est maintenant défini dans auth.js (global)

// --- BOOT ---
console.log("mon50ccetmoi v100.00-GOLD : Production Ready.");

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
window.getVehicleIcon = function(brand, model) {
    const b = (brand || "").toLowerCase();
    const m = (model || "").toLowerCase();
    const vspBrands = ["citroën", "citroen", "ligier", "microcar", "aixam", "chatenet", "casalini", "ami"];
    if (vspBrands.some(brandName => b.includes(brandName)) || m.includes("ami") || b.includes("voturette") || b.includes("vsp")) {
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
    
    // On récupère les infos calculées par auth.js
    if (window.session && window.session.isTrialExpired) {
        const overlay = document.getElementById('sub-overlay');
        if (overlay) overlay.classList.remove('hidden');
        if(navigator.vibrate) navigator.vibrate(50);
        speak("Alerte abonnement : Votre période d'essai gratuite est terminée.");
    }
}

// Style Cyberpunk Dark Neon pour Google Maps
const GOOGLE_MAPS_STYLE = [
    { "elementType": "geometry", "stylers": [{ "color": "#120024" }] }, // Dark purple/black background
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#00f2ff" }] }, // Neon cyan text
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#120024" }, { "weight": 2 }] },
    { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#ff0055" }] },
    { "featureType": "landscape.man_made", "elementType": "geometry.fill", "stylers": [{ "color": "#1b0a33" }] },
    { "featureType": "landscape.man_made", "elementType": "geometry.stroke", "stylers": [{ "color": "#ff0055" }, { "lightness": -30 }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#ffb700" }] },
    { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#0d011a" }] },
    { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#00f2ff" }] },
    { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#0088ff" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#ffffff" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#ff0055" }] },
    { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#aa0033" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#05000a" }] }
];

window.appStarted = false;

window.initMapController = async function() {
    if (map) return; 
    console.log("mon50cc Maps : Début de l'initialisation du contrôleur...");
    
    const mapElement = document.getElementById('map');
    const statusEl = document.getElementById('loader-status');
    if (!mapElement) {
        console.error("mon50cc Maps : Élément #map introuvable !");
        return;
    }

    try {
        if (typeof google === 'undefined' || !google.maps) {
            throw new Error("SDK_NOT_LOADED");
        }

        // Modern Library Imports
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
        // Suppression de l'import "routes" qui bloque le chargement de la carte (API non activée)

        // PlaceAutocompleteElement (New API)
        let PlaceAutocompleteElement = null;
        try {
            const placesLib = await google.maps.importLibrary("places");
            PlaceAutocompleteElement = placesLib.PlaceAutocompleteElement;
        } catch(e) {
            console.warn("mon50cc Maps : PlaceAutocompleteElement non disponible (plan API).", e.message);
        }

        window.googleLibraries = { Map, AdvancedMarkerElement, PinElement, PlaceAutocompleteElement };

        console.log("mon50cc Maps : Création de l'objet Map...");
        map = new Map(mapElement, {
            center: { lat: 48.8566, lng: 2.3522 },
            zoom: 16,
            styles: window.isLiteMode ? [] : GOOGLE_MAPS_STYLE, // Retirer style lourd en lite
            disableDefaultUI: true,
            zoomControl: false,
            tilt: window.isLiteMode ? 0 : 45, // Pas de 3D en lite
            mapTypeId: window.isLiteMode ? 'roadmap' : undefined,
            gestureHandling: 'greedy'
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
                    polylineOptions: { strokeColor: '#00f2ff', strokeOpacity: 0.8, strokeWeight: 6 }
                });
            } else {
                console.warn("mon50cc Maps : DirectionsService non disponible dans routesLib.");
            }
        } catch(e) {
            console.warn("mon50cc Maps : Erreur initialisation DirectionsService");
        }

        // Autocomplete Classique pour le Départ
        const startInputOld = document.getElementById('route-start');
        let autocompleteStart = null;
        if (startInputOld && google.maps.places) {
            autocompleteStart = new google.maps.places.Autocomplete(startInputOld, {
                fields: ['geometry', 'name']
            });

            autocompleteStart.addListener('place_changed', () => {
                const searchEl = document.getElementById('route-search');
                if (searchEl && searchEl.value.trim() !== "") {
                    window.searchDestination();
                }
            });
        }

        // Autocomplete Classique pour la Recherche (Destination)
        const inputOld = document.getElementById('route-search');
        if (inputOld && google.maps.places) {
            const autocompleteSearch = new google.maps.places.Autocomplete(inputOld, {
                fields: ['geometry', 'name']
            });

            autocompleteSearch.addListener('place_changed', () => {
                const place = autocompleteSearch.getPlace();
                if (!place || !place.geometry || !place.geometry.location) {
                    window.searchDestination();
                    return;
                }

                const destLocation = place.geometry.location;
                map.panTo(destLocation);
                map.setZoom(17);

                // Vérifier si un départ manuel a été saisi
                const manualStartEl = document.getElementById('route-start');
                const manualStartQuery = manualStartEl ? manualStartEl.value.trim() : "";

                if (manualStartQuery !== "") {
                    // Si départ manuel renseigné, on lance l'itinéraire de départ manuel à destination
                    geocoder.geocode({ address: manualStartQuery }, (resStart, statusStart) => {
                        if (statusStart === "OK") {
                            const startPos = resStart[0].geometry.location;
                            calculateRouteSansAutoroute(startPos, destLocation);
                            const btnCancel = document.getElementById('btn-cancel-route');
                            if (btnCancel) btnCancel.classList.remove('hidden');
                        } else {
                            speak("Lieu de départ introuvable.");
                        }
                    });
                    return;
                }

                // Sinon, utilisation du GPS
                if (!currentPosition) {
                    speak("Recherche de votre position GPS. L'itinéraire démarrera automatiquement dès que possible.");
                    window.pendingDestinationName = inputOld.value;
                    return;
                }

                calculateRouteSansAutoroute(currentPosition, destLocation);
                const btnCancel = document.getElementById('btn-cancel-route');
                if (btnCancel) btnCancel.classList.remove('hidden');
            });
        }

        console.log("mon50cc Maps : Contrôleur prêt.");
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
}

window.startApp = function() {
    if (window.appStarted) return;
    window.appStarted = true;
    console.log("mon50cc Master Controller : Démarrage de la séquence d'initialisation v100.00-GOLD...");
    runCinematicStartup();
    
    checkTrialExpiration();
    updateUILabels();
    if(window.session && document.getElementById('mileage-hud')) {
        document.getElementById('mileage-hud').textContent = `${(window.session.totalDistance || 0).toFixed(1)} KM`;
    }
    
    loadHazards();
    renderRoadbooks();
    if (window.OracleVoice) window.OracleVoice.start();
    
    // ── Initialisation des Cartes Hors Ligne ──────────────────────
    if (window.OfflineMapManager) {
        try {
            window.OfflineMapManager.init();
            console.log("mon50cc OfflineMap : Module initialisé.");

            // Mise à jour du badge de statut dans le sidebar
            const updateOfflineBadge = () => {
                const dot = document.getElementById('offline-status-dot');
                if (!dot) return;
                if (navigator.onLine) {
                    dot.textContent = 'EN LIGNE';
                    dot.style.background = '#2ecc71';
                } else {
                    dot.textContent = 'HORS LIGNE';
                    dot.style.background = '#ff0055';
                }
            };
            updateOfflineBadge();
            window.addEventListener('online', updateOfflineBadge);
            window.addEventListener('offline', updateOfflineBadge);
        } catch(e) {
            console.warn("mon50cc OfflineMap : Erreur init", e);
        }
    }
    // ─────────────────────────────────────────────────────────────

    // Check Parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('shortcut')) {
        const sc = urlParams.get('shortcut');
        setTimeout(() => {
            if (sc === 'garage') showPage('garage');
            if (sc === 'danger') toggleHazardMenu();
        }, 1000);
    }

    // Masquer le loader + marquer le système comme prêt
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.opacity = '0';
        }
        updateUILabels();
        if (typeof renderCommunityMarkers === "function") renderCommunityMarkers();
        if (typeof simulateLiveFleet === "function") simulateLiveFleet();
        console.log("mon50cc v100.00-GOLD : Système prêt.");
    }, 3500);

    // Lancement de la géolocalisation
    checkLegalConsent();
};

// ── Panneau Cartes Hors Ligne : ouverture / fermeture ────────────
window.toggleOfflinePanel = function() {
    const panel = document.getElementById('offline-panel');
    if (!panel) return;

    closeMenu(); // Ferme le sidebar

    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');

        // Statut réseau live
        const statusEl = document.getElementById('offline-network-status');
        if (statusEl) {
            const online = navigator.onLine;
            statusEl.style.cssText += `
                background: ${online ? 'rgba(0,46,20,0.8)' : 'rgba(46,0,20,0.8)'};
                border: 1px solid ${online ? 'rgba(0,255,136,0.3)' : 'rgba(255,0,85,0.3)'};
                color: ${online ? '#00ff88' : '#ff4d6d'};
            `;
            statusEl.innerHTML = `
                <span style="font-size:1rem; margin-right:8px;">${online ? '🟢' : '🔴'}</span>
                ${online ? 'CONNECTÉ — Google Maps actif' : 'HORS LIGNE — Carte locale active'}
            `;
        }

        // Stats du cache
        if (window.OfflineMapManager) {
            window.OfflineMapManager.getStats((stats) => {
                const el = document.getElementById('offline-tiles-stat');
                if (el) {
                    el.textContent = stats.count > 0
                        ? `${stats.count} tuiles en cache (~${stats.estimatedMb} Mo)`
                        : 'Aucune tuile en cache';
                }
            });
            window.OfflineMapManager.refreshZoneList();
        }
    } else {
        panel.classList.add('hidden');
    }
};

window.closeOfflinePanel = function(evt) {
    if (evt && evt.target !== document.getElementById('offline-panel')) return;
    const panel = document.getElementById('offline-panel');
    if (panel) panel.classList.add('hidden');
};


// Fonctions de menu déplacées au début pour sécurité

window.showAdvantages = function() {
    const pop = document.getElementById('advantages-popup');
    if (pop) pop.classList.remove('hidden');
};

window.closeAdvantages = function() {
    const pop = document.getElementById('advantages-popup');
    if (pop) pop.classList.add('hidden');
};


window.toggleTraffic = function() {
    if (trafficLayer.getMap()) {
        trafficLayer.setMap(null);
        speak("Info trafic désactivée.");
    } else {
        trafficLayer.setMap(map);
        speak("Info trafic activée.");
    }
}

window.toggleTilt = function() {
    const currentTilt = map.getTilt();
    map.setTilt(currentTilt === 45 ? 0 : 45);
}

// ─── Wake Lock résilient (se réactive automatiquement en cas de perte) ────────
let wakeLockRef = null;
async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
        wakeLockRef = await navigator.wakeLock.request('screen');
        console.log("mon50cc GPS : Wake Lock acquis.");
        // Réacquérir automatiquement quand l'onglet redevient visible
        wakeLockRef.addEventListener('release', () => {
            console.warn("mon50cc GPS : Wake Lock perdu, réacquisition programmée.");
            wakeLockRef = null;
        });
    } catch (err) {
        console.warn("mon50cc GPS : Wake Lock refusé :", err.message);
    }
}

// Réacquérir le Wake Lock quand l'app revient au premier plan
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !wakeLockRef) {
        requestWakeLock();
        // Relancer le GPS si on a perdu la position pendant le sleep (SEULEMENT si consentement donné)
        if (!currentPosition && gpsWatchId === null && hasLocationConsent()) {
            console.log("mon50cc GPS : Retour au premier plan sans position → relance GPS.");
            startGeolocation();
        }
    }
});

// ── Garde de consentement : vérifie si l'utilisateur a accepté la divulgation ──
function hasLocationConsent() {
    return localStorage.getItem('location_consent_accepted') === 'true';
}

async function checkLegalConsent() {
    if (hasLocationConsent()) {
        // Déclenchement du message de bienvenue pour les utilisateurs récurrents
        const name = (window.session && !window.session.isGuest) ? window.session.username : "";
        const welcomeMsg = name ? `Content de vous revoir, ${name}. Systèmes opérationnels.` : "Systèmes opérationnels. Bonne route sur mon 50cc et moi.";
        setTimeout(() => { if (typeof speak === 'function') speak(welcomeMsg); }, 1000);
        
        startGeolocation();
        return;
    }

    // ══════════════════════════════════════════════════════════════════
    // DIVULGATION BIEN VISIBLE (Prominent Disclosure) — Google Play
    // Conforme à la politique relative aux données de l'utilisateur.
    // Affiché AVANT toute collecte de données de localisation.
    // ══════════════════════════════════════════════════════════════════
    const modal = document.createElement('div');
    modal.id = 'location-disclosure-modal';
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
    document.getElementById('btn-refuse-location').onclick = () => {
        modal.remove();
        // Afficher un bandeau persistant expliquant que l'app ne peut pas fonctionner
        const banner = document.createElement('div');
        banner.id = 'location-refused-banner';
        banner.style.cssText = `
            position:fixed; bottom:0; left:0; width:100%; padding:16px;
            background:#1a0000; border-top:2px solid #ff4444; color:#ff8888;
            text-align:center; font-size:0.85rem; z-index:19999; line-height:1.4;
        `;
        banner.innerHTML = `
            <strong>⚠️ Localisation requise</strong><br>
            L'application ne peut pas fonctionner sans accès à votre position.
            <br><button onclick="checkLegalConsent()" style="margin-top:8px; padding:8px 24px; background:#ffb703; color:#000; border:none; border-radius:20px; font-weight:bold; cursor:pointer;">Réessayer</button>
        `;
        document.body.appendChild(banner);
        if (typeof speak === 'function') speak("L'application nécessite l'accès à votre position pour fonctionner.");
    };

    // Bouton ACCEPTER : sauvegarde le consentement et démarre le GPS
    document.getElementById('btn-accept-location').onclick = () => {
        localStorage.setItem('location_consent_accepted', 'true');
        modal.remove();
        // Retirer le bandeau de refus s'il existait
        const oldBanner = document.getElementById('location-refused-banner');
        if (oldBanner) oldBanner.remove();
        
        // Déclenchement du message de bienvenue (Audio débloqué par le clic)
        const name = (window.session && !window.session.isGuest) ? window.session.username : "";
        const welcomeMsg = name ? `Content de vous revoir, ${name}. Systèmes opérationnels.` : "Systèmes opérationnels. Bonne route sur mon 50cc et moi.";
        if (typeof speak === 'function') speak(welcomeMsg);
        
        startGeolocation();
    };
}

function showGpsBanner(msg, code) {
    // Ne pas afficher si on a déjà une position valide (évite la bannière rouge permanente)
    if (currentPosition && code !== 1) {
        console.warn("mon50cc GPS : Erreur ignorée (position déjà disponible) :", msg);
        return;
    }

    if (code === 1) {
        let hardLock = document.getElementById('gps-hard-lock');
        if (!hardLock) {
            hardLock = document.createElement('div');
            hardLock.id = 'gps-hard-lock';
            hardLock.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10, 10, 10, 0.98); backdrop-filter:blur(10px); color:white; z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px; text-align:center;";
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
        hardLock.style.display = 'flex';
        return; // On affiche le hard lock, pas la bannière
    }

    let banner = document.getElementById('gps-error-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'gps-error-banner';
        banner.style = "position:fixed; top:120px; left:50%; transform:translateX(-50%); width:90%; background:rgba(180, 20, 20, 0.97); color:white; padding:15px; border-radius:12px; z-index:99999; font-size:0.85rem; text-align:center; border:2px solid #ef4444; box-shadow:0 0 25px rgba(220,38,38,0.9); transition: all 0.3s ease;";
        document.body.appendChild(banner);
    }
    
    const repairBtn = `<button onclick="window.retryGps()" style="margin-top:10px; padding:8px 20px; background:#ffb703; color:#000; border:none; border-radius:20px; font-weight:bold; font-size:0.85rem; cursor:pointer;">🔄 Réessayer</button>`;
    
    banner.innerHTML = `<div style="font-weight:bold; margin-bottom:4px;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i>GPS : ${msg}</div><div style="font-size:0.72rem; color:#fca5a5;">(Code erreur: ${code})</div>${repairBtn}`;
    banner.style.display = 'block';

    // Auto-dismiss après 20s pour les erreurs non-critiques (code 2 = signal faible, code 3 = timeout)
    clearTimeout(window._gpsBannerTimer);
    window._gpsBannerTimer = setTimeout(hideGpsBanner, 20000);
}

function hideGpsBanner() {
    const banner = document.getElementById('gps-error-banner');
    if (banner) banner.style.display = 'none';
    const hardLock = document.getElementById('gps-hard-lock');
    if (hardLock) hardLock.style.display = 'none';
    clearTimeout(window._gpsBannerTimer);
}

window.repairGps = function() {
    const appUrl = 'mon50ccetmoi.com';
    const instructions = `
        <div style="text-align:left; font-size:0.9rem; line-height:1.5;">
            <b style="color:#ffb703;">📱 Sur Android Chrome :</b><br>
            1. Appuie sur les 3 points ⋮ en haut à droite<br>
            2. Paramètres → Paramètres du site<br>
            3. Localisation → Cherche '${appUrl}'<br>
            4. Passe de 'Bloquer' à 'Autoriser'<br>
            5. Recharge l'application<br><br>
            <b style="color:#ffb703;">📱 Dans l'app Android :</b><br>
            1. Appui long sur l'icône de l'app<br>
            2. Infos sur l'appli → Autorisations<br>
            3. Position → Autoriser (ou Toujours autoriser)
        </div>
    `;

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Comment réactiver le GPS',
            html: instructions,
            icon: 'info',
            confirmButtonText: "J'AI COMPRIS",
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#ffb703'
        });
    } else {
        const modal = document.createElement('div');
        modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px;";
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

window.retryGps = function() {
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
        console.warn("mon50cc GPS : Consentement de localisation non accordé. GPS bloqué.");
        alert("⚠️ Accès GPS bloqué : Le consentement de géolocalisation est requis. Vous allez être redirigé vers l'accueil.");
        window.location.href = "index.html";
        return;
    }

    if (!('geolocation' in navigator)) {
        console.error("mon50cc GPS : Géolocalisation non supportée sur cet appareil.");
        showGpsBanner("Géolocalisation non supportée par ce navigateur.", 0);
        return;
    }

    // Acquérir le Wake Lock pour maintenir le GPS actif
    requestWakeLock();

    // ÉTAPE 1 : Vérifier les permissions (non-bloquant)
    if (navigator.permissions) {
        try {
            const perm = await navigator.permissions.query({ name: 'geolocation' });
            console.log("mon50cc GPS : Permission =", perm.state);

            if (perm.state === 'denied') {
                speak("Le GPS est bloqué. Vérifiez les permissions de l'application.");
                showGpsBanner("Permission refusée. Appuyez sur 'Réparer'.", 1);
                return; // Inutile de continuer si explicitement refusé
            }

            perm.onchange = () => {
                if (perm.state === 'granted') {
                    hideGpsBanner();
                    window.retryGps();
                } else if (perm.state === 'denied') {
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
        timeout: 30000,       // 30s — laisse le temps aux satellites en intérieur
        maximumAge: 3000      // 3s de cache max pour les updates fréquents
    };

    const onError = (err) => {
        let msg = "Erreur GPS inconnue";
        if (err.code === 1) msg = "Permission GPS refusée. Appuyez sur 'Réparer'.";
        if (err.code === 2) msg = "Signal GPS faible. Sortez à l'extérieur.";
        if (err.code === 3) msg = "Recherche GPS en cours... Patience.";
        console.error("mon50cc GPS :", msg, "code:", err.code);

        // Permission refusée → bannière immédiate
        if (err.code === 1) {
            speak("Le GPS est bloqué. Vérifiez les permissions.");
            showGpsBanner(msg, err.code);
            return;
        }

        // Si on n'a aucune position → tenter le fallback basse précision
        if (!currentPosition) {
            showGpsBanner(msg, err.code);
            activateLowAccuracyFallback();
        }
        // Si on a déjà une position → on garde celle-ci, pas de bannière
    };

    // Nettoyer les anciens watchers avant d'en créer de nouveaux
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
            // Filtrage qualité : accepter la première position à tout prix, puis filtrer à < 500m
            const acc = pos.coords.accuracy || 0;
            if (currentPosition && acc > 500) {
                console.warn(`mon50cc GPS : Position ignorée (précision: ${acc.toFixed(0)}m > 500m)`);
                return;
            }
            updatePosition(pos);
            hideGpsBanner();
            gpsRetryCount = 0; // Reset du compteur de retry
        },
        onError,
        geoOptions
    );
    console.log("mon50cc GPS : Surveillance haute précision démarrée (watch:", gpsWatchId, ")");

    // ÉTAPE 4 : Timer de sécurité — si aucune position après 15s, forcer le fallback
    setTimeout(() => {
        if (!currentPosition && fallbackWatchId === null) {
            console.warn("mon50cc GPS : Aucune position après 15s → activation fallback.");
            activateLowAccuracyFallback();
        }
    }, 15000);
}

// Fallback basse précision (WiFi/Cellulaire) — déclenché automatiquement
function activateLowAccuracyFallback() {
    if (fallbackWatchId !== null) return; // Déjà actif
    if (gpsRetryCount >= GPS_MAX_RETRIES) {
        console.error("mon50cc GPS : Nombre max de retries atteint.");
        showGpsBanner("GPS indisponible. Vérifiez que la localisation est activée dans les paramètres.", 2);
        return;
    }
    gpsRetryCount++;
    console.log(`mon50cc GPS : Fallback basse précision (tentative ${gpsRetryCount}/${GPS_MAX_RETRIES})...`);

    fallbackWatchId = navigator.geolocation.watchPosition(
        (pos) => {
            const acc = pos.coords.accuracy || 0;
            if (!currentPosition || acc <= 3000) {
                console.log(`mon50cc GPS : ✅ Fallback OK (précision: ${acc.toFixed(0)}m)`);
                updatePosition(pos);
                hideGpsBanner();
            }
        },
        (e) => console.warn("mon50cc GPS : Fallback échoué :", e.code, e.message),
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
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
        
        this.gripLevel = Math.max(0.1, baseGrip - (angleRisk * speedRisk));

        // ENGINE STRESS: Based on load and cooling
        // High speed + high temp = high stress
        const load = speedKmh / 50; // 50cc specific
        const heatFactor = temp > 30 ? (temp - 30) / 20 : 0;
        this.engineStress = Math.min(1.0, (load * 0.7) + (heatFactor * 0.3));

        if (this.gripLevel < 0.4 && speedKmh > 30) {
            if (window.NeuralHUD) window.NeuralHUD.logToConsole("GRIP_WARNING: SLIPPERY_SURFACE_DETECTED");
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
    // Arrêt du fallback basse précision si on récupère un signal GPS haute précision décent (< 30m)
    if (position.coords.accuracy !== null && position.coords.accuracy < 30 && fallbackWatchId !== null) {
        console.log("mon50cc GPS : Signal haute précision retrouvé, arrêt du fallback.");
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
        console.log("mon50cc GPS : Premier FIX reçu, centrage initial.");
        
        if (map) {
            if (!window.hasWelcomed) {
                window.hasWelcomed = true;
                if (typeof triggerRegionalWelcome === 'function') {
                    triggerRegionalWelcome(lat, lng);
                }
            }
            
            // Si une destination attendait le GPS, on la lance maintenant
            if (window.pendingDestinationName) {
                console.log("mon50cc GPS : Lancement de l'itinéraire en attente vers : " + window.pendingDestinationName);
                const savedName = window.pendingDestinationName;
                window.pendingDestinationName = null; 
                document.getElementById('route-search').value = savedName;
                window.searchDestination();
            }
        }
    }

    // Suivi continu et fluide (auto-centrage Google Maps)
    if (map) {
        map.panTo(currentPosition);
    }

    // Tracé GPS de la balade (cyberline cyan)
    if (typeof window.addTracePoint === 'function') {
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
        const gpsStatus = document.getElementById('tel-gps');
        if (gpsStatus) gpsStatus.textContent = `FIX (${safeAccuracy.toFixed(1)}m)`;
    }
    
    // Update main HUD GPS indicator
    const hudGps = document.getElementById('hud-gps');
    if (hudGps) {
        hudGps.textContent = `FIX (${Math.round(safeAccuracy)}m)`;
        hudGps.style.color = safeAccuracy <= 15 ? '#00e676' : '#ffb703';
    }
    
    // --- GUEST MODE LOCKS (Initial logic check) ---
    if (window.session && window.session.isGuest) {
        document.getElementById('menu-insurance')?.classList.add('locked-feature');
        document.getElementById('menu-mechanic')?.classList.add('locked-feature');
        document.getElementById('menu-garage')?.classList.add('locked-feature');
        // On rend aussi le clic inactif ou redirige vers login
        ['menu-insurance', 'menu-mechanic', 'menu-garage', 'menu-arbitre'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.onclick = () => alert("Veuillez créer un compte pour accéder à l'Arbitre de la Route ! ⚖️🛵");
        });
    }

    // Vitesse (HUD) avec Smoothing Neural
    const rawSpeed = (speed !== null && speed >= 0) ? speed * 3.6 : 0;
    const speedKmh = Math.round(getSmoothedSpeed(rawSpeed));
    const speedEl = document.getElementById('speed');
    const speedBar = document.getElementById('speed-bar');
    
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
        window.NeuralEngine.update(speedKmh, currentTemp, currentPrecip, currentLean);
        
        // Effet de vitesse sur le HUD
        if(speedKmh > 40) {
            speedEl.parentElement.classList.add('fast');
            speedEl.style.color = 'var(--danger)';
            vibrate(50); 
            if (window.NeuralHUD) window.NeuralHUD.logToConsole("VELOCITY_ALERT: HIGH_SPEED_DETECTED");
        } else if(speedKmh > 25) {
            speedEl.parentElement.classList.remove('fast');
            speedEl.style.color = 'var(--accent)';
        } else {
            speedEl.parentElement.classList.remove('fast');
            speedEl.style.color = 'var(--neon-blue)';
        }
        
        // Dynamic Glow based on speed
        const hud = document.getElementById('hud');
        if (hud) {
            const glow = Math.min(speedKmh / 2, 20);
            hud.style.boxShadow = `0 0 ${20 + glow}px rgba(0, 242, 255, ${0.5 + speedKmh/200})`;
        }
        
        // --- NEW: Compass & 3D Navigation Logic ---
        const heading = position.coords.heading;
        if (heading !== null) {
            document.getElementById('compass-needle').style.transform = `rotate(${heading}deg)`;
            const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO', 'N'];
            const dirIdx = Math.round(heading / 45);
            document.getElementById('compass-dir').textContent = dirs[dirIdx];
            
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
                targetTilt = 60;   // High perspective
            } else if (speedKmh > 10) {
                targetZoom = 16.5;
                targetTilt = 45;
            } else if (speedKmh < 3) {
                targetZoom = 18.5; // Detailed parking view
                targetTilt = 0;    // Standard flat view
            }

            // Smooth adjustment to prevent jitter
            if (Math.abs(map.getZoom() - targetZoom) > 0.1) map.setZoom(targetZoom);
            if (map.getTilt() !== targetTilt) map.setTilt(targetTilt);
        }

        // vMax Tracking (NEW v25)
        if(!window.session.vMax || speedKmh > window.session.vMax) {
            window.session.vMax = speedKmh;
            secureSetItem('session', JSON.stringify(window.session));
        }
    }
    
    const wasRiding = window.isRiding;
    window.isRiding = speedKmh > 2;
    if (wasRiding && !window.isRiding) {
        if (typeof Habits !== "undefined" && currentPosition) Habits.recordEnd(currentPosition);
    }
    calculateDistanceAndBadges(lat, lng);

    // --- NEW: Parking Mode Security ---
    handleParkingMode(lat, lng);

    // Rendu Map (uniquement en ligne)
    if (map) {
        if (!userMarker) {
            const totalKm = window.session?.totalDistance || 0;
            const color = totalKm >= 10000 ? '#B9F2FF' : '#cca000'; // DIAMANT SI 10000KM
            const shadow = totalKm >= 10000 ? '0 0 20px #B9F2FF' : '0 0 15px rgba(204, 160, 0, 0.9)';

            // Detection du type de vehicule pour l'icone
            const vehicleIcon = window.getVehicleIcon(window.session?.brand, window.session?.model);

            const iconContent = document.createElement("div");
            iconContent.innerHTML = `<div style="background-color: #1a1a1a; color: ${color}; font-size: 16px; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; border: 2px solid white; box-shadow: ${shadow}; transition: all 0.5s ease;"><i class="fa-solid ${vehicleIcon}"></i></div>`;
            
            try {
                if (false) { // AdvancedMarkerElement removed due to mapId styling conflict
                } else {
                    userMarker = new google.maps.Marker({
                        map: map,
                        position: currentPosition,
                        title: "Votre Position",
                        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: color, fillOpacity: 1, strokeColor: 'white', strokeWeight: 2 }
                    });
                }
            } catch(e) { console.error("Marker init fail", e); }

            accuracyCircle = new google.maps.Circle({
                map: map,
                center: currentPosition,
                radius: safeAccuracy / 2,
                fillColor: "#ffffff",
                fillOpacity: 0.1,
                strokeColor: "#ffffff",
                strokeWeight: 1
            });

            map.setCenter(currentPosition);
            map.panBy(0, -100); 
        } else {
            const totalKm = window.session?.totalDistance || 0;
            const color = totalKm >= 10000 ? '#B9F2FF' : '#cca000';
            
            if (userMarker.content) {
                const innerDiv = userMarker.content.querySelector('div');
                if (innerDiv) {
                    innerDiv.style.color = color;
                    innerDiv.style.boxShadow = totalKm >= 10000 ? '0 0 20px #B9F2FF' : '0 0 15px rgba(204, 160, 0, 0.9)';
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
    const wHud = document.getElementById('weather-hud');
    if(wHud && wHud.textContent.includes('--')) {
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
            publishUserLocation(lat, lng, window.isRiding ? "Sur la route" : "En pause");
            window.lastCloudSync = Date.now();
        }

    }
}

function checkHazardProximity(lat, lng) {
    const raw = secureGetItem('hazards');
    const hazards = raw ? JSON.parse(raw) : [];
    const p1 = new google.maps.LatLng(lat, lng);
    
    hazards.forEach((h, index) => {
        const p2 = new google.maps.LatLng(h.lat, h.lon);
        const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
        
        // --- ALERTE ROUGE (GHOST CAR) ---
        if (h.type === 'danger_immediat') {
            const ageMins = (Date.now() - new Date(h.date).getTime()) / 60000;
            if (dist < 1000 && ageMins <= 15 && window.lastSpokenRedAlert !== h.lat + h.lon) {
                window.lastSpokenRedAlert = h.lat + h.lon;
                if (typeof window.triggerRedAlert === 'function') {
                    window.triggerRedAlert(Math.round(dist), h.description || "");
                }
            }
        } 
        // --- ANIMAUX (Anticipation 500m) ---
        else if ((h.type === 'animal' || h.type === 'chien') && dist < 500 && lastSpokenHazard !== h.lat + h.lon) {
            speak(`Attention, ${h.type} signalé à environ 500 mètres. Restez vigilant.`);
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

window.triggerRedAlert = function(distance, description) {
    // Annonce vocale
    let alertMsg = `Attention, conduite dangereuse signalée`;
    if (description) {
        alertMsg += ` : ${description}`;
    }
    alertMsg += ` à ${distance} mètres devant vous. Restez vigilant.`;
    speak(alertMsg);

    // Effet visuel clignotant rouge
    const overlay = document.createElement('div');
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; box-shadow: inset 0 0 50px 20px rgba(255, 0, 0, 0.8); z-index:999999; pointer-events:none; transition: opacity 0.5s;";
    document.body.appendChild(overlay);

    let count = 0;
    const interval = setInterval(() => {
        overlay.style.opacity = (count % 2 === 0) ? "0" : "1";
        count++;
        if (count > 10) {
            clearInterval(interval);
            overlay.remove();
        }
    }, 500);
}

function showHazardConfirmation(index, type) {
    const toast = document.createElement('div');
    toast.className = 'hazard-toast glassmorphism';
    toast.innerHTML = `
        <p>Toujours là : <strong>${type}</strong> ?</p>
        <div style="display:flex; gap:10px;">
            <button onclick="confirmHazard(${index}, true)">✅ Oui</button>
            <button onclick="confirmHazard(${index}, false)">❌ Non</button>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 8000);
}

window.confirmHazard = function(index, exists) {
    if (!exists) {
        let hazards = JSON.parse(secureGetItem('hazards') || '[]');
        hazards.splice(index, 1);
        secureSetItem('hazards', JSON.stringify(hazards));
        loadHazards();
        speak("Merci, signalement mis à jour.");
    } else {
        speak("Merci de votre vigilance.");
    }
    const toast = document.querySelector('.hazard-toast');
    if(toast) toast.remove();
    vibrate(30);
}

// --- NEW: Voice Synthesis & Haptics ---
function vibrate(ms) {
    if ('vibrate' in navigator && navigator.userActivation && navigator.userActivation.hasBeenActive) {
        navigator.vibrate(ms);
    }
}

// --- REGIONAL & VOICE ENGINE (ORACLE v100.00-GOLD) ---
window.OracleEngine = {
    gender: localStorage.getItem('oracle_gender') || 'female',
    currentRegion: 'standard',
    
    regionalLexicon: {
        'fr': {
            'marseille': {
                'start': "Té, l'Oracle est en place ! On est parés pour la route, peuchère.",
                'speed': "Oh fada, tu vas trop vite ! Lève le pied avant de t'envoler.",
                'threat_detected': "Vé ! Y'a un souci sur la route devant. Fais gaffe à toi.",
                'level_up': "Et bim ! Tu as monté de niveau, bravo mon brave.",
                'start_guardian': "Ange Gardien en place ! T'inquiète pas, je veille sur toi.",
                'stop_guardian': "Ange Gardien au repos. Fais doucement, hein !",
                'danger_overtake': "Vé ! Tu doubles n'importe comment, tu vas nous faire un plat !"
            },
            'quebec': {
                'start': "Attache ta tuque, l'Oracle est prêt pour une sacrée virée !",
                'speed': "Lâche la patate, tu roules pas mal trop vite là !",
                'threat_detected': "Check ben ça, y'a de quoi de pas net sur le chemin.",
                'level_up': "C'est écoeurant ! T'as gagné un niveau.",
                'start_guardian': "Ton Ange Gardien est prêt, on lâche pas !",
                'stop_guardian': "L'Ange Gardien prend une pause. Prudence !",
                'danger_overtake': "Oulà ! Ton dépassement était pas mal risqué, check tes angles !"
            },
            'standard': {
                'start': "Core Universel stabilisé. Liaison totale établie.",
                'speed': "Alerte : Vitesse excessive. Ralentissez immédiatement.",
                'threat_detected': "ANALYSE : Menace identifiée. Prudence conseillée.",
                'level_up': "Félicitations Pilote. Votre expérience a augmenté.",
                'start_guardian': "Ange Gardien activé. Surveillance périmétrique en cours.",
                'stop_guardian': "Ange Gardien désactivé. Fin de la surveillance.",
                'danger_overtake': "ATTENTION : DÉPASSEMENT DANGEREUX DÉTECTÉ.",
                'ferry_detected': "Attention, cet itinéraire inclut une traversée en ferry.",
                'ferry_ahead': "Traversée en ferry à 1 kilomètre. Préparez-vous à l'embarquement."
            },
            'liege': {
                'start': "Oufti, l'Oracle est en place, valet ! On décolle ?",
                'speed': "Ouille valet, tu vas trop vite ! Calme ton jeu.",
                'threat_detected': "Aïe gaffe, y'a un bins sur la route devant.",
                'level_up': "Oufti ! T'es passé au niveau suivant, c'est du propre !",
                'start_guardian': "L'Ange Gardien est là pour toi, valet. Roule tranquille.",
                'stop_guardian': "L'Ange Gardien va s'en jeter une, sois prudent.",
                'danger_overtake': "Oufti ! Ton dépassement était un peu chaud, valet !"
            },
            'charleroi': {
                'start': "Salut m'fi ! L'Oracle est prêt, on y va ?",
                'speed': "M'fi, tu roules trop vite ! On n'est pas sur le ring ici.",
                'threat_detected': "Fais gaffe m'fi, y'a un gros souci devant.",
                'level_up': "Bordel m'fi ! T'as monté de niveau, félicitations !",
                'start_guardian': "Ton Ange Gardien veille sur toi, m'fi. Pas de stress.",
                'stop_guardian': "L'Ange Gardien a fini sa pause, fais attention m'fi.",
                'danger_overtake': "M'fi ! C'était quoi ce dépassement de baraki ?"
            },
            'brussels': {
                'start': "Salut fieu ! L'Oracle est là, on y va ou quoi ?",
                'speed': "Dites une fois, fieu ! Tu vas trop vite, on n'est pas pressés !",
                'threat_detected': "Attention fieu, y'a un stut sur la route devant.",
                'level_up': "Non peut-être ! T'as monté de niveau, ça c'est du stoemp !",
                'start_guardian': "L'Ange Gardien est avec toi, fieu. T'inquiète pas.",
                'stop_guardian': "L'Ange Gardien va manger une frite, fais gaffe à toi.",
                'danger_overtake': "Eh fieu ! Ton dépassement là, c'était un peu zinneke, non ?"
            },
            'flanders': {
                'start': "Allez, l'Oracle est prêt. On roule, hein ?",
                'speed': "Oula ! Tu vas trop vite, hein ! Calme-toi un peu.",
                'threat_detected': "Pas de chance, y'a un problème sur la route.",
                'level_up': "Super ! T'as monté de niveau. C'est bien, hein !",
                'start_guardian': "L'Ange Gardien est là pour toi. C'est sécurisé, hein.",
                'stop_guardian': "L'Ange Gardien s'arrête. Sois prudent, hein.",
                'danger_overtake': "Dis, ton dépassement était un peu dangereux, hein !"
            },
            'andalucia': {
                'start': "¡Ole! L'Oracle est prêt, mon ami. On y va !",
                'speed': "Eh, l'ami ! Tu vas trop vite, doucement sur l'accélérateur.",
                'threat_detected': "Attention, y'a du jaleo sur la route devant.",
                'level_up': "¡Qué arte! Tu as monté de niveau, bravo !",
                'start_guardian': "L'Ange Gardien est avec toi, l'ami.",
                'stop_guardian': "L'Ange Gardien fait une petite sieste, sois prudent.",
                'danger_overtake': "Eh ! Ce dépassement était un peu trop risqué, mi arma !"
            },
            'reunion': {
                'start': "Lé paré ! L'Oracle est en place, dalon. Allons rouler !",
                'speed': "Oté ! Tu vas trop vite, calme un peu là !",
                'threat_detected': "Gaffe dalon, y'a un l'embouteillage ou un souci devant.",
                'level_up': "Lé bon ça ! T'as monté de niveau, félicitations !",
                'start_guardian': "L'Ange Gardien lé là, t'inquiète pas dalon.",
                'stop_guardian': "L'Ange Gardien va prendre un petit rhum, sois prudent.",
                'danger_overtake': "Oté ! Ton dépassement là, c'était risqué dalon !"
            }
        },
        'zh': {
            'standard': {
                'start': "系统就绪。连接已建立。",
                'speed': "警告：速度过快。请立即减速。",
                'threat_detected': "分析：发现威胁。建议谨慎。",
                'level_up': "恭喜车手。您的经验值已提升。",
                'start_guardian': "守护天使已开启。正在监控。",
                'stop_guardian': "守护天使已关闭。监控结束。",
                'danger_overtake': "警告：检测到危险超车。"
            }
        },
        'ja': {
            'standard': {
                'start': "システム準備完了。接続が確立されました。",
                'speed': "警告：速度超過です。直ちに減速してください。",
                'threat_detected': "分析：脅威を検知。注意してください。",
                'level_up': "おめでとうございます。レベルが上がりました。",
                'start_guardian': "守護天使が起動しました。監視中。",
                'stop_guardian': "守護天使が解除されました。監視終了。",
                'danger_overtake': "警告：危険な追い越しを検知しました。"
            }
        },
        'es': {
            'andalucia': {
                'start': "¡Ole! El Oráculo está listo, mi arma. ¡Vámonos!",
                'speed': "¡Eh, chiquillo! Vas mu' rápido, frena un poco.",
                'threat_detected': "Cuidao, que hay un jaleo ahí delante.",
                'level_up': "¡Qué arte tienes! Has subido de nivel.",
                'start_guardian': "El Ángel de la Guarda está contigo, mi arma.",
                'stop_guardian': "El Ángel se va a echar una siestecita, ten cuidao.",
                'danger_overtake': "¡Chiquillo! Ese adelantamiento ha sío mu' peligroso."
            },
            'standard': {
                'start': "Sistemas listos. Conexión establecida.",
                'speed': "Alerta: Exceso de velocidad. Reduzca inmediatamente.",
                'threat_detected': "ANÁLISIS: Amenaza identificada. Tenga precaución.",
                'level_up': "Felicidades Piloto. Su experiencia ha aumentado.",
                'start_guardian': "Ángel de la Guarda activado. Vigilancia en curso.",
                'stop_guardian': "Ángel de la Guarda desactivado. Fin de la vigilancia.",
                'danger_overtake': "ATENCIÓN: ADELANTAMIENTO PELIGROSO DETECTADO."
            }
        },
        'en': {
            'standard': {
                'start': "System ready. Connection established.",
                'speed': "Alert: Excessive speed. Please slow down.",
                'threat_detected': "ANALYSIS: Threat identified. Caution advised.",
                'level_up': "Congratulations Pilot. Your experience has increased.",
                'start_guardian': "Guardian Angel activated. Monitoring perimeter.",
                'stop_guardian': "Guardian Angel deactivated. End of monitoring.",
                'danger_overtake': "WARNING: DANGEROUS OVERTAKE DETECTED.",
                'ferry_detected': "Attention, this route includes a ferry crossing.",
                'ferry_ahead': "Ferry crossing in 1 kilometer. Prepare for boarding."
            }
        },
        'it': {
            'standard': {
                'start': "Sistema pronto. Connessione stabilita.",
                'speed': "Allerta: Velocità eccessiva. Rallenta immediatamente.",
                'threat_detected': "ANALISI: Minaccia identificata. Prudenza consigliata.",
                'level_up': "Congratulazioni Pilota. La tua esperienza è aumentata.",
                'start_guardian': "Angelo Custode attivato. Monitoraggio in corso.",
                'stop_guardian': "Angelo Custode disattivato. Fine monitoraggio.",
                'danger_overtake': "ATTENZIONE: SORPASSO PERICOLOSO RILEVATO."
            }
        },
        'de': {
            'standard': {
                'start': "System bereit. Verbindung hergestellt.",
                'speed': "Warnung: Zu hohe Geschwindigkeit. Bitte sofort abbremsen.",
                'threat_detected': "ANALYSE: Gefahr erkannt. Vorsicht geboten.",
                'level_up': "Glückwunsch Pilot. Deine Erfahrung ist gestiegen.",
                'start_guardian': "Schutzengel aktiviert. Überwachung läuft.",
                'stop_guardian': "Schutzengel deaktiviert. Ende der Überwachung.",
                'danger_overtake': "WARNUNG: GEFÄHRLICHES ÜBERHOLMANÖVER ERKANNT."
            }
        },
        'pt': {
            'standard': {
                'start': "Sistema pronto. Conexão estabelecida.",
                'speed': "Alerta: Velocidade excessiva. Reduza imediatamente.",
                'threat_detected': "ANÁLISE: Ameaça identificada. Cuidado aconselhado.",
                'level_up': "Parabéns Piloto. A sua experiência aumentou.",
                'start_guardian': "Anjo da Guarda ativado. Monitorização em curso.",
                'stop_guardian': "Anjo da Guarda desativado. Fim da monitorização.",
                'danger_overtake': "AVISO: ULTRAPASSAGEM PERIGOSA DETETADA."
            }
        },
        'nl': {
            'standard': {
                'start': "Systeem gereed. Verbinding tot stand gebracht.",
                'speed': "Waarschuwing: Te hoge snelheid. Gelieve onmiddellijk te vertragen.",
                'threat_detected': "ANALYSE: Dreiging geïdentificeerd. Voorzichtigheid geboden.",
                'level_up': "Gefeliciteerd Piloot. Uw ervaring is toegenomen.",
                'start_guardian': "Beschermengel geactiveerd. Monitoring gestart.",
                'stop_guardian': "Beschermengel gedeactiveerd. Einde monitoring.",
                'danger_overtake': "WAARSCHUWING: GEVAARLIJKE INHAALACTIE GEDETECTEERD."
            }
        },
        'pl': {
            'standard': {
                'start': "System gotowy. Połączenie nawiązane.",
                'speed': "Alert: Nadmierna prędkość. Proszę natychmiast zwolnić.",
                'threat_detected': "ANALIZA: Zidentyfikowano zagrożenie. Zalecana ostrożność.",
                'level_up': "Gratulacje Pilocie. Twoje doświadczenie wzrosło.",
                'start_guardian': "Anioł Stróż aktywowany. Monitorowanie w toku.",
                'stop_guardian': "Anioł Stróż dezaktywowany. Koniec monitorowania.",
                'danger_overtake': "OSTRZEŻENIE: WYKRYTO NIEBEZPIECZNE WYPRZEDZANIE."
            }
        },
        'sv': {
            'standard': {
                'start': "Systemet är klart. Anslutning upprättad.",
                'speed': "Varning: För hög hastighet. Sänk farten omedelbart.",
                'threat_detected': "ANALYS: Hot identifierat. Var försiktig.",
                'level_up': "Grattis Pilot. Din erfarenhet har ökat.",
                'start_guardian': "Skyddsängel aktiverad. Övervakning pågår.",
                'stop_guardian': "Skyddsängel inaktiverad. Slut på övervakning.",
                'danger_overtake': "VARNING: FARLIG OMKÖRNING UPPTÄCKT."
            }
        },
        'da': {
            'standard': {
                'start': "Systemet er klar. Forbindelse oprettet.",
                'speed': "Advarsel: For høj hastighed. Sæt farten ned med det samme.",
                'threat_detected': "ANALYSE: Trussel identificeret. Forsigtighed tilrådes.",
                'level_up': "Tillykke Pilot. Din erfarenhet er øget.",
                'start_guardian': "Skytsengel aktiveret. Overvågning i gang.",
                'stop_guardian': "Skytsengel deaktiveret. Slut på overvågning.",
                'danger_overtake': "ADVARSEL: FARLIG OVERHALING REGISTRERET."
            }
        },
        'fi': {
            'standard': {
                'start': "Järjestelmä valmis. Yhteys muodostettu.",
                'speed': "Hälytys: Liian suuri nopeus. Hidasta välittömästi.",
                'threat_detected': "ANALYYSI: Uhka tunnistettu. Noudata varovaisuutta.",
                'level_up': "Onnea Pilotti. Kokemuksesi on kasvanut.",
                'start_guardian': "Suojelusenkeli aktivoitu. Valvonta käynnissä.",
                'stop_guardian': "Suojelusenkeli deaktivoitu. Valvonta päättynyt.",
                'danger_overtake': "VAROITUS: VAARALLINEN OHITUS HAVAITTU."
            }
        },
        'no': {
            'standard': {
                'start': "Systemet er klart. Tilkobling opprettet.",
                'speed': "Advarsel: For høy hastighet. Sakt ned umiddelbart.",
                'threat_detected': "ANALYSE: Trussel identifisert. Forsiktighet anbefales.",
                'level_up': "Gratulerer Pilot. Din erfaring har økt.",
                'start_guardian': "Skytsengel aktivert. Overvåking pågår.",
                'stop_guardian': "Skytsengel deaktivert. Slut på overvåking.",
                'danger_overtake': "ADVARSEL: FARLIG FORBIKJØRING OPPDAGET."
            }
        },
        'el': {
            'standard': {
                'start': "Σύστημα έτοιμο. Η σύνδεση ολοκληρώθηκε.",
                'speed': "Ειδοποίηση: Υπερβολική ταχύτητα. Επιβραδύνετε αμέσως.",
                'threat_detected': "ΑΝΑΛΥΣΗ: Εντοπίστηκε απειλή. Συνιστάται προσοχή.",
                'level_up': "Συγχαρητήρια Πιλότε. Η εμπειρία σας αυξήθηκε.",
                'start_guardian': "Φύλακας Άγγελος ενεργοποιήθηκε. Παρακολούθηση σε εξέλιξη.",
                'stop_guardian': "Φύλακας Άγγελος απενεργοποιήθηκε. Τέλος παρακολούθησης.",
                'danger_overtake': "ΠΡΟΣΟΧΗ: ΕΝΤΟΠΙΣΤΗΚΕ ΕΠΙΚΙΝΔΥΝΗ ΠΡΟΣΠΕΡΑΣΗ."
            }
        },
        'cs': {
            'standard': {
                'start': "Systém připraven. Připojení navázáno.",
                'speed': "Upozornění: Nadměrná rychlost. Okamžitě zpomalte.",
                'threat_detected': "ANALÝZA: Identifikována hrozba. Doporučuje se opatrnost.",
                'level_up': "Gratulujeme Pilote. Vaše zkušenosti se zvýšily.",
                'start_guardian': "Anděl strážný aktivován. Sledování probíhá.",
                'stop_guardian': "Anděl strážný deaktivován. Konec sledování.",
                'danger_overtake': "VAROVÁNÍ: ZJIŠTĚNO NEBEZPEČNÉ PŘEDBÍHÁNÍ."
            }
        },
        'hu': {
            'standard': {
                'start': "Rendszer kész. Kapcsolat létrejött.",
                'speed': "Riasztás: Túl nagy sebesség. Azonnal lassítson.",
                'threat_detected': "ELEMZÉS: Fenyegetés azonosítva. Óvatosság ajánlott.",
                'level_up': "Gratulálunk Pilóta. Tapasztalata nőtt.",
                'start_guardian': "Őrangyal aktiválva. Megfigyelés folyamatban.",
                'stop_guardian': "Őrangyal deaktiválva. Megfigyelés vége.",
                'danger_overtake': "FIGYELEM: VESZÉLYES ELŐZÉS ÉSZLELVE."
            }
        },
        'ro': {
            'standard': {
                'start': "Sistem gata. Conexiune stabilită.",
                'speed': "Alertă: Viteză excesivă. Încetiniți imediat.",
                'threat_detected': "ANALIZĂ: Amenințare identificată. Se recomandă prudență.",
                'level_up': "Felicitări Pilotule. Experiența ta a crescut.",
                'start_guardian': "Înger Păzitor activat. Monitorizare în curs.",
                'stop_guardian': "Înger Păzitor dezactivat. Sfârșitul monitorizării.",
                'danger_overtake': "ATENȚIE: DEPĂȘIRE PERICULOASĂ DETECTATĂ."
            }
        }
    },

    updateRegion: function(lat, lng) {
        if (lat > 43.1 && lat < 43.4 && lng > 5.2 && lng < 5.6) this.currentRegion = 'marseille';
        else if (lat > 45 && lat < 47 && lng > -74 && lng < -71) this.currentRegion = 'quebec';
        else if (lat > 50.5 && lat < 50.8 && lng > 5.3 && lng < 5.8) this.currentRegion = 'liege';
        else if (lat > 50.2 && lat < 50.5 && lng > 4.2 && lng < 4.6) this.currentRegion = 'charleroi';
        else if (lat > 50.75 && lat < 50.95 && lng > 4.2 && lng < 4.6) this.currentRegion = 'brussels';
        else if (lat > 50.95 && lat < 51.5 && lng > 2.5 && lng < 5.9) this.currentRegion = 'flanders';
        else if (lat > 35.8 && lat < 38.7 && lng > -7.5 && lng < -1.6) this.currentRegion = 'andalucia';
        else if (lat > -21.4 && lat < -20.8 && lng > 55.2 && lng < 55.9) this.currentRegion = 'reunion';
        else this.currentRegion = 'standard';
    },

    getVoice: function(lang) {
        const voices = window.speechSynthesis.getVoices();
        let filtered = voices.filter(v => v.lang.startsWith(lang));
        let target = filtered.find(v => {
            const name = v.name.toLowerCase();
            return this.gender === 'female' ? 
                (name.includes('female') || name.includes('mary') || name.includes('claire') || name.includes('hortense')) :
                (name.includes('male') || name.includes('david') || name.includes('thomas') || name.includes('paul'));
        });
        return target || filtered[0] || null;
    }
};

window.TranslationCache = {};

async function speak(phraseKey) {
    if (!('speechSynthesis' in window)) return;
    
    const baseLang = window.currentLang || 'fr';
    const region = window.OracleEngine.currentRegion;
    
    let text = phraseKey;
    if (window.OracleEngine.regionalLexicon && window.OracleEngine.regionalLexicon[baseLang]) {
        text = window.OracleEngine.regionalLexicon[baseLang][region]?.[phraseKey] || 
               window.OracleEngine.regionalLexicon[baseLang]['standard']?.[phraseKey] || 
               phraseKey;
    }

    let targetLang = navigator.language.split('-')[0].toLowerCase();
    let finalMsg = text;
    
    if (targetLang !== 'fr') {
        if (window.TranslationCache[text] && window.TranslationCache[text][targetLang]) {
            finalMsg = window.TranslationCache[text][targetLang];
        } else {
            try {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
                const res = await fetch(url);
                const data = await res.json();
                if (data && data[0] && data[0][0] && data[0][0][0]) {
                    finalMsg = data[0].map(item => item[0]).join(''); // Join parts if translated in multiple chunks
                    if (!window.TranslationCache[text]) window.TranslationCache[text] = {};
                    window.TranslationCache[text][targetLang] = finalMsg;
                }
            } catch (e) {
                console.warn("Oracle Translation failed, fallback:", e);
                targetLang = 'fr';
            }
        }
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(finalMsg);
    
    const voices = window.speechSynthesis.getVoices();
    let voice = voices.find(v => v.lang.toLowerCase().startsWith(targetLang));
    if (!voice && targetLang === 'fr') voice = window.OracleEngine.getVoice('fr');
    if (voice) utterance.voice = voice;
    
    utterance.lang = navigator.language;
    
    // Voice Modes (Marché Noir BVC)
    let rate = 0.95;
    let pitch = (window.OracleEngine && window.OracleEngine.gender === 'female') ? 1.05 : 0.9;
    
    const voiceMode = localStorage.getItem('jarvisVoiceMode') || 'standard';
    if (voiceMode === 'cyberpunk') {
        rate = 0.85; pitch = 0.4;
    } else if (voiceMode === 'rally') {
        rate = 1.3; pitch = 1.2;
    }

    utterance.rate = rate;
    utterance.pitch = pitch;
    
    window.speechSynthesis.speak(utterance);
    if ('vibrate' in navigator && navigator.userActivation && navigator.userActivation.hasBeenActive) {
        navigator.vibrate(30);
    }
}

// --- NEW: Auto Night Mode ---
function checkNightMode() {
    const hr = new Date().getHours();
    const isNight = (hr >= 20 || hr <= 7);
    if(isNight && !nightModeActive) {
        document.body.classList.add('night-theme');
        nightModeActive = true;
        speak("Mode nuit activé.");
    } else if(!isNight && nightModeActive) {
        document.body.classList.remove('night-theme');
        nightModeActive = false;
    }
}
// --- NEW v25: TELEMETRY & LEAN ANGLE ---
// --- BACKGROUND MODE SURVIVAL ---
document.addEventListener('deviceready', () => {
    // Si le plugin de background-mode est installé (Cordova/Capacitor)
    if (window.cordova && cordova.plugins && cordova.plugins.backgroundMode) {
        cordova.plugins.backgroundMode.enable();
        cordova.plugins.backgroundMode.on('activate', function() {
            cordova.plugins.backgroundMode.disableWebViewOptimizations(); 
        });
    }
}, false);
window.addEventListener('deviceorientation', (e) => {
    if(!window.isRiding) return;
    
    const lean = Math.round(e.gamma); // Tilt left/right
    currentLeanAngle = Math.abs(lean);
    if(currentLeanAngle > maxLeanAngle) maxLeanAngle = currentLeanAngle;

    // --- INTEGRATION: Guardian Angel Dangerous Overtake Check ---
    if (window.GuardianAngel && typeof window.GuardianAngel.checkOvertakingSafety === "function") {
        const speedKmh = parseInt(document.getElementById('speed')?.textContent || "0");
        window.GuardianAngel.checkOvertakingSafety(speedKmh, lean);
    }

    const horizon = document.querySelector('.horizon-line');
    if (horizon) {
        horizon.style.transform = `rotate(${-lean}deg)`;
    }

    const leanMeter = document.getElementById('lean-meter');
    const leanVal = document.getElementById('lean-angle-val');
    const fillL = document.getElementById('lean-fill-L');
    const fillR = document.getElementById('lean-fill-R');

    if(leanMeter && currentLeanAngle > 5) {
        leanMeter.classList.remove('hidden');
        leanVal.textContent = `${currentLeanAngle}°`;
        
        if(lean < 0) {
            fillL.style.width = `${Math.min(currentLeanAngle * 2, 100)}%`;
            fillR.style.width = '0%';
        } else {
            fillR.style.width = `${Math.min(currentLeanAngle * 2, 100)}%`;
            fillL.style.width = '0%';
        }

        if(currentLeanAngle > 35) {
            leanVal.style.color = 'var(--danger)';
            if(currentLeanAngle > 45) vibrate(100);
        } else {
            leanVal.style.color = 'var(--accent)';
        }
    } else if(leanMeter) {
        leanMeter.classList.add('hidden');
    }
});

setInterval(checkNightMode, 60000);
checkNightMode();
