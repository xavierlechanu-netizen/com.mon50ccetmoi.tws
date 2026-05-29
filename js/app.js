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
console.log("mon50ccetmoi v60.0.19-GOLD : Production Ready.");

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
    content.classList.remove('page-enter-active');
    content.classList.add('page-enter');
    setTimeout(() => content.classList.add('page-enter-active'), 50);
    if(navigator.vibrate) navigator.vibrate(50);
        speak("Alerte abonnement : Votre période d'essai gratuite est terminée.");
    }
}

// Style Premium Dark "Gold & Black" pour Google Maps
const GOOGLE_MAPS_STYLE = [
    { "elementType": "geometry", "stylers": [{ "color": "#0a131c" }] },
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#436a8c" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#0a131c" }] },
    { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#122a40" }] },
    { "featureType": "landscape.man_made", "elementType": "geometry.fill", "stylers": [{ "color": "#0b1824" }] },
    { "featureType": "landscape.man_made", "elementType": "geometry.stroke", "stylers": [{ "color": "#00d2ff" }, { "lightness": -60 }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#2a4b6c" }] },
    { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#061017" }] },
    { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#142d47" }] },
    { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#1b3c5e" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#4b85b8" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#00d2ff" }, { "lightness": -40 }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#040b12" }] }
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
            styles: GOOGLE_MAPS_STYLE,
            disableDefaultUI: true,
            zoomControl: false,
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
            console.warn("mon50cc Maps : Erreur initialisation DirectionsService", e);
        }

        // PlaceAutocompleteElement pour le Départ
        const startInputOld = document.getElementById('route-start');
        if (startInputOld && PlaceAutocompleteElement) {
            const startInputGmp = new PlaceAutocompleteElement({
                requestedLanguage: 'fr'
            });
            startInputGmp.id = 'route-start-gmp';
            startInputGmp.setAttribute('placeholder', 'Position de départ...');
            startInputOld.parentNode.replaceChild(startInputGmp, startInputOld);
        }

        // PlaceAutocompleteElement pour la Recherche
        const inputOld = document.getElementById('route-search');
        if (inputOld && PlaceAutocompleteElement) {
            const searchInputGmp = new PlaceAutocompleteElement({
                requestedLanguage: 'fr'
            });
            searchInputGmp.id = 'route-search-gmp';
            searchInputGmp.setAttribute('placeholder', 'Où allez-vous ?');
            
            inputOld.parentNode.replaceChild(searchInputGmp, inputOld);

            searchInputGmp.addEventListener('gmp-placeselect', async ({ place }) => {
                if (!place) return;
                await place.fetchFields({ fields: ['location', 'viewport'] });
                
                if (!place.location) {
                    window.searchDestination();
                    return;
                }
                if (place.viewport) {
                    map.fitBounds(place.viewport);
                } else {
                    map.setCenter(place.location);
                    map.setZoom(17);
                }

                if (!currentPosition) {
                    speak("Recherche de votre position GPS. L'itinéraire démarrera automatiquement dès que possible.");
                    window.pendingDestinationName = searchInputGmp.inputValue;
                    return;
                }

                calculateRouteSansAutoroute(currentPosition, place.location);
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
    console.log("mon50cc Master Controller : Démarrage de la séquence d'initialisation v60.0.19-GOLD...");
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
        console.log("mon50cc v60.0.19-GOLD : Système prêt.");
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
        // Relancer le GPS si on a perdu la position pendant le sleep
        if (!currentPosition && gpsWatchId === null) {
            console.log("mon50cc GPS : Retour au premier plan sans position → relance GPS.");
            startGeolocation();
        }
    }
});

async function checkLegalConsent() {
    const consent = localStorage.getItem('legal_consent_accepted');
    if (consent === 'true') {
        startGeolocation();
        return;
    }

    // Création du modal de divulgation (Prominent Disclosure)
    const modal = document.createElement('div');
    modal.id = 'legal-modal';
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:#0a0a0a; z-index:20000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; padding:30px; text-align:center; overflow-y:auto;";
    modal.innerHTML = `
        <i class="fa-solid fa-shield-halved" style="font-size:3rem; color:#ffb703; margin-bottom:20px;"></i>
        <h2 style="margin-bottom:15px;">Respect de votre Vie Privée</h2>
        <p style="font-size:0.9rem; line-height:1.4; margin-bottom:15px;">
            Pour fonctionner, <strong>mon50ccetmoi</strong> collecte les données de <strong>localisation précise</strong>.
        </p>
        <div style="background:#1a1a1a; padding:15px; border-radius:10px; text-align:left; font-size:0.8rem; margin-bottom:15px; border-left:4px solid #ffb703;">
            <p><strong>Utilisation en arrière-plan :</strong> Votre position est accédée même lorsque l'application est fermée ou en arrière-plan pour :</p>
            <ul style="margin-top:5px; padding-left:15px;">
                <li>Vous alerter en cas de <strong>chute détectée</strong>.</li>
                <li>Garder la <strong>navigation active</strong> écran éteint.</li>
                <li>Signaler les <strong>dangers</strong> à la communauté.</li>
            </ul>
        </div>
        <p style="font-size:0.75rem; color:#888; margin-bottom:20px;">
            Les données sont chiffrées et vous pouvez supprimer votre compte à tout moment. En continuant, vous acceptez notre <a href="privacy.html" target="_blank" style="color:#ffb703;">politique de confidentialité</a>.
        </p>
        <button id="btn-accept-legal" style="width:100%; padding:15px; background:#ffb703; color:black; border:none; border-radius:30px; font-weight:bold; font-size:1rem; margin-bottom:10px;">ACCEPTER ET CONTINUER</button>
        <button onclick="window.close()" style="background:transparent; border:none; color:#666; font-size:0.8rem; text-decoration:underline;" id="btn-refuse-legal">Refuser et quitter</button>
    `;
    document.body.appendChild(modal);

    // Bouton Refus : masque le modal (window.close() ne marche pas sur mobile)
    document.getElementById('btn-refuse-legal').onclick = () => {
        modal.style.display = 'none';
        speak("L'application nécessite votre accord pour fonctionner.");
    };

    document.getElementById('btn-accept-legal').onclick = () => {
        localStorage.setItem('legal_consent_accepted', 'true');
        modal.remove();
        
        // Déclenchement du message de bienvenue (Audio débloqué par le clic)
        const name = (window.session && !window.session.isGuest) ? window.session.username : "";
        const welcomeMsg = name ? `Content de vous revoir, ${name}. Systèmes opérationnels.` : "Systèmes opérationnels. Bonne route sur mon 50cc et moi.";
        speak(welcomeMsg);
        
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
            <p style="font-size:1rem; line-height:1.5; margin-bottom:25px;">
                mon50cc est une application de navigation GPS et de sécurité.<br><br>
                <b>Sans accès à votre position, l'application ne peut pas fonctionner.</b>
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
    const instructions = [
        "📱 Sur Android Chrome :",
        "1. Appuie sur les 3 points ⋮ en haut à droite",
        "2. Paramètres → Paramètres du site",
        "3. Localisation → Cherche '" + appUrl + "'",
        "4. Passe de 'Bloquer' à 'Autoriser'",
        "5. Recharge l'application",
        "",
        "📱 Dans l'app Android :",
        "1. Appui long sur l'icône de l'app",
        "2. Infos sur l'appli → Autorisations",
        "3. Position → Autoriser (ou Toujours autoriser)"
    ].join("\n");
    alert(instructions);
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
    
    if (speedEl) {
        speedEl.textContent = speedKmh;
        
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
        
        if (dist < 100 && lastSpokenHazard !== h.lat + h.lon) { 
            speak(`Attention : ${h.type} signalé à proximité.`);
            lastSpokenHazard = h.lat + h.lon;
            showHazardConfirmation(index, h.type);
        }
    });
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

// --- REGIONAL & VOICE ENGINE (ORACLE v50000.9) ---
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
    utterance.rate = 0.95;
    utterance.pitch = (window.OracleEngine && window.OracleEngine.gender === 'female') ? 1.05 : 0.9;
    
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

// --- 3. ROUTAGE ---
let destinationMarker = null;
let currentRoutePolylines = [];
let currentRouteMarkers = [];

async function calculateRouteSansAutoroute(start, end) {
    if (!start || !end) {
        console.error("mon50cc Maps : Points de départ ou d'arrivée invalides.", {start, end});
        if (!start) speak("Signal GPS insuffisant pour démarrer l'itinéraire.");
        return;
    }

    // Nettoyage des tracés précédents
    currentRoutePolylines.forEach(p => p.setMap(null));
    currentRoutePolylines = [];
    currentRouteMarkers.forEach(m => m.setMap(null));
    currentRouteMarkers = [];

    if (!directionsService || !directionsRenderer) {
        speak("Le moteur de routage n'est pas disponible pour le moment.");
        return;
    }

    if (directionsRenderer) directionsRenderer.setMap(null);

    const legacyRequest = {
        origin: start,
        destination: end,
        travelMode: 'DRIVING',
        avoidHighways: true,
        avoidTolls: true,
        provideRouteAlternatives: window.isRodageActive
    };

    console.log("mon50cc Routes : Calcul via DirectionsService...");
    directionsService.route(legacyRequest, (result, status) => {
        if (status === 'OK') {
            if (directionsRenderer) {
                directionsRenderer.setMap(map);
                directionsRenderer.setDirections(result);
            }
            
            const leg = result.routes[0].legs[0];
            const infoBar = document.getElementById('nav-info-bar');
            if (infoBar) {
                infoBar.style.setProperty('display', 'flex', 'important');
            }
            
            const btnStop = document.getElementById('btn-stop-nav');
            if (btnStop) btnStop.classList.remove('hidden');

            const distEl = document.getElementById('nav-dist');
            const timeEl = document.getElementById('nav-time');
            const etaEl = document.getElementById('nav-eta');
            if(typeof window.startPremiumNavigation === 'function') window.startPremiumNavigation(leg);

            if (distEl) distEl.textContent = leg.distance.text;

            let durationSec = leg.duration.value;
            const distanceMeters = leg.distance.value;

            // --- AJUSTEMENT 50cc ---
            durationSec = Math.round(durationSec * 1.20); // +20% pour scooter 50cc en ville
            const maxSpeedMs = 40 / 3.6; 
            const googleSpeedMs = distanceMeters / durationSec;
            if (googleSpeedMs > maxSpeedMs) {
                durationSec = Math.round(distanceMeters / maxSpeedMs);
                if (window.Telemetry) window.Telemetry.addLog("INFO", `ETA ajusté pour 50cc.`);
            }
            
            const destNameLegacy = document.getElementById('route-search').value || 'ITINÉRAIRE 50CC';
            const titleElLegacy = document.querySelector('.route-title');
            if (titleElLegacy) titleElLegacy.textContent = destNameLegacy.toUpperCase();

            let durationTextStr;
            const totalMins = Math.floor(durationSec / 60);
            if (totalMins >= 60) {
                durationTextStr = `${Math.floor(totalMins/60)} h ${totalMins%60} min`;
            } else {
                durationTextStr = `${totalMins} min`;
            }

            if (timeEl) timeEl.textContent = durationTextStr;
            if (etaEl) {
                const arrivalTime = new Date(Date.now() + durationSec * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                etaEl.textContent = arrivalTime;
            }

            // Détection ferry (Legacy)
            window.routeFerries = leg.steps.filter(s => 
                s.instructions.toLowerCase().includes('ferry') || 
                (s.maneuver && s.maneuver.toLowerCase().includes('ferry'))
            );
            lastSpokenFerryIndex = -1;

            if (window.routeFerries.length > 0) {
                setTimeout(() => speak('ferry_detected'), 4000);
                if (window.NeuralHUD && typeof window.NeuralHUD.logToConsole === "function") {
                    window.NeuralHUD.logToConsole(`NAV_INTEL: FERRY_CROSSING_AHEAD (${window.routeFerries.length})`);
                }
            }
            
            const etaText = etaEl ? etaEl.textContent : '';
            speak(window.getLocalizedRouteMsg(leg.distance.text, etaText, window.isRodageActive));

            if(destinationMarker) destinationMarker.setMap(null);
            destinationMarker = new google.maps.Marker({
                position: end,
                map: map,
                icon: {
                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: 6,
                    fillColor: "white",
                    fillOpacity: 1,
                    strokeWeight: 2
                }
            });
            currentRouteMarkers.push(destinationMarker);
        } else if (status === 'ZERO_RESULTS') {
            speak("Aucun itinéraire trouvé vers cette destination.");
        } else { 
            console.error("Routage impossible: " + status);
            speak("Erreur de calcul d'itinéraire.");
        }
    });
}

window.cancelRoute = function() {
    if (directionsRenderer) directionsRenderer.setDirections({routes: []});
    if(destinationMarker) { destinationMarker.setMap(null); destinationMarker = null; }
    
    document.getElementById('nav-instruction').classList.add('hidden');
    document.getElementById('nav-info-bar').style.display = 'none'; // On cache le bandeau
    document.getElementById('btn-stop-nav').classList.add('hidden');
    document.getElementById('btn-reroute').classList.add('hidden');
    
    document.getElementById('route-search').value = "";
}

window.pendingDestination = null;

window.toggleManualStart = function() {
    const box = document.getElementById('manual-start-box');
    box.classList.toggle('hidden');
    if(!box.classList.contains('hidden')) {
        const startEl = document.getElementById('route-start-gmp') || document.getElementById('route-start');
        startEl.focus();
    }
}

window.searchDestination = function() {
    const searchEl = document.getElementById('route-search-gmp') || document.getElementById('route-search');
    const startEl = document.getElementById('route-start-gmp') || document.getElementById('route-start');
    
    const query = searchEl.inputValue !== undefined ? searchEl.inputValue : searchEl.value;
    const startQuery = startEl.inputValue !== undefined ? startEl.inputValue : startEl.value;
    
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
                    } else { speak("Destination introuvable."); }
                });
            } else { speak("Lieu de départ introuvable."); }
        });
        return;
    }

    // SINON GPS CLASSIQUE
    if (!currentPosition) {
        speak("Recherche de votre position GPS. L'itinéraire démarrera automatiquement dès que possible.");
        window.pendingDestinationName = query; 
        return;
    }

    geocoder.geocode({ address: query }, (res, status) => {
        if (status === "OK") {
            const dest = res[0].geometry.location;
            calculateRouteSansAutoroute(currentPosition, dest);
            map.panTo(dest);
            const btnCancel = document.getElementById('btn-cancel-route');
            if (btnCancel) btnCancel.classList.remove('hidden');
        } else {
            speak("Destination introuvable.");
        }
    });
}

// --- 4. SERVICES COMMUNAUTAIRES (SIGNALEMENTS) ---
window.toggleHazardMenu = function() {
    const opts = document.getElementById('hazard-options');
    const mainBtn = document.getElementById('btn-hazard-quick') || document.getElementById('btn-hazard-main');
    if(!opts) return;
    if(opts.classList.contains('hidden')) {
        opts.classList.remove('hidden');
        if(mainBtn) mainBtn.style.transform = 'rotate(45deg)';
    } else {
        opts.classList.add('hidden');
        if(mainBtn) mainBtn.style.transform = 'rotate(0deg)';
    }
};

window.saveHazard = function(type) {
    if(!currentPosition) return;

    // VERIFICATION DU BAN
    if (typeof isUserBanned === "function" && isUserBanned()) {
        const remaining = Math.ceil((window.session.bannedUntil - Date.now()) / 60000);
        alert(`🚨 Action Interdite : Votre compte est suspendu pour faux signalements répétés. Fin de la sanction dans ${remaining} minutes.`);
        return;
    }

    const h = { 
        lat: currentPosition.lat, 
        lon: currentPosition.lng, 
        type: type, 
        author: window.session ? window.session.username : 'Anonyme',
        date: new Date().toISOString()
    };
    
    // 1. Sauvegarde Locale (Fallback)
    let dbLocal = JSON.parse(secureGetItem('hazards') || '[]');
    dbLocal.push(h);
    secureSetItem('hazards', JSON.stringify(dbLocal));
    
    // 2. Publication Cloud (Temps réel pour la communauté)
    if (typeof publishHazardCloud === "function") {
        publishHazardCloud(h).then(success => {
            if(success) console.log("Signalement synchronisé sur le Cloud.");
        });
    }

    alert(`Signalement: ${escapeHTML(type)} enregistré ! Merci à vous.`);
    toggleHazardMenu();
    loadHazards();
};

function loadHazards() {
    if (typeof google === 'undefined' || !google.maps || !google.maps.Marker) return;
    const raw = secureGetItem('hazards');
    const hazards = raw ? JSON.parse(raw) : [];
    hazardMarkers.forEach(m => m.setMap(null));
    hazardMarkers = [];
    
    const listContainer = document.getElementById('live-hazards-list');
    if(listContainer) {
        if(hazards.length === 0) {
            listContainer.innerHTML = '<p style="font-size:0.8rem; color:#666; text-align:center; padding:10px;">Aucun danger signalé.</p>';
        } else {
            listContainer.innerHTML = '';
            hazards.reverse(); // Voir les plus récents en premier dans la liste
        }
    }

    hazards.forEach((h, index) => {
        const hColor = h.type === 'Police' ? '#00d2ff' : (h.type === 'Route Dégradée' ? '#f1c40f' : '#ff4d4d');
        const marker = new google.maps.Marker({
            position: { lat: h.lat, lng: h.lon },
            map: map,
            icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: hColor, fillOpacity: 0.9, scale: 9, strokeColor: 'white', strokeWeight: 2 }
        });
        const info = new google.maps.InfoWindow({ content: `<b>${escapeHTML(h.type)}</b><br><small>${escapeHTML(h.author)}</small>` });
        marker.addListener("click", () => info.open(map, marker));
        hazardMarkers.push(marker);

        // Ajout à la liste sidebar
        if(listContainer && index < 5) { // On affiche les 5 derniers max
            const div = document.createElement('div');
            div.className = 'hazard-alert';
            div.style.cursor = 'pointer';
            div.innerHTML = `<div><i class="fa-solid fa-triangle-exclamation"></i> <strong>${escapeHTML(h.type)}</strong><br><span>Par ${escapeHTML(h.author)}</span></div><i class="fa-solid fa-chevron-right" style="font-size:0.6rem; color:#444;"></i>`;
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
    'fuel': { icon: 'fa-gas-pump', label: 'Essence', color: '#cca000', radius: 5000 },
    'doctors': { icon: 'fa-briefcase-medical', label: 'Santé & Pharmacie', color: '#e74c3c', radius: 3000 },
    'atm': { icon: 'fa-money-bill-1', label: 'DAB', color: '#2ecc71', radius: 3000 },
    'mechanic': { icon: 'fa-wrench', label: 'Garages', color: '#ffa500', radius: 8000 },
    'tourist_attraction': { icon: 'fa-landmark', label: 'Lieux Historiques', color: '#e67e22', radius: 10000 }
};

window.toggleRadarMenu = function() {
    const r = document.getElementById('radar-options');
    if(r) r.classList.toggle('hidden');
}

window.scanRadar = function(type) {
    if(!currentPosition) return;
    toggleRadarMenu();
    const config = poiConfig[type];
    const radarBtn = document.getElementById('btn-radar-quick') || document.getElementById('btn-radar-main');
    const oldHtml = radarBtn ? radarBtn.innerHTML : '';
    if(radarBtn) radarBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    if (type === 'fuel') {
        // --- NEW: Government Data Integration ---
        fetchFuelPricesUsingGovAPI(currentPosition.lat, currentPosition.lng, config, radarBtn, oldHtml);
    } else if (type === 'mechanic') {
        // --- NEW: Google Places Garage Integration ---
        fetchGaragesUsingPlacesAPI(currentPosition.lat, currentPosition.lng, config, radarBtn, oldHtml);
    } else {
        // Standard Overpass Search for other POIs
        const lat = currentPosition.lat;
        const lon = currentPosition.lng;
        // MEDICAL includes doctors, clinics, hospitals AND pharmacy
        const medicalTags = 'clinic|hospital|doctors|pharmacy';
        const query = `[out:json][timeout:15];(nwr["amenity"~"${type === 'doctors' ? medicalTags : type}"](around:${config.radius},${lat},${lon}););out center;`;
        const url = `https://lz4.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        
        fetch(url).then(r => r.json()).then(data => {
            renderPoiMarkers(data.elements, config);
        }).finally(() => { if(radarBtn) radarBtn.innerHTML = oldHtml; });
    }
}

async function fetchFuelPricesUsingGovAPI(lat, lng, config, btn, oldHtml) {
    // API OpenData Gouv: Prix des carburants
    const url = `https://data.economie.gouv.fr/api/records/1.0/search/?dataset=prix-des-carburants-en-france-flux-instantane-v2&q=&geofilter.distance=${lat},${lng},5000&rows=20`;
    
    try {
        const blacklist = typeof getBlacklist === "function" ? await getBlacklist() : [];
        const today = new Date().toISOString().split('T')[0];
        const reportsSnap = await db.collection("reports_abuse").where("lastUpdate", ">=", new Date(today)).get();
        const reportCounts = {};
        reportsSnap.forEach(doc => { reportCounts[doc.data().stationId] = doc.data().count; });

        const res = await fetch(url);
        const data = await res.json();
        officialPoiMarkers.forEach(m => m.setMap(null));
        officialPoiMarkers = [];

        if (data.records) {
            data.records.forEach(record => {
                const fields = record.fields;
                const coords = record.geometry.coordinates;
                const stationId = record.recordid;

                // Masquer si blacklistée
                if (blacklist.includes(stationId)) {
                    console.log("Station ignorée (Blacklistée par la communauté) :", fields.vile);
                    return;
                }
                
                // Extraction des prix
                let pricesHtml = "";
                try {
                    const priceList = JSON.parse(fields.prix || "[]");
                    priceList.forEach(p => {
                        // Ignorer le gazole (pas pour les 50cc)
                        if (p["@nom"] === "Gazole") return;
                        
                        pricesHtml += `<div style="display:flex; justify-content:space-between; gap:10px;">
                            <strong>${p["@nom"]}</strong> <span>${parseFloat(p["@valeur"]).toFixed(3)}€</span>
                        </div>`;
                    });
                } catch(e) { pricesHtml = "Prix non disponibles"; }

                const marker = new google.maps.Marker({
                    position: { lat: coords[1], lng: coords[0] },
                    map: map,
                    icon: { path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, fillColor: "#cca000", fillOpacity: 1, scale: 6, strokeColor: 'white' }
                });

                // Compteur de signalements
                const currentReports = reportCounts[stationId] || 0;
                const reportBadge = currentReports > 0 ? `<div style="color:#ff4d4d; font-size:0.7rem; font-weight:bold; margin-top:5px;"><i class="fa-solid fa-triangle-exclamation"></i> ${currentReports}/10 signalements</div>` : "";

                // Bouton de signalement pour les membres
                const isGuest = !window.session || window.session.isGuest;
                const reportBtn = isGuest ? "" : `
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
                    </div>`
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
    if(!google.maps.places) {
        alert("Services de lieux non disponibles.");
        btn.innerHTML = oldHtml;
        return;
    }
    
    const service = new google.maps.places.PlacesService(map);
    const request = {
        location: new google.maps.LatLng(lat, lng),
        radius: config.radius,
        keyword: 'garage scooter 50cc moto'
    };

    service.nearbySearch(request, (results, status) => {
        btn.innerHTML = oldHtml;
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            officialPoiMarkers.forEach(m => m.setMap(null));
            officialPoiMarkers = [];
            
            // FILTRAGE : Uniquement ceux avec note >= 3.3
            const filtered = results.filter(r => (r.rating || 0) >= 3.3);
            
            filtered.forEach(async (place) => {
                // DONNEES COMMUNAUTAIRES
                const internalInfo = typeof getGarageInternalInfo === "function" ? await getGarageInternalInfo(place.place_id) : null;
                const isPro = (internalInfo?.count || 0) >= 1000;
                const proBadge = isPro ? `<div style="background:#ffd700; color:black; padding:2px 5px; font-size:0.6rem; font-weight:bold; border-radius:4px; margin-top:5px; display:inline-block;"><i class="fa-solid fa-trophy"></i> BADGE PRO CERTIFIÉ</div>` : "";
                const qualityBadge = (place.rating > 3.9) ? `<div style="background:#f1c40f; color:black; padding:2px 5px; font-size:0.6rem; font-weight:bold; border-radius:4px; margin-top:5px; display:inline-block;"><i class="fa-solid fa-certificate"></i> QUALITÉ CERTIFIÉE (>3.9)</div>` : "";
                const communityRating = internalInfo ? `<div style="font-size:0.7rem; color:#00d2ff; margin-top:3px;">Label Scooter : ⭐ ${internalInfo.avgRating}/5 (${internalInfo.count} avis)</div>` : "";

                const marker = new google.maps.Marker({
                    position: place.geometry.location,
                    map: map,
                    icon: { 
                        path: google.maps.SymbolPath.CIRCLE, 
                        scale: 10, 
                        fillColor: (place.rating > 3.9) ? "#f1c40f" : (isPro ? "#ffd700" : config.color), 
                        fillOpacity: 1, 
                        strokeColor: 'white',
                        strokeWeight: (place.rating > 3.9) ? 3 : 1
                    }
                });

                // Étoiles de notation
                const isGuest = !window.session || window.session.isGuest;
                const starBtns = isGuest ? "" : `<div style="margin-top:10px; border-top:1px solid #eee; padding-top:5px;">
                    <small>Évaluer ce garage :</small><br>
                    <span style="font-size:1.2rem; cursor:pointer;" onclick="evaluateGarage('${place.place_id}', '${place.name.replace(/'/g, "\\'")}', 1)">⭐</span>
                    <span style="font-size:1.2rem; cursor:pointer;" onclick="evaluateGarage('${place.place_id}', '${place.name.replace(/'/g, "\\'")}', 2)">⭐</span>
                    <span style="font-size:1.2rem; cursor:pointer;" onclick="evaluateGarage('${place.place_id}', '${place.name.replace(/'/g, "\\'")}', 3)">⭐</span>
                    <span style="font-size:1.2rem; cursor:pointer;" onclick="evaluateGarage('${place.place_id}', '${place.name.replace(/'/g, "\\'")}', 4)">⭐</span>
                    <span style="font-size:1.2rem; cursor:pointer;" onclick="evaluateGarage('${place.place_id}', '${place.name.replace(/'/g, "\\'")}', 5)">⭐</span>
                </div>`;

                const info = new google.maps.InfoWindow({
                    content: `<div style="color:black; min-width:180px;">
                        <b style="font-size:1rem;">${escapeHTML(place.name)}</b><br>
                        ⭐ Google: ${place.rating || "N/A"}/5 (${place.user_ratings_total || 0})<br>
                        ${qualityBadge}
                        ${communityRating}
                        ${proBadge}
                        ${starBtns}
                    </div>`
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
window.triggerPhotoReport = function(id, name) {
    const input = document.getElementById('abuse-photo-input');
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        
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
    officialPoiMarkers.forEach(m => m.setMap(null));
    officialPoiMarkers = [];
    if(elements?.length > 0) {
        elements.forEach(item => {
            const marker = new google.maps.Marker({
                position: { lat: item.lat || item.center.lat, lng: item.lon || item.center.lon },
                map: map,
                icon: { path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, fillColor: config.color, fillOpacity: 1, scale: 5, strokeColor: 'white' }
            });
            const info = new google.maps.InfoWindow({ content: `<div style="color:black"><b>${escapeHTML(item.tags?.name || config.label)}</b></div>` });
            marker.addListener("click", () => info.open(map, marker));
            officialPoiMarkers.push(marker);
        });
    }
    alert(`${elements?.length || 0} résultat(s) trouvés.`);
}

// --- 6. SIMULATIONS ET CHRONO ---
let tripSeconds = 0;
setInterval(() => {
    if(window.isRiding) tripSeconds++;
    const tEl = document.getElementById('trip-timer');
    if(tEl) {
        const str = new Date(tripSeconds * 1000).toISOString().substring(11, 19);
        tEl.textContent = str.startsWith("00:") ? str.substring(3) : str;
    }
}, 1000);

// --- COMMUNITY LIVE RENDERING (MOBILE HUD ENGINE) ---
let communityMarkers = [];
window.renderCommunityMarkers = function() {
    if(!map || !window.communityMembers) return;
    
    // Clear old markers
    communityMarkers.forEach(m => m.setMap(null));
    communityMarkers = [];

    window.communityMembers.forEach(member => {
        const m = new google.maps.Marker({
            position: { lat: member.lat, lng: member.lng },
            map: map,
            icon: { 
                path: google.maps.SymbolPath.CIRCLE, 
                scale: 6, 
                fillColor: '#00d2ff', 
                fillOpacity: 0.8, 
                strokeColor: 'white', 
                strokeWeight: 2,
                labelOrigin: new google.maps.Point(0, -2)
            },
            title: member.username
        });

        const info = new google.maps.InfoWindow({ 
            content: `<div style="color:black"><b>${escapeHTML(member.username)}</b><br><small>${escapeHTML(member.brand)} - ${escapeHTML(member.status)}</small></div>` 
        });
        m.addListener("click", () => info.open(map, m));
        communityMarkers.push(m);
    });
}

window.simulateLiveFleet = function() {
    if(!currentPosition || !map) return;
    const ghostNames = ["Rider_Z", "Nitro50", "BoostPowa", "StuntMan", "RoadRunner"];
    const ghostBrands = ["Yamaha Bw's", "MBK Booster", "Piaggio Zip", "Peugeot Speedfight", "Derbi Senda"];
    
    ghostNames.forEach((name, i) => {
        const offsetLat = (Math.random() - 0.5) * 0.01;
        const offsetLng = (Math.random() - 0.5) * 0.01;
        const ghostPos = { lat: currentPosition.lat + offsetLat, lng: currentPosition.lng + offsetLng };
        
        const m = new google.maps.Marker({
            position: ghostPos,
            map: map,
            icon: { 
                path: google.maps.SymbolPath.CIRCLE, 
                scale: 5, 
                fillColor: '#666', 
                fillOpacity: 0.5, 
                strokeColor: 'white', 
                strokeWeight: 1 
            },
            title: name
        });
        
        const info = new google.maps.InfoWindow({ 
            content: `<div style="color:black"><b>${name} [IA]</b><br><small>${ghostBrands[i]}</small></div>` 
        });
        m.addListener("click", () => info.open(map, m));
        communityMarkers.push(m);
    });
    console.log("mon50cc Fleet : Ghost riders deployed.");
}

// --- 7. SERVICES (Météo, Boussole, Garage) ---
window.fetchWeather = async function(lat, lon) {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        const temp = Math.round(data.current_weather.temperature);
        const code = data.current_weather.weathercode;
        
        let icon = '<i class="fa-solid fa-cloud-sun"></i>';
        let alertMsg = "";

        if (code >= 95) { alertMsg = "Alerte Orage : Prudence maximale conseillée."; icon = '<i class="fa-solid fa-cloud-bolt" style="color:#f1c40f;"></i>'; }
        else if (code >= 80) { alertMsg = "Averses détectées : Route potentiellement glissante."; icon = '<i class="fa-solid fa-cloud-showers-heavy"></i>'; }
        else if (code >= 61) { alertMsg = "Pluie signalée par satellite. Équipez-vous."; icon = '<i class="fa-solid fa-cloud-rain"></i>'; }
        else if (code >= 71) { alertMsg = "Alerte Neige : Conditions de circulation difficiles."; icon = '<i class="fa-solid fa-snowflake"></i>'; }

        const wHud = document.getElementById('weather-hud');
        if(wHud) {
            wHud.innerHTML = `${icon} ${temp}°C`;
            if (alertMsg) wHud.classList.add('weather-alert');
            else wHud.classList.remove('weather-alert');
        }

        if (alertMsg && !window.lastWeatherAlert) {
            speak(alertMsg);
            window.lastWeatherAlert = true;
            setTimeout(() => window.lastWeatherAlert = false, 3600000); // Reset alerte toutes les heures
        }
    } catch(e) { console.warn("Météo fail"); }
}

const maintenanceIntervals = { 'oil': 2000, 'belt': 5000, 'tires': 10000 };
window.renderDynamicGarage = function() {
    if(!window.session) return;
    const c = document.getElementById('dynamic-garage-list');
    if(!c) return;
    c.innerHTML = "";
    Object.keys(maintenanceIntervals).forEach(k => {
        const total = window.session.totalDistance || 0;
        const last = (window.session.maintenance || {})[k] || 0;
        const percent = Math.min(((total - last) / maintenanceIntervals[k]) * 100, 100);
        c.innerHTML += `<div class="garage-item"><span>${k.toUpperCase()}</span><div class="garage-bar-bg"><div class="garage-bar-fill" style="width:${percent}%"></div></div></div>`;
    });
}

// --- 8. GAMIFICATION ODOMETRE ---
let lastPositionForOdometer = null;
function calculateDistanceAndBadges(lat, lng) {
    if(!window.session) return;
    window.session.totalDistance = window.session.totalDistance || 0;
    window.session.rodageKm = window.session.rodageKm || 0;

    if(lastPositionForOdometer) {
        const p1 = new google.maps.LatLng(lastPositionForOdometer.lat, lastPositionForOdometer.lng);
        const p2 = new google.maps.LatLng(lat, lng);
        const d = google.maps.geometry.spherical.computeDistanceBetween(p1, p2) / 1000;
        
        if(d > 0.005 && d < 0.2) {
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
    if(!window.session) return;
    secureSetItem('session', JSON.stringify(window.session));
    const odom = document.getElementById('display-odometer');
    if(odom) odom.textContent = `Odomètre: ${window.session.totalDistance.toFixed(2)} km`;
    
    const mileageHud = document.getElementById('mileage-hud');
    if(mileageHud) mileageHud.textContent = `${window.session.totalDistance.toFixed(1)} KM`;
    
    // --- NEW: CO2 Savings calculation ---
    const ecoEl = document.getElementById('display-eco');
    if(ecoEl) {
        const co2Saved = window.session.totalDistance * 0.12; // 120g CO2 saved per km vs car
        ecoEl.innerHTML = `<i class="fa-solid fa-leaf"></i> -${co2Saved.toFixed(1)} kg CO2`;
    }

    // --- Badge Check ---
    checkUserBadges();
}

function checkUserBadges() {
    if(!window.session) return;
    const badgeContainer = document.getElementById('user-badges');
    if(!badgeContainer) return;

    const total = window.session.totalDistance || 0;
    const co2Saved = total * 0.12;
    let badgesHtml = "";

    // Badge Elite (5000km)
    if(total >= 5000) {
        badgesHtml += `<div class="badge-pro" title="Badge Elite: 5000km" style="background:#00d2ff; color:black; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block; margin-right:5px;">
            <i class="fa-solid fa-crown"></i> Elite
        </div>`;
    }

    // Badge Ecolo (100kg CO2)
    if(co2Saved >= 100) {
        badgesHtml += `<div class="badge-eco" title="Badge Écolo: 100kg CO2 sauvés" style="background:#2ecc71; color:white; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block; margin-right:5px;">
            <i class="fa-solid fa-leaf"></i> Écolo
        </div>`;
    }

    // Badge Pro du Rodage (500km rodage)
    const rodageTotal = window.session.rodageKm || 0;
    if(rodageTotal >= 500) {
        badgesHtml += `<div class="badge-rodage" title="Pro du Rodage: 500km zen" style="background:#f39c12; color:white; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block;">
            <i class="fa-solid fa-wrench"></i> Pro Rodage
        </div>`;
    }

    // Badge Diamant (10000km)
    if(total >= 10000) {
        badgesHtml += `<div class="badge-diamant" title="Légende: 10000km" style="background:linear-gradient(135deg, #B9F2FF, #ffffff); color:#005c75; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block; box-shadow:0 0 10px #B9F2FF; margin-right:5px;">
            <i class="fa-solid fa-gem"></i> Diamant
        </div>`;
    }

    // Badge Pro des Défis (150 victoires)
    const challengeWins = window.session?.completedChallengesCount || 0;
    if(challengeWins >= 150) {
        badgesHtml += `<div class="badge-master-defi" title="Master Défis: 150 victoires" style="background:#9b59b6; color:white; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block; border:1px solid #fff;">
            <i class="fa-solid fa-trophy"></i> Pro des Défis
        </div>`;
    }

    // Badge Mécène (Donateur)
    if(window.session?.isDonator) {
        badgesHtml += `<div class="badge-mecene" title="Mécène: Soutien du projet" style="background:#e91e63; color:white; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block; margin-right:5px; box-shadow:0 0 5px #e91e63;">
            <i class="fa-solid fa-heart"></i> Mécène
        </div>`;
    }

    if(badgesHtml === "") {
        const remainingEl = 5000 - total;
        badgesHtml = `<small style="color:#666; font-size:0.6rem;">En route pour les badges...</small>`;
    }

    badgeContainer.innerHTML = badgesHtml;
}

// --- 9. ROADBOOKS ---
let savedRoadbooks = JSON.parse(secureGetItem('roadbooks')) || [];
window.renderRoadbooks = function(filter = 'all') {
    const list = document.getElementById('roadbook-list');
    if(!list) return;
    
    const favorites = JSON.parse(secureGetItem('favorite_roadbooks') || '[]');
    let items = filter === 'favorites' 
        ? savedRoadbooks.filter((rb, idx) => favorites.includes(idx))
        : savedRoadbooks;

    if(items.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:#666; margin-top:20px;">Aucun roadbook ${filter === 'favorites' ? 'favori' : 'enregistré'}.</p>`;
        return;
    }

    list.innerHTML = items.map((rb, i) => {
        const globalIdx = savedRoadbooks.indexOf(rb);
        const isFav = favorites.includes(globalIdx);
        return `
            <li style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px; margin-bottom:5px; border-radius:8px;">
                <div style="flex:1;">
                    <div style="font-weight:bold;">${rb.name}</div>
                    <small style="color:#888;">${rb.waypoints?.length || 0} étapes</small>
                </div>
                <div style="display:flex; gap:5px;">
                    <button onclick="toggleFavoriteRoadbook(${globalIdx})" style="background:transparent; color:${isFav ? '#f1c40f' : '#444'}; border:none; font-size:1.2rem; cursor:pointer;" title="Ajouter aux favoris">
                        <i class="fa-${isFav ? 'solid' : 'regular'} fa-star"></i>
                    </button>
                    <button onclick="loadRoadbook(${globalIdx})" style="background:#2ecc71; color:white; border:none; padding:5px 10px; border-radius:5px; font-size:0.7rem;">Go</button>
                    <button onclick="shareRoadbook(${globalIdx})" style="background:#00d2ff; color:black; border:none; padding:5px 10px; border-radius:5px; font-size:0.7rem;"><i class="fa-solid fa-share"></i></button>
                </div>
            </li>`;
    }).join('');
}

window.toggleFavoriteRoadbook = function(idx) {
    let favorites = JSON.parse(secureGetItem('favorite_roadbooks') || '[]');
    const favIdx = favorites.indexOf(idx);
    
    if (favIdx > -1) {
        favorites.splice(favIdx, 1);
        speak("Retiré des favoris.");
    } else {
        favorites.push(idx);
        speak("Ajouté aux favoris !");
        vibrate(50);
    }
    
    secureSetItem('favorite_roadbooks', JSON.stringify(favorites));
    renderRoadbooks(document.querySelector('[style*="background: rgb(241, 196, 15)"]') ? 'favorites' : 'all');
}

window.shareRoadbook = async function(i) {
    const rb = savedRoadbooks[i];
    
    // MODÉRATION : Vérification de la grossièreté
    if (Moderation.isProfane(rb.name) || (rb.description && Moderation.isProfane(rb.description))) {
        alert("Action bloquée : Le titre ou la description contient un langage inapproprié.");
        return;
    }

    // MODÉRATION : Vérification des images (si présentes)
    if (rb.photo) {
        const scan = await Moderation.scanImage(rb.photo);
        if (!scan.safe) {
            alert("Action bloquée : L'image jointe n'est pas conforme aux règles communautaires.");
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
}

window.loadRoadbook = function(i) {
    const rb = savedRoadbooks[i];
    calculateRouteSansAutoroute(currentPosition, rb.waypoints[rb.waypoints.length-1]);
}

// --- SYSTEM STARTUP ---
function runCinematicStartup() {
    const statusEl = document.getElementById('loader-status');
    const needle = document.getElementById('gauge-needle');
    const speedVal = document.getElementById('gauge-speed-val');
    const gaugeFill = document.getElementById('gauge-fill-path');
    const checkList = document.getElementById('system-check-list');

    const steps = [
        { text: "INITIALIZING KERNEL...", delay: 200 },
        { text: "50CC ENGINE CHECK: OPTIMAL", delay: 800 },
        { text: "STABLIZING SATELLITE LINK...", delay: 1400 },
        { text: "CALIBRATING HUD SENSORS...", delay: 2000 },
        { text: "SYSTEM READY - RIDE SAFE", delay: 3000 }
    ];

    steps.forEach(step => {
        setTimeout(() => {
            if(statusEl) statusEl.textContent = step.text;
        }, step.delay);
    });

    // Needle Sweep 0 -> 80 -> 0
    setTimeout(() => {
        if(needle) needle.style.transform = 'rotate(40deg)'; // 120 -> 40 pour être proportionnel
        if(gaugeFill) gaugeFill.style.strokeDashoffset = '220';
        
        let speed = 0;
        const interval = setInterval(() => {
            speed += 2;
            if(speedVal) speedVal.textContent = speed;
            if(speed >= 80) {
                clearInterval(interval);
                setTimeout(() => {
                    if(needle) needle.style.transform = 'rotate(-120deg)';
                    if(gaugeFill) gaugeFill.style.strokeDashoffset = '440';
                    const intervalDown = setInterval(() => {
                        speed -= 3;
                        if(speed <= 0) {
                            speed = 0;
                            clearInterval(intervalDown);
                        }
                        if(speedVal) speedVal.textContent = speed;
                    }, 20);
                }, 200);
            }
        }, 15);
    }, 500);

    // Update check list
    setTimeout(() => {
        if(checkList) checkList.innerHTML += "<div>> ENGINE_CHECK: OK</div>";
    }, 1200);
    setTimeout(() => {
        if(checkList) checkList.innerHTML += "<div>> NETWORK_ESTABLISHED: 5G_ULTRA</div>";
    }, 2000);
}


// Fail-safe Loader removal (after 5s)
setTimeout(() => {
    const loader = document.getElementById('app-loader');
    if(loader && loader.style.visibility !== 'hidden') {
        console.warn("Fail-safe: Force hiding loader after timeout.");
        loader.style.opacity = '0';
        setTimeout(() => loader.style.visibility = 'hidden', 1500);
    }
}, 5000);

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Prêt. En attente du SDK Maps...");
});

window.closeScreen = function() {
    const hud = document.getElementById('hud');
    if(hud) hud.style.display = 'block';
    document.getElementById('screen-overlay').classList.add('hidden');
}

window.showPage = function(page) {
    const hud = document.getElementById('hud');
    if(hud) hud.style.display = 'none';
    const overlay = document.getElementById('screen-overlay');
    const content = document.getElementById('screen-content');
    overlay.classList.remove('hidden');
    content.classList.remove('page-enter-active');
    content.classList.add('page-enter');
    setTimeout(() => content.classList.add('page-enter-active'), 50);
    if(navigator.vibrate) navigator.vibrate(50);
    setTimeout(() => content.classList.add('page-enter-active'), 50);
    
    if(page === 'stats') {
        content.innerHTML = `<h3><i class="fa-solid fa-chart-line"></i> ${t('stats_title')}</h3>
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
                <i class="fa-solid fa-share-nodes"></i> GÉNÉRER MA CARTE RIDE (VIRAL)
            </button>`;
    } else if(page === 'seasons') {
        content.innerHTML = `<h3><i class="fa-solid fa-trophy"></i> Saisons de Pilote</h3>
            <p style="font-size:0.75rem; color:#aaa; margin-bottom:15px;">Defis communautaires gratuits. Progressez chaque mois avec la communaute 50cc !</p>` +
            window.PilotSeasons.getHTMLSummary() +
            `<div style="margin-top:20px; padding:15px; background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid #333;">` +
            `<h4 style="color:var(--accent); font-size:0.85rem; margin-bottom:10px;"><i class="fa-solid fa-gauge-high"></i> KILOMETRAGE PREDICTIF</h4>` +
            window.MecaPredictor.getHTMLSummary() +
            `</div>
            <button onclick="window.SchoolZoneAI.enable()" class="btn-insurance" style="width:100%; margin-top:15px; background:linear-gradient(135deg,#e74c3c,#c0392b);">
                <i class="fa-solid fa-school"></i> Activer Detecteur Zones Scolaires
            </button>`;
    } else if(page === 'community_roadbooks') {
        const sharedRoadbooks = JSON.parse(localStorage.getItem('community_roadbooks') || '[]');
        content.innerHTML = `<h3><i class="fa-solid fa-map-location-dot"></i> Roadbooks Communautaires</h3>
            <p style="font-size:0.75rem; color:#aaa; margin-bottom:15px;">Partagez gratuitement vos itineraires favoris avec tous les pilotes 50cc !</p>
            <button onclick="window.CommunityRoadbooks.shareMyRoute()" class="btn-insurance" style="width:100%; margin-bottom:20px; background:linear-gradient(135deg,var(--neon-blue),#0077b6);">
                <i class="fa-solid fa-share-nodes"></i> Partager mon itineraire actuel (Gratuit)
            </button>
            <h4 style="font-size:0.85rem; color:#aaa; margin-bottom:10px;">Itineraires de la communaute</h4>
            <div id="community-roadbooks-list">
                ${sharedRoadbooks.length ? sharedRoadbooks.map(rb => `<div class="card" style="border-left:4px solid var(--neon-blue);">
                    <strong>${rb.name}</strong> <span style="font-size:0.65rem;color:#aaa;">${rb.distance}km - ${rb.author}</span>
                    <p style="font-size:0.75rem;margin:5px 0;color:#ccc;">${rb.description || "Itineraire 50cc"}</p>
                    <button onclick="window.CommunityRoadbooks.load(rb.id)" style="background:var(--neon-blue);color:#000;border:none;border-radius:8px;padding:4px 10px;font-size:0.7rem;cursor:pointer;">CHARGER</button>
                </div>`).join("") : "<p style='text-align:center;color:#444;padding:30px;'>Soyez le premier a partager !</p>"}
            </div>`;

    } else if(page === 'garage') {
        const history = JSON.parse(secureGetItem('maint_history') || '[]');
        const ctDate = secureGetItem('ct_date') || 'Non défini';
        
        content.innerHTML = `<h3><i class="fa-solid fa-warehouse"></i> ${t('garage_title')}</h3>
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
                <h4 style="color:var(--neon-blue); margin-bottom:10px;"><i class="fa-solid fa-chart-line"></i> TÉLÉMÉTRIE DE RIDE</h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; text-align:center;">
                    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px;">
                        <small>ANGLE MAX</small><br>
                        <strong style="font-size:1.2rem; color:var(--accent);">${maxLeanAngle}°</strong>
                    </div>
                    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:10px;">
                        <small>VITESSE MAX</small><br>
                        <strong style="font-size:1.2rem; color:var(--danger);">${window.session?.vMax || 0} km/h</strong>
                    </div>
                </div>
                <button onclick="resetTelemetry()" style="width:100%; height:25px; margin-top:10px; background:transparent; border:1px solid #444; color:#666; font-size:0.6rem; border-radius:15px;">RÉINITIALISER LES STATS</button>
            </div>

            <h4 style="margin-top:20px; font-size:0.9rem; color:#aaa; display:flex; justify-content:space-between;">
                <span>${t('maint_history_title')}</span>
                <i class="fa-solid fa-book-medical" style="color:#2ecc71;"></i>
            </h4>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
                <button onclick="addCategorizedMaint('Huile')" class="btn-dark" style="font-size:0.7rem; padding:10px;"><i class="fa-solid fa-droplet"></i> Huile</button>
                <button onclick="addCategorizedMaint('Courroie')" class="btn-dark" style="font-size:0.7rem; padding:10px;"><i class="fa-solid fa-gear"></i> Courroie</button>
                <button onclick="addCategorizedMaint('Pneus')" class="btn-dark" style="font-size:0.7rem; padding:10px;"><i class="fa-solid fa-circle-notch"></i> Pneus</button>
                <button onclick="addCategorizedMaint('Freins')" class="btn-dark" style="font-size:0.7rem; padding:10px;"><i class="fa-solid fa-hard-drive"></i> Freins</button>
            </div>

            <div id="maint-history" style="font-size:0.8rem; margin-top:15px; max-height:200px; overflow-y:auto;">
                ${history.length ? history.reverse().map(h => `<div style="padding:10px; background:rgba(255,255,255,0.05); margin-bottom:5px; border-radius:8px; border-left:3px solid ${h.certified ? '#2ecc71' : '#444'};">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>${h.category}</strong>
                        <span style="color:#666; font-size:0.7rem;">${h.date}</span>
                    </div>
                    <div style="font-size:0.75rem; margin-top:3px; color:#ccc;">${h.action}</div>
                    ${h.certified ? `<div style="font-size:0.6rem; color:#2ecc71; margin-top:5px;"><i class="fa-solid fa-certificate"></i> CERTIFIÉ PAR : ${h.garage}</div>` : ''}
                </div>`).join('') : '<p style="color:#444; text-align:center;">Votre carnet est vide.</p>'}
            </div>`;
        renderDynamicGarage();
    } else if(page === 'group') {
        content.innerHTML = `<h3>Balade en Groupe</h3>
            <div class="card" style="text-align:center; border: 1px solid #00d2ff;">
                <i class="fa-solid fa-people-group" style="font-size:3rem; color:#00d2ff; margin-bottom:15px;"></i>
                <p style="font-size:0.9rem;">Rejoignez vos amis sur la route !</p>
                <input type="text" id="group-code" placeholder="Code (Ex: RIDE75)" style="width:100%; padding:10px; margin-top:15px; background:#000; border:1px solid #00d2ff; color:white; border-radius:8px;">
                <button class="btn-insurance" onclick="joinGroup()" style="background:#00d2ff; color:black; margin-top:15px; width:100%;">Rejoindre</button>
            </div>`;
    } else if(page === 'rodage') {
        content.innerHTML = `<h3>Itinéraires Rodage</h3>
            <p>Routes limitées à 45 km/h pour préserver votre moteur.</p>
            <button class="btn-insurance" onclick="startRodage('Paris-Boucle')">Boucle Zen (Paris)</button>
            <button class="btn-insurance" onclick="startRodage('Lyon-Quais')">Quais Saône (Lyon)</button>`;
    } else if(page === 'insurance') {
        content.innerHTML = `<div class="card-insurance">
            <div class="insurance-badge">Partenaire</div>
            <h3>Protection 50cc</h3>
            <div class="promo-box"><span>Votre code promo:</span><strong>CHEZBIGBOO</strong></div>
            <div class="broker-contact">
                <strong>Robert - Courtier Partenaire</strong>
                <a href="tel:0749555829">📞 07 49 55 58 29</a>
                <span>Spécialiste du jeune conducteur 50cc</span>
            </div>
            <p>Bénéficiez de -15% sur votre assurance scooter en tant que membre.</p>
        </div>`;
    } else if(page === 'roadbooks') {
        content.innerHTML = `<h3>Roadbooks</h3>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <button onclick="renderRoadbooks('all')" class="btn-insurance" style="flex:1; padding:8px; font-size:0.75rem;">Mes Créations</button>
                <button onclick="renderRoadbooks('favorites')" class="btn-insurance" style="flex:1; padding:8px; font-size:0.75rem; background:#f1c40f; color:black;"><i class="fa-solid fa-star"></i> Mes Favoris</button>
            </div>
            <ul id="roadbook-list" style="list-style:none; padding:0;"></ul>`;
        renderRoadbooks('all');
    } else if(page === 'mechanic') {
        content.innerHTML = `<h3><i class="fa-solid fa-robot"></i> ${t('expert_meca_title')}</h3>
            <p style="font-size:0.8rem; color:#aaa;">Décrivez le symptôme (bruit, fumée, panne...)</p>
            <textarea id="meca-query" placeholder="Ex: Mon scoot broute à l'accélération..." style="width:100%; height:80px; margin-top:10px; background:#111; color:white; border:1px solid #ffb703; border-radius:8px; padding:10px;"></textarea>
            <button class="btn-insurance" onclick="submitMecaV3()" style="margin-top:15px; width:100%;">Scanner mon 50cc</button>
            <div id="meca-response" style="margin-top:20px; font-size:0.9rem; line-height:1.4;"></div>`;
    } else if(page === 'arbitre') {
        if (window.session && window.session.isGuest) {
            alert("Accès réservé aux membres inscrits ! 🛵");
            return;
        }
        content.innerHTML = `<h3><i class="fa-solid fa-scale-balanced"></i> ${t('arbitre_title')}</h3>
            <p style="font-size:0.8rem; color:#aaa; margin-bottom:15px;">Posez votre question sur la réglementation 50cc (débridage, équipement, contrôles...).</p>
            
            <div id="arbitre-chat" style="background:rgba(0,0,0,0.3); border-radius:15px; padding:15px; min-height:150px; max-height:300px; overflow-y:auto; margin-bottom:15px; border:1px solid rgba(255,183,3,0.2);">
                <div class="bot-msg" style="background:rgba(255,183,3,0.1); padding:10px; border-radius:10px 10px 10px 0; margin-bottom:10px; font-size:0.9rem; border-left:3px solid #ffb703;">
                    Bonjour ! Je suis l'Arbitre. Quel est votre litige ou votre question sur le Code de la Route ?
                </div>
            </div>

            <div style="display:flex; gap:10px;">
                <input type="text" id="arbitre-query" placeholder="Ex: Mon pot est-il homologué ?" style="flex:1; background:#111; color:white; border:1px solid #444; border-radius:20px; padding:10px 15px; font-size:0.9rem;">
                <button onclick="submitArbitre()" style="background:#ffb703; color:black; border:none; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-paper-plane"></i></button>
            </div>`;
    } else if(page === 'ia_predictive') {
        content.innerHTML = <div class="card-insurance" style="border: 2px solid #b700ff; background: rgba(20, 10, 40, 0.9);">
            <div class="insurance-badge" style="background: #b700ff; color: white;">IA Prédictive & Courtier</div>
            <h3 style="color: #00d2ff;"><i class="fa-solid fa-microchip"></i> IA Prédictive</h3>
            <p style="font-size: 0.85rem; color: #ddd; margin-bottom: 15px;">L'IA analyse vos trajets pour anticiper les pannes et optimiser votre conduite 50cc.</p>
            
            <div class="glassmorphism" style="padding:15px; margin-bottom:20px; background: rgba(0,0,0,0.4);">
                <h4 style="color: #ffb703; font-size: 0.9rem; margin-bottom: 10px;"><i class="fa-solid fa-star"></i> Avantages Courtier Partenaire</h4>
                <ul style="color: #aaa; font-size: 0.8rem; text-align: left; padding-left: 20px;">
                    <li><strong style="color: #fff;">-20% de réduction</strong> sur votre assurance tous risques grâce à l'IA Prédictive.</li>
                    <li><strong style="color: #fff;">Garantie panne 0 km</strong> incluse avec dépannage express.</li>
                    <li><strong style="color: #fff;">Bonus de bonne conduite</strong> (Ride-to-Earn convertible en réductions).</li>
                </ul>
                <button class="btn-insurance" style="width:100%; margin-top:10px; background: #ffb703; color: black; font-weight: bold;" onclick="showPage('insurance')">VOIR MON OFFRE ASSURANCE</button>
            </div>

            <button class="btn-insurance" style="width:100%; background: linear-gradient(135deg, #b700ff, #00d2ff); color: white; font-weight: bold; border: none; padding: 15px; border-radius: 10px;" onclick="PredictiveMeca.checkAlerts(); alert('L'IA analyse vos données de télémétrie actuelles... Aucun risque de serrage moteur détecté pour le moment. Vous roulez de manière optimale !')"><i class="fa-solid fa-bolt"></i> LANCER L'ANALYSE IA</button>
        </div>;
    } else if(page === 'profile') {
        content.innerHTML = <h3><i class="fa-solid fa-user-pen"></i> Mon Profil</h3>
            <div class="glassmorphism" style="padding:20px; margin-bottom:20px;">
                <label style="color:#aaa; font-size:0.8rem;">Pseudo :</label>
                <input type="text" id="edit-username" value="" style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; background:rgba(255,255,255,0.1); border:1px solid #444; color:#fff; border-radius:8px;">
                <label style="color:#aaa; font-size:0.8rem;">Modèle de scooter :</label>
                <input type="text" id="edit-scooter" value="" placeholder="Ex: Peugeot Kisbee 50cc" style="width:100%; padding:10px; margin-top:5px; margin-bottom:15px; background:rgba(255,255,255,0.1); border:1px solid #444; color:#fff; border-radius:8px;">
                <label style="color:#aaa; font-size:0.8rem;">Email de contact :</label>
                <input type="email" id="edit-email" value="" placeholder="contact@exemple.com" style="width:100%; padding:10px; margin-top:5px; margin-bottom:20px; background:rgba(255,255,255,0.1); border:1px solid #444; color:#fff; border-radius:8px;">
                <button onclick="saveProfileInfo()" class="btn-insurance" style="width:100%; background:var(--neon-blue); color:black; font-weight:bold; border:none; padding:12px; border-radius:8px;">ENREGISTRER</button>
            </div>;
    } else if(page === 'insurance_expert') {
        content.innerHTML = `<h3><i class="fa-solid fa-building-shield"></i> Portail Expert Assurance</h3>
            <p style="font-size:0.8rem; color:#aaa; margin-bottom:20px;">Accès sécurisé pour les compagnies d'assurance et experts judiciaires.</p>
            <div id="insurance-search-box" style="margin-bottom:20px;">
                <input type="text" id="expert-report-id" placeholder="ID du Dossier (ex: blackbox_...)" style="width:100%; padding:15px; background:rgba(255,255,255,0.05); border:1px solid #444; border-radius:10px; color:white; margin-bottom:10px;">
                <button class="btn-insurance" onclick="InsurancePortal.searchReport(document.getElementById('expert-report-id').value)" style="width:100%; padding:15px; background:#ffb703; color:black; border:none; border-radius:10px; font-weight:bold;">RECHERCHER LE DOSSIER</button>
            </div>
            <div id="insurance-content"></div>`;
    } else if(page === 'pulse') {
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
    } else if(page === 'ants_wallet') {
        const passport = Wallet.getSafetyPassport();
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
                <i class="fa-solid fa-file-shield"></i> GÉNÉRER MON CERTIFICAT OFFICIEL
            </button>
            
            <p style="font-size:0.65rem; color:#666; text-align:center; margin-top:20px;">Note : Ce coffre-fort facilite les contrôles mais ne remplace pas les documents originaux selon la législation en vigueur.</p>`;
    } else if(page === 'meca_lab') {
        content.innerHTML = `<h3><i class="fa-solid fa-oil-can"></i> Le Sorcier de la Méca</h3>
            <div class="glassmorphism" style="padding:20px; margin-bottom:20px;">
                <h4 style="color:var(--accent);">CALCULATEUR DE MÉLANGE</h4>
                <div style="margin-top:15px;">
                    <input type="number" id="mix-liters" placeholder="Litres d'essence" class="scooter-brand-select" style="width:100%; margin-bottom:10px;">
                    <input type="number" id="mix-percent" placeholder="% d'huile (ex: 2)" class="scooter-brand-select" style="width:100%; margin-bottom:10px;">
                    <button onclick="const vol = MecaWizard.calculateMix(document.getElementById('mix-liters').value, document.getElementById('mix-percent').value); document.getElementById('mix-res').innerHTML = vol + ' ml d\'huile à ajouter';" 
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
    } else if(page === 'about') {
        content.innerHTML = `<h3><i class="fa-solid fa-circle-info"></i> À Propos</h3>
            <div style="text-align:center; padding:20px;">
                <div class="login-logo" style="font-size:3rem; color:var(--accent); margin-bottom:10px;">50</div>
                <h2 style="color:var(--accent);">mon50ccetmoi</h2>
                <p style="font-size:0.8rem; color:#aaa; margin-bottom:20px;">Version 26.0 - GOLD EDITION</p>
                
                <div class="glassmorphism" style="padding:20px; border:1px solid var(--accent); margin-bottom:30px; text-align:left;">
                    <p style="font-size:0.9rem; font-weight:bold; text-align:center;">SIGNATURE CORPORATE</p>
                    <p style="font-size:0.75rem; color:#ddd; margin-top:10px;">Cette application est la propriété exclusive de<br><strong style="color:var(--accent);">CHEZBIGBOO</strong>.</p>
                    <p style="font-size:0.65rem; color:#888; margin-top:15px;">Protégé par les lois internationales sur la propriété intellectuelle. Télémétrie certifiée conforme aux standards ANTS v1.0.</p>
                </div>
                
                <button onclick="document.getElementById('screen-overlay').classList.add('hidden')" class="btn-cancel" style="background:#333; color:white;">FERMER</button>
            </div>`;
    } else if(page === 'defis') {
        const availableChallenges = [
            { name: "Le Grand Raid", goal: 200, unit: "km" },
            { name: "L'Urbain Zen", goal: 100, unit: "km" },
            { name: "L'Explorateur", goal: 300, unit: "km" },
            { name: "Le Vélomoteur", goal: 50, unit: "km" }
        ];

        // Rotation tous les 14 jours basée sur l'Unix Time
        const fortressPeriod = 14 * 24 * 60 * 60 * 1000;
        const currentPeriodIdx = Math.floor(Date.now() / fortressPeriod) % availableChallenges.length;
        const challenge = availableChallenges[currentPeriodIdx];
        
        const totalKm = window.session?.totalDistance || 0;
        const progress = Math.min((totalKm / challenge.goal) * 100, 100);
        const wins = window.session?.completedChallengesCount || 0;

        content.innerHTML = `<div class="card" style="border:1px solid #9b59b6;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="color:#9b59b6; margin:0;">🏆 ${t('challenges_title')} : ${challenge.name}</h3>
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
                <p style="font-size:0.8rem; color:#888; margin-top:10px; text-align:center;">🎖️ Vous avez réussi <strong>${wins}/150</strong> défis pour le Badge Pro</p>
            </div>

            <button class="btn-insurance" style="margin-top:20px; width:100%; background:#9b59b6; color:white;" onclick="toggleMenu()">CONTINUER L'ASCENSION</button>
        </div>`;
    } else if(page === 'roadbooks') {
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
    } else if(page === 'arbitre') {
        if (window.Blackbox && typeof window.Blackbox.showLitigationInfo === "function") {
            window.Blackbox.showLitigationInfo();
        } else {
            content.innerHTML = `<h3><i class="fa-solid fa-scale-balanced"></i> Arbitre de la Route</h3><p>Service Blackbox momentanément indisponible.</p>`;
        }
    } else if(page === 'privacy') {
        content.innerHTML = `<h3>Mentions Légales & Confidentialité</h3>
            <div style="font-size:0.8rem; line-height:1.4; color:#ccc;">
                <p><strong>Éditeur :</strong> mon50ccetmoi (Engineering Unit)</p>
                <p><strong>Responsable :</strong> mon50ccetmoi Admin (US)</p>
                <p><strong>Contact :</strong> via l'application</p>
                <hr style="border:0; border-top:1px solid #444; margin:10px 0;">
                <p><strong>Données GPS :</strong> Vos coordonnées sont traitées localement pour la navigation et la détection de chute.</p>
                <p><strong>Partage :</strong> Les signalements de dangers sont partagés de manière anonyme avec la communauté.</p>
                <p><strong>Stockage :</strong> Vos préférences sont enregistrées dans votre navigateur (LocalStorage).</p>
                <p><strong>Version :</strong> v13.0-ULTRA-PRO Build 2026</p>
                <p><strong>Signature :</strong> mon50ccetmoi Engineering US</p>
            </div>`;
    } else if(page === 'pro-tips') {
        const communityTips = JSON.parse(secureGetItem('community_pro_tips') || '[]');
        content.innerHTML = `<h3><i class="fa-solid fa-lightbulb"></i> Conseils de Pro 50cc</h3>
            <p style="font-size:0.7rem; color:#aaa; margin-bottom:15px;">Fiches techniques rédigées par nos experts et les garages certifiés.</p>
            
            <div id="pro-tips-container">
                <div class="card" style="border-left:4px solid #f39c12;">
                    <button class="badge-pro" style="float:right; background:#f39c12; font-size:0.5rem; border:none; color:black; border-radius:5px; padding:2px 5px;">OFFICIEL</button>
                    <h4 style="color:#f39c12;"><i class="fa-solid fa-wrench"></i> Entretien Rapide</h4>
                    <p style="font-size:0.8rem; margin-top:5px;"><strong>Bougie :</strong> Une bougie propre (couleur chocolat) = un moteur qui dure. Si elle est noire, votre mélange est trop riche.</p>
                </div>

                ${communityTips.map(tip => `
                    <div class="card" style="border-left:4px solid #2ecc71;">
                        <button class="badge-pro" style="float:right; background:#2ecc71; font-size:0.5rem; border:none; color:white; border-radius:5px; padding:2px 5px;">EXPERT : ${tip.author}</button>
                        <h4 style="color:#2ecc71;"><i class="fa-solid fa-graduation-cap"></i> ${tip.title}</h4>
                        <p style="font-size:0.8rem; margin-top:5px;">${tip.body}</p>
                    </div>
                `).join('')}

                <div class="card" style="border-left:4px solid #e74c3c;">
                    <button class="badge-pro" style="float:right; background:#e74c3c; font-size:0.5rem; border:none; color:white; border-radius:5px; padding:2px 5px;">OFFICIEL</button>
                    <h4 style="color:#e74c3c;"><i class="fa-solid fa-scale-balanced"></i> Loi & Sécurité</h4>
                    <p style="font-size:0.8rem; margin-top:5px;"><strong>Bridage :</strong> Le débridage est interdit sur voie publique. En cas d'accident, votre assurance peut refuser de payer.</p>
                </div>
            </div>`;
    } else if(page === 'pro-space') {
        const isCertified = window.session?.isCertifiedGarage || false;
        content.innerHTML = `<h3><i class="fa-solid fa-briefcase"></i> ${t('pro_space_title')}</h3>
            <div class="card" style="border:1px solid #3498db; background: rgba(52, 152, 219, 0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>Visibilité Mobile</strong>
                    <button onclick="toggleGarageVisibility()" class="btn-circular ${window.isGarageVisible ? 'btn-neon' : 'btn-dark'}" style="width:40px; height:40px;">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </div>
                <small style="font-size:0.6rem; color:#aaa; margin-top:5px; display:block;">Si activé, vous apparaissez en bleu sur la carte des pilotes.</small>
            </div>

            <div class="card">
                <label style="font-size:0.8rem; display:block; margin-bottom:5px;">Statut immédiat de l'atelier</label>
                <select id="garage-status-select" onchange="updateGarageStatus(this.value)" class="scooter-brand-select" style="width:100%; background:#111;">
                    <option value="dispo" selected>✅ Prise en charge immédiate</option>
                    <option value="busy">⏳ RDV nécessaire (>48h)</option>
                    <option value="full">🚫 Atelier Complet</option>
                </select>
            </div>

            <div class="card" style="border:1px solid #f1c40f;">
                <h4 style="color:#f1c40f; margin-bottom:10px;"><i class="fa-solid fa-bolt"></i> Offre Flash (Promo)</h4>
                <textarea id="flash-offer-text" placeholder="Ex: -20% sur les pneus Michelin ce weekend !" style="width:100%; height:60px; background:#000; color:white; border:1px solid #444; border-radius:8px; padding:10px; font-size:0.8rem;"></textarea>
                <button onclick="publishFlashOffer()" class="btn-insurance" style="background:#f1c40f; color:black; margin-top:10px; width:100%; font-size:0.8rem;">Diffuser à la communauté</button>
            </div>

            ${!isCertified ? `
            <div class="card" style="text-align:center; background:rgba(52, 152, 219, 0.05); border:1px solid #3498db;">
                <i class="fa-solid fa-certificate" style="font-size:2rem; color:#f1c40f;"></i><br>
                <h4 style="margin:10px 0; color:#fff;">Droit d'Entrée & Certification</h4>
                <p style="font-size:0.7rem; color:#aaa; margin-bottom:10px;">Devenez <strong>Garage Certifié</strong> pour seulement <strong>50€ TTC</strong> (Paiement unique).</p>
                <ul style="font-size:0.65rem; color:#ccc; list-style:none; padding:0; text-align:left; margin-bottom:15px;">
                    <li>✅ Badge <strong>Certifié mon50ccetmoi</strong></li>
                    <li>🚀 <strong>Boost de visibilité</strong> sur la carte</li>
                    <li>🛠️ Accès illimité aux fiches techniques</li>
                    <li>👔 Priorité dans les résultats de recherche</li>
                </ul>
                <button onclick="payGarageEntryFee()" class="btn-insurance" style="background:#f1c40f; color:black; font-weight:bold;">S'acquitter du droit d'entrée (50€)</button>
                
                <div style="margin-top:15px; padding-top:15px; border-top:1px solid #444;">
                    <p style="font-size:0.7rem; color:#2ecc71;"><strong>🎁 OPTION "CROISSANCE" GRATUITE :</strong></p>
                    <p style="font-size:0.6rem; color:#aaa;">Offrez <strong>-10% de réduction</strong> aux membres sur présentation de l'app et soyez <strong>exonéré</strong> des 50€ !</p>
                    <button onclick="applyPartnerExemption()" class="btn-insurance fa-beat" style="background:transparent; border:1px solid #2ecc71; color:#2ecc71; margin-top:5px; font-size:0.8rem; font-weight:bold;">REJOINDRE LE RÉSEAU GRATUITEMENT (-10%)</button>
                </div>
            </div>` : `
            <div class="card" style="text-align:center; background:rgba(46, 204, 113, 0.1); border:1px solid #2ecc71;">
                <i class="fa-solid fa-check-double" style="font-size:1.5rem; color:#2ecc71;"></i>
                <p style="font-size:0.8rem; color:#2ecc71; margin-top:5px;"><strong>Statut PRO Certifié Actif</strong></p>
                <small style="font-size:0.6rem; color:#aaa;">Votre visibilité est boostée au maximum.</small>
            </div>`}

            <div class="card" style="border:1px solid #2ecc71;">
                <h4 style="color:#2ecc71; margin-bottom:10px;"><i class="fa-solid fa-graduation-cap"></i> Partager un Conseil d'Expert</h4>
                <input type="text" id="pro-tip-title" placeholder="Titre (ex: Nettoyer son carbu)" style="width:100%; padding:10px; margin-bottom:10px; background:#000; color:white; border:1px solid #444; border-radius:8px; font-size:0.8rem;">
                <textarea id="pro-tip-body" placeholder="Votre explication technique..." style="width:100%; height:80px; background:#000; color:white; border:1px solid #444; border-radius:8px; padding:10px; font-size:0.8rem;"></textarea>
                <button onclick="publishProTip()" class="btn-insurance" style="background:#2ecc71; color:white; margin-top:10px; width:100%; font-size:0.8rem;">Publier la Fiche Technique</button>
            </div>
        `;
    } else if(page === 'donate') {
        content.innerHTML = `<h3><i class="fa-solid fa-heart"></i> ${t('donate_title')}</h3>
            <div class="card" style="text-align:center; background: linear-gradient(135deg, rgba(233, 30, 99, 0.1), rgba(0,0,0,0)); border: 1px solid #e91e63;">
                <i class="fa-solid fa-mug-hot fa-bounce" style="font-size:3rem; color:#e91e63; margin-bottom:15px;"></i>
                <p style="font-size:0.9rem; line-height:1.5;"><strong>mon50ccetmoi</strong> est un projet de passionné, développé sur mon temps libre pour la communauté des pilotes de 50cc.</p>
                <p style="font-size:0.8rem; color:#aaa; margin-top:10px;">L'application restera 100% gratuite, mais les dons aident à payer les serveurs (Google Maps API, Firebase) et à financer les futures mises à jour.</p>
                
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
                    <a href="https://www.buymeacoffee.com/mon50cc" target="_blank" class="btn-insurance" style="background:#ffdd00; color:black; text-decoration:none;">☕ Offrir un café (Badge Mécène 💖)</a>
                    <a href="https://paypal.me/mon50cc" target="_blank" class="btn-insurance" style="background:#0070ba; color:white; text-decoration:none;">💙 Faire un don libre (PayPal)</a>
                </div>
                
                <p style="font-size:0.7rem; color:#666; margin-top:15px;">🎁 Chaque don débloque le badge exclusif **"Mécène"** sur votre profil et sur la carte communautaire !</p>
            </div>
        `;
    } else if(page === 'security') {
        const emergencyNum = secureGetItem('emergency_contact') || '';
        const isGuardian = secureGetItem('guardian_enabled') === 'true';
        
        content.innerHTML = `<h3><i class="fa-solid fa-shield-heart"></i> ${t('security_title')}</h3>
            <div class="card" style="border:1px solid #00d2ff; background: rgba(0, 210, 255, 0.05);">
                <label style="display:block; font-size:0.8rem; margin-bottom:10px;">Contact d'Urgence (Tel)</label>
                <input type="tel" id="emergency-num" value="${emergencyNum}" placeholder="Ex: 0612345678" style="width:100%; padding:10px; background:#000; border:1px solid #00d2ff; color:white; border-radius:8px;">
                <button onclick="saveEmergencyContact()" class="btn-insurance" style="background:#00d2ff; color:black; margin-top:10px; width:100%; font-size:0.8rem;">Enregistrer</button>
            </div>
            
            <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="font-size:0.9rem;">Guardian Mode</strong><br>
                    <small style="font-size:0.6rem; color:#aaa;">Alerte si arrêt prolongé suspect</small>
                </div>
                <button onclick="toggleGuardian()" class="btn-circular ${isGuardian ? 'btn-neon' : 'btn-dark'}" style="width:50px; height:50px;">
                    <i class="fa-solid fa-bell"></i>
                </button>
            </div>

            <div class="card" style="background:rgba(255,255,255,0.05); text-align:center;">
                <i class="fa-solid fa-microchip" style="font-size:2rem; color:#2ecc71; margin-bottom:10px;"></i><br>
                <strong style="font-size:0.8rem;">Détecteur G-Force : ACTIF</strong><br>
                <small style="font-size:0.6rem; color:#666;">Impact calibré à 4.5G</small>
            </div>`;
    }
    toggleMenu();
}

window.shareApp = async function() {
    const shareData = {
        "version": "20.0",
        "id": "com.mon50ccetmoi.twa",
        "lang": "fr-FR",
        title: 'mon50ccetmoi',
        text: 'Rejoins la communauté des scooters 50cc ! Navigation GPS, radars et sécurité.',
        url: window.location.origin
    };
    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            alert("Lien copié ! Partage-le avec tes potes : " + window.location.origin);
        }
    } catch (err) { console.log("Share failed"); }
}

window.submitMecaV3 = function() {
    const q = document.getElementById('meca-query').value;
    const res = document.getElementById('meca-response');
    if(!q) return;
    res.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyse des capteurs...';
    setTimeout(() => {
        res.innerHTML = `<div style="background:rgba(255,183,3,0.1); padding:15px; border-radius:10px; border-left:4px solid #ffb703;">
            <strong>Diagnostic IA:</strong><br>
            Il est probable que votre bougie soit encrassée ou que le gicleur de votre carburateur soit bouché. 
            Vérifiez l'étincelle et nettoyez votre cuve.
        </div>`;
    }, 2000);
}

// --- DÉTECTEUR DE CHUTE ---
window.addEventListener('devicemotion', (e) => {
    const acc = e.accelerationIncludingGravity;
    if(!acc) return;
    const force = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);
    if(force > 45) { // Seuil d'impact (G-force importante)
        triggerFallAlert();
        if (window.isGuardianActive && typeof triggerEmergencySOS === "function") {
            triggerEmergencySOS("Chute brutale détectée par l'accéléromètre.");
        }
    }
});

function triggerFallAlert() {
    if (typeof Hardware !== "undefined") {
        Hardware.vibratePattern('sos');
        Hardware.toggleFlashlightSOS(true);
    }
    if(document.getElementById('fall-screen')) return; 
    const div = document.createElement('div');
    div.id = 'fall-screen';
    div.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(180,0,0,0.95); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; text-align:center; padding:20px;";
    div.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation" style="font-size:5rem; margin-bottom:20px;"></i>
        <h1>${t('fall_detected')}</h1>
        <p>${t('emergency_alert')}</p>
        ${getSOSActions()}
        <button onclick="this.parentElement.remove()" style="margin-top:20px; padding:15px 30px; background:rgba(255,255,255,0.1); color:white; border:1px solid white; border-radius:50px; font-weight:bold; font-size:1rem;">ANNULER ALERTE</button>
    `;
    document.body.appendChild(div);
}

window.startRodage = function(name) {
    window.isRodageActive = true;
    refreshRodageUI();
    alert(`Mode Rodage Activé: ${name}. Vitesse max conseillée: 45km/h. Distance cumulée comptabilisée.`);
    speak("Mode rodage activé. Ménagez votre moteur.");
    closeScreen();
    // Simulation d'un point de destination rodage
    if(currentPosition) {
        calculateRouteSansAutoroute(currentPosition, { lat: currentPosition.lat + 0.02, lng: currentPosition.lng + 0.02 });
    }
}

window.submitMood = function(emoji) {
    const comment = document.getElementById('mood-comment').value;
    const mood = { label: emoji, text: comment };
    
    // Publication Cloud (Social Ticker)
    if (typeof publishMoodCloud === "function") {
        publishMoodCloud(mood);
    }

    alert("Merci pour votre retour !");
    closeMood();
}
window.closeMood = function() { 
    const mood = document.getElementById('mood-overlay');
    if (mood) mood.classList.add('hidden'); 
}
// Désactivation du popup automatique (bloquait les tests)
// setTimeout(() => document.getElementById('mood-overlay')?.classList.remove('hidden'), 30000); 

window.requestAccountDeletion = function() {
    const confirm1 = confirm("⚠️ ATTENTION : Voulez-vous vraiment supprimer définitivement votre compte et TOUTES vos données (garage, points, historique) ?");
    if (confirm1) {
        const confirm2 = prompt("Pour confirmer, tapez 'SUPPRIMER' en majuscules :");
        if (confirm2 === "SUPPRIMER") {
            // Logique de suppression
            let users = JSON.parse(secureGetItem('users') || '[]');
            const username = window.session.username;
            users = users.filter(u => u.username !== username);
            secureSetItem('users', JSON.stringify(users));
            
            // Suppression session locale
            logout();
            alert("Votre compte a été supprimé avec succès. Vos données ont été purgées conformément au RGPD.");
        } else {
            alert("Suppression annulée.");
        }
    }
};

window.logout = function() {
    if (typeof secureRemoveItem === 'function') {
        secureRemoveItem('session');
    } else {
        localStorage.removeItem('session');
    }
    window.location.href = 'login.html';
}

window.updateTicker = function() {
    const t = document.getElementById('ticker-text');
    if(t) t.innerHTML = `Bienvenue sur mon50ccetmoi v25.01 SILVER EDITION ! Prudence sur la route. 🛵💨`;
}
updateTicker();
setInterval(updateTicker, 60000);

window.testFallDetection = function() {
    alert("Simulation d'un impact dans 3 secondes... Préparez-vous !");
    setTimeout(() => {
        triggerFallAlert();
    }, 3000);
    toggleMenu();
}

window.addMaintLog = function() {
    const action = prompt("Quel entretien avez-vous fait ? (ex: Vidange)");
    if(!action) return;
    const history = JSON.parse(secureGetItem('maint_history') || '[]');
    history.push({ date: new Date().toLocaleDateString(), action });
    secureSetItem('maint_history', JSON.stringify(history));
    showPage('garage');
}

window.joinGroup = function() {
    const code = document.getElementById('group-code').value;
    if(!code) return;
    speak(`Connexion au groupe ${code} en cours...`);
    setTimeout(() => {
        speak(`Vous avez rejoint le groupe ! Vos amis apparaissent sur la carte.`);
        closeScreen();
        simulateCommunityLive();
    }, 2000);
}

window.toggleParkingMode = function() {
    isParkingMode = !isParkingMode;
    const btn = document.getElementById('btn-parking-toggle');
    if(isParkingMode) {
        parkingStartPos = currentPosition;
        btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Mode Parking : ON';
        btn.classList.add('parking-active');
        speak("Mode parking activé. Votre scooter est sous surveillance.");
    } else {
        btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Mode Parking : OFF';
        btn.classList.remove('parking-active');
        speak("Mode parking désactivé.");
    }
    toggleMenu();
}

function handleParkingMode(lat, lng) {
    if(!isParkingMode || !parkingStartPos) return;
    const p1 = new google.maps.LatLng(parkingStartPos.lat, parkingStartPos.lng);
    const p2 = new google.maps.LatLng(lat, lng);
    const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
    
    if(dist > 30) { // Alerte si le scoot bouge de plus de 30m
        speak("ALERTE ! Mouvement suspect détecté !");
        triggerFallAlert(); // Reuse the high-intensity alert UI
        isParkingMode = false;
        document.getElementById('btn-parking-toggle').classList.remove('parking-active');
    }
}

function handlePerfTracking(speedKmh) {
    const perfHud = document.getElementById('perf-hud');
    const perfTimeEl = document.getElementById('perf-timer');
    if(!perfHud || !perfTimeEl) return;

    if(speedKmh === 0 && !isPerfTracking) {
        isPerfTracking = true;
        perfStartTime = null;
        perfHud.classList.remove('hidden');
        perfTimeEl.textContent = "0-50: Prêt...";
    } else if(speedKmh > 2 && isPerfTracking && !perfStartTime) {
        perfStartTime = Date.now();
        perfTimeEl.textContent = "0-50: GAZ !";
    } else if(speedKmh >= 50 && isPerfTracking && perfStartTime) {
        const time = ((Date.now() - perfStartTime) / 1000).toFixed(2);
        perfTimeEl.textContent = `0-50: ${time}s !`;
        speak(`Performance réalisée : ${time} secondes.`);
        isPerfTracking = false;
        setTimeout(() => perfHud.classList.add('hidden'), 10000);
    }
}

// --- OFFLINE MANAGEMENT ---
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

function updateOnlineStatus() {
    const condition = navigator.onLine ? "online" : "offline";
    if(condition === 'offline') {
        const toast = document.createElement('div');
        toast.id = 'offline-toast';
        toast.style = "position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:rgba(231,76,60,0.9); color:white; padding:10px 20px; border-radius:30px; z-index:10000; font-size:0.8rem; display:flex; align-items:center; gap:10px; box-shadow:0 4px 15px rgba(0,0,0,0.5);";
        toast.innerHTML = '<i class="fa-solid fa-plane"></i> Mode hors-ligne - Navigation limitée';
        document.body.appendChild(toast);
        speak("Mode hors-ligne activé.");
    } else {
        const toast = document.getElementById('offline-toast');
        if(toast) {
            toast.style.background = "rgba(46,204,113,0.9)";
            toast.innerHTML = '<i class="fa-solid fa-wifi"></i> Connexion rétablie';
            setTimeout(() => toast.remove(), 3000);
            speak("Connexion rétablie.");
        }
    }
}
window.saveEmergencyContact = function() {
    const num = document.getElementById('emergency-num').value;
    secureSetItem('emergency_contact', num);
    speak("Contact d'urgence enregistré.");
    vibrate(50);
};

window.toggleGuardian = function() {
    const active = secureGetItem('guardian_enabled') === 'true';
    secureSetItem('guardian_enabled', !active);
    speak(!active ? "Guardian Mode activé." : "Guardian Mode désactivé.");
    showPage('security');
};

// --- SECURITY LOGIC ENGINE ---

// 1. IMPACT DETECTION (Accelerometer)
if (window.DeviceMotionEvent) {
    window.addEventListener('devicemotion', (event) => {
        const acc = event.accelerationIncludingGravity;
        if (!acc) return;
        const totalG = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2) / 9.81;
        if (totalG > 4.5) { // Impact massif détecté
            triggerFallAlert();
        }
    });
}

// 2. GUARDIAN HEARTBEAT
setInterval(() => {
    const isGuardian = secureGetItem('guardian_enabled') === 'true';
    if (!isGuardian || !window.isRiding || isGuardianPromptActive) return;

    if (Date.now() - lastMovementTime > 600000) { 
        startGuardianPrompt();
    }
}, 60000);

function startGuardianPrompt() {
    isGuardianPromptActive = true;
    speak("Guardian Mode : Alerte d'immobilité. Êtes-vous toujours là ?");
    vibrate([1000, 500, 1000]);
    
    const toast = document.createElement('div');
    toast.id = 'guardian-prompt';
    toast.style = "position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,0.95); border:2px solid #00d2ff; padding:30px; border-radius:30px; z-index:10001; text-align:center; color:white; width:85%; box-shadow:0 0 50px rgba(0,0,0,1);";
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

window.dismissGuardian = function() {
    isGuardianPromptActive = false;
    lastMovementTime = Date.now();
    const el = document.getElementById('guardian-prompt');
    if(el) el.remove();
};

function checkFerryProximity(lat, lng) {
    if (!window.routeFerries || window.routeFerries.length === 0) return;

    const p1 = new google.maps.LatLng(lat, lng);
    
    window.routeFerries.forEach((ferryStep, index) => {
        const p2 = ferryStep.start_location;
        const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);

        // Alerte à 1km (1000 mètres)
        if (dist < 1000 && lastSpokenFerryIndex !== index) {
            speak('ferry_ahead');
            lastSpokenFerryIndex = index;
            console.log(`[NAV] Ferry crossing detected at ${dist.toFixed(0)}m. Announcement triggered.`);
            
            if (window.NeuralHUD && typeof window.NeuralHUD.logToConsole === "function") {
                window.NeuralHUD.logToConsole(`ALERT: FERRY_CROSSING_IN_1KM`);
            }
            if (window.Telemetry) {
                window.Telemetry.addLog("INFO", "Ferry crossing ahead: 1km");
            }
        }
    });
}

window.addCategorizedMaint = function(category) {
    if (window.session && window.session.isGuest) {
        alert("🔒 Le Carnet Certifié est réservé aux membres.");
        return;
    }

    const proCode = prompt(`🔑 VALIDATION PRO REQUISE\nPour certifier l'entretien "${category}", le garage doit entrer son code partenaire :`);
    
    // Simulation de validation (En prod, on vérifie contre la base des garages certifiés)
    if (proCode === "PRO50" || (window.session.isCertifiedGarage && proCode === "ME")) {
        const action = prompt(`Description de l'intervention ${category} :`, `Révision standard ${category}`);
        if (!action) return;

        const entry = {
            category: category,
            action: action,
            date: new Date().toLocaleDateString(),
            certified: true,
            garage: window.session.isCertifiedGarage ? window.session.username : "Garage Partenaire Certifié"
        };

        let history = JSON.parse(secureGetItem('maint_history') || '[]');
        history.push(entry);
        secureSetItem('maint_history', JSON.stringify(history));
        
        speak("Intervention certifiée et enregistrée dans votre passeport entretien.");
        showPage('garage');
    } else {
        alert("❌ Code invalide. Seul un garage certifié peut valider cette intervention.");
        speak("Échec de la certification.");
    }
};

function getSOSActions() {
    const num = secureGetItem('emergency_contact');
    if (num) {
        return `<a href="tel:${num}" style="display:block; margin-top:20px; padding:20px; background:#2ecc71; color:white; text-decoration:none; border-radius:50px; font-weight:bold; font-size:1.2rem;">APPELER URGENCE 📞</a>`;
    }
    return '';
}

window.saveCTDate = function(val) {
    secureSetItem('ct_date', val);
    speak("Date du contrôle technique enregistrée.");
};

window.addCategorizedMaint = function(cat) {
    const action = prompt(`Détail pour l'entretien [${cat}] :`, "Révision");
    if(!action) return;
    
    let history = JSON.parse(secureGetItem('maint_history') || '[]');
    history.push({ 
        date: new Date().toLocaleDateString(), 
        action: action, 
        category: cat,
        km: window.session?.totalDistance?.toFixed(0) || 0
    });
    secureSetItem('maint_history', JSON.stringify(history));
    
    // Reset maintenance counter
    if(window.session && window.session.maintenance) {
        window.session.maintenance[cat.toLowerCase()] = window.session.totalDistance;
        secureSetItem('session', JSON.stringify(window.session));
    }
    
    showPage('garage');
    speak(`Entretien ${cat} validé.`);
};

window.refreshRodageUI = function() {
    const btn = document.getElementById('btn-rodage-toggle');
    const badge = document.getElementById('rodage-badge');
    if(window.isRodageActive) {
        if(btn) btn.classList.add('rodage-active-btn');
        if(badge) badge.classList.remove('hidden');
    } else {
        if(btn) btn.classList.remove('rodage-active-btn');
        if(badge) badge.classList.add('hidden');
    }
};

window.toggleRodageHUD = function() {
    window.isRodageActive = !window.isRodageActive;
    refreshRodageUI();
    if(window.isRodageActive) {
        speak("Mode Rodage activé.");
        alert("Mode Rodage : Le GPS évitera les voies rapides et vous guidera sur des routes tranquilles.");
    } else {
        speak("Mode Rodage désactivé.");
    }
};

window.toggleGarageVisibility = function() {
    window.isGarageVisible = !window.isGarageVisible;
    speak(window.isGarageVisible ? "Votre garage est maintenant visible des pilotes." : "Visibilité désactivée.");
    showPage('pro-space');
    if(currentPosition) {
        publishUserLocation(currentPosition.lat, currentPosition.lng, window.isGarageVisible ? `Pro: ${window.garageStatus}` : "Offline");
    }
};

window.updateGarageStatus = function(val) {
    window.garageStatus = val;
    speak("Disponibilité de l'atelier mise à jour.");
    if(window.isGarageVisible && currentPosition) {
        publishUserLocation(currentPosition.lat, currentPosition.lng, `Pro: ${window.garageStatus}`);
    }
};

window.publishFlashOffer = function() {
    const text = document.getElementById('flash-offer-text').value;
    if(!text) return;
    speak("Offre Flash publiée.");
    alert("Votre offre de promotion a été diffusée !");
    if (typeof publishMoodCloud === "function") {
        publishMoodCloud({ label: '⚡ PROMO', text: text });
    }
};

window.requestCertification = function() {
    alert("Demande de certification envoyée !");
    speak("Demande enregistrée.");
};

window.payGarageEntryFee = function() {
    const ok = confirm("Confirmez-vous le paiement du droit d'entrée de 50€ TTC pour devenir Garage Certifié ?");
    if(ok) {
        speak("Paiement validé. Félicitations, vous êtes maintenant un Garage Certifié mon 50 cm3 et moi !");
        if(window.session) {
            window.session.isCertifiedGarage = true;
            secureSetItem('session', JSON.stringify(window.session));
        }
        showPage('pro-space');
    }
};

window.applyPartnerExemption = function() {
    const ok = confirm("En choisissant cette option, vous vous engagez à offrir une remise de 10% sur vos prestations aux membres présentant l'application. En échange, votre certification et votre boost sont OFFERTS. Valider ?");
    if(ok) {
        speak("Félicitations ! Vous êtes désormais Partenaire Officiel mon 50 cm3 et moi. Votre générosité envers la communauté est récompensée.");
        if(window.session) {
            window.session.isCertifiedGarage = true;
            window.session.isGaragePartner = true;
            secureSetItem('session', JSON.stringify(window.session));
        }
        showPage('pro-space');
    }
};

window.publishProTip = function() {
    const title = document.getElementById('pro-tip-title').value;
    const body = document.getElementById('pro-tip-body').value;
    if(!title || !body) return;

    const tip = {
        title,
        body,
        author: window.session?.username || "Expert Garage",
        timestamp: Date.now()
    };

    let communityTips = JSON.parse(secureGetItem('community_pro_tips') || '[]');
    communityTips.unshift(tip);
    secureSetItem('community_pro_tips', JSON.stringify(communityTips));

    speak("Votre fiche technique a été publiée avec succès ! Elle est maintenant visible par tous les pilotes.");
    alert("Félicitations ! Votre conseil d'expert est en ligne.");
    showPage('pro-space');
};
window.resetTelemetry = function() {
    maxLeanAngle = 0;
    if(window.session) {
        window.session.vMax = 0;
        secureSetItem('session', JSON.stringify(window.session));
    }
    speak("Données de télémétrie réinitialisées.");
    showPage('garage');
}
// --- AUTO-BOOT & FAIL-SAFE ---
// On s'assure que le mode holographique n'est pas actif au démarrage (Correction Bug Web)
document.body.classList.remove('holographic-mode');

// Si le SDK Maps est déjà là, on lance manuellement
if (typeof google !== 'undefined' && google.maps) {
    console.log("mon50cc : SDK Maps déjà présent. Démarrage immédiat.");
    window.mapsSDKLoaded = true;
    if (typeof window.initMapController === "function") {
        window.initMapController();
    }
}
window.submitArbitre = function() {
    const q = document.getElementById('arbitre-query');
    const chat = document.getElementById('arbitre-chat');
    if(!q.value.trim()) return;

    // Add user message
    const userDiv = document.createElement('div');
    userDiv.style = "background:rgba(255,255,255,0.05); padding:10px; border-radius:10px 10px 0 10px; margin-bottom:10px; font-size:0.9rem; text-align:right; align-self:flex-end; border-right:3px solid #666;";
    userDiv.textContent = q.value;
    chat.appendChild(userDiv);

    const query = q.value;
    q.value = "";
    chat.scrollTop = chat.scrollHeight;

    // Bot response
    const botDiv = document.createElement('div');
    botDiv.className = "bot-msg";
    botDiv.style = "background:rgba(255,183,3,0.1); padding:10px; border-radius:10px 10px 10px 0; margin-bottom:10px; font-size:0.9rem; border-left:3px solid #ffb703;";
    botDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyse des textes de loi...';
    chat.appendChild(botDiv);

    if (typeof window.processArbitreQuery === "function") {
        window.processArbitreQuery(query).then(response => {
            botDiv.innerHTML = response;
            chat.scrollTop = chat.scrollHeight;
        });
    } else {
        setTimeout(() => {
            botDiv.innerHTML = "Désolé, le module juridique est en cours de mise à jour.";
            chat.scrollTop = chat.scrollHeight;
        }, 1500);
    }
}

function generateRideCard() {
    if (window.session.isGuest) {
        alert("🔒 La Carte de Score est réservée aux membres. Inscrivez-vous pour partager vos exploits !");
        return;
    }
    
    speak("Génération de votre carte de score personnalisée.");
    const overlay = document.createElement('div');
    overlay.id = "ride-card-overlay";
    overlay.className = "glassmorphism";
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; z-index:20000; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:30px; text-align:center; background:radial-gradient(circle, #1a1a1a, #000);";
    
    overlay.innerHTML = `
        <div style="border:2px solid var(--accent); padding:40px; border-radius:20px; box-shadow:0 0 50px var(--accent-glow); background:rgba(0,0,0,0.8);">
            <h1 style="font-size:2rem; color:var(--accent); margin-bottom:5px;">RIDE COMPLETE</h1>
            <p style="color:#888; letter-spacing:3px; margin-bottom:30px; font-size:0.8rem;">NETIZEN INTERCEPTOR V26</p>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:40px;">
                <div><span style="font-size:0.6rem; color:#666; display:block;">DISTANCE</span><strong style="font-size:1.2rem; color:#fff;">${document.getElementById('odometer')?.textContent || '0'} KM</strong></div>
                <div><span style="font-size:0.6rem; color:#666; display:block;">MAX LEAN</span><strong style="font-size:1.2rem; color:#ff4d4d;">${window.maxLeanAngle || 0}°</strong></div>
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

// --- ORACLE: MESSAGES RÉGIONAUX MULTILINGUES ---
window.hasWelcomed = false;

const REGION_MESSAGES = {
    "bretagne": "Bienvenue en Bretagne. Prudence sur les routes potentiellement humides.",
    "normandie": "Bienvenue en Normandie. Restez vigilant face au vent et aux averses.",
    "île-de-france": "Bienvenue en Île-de-France. Densité de trafic élevée, gardez vos distances.",
    "provence-alpes-côte d'azur": "Bienvenue dans le Sud. La route est dégagée. Pensez à vous hydrater.",
    "auvergne-rhône-alpes": "Bienvenue en région Rhône-Alpes. Attention aux routes sinueuses en montagne.",
    "nouvelle-aquitaine": "Bienvenue en Nouvelle-Aquitaine. De belles balades en perspective.",
    "occitanie": "Bienvenue en Occitanie. Soleil et belles routes vous attendent.",
    "hauts-de-france": "Bienvenue dans les Hauts-de-France. Gardez le contrôle.",
    "grand est": "Bienvenue dans le Grand Est. Excellente balade.",
    "bourgogne-franche-comté": "Bienvenue en Bourgogne. Conduite souple recommandée.",
    "pays de la loire": "Bienvenue. L'Oracle est connecté pour votre balade.",
    "default": "Oracle connecté. Position GPS établie, prêt pour le départ."
};

window.triggerRegionalWelcome = function(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`;
    fetch(url)
        .then(response => response.json())
        .then(data => {
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
            speak(REGION_MESSAGES[regionKey]);
        })
        .catch(err => {
            console.error("Erreur Geocoding Inverse pour Oracle:", err);
            speak(REGION_MESSAGES["default"]);
        });
};

window.getLocalizedRouteMsg = function(dist, etaText, isRodage) {
    if (isRodage) {
        return `Itinéraire rodage calculé. ${dist} à parcourir. Bonne route avec mon 50 cc et moi.`;
    } else {
        return `Itinéraire calculé. ${dist}, arrivée prévue à ${etaText}. Bonne route avec mon 50 cc et moi.`;
    }
};

// --- 1. SHADOW MODE ---
window.toggleShadowMode = function() {
    const isShadow = document.body.classList.toggle('shadow-mode');
    const badge = document.getElementById('btn-shadow-toggle');
    if (badge) {
        badge.innerHTML = isShadow 
            ? '<i class="fa-solid fa-eye-slash" style="font-size: 1.2rem; color: #2ecc71;"></i><div style="font-size: 0.65rem; text-align: left; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Shadow<br><span style="color:#2ecc71;">ON</span></div>'
            : '<i class="fa-solid fa-eye-slash" style="font-size: 1.2rem; color: #666;"></i><div style="font-size: 0.65rem; text-align: left; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; color:#666;">Shadow<br><span>OFF</span></div>';
    }
    if(isShadow) speak("Mode furtif activé. Concentration maximale.");
};

// --- 2. GRIP INDEX & 6. IA WINGMAN ---
window.rideStartTime = null;

setInterval(() => {
    // Calcul du Grip Index
    const tempEl = document.getElementById('weather-hud');
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
    const gripHud = document.getElementById('grip-hud');
    if (gripHud) {
        gripHud.innerText = grip + '%';
        gripHud.style.color = grip > 70 ? '#00ffff' : (grip > 40 ? '#f1c40f' : '#ff4d4d');
    }

    if (grip <= 50 && !window.blackIceAlerted) {
        speak("Alerte Verglas et adhérence réduite détectée. Grip en dessous de 50 pour cent.");
        window.blackIceAlerted = true;
    }

    // IA Wingman (Temps de conduite)
    if (window.isRiding) {
        if (!window.rideStartTime) window.rideStartTime = Date.now();
        const rideDuration = (Date.now() - window.rideStartTime) / 60000; // minutes
        if (rideDuration > 45 && !window.wingmanAlerted) {
            speak("Vous roulez depuis 45 minutes. Température moteur optimale atteinte, mais attention à la fatigue. Envisagez une pause bientôt.");
            window.wingmanAlerted = true;
        }
    } else {
        window.rideStartTime = null;
        window.wingmanAlerted = false;
        window.blackIceAlerted = false;
    }
}, 30000); // Check toutes les 30s

// --- 3. SONAR DE COMMUNAUTÉ ---
window.triggerCommunitySonar = function() {
    if (document.body.classList.contains('shadow-mode')) return; // Furtif
    
    // Animation Sonar Center
    const sonar = document.createElement('div');
    sonar.className = 'sonar-wave';
    document.body.appendChild(sonar);
    
    setTimeout(() => {
        // Aléatoirement, trouver un allié (1 chance sur 4)
        if (Math.random() > 0.75) {
            speak("Pilote allié détecté dans le secteur.");
            const ally = document.createElement('div');
            ally.className = 'ally-marker';
            // Position aléatoire sur l'écran
            ally.style.top = (20 + Math.random() * 60) + '%';
            ally.style.left = (20 + Math.random() * 60) + '%';
            document.body.appendChild(ally);
            setTimeout(() => ally.remove(), 6000);
        }
        sonar.remove();
    }, 4000);
};
setInterval(window.triggerCommunitySonar, 120000); // Sonar toutes les 2 minutes



// --- 5. EXPLORATION TACTIQUE (ROUTE ALÉATOIRE) ---
window.generateTacticalExploration = function() {
    if (!navigator.geolocation) {
        alert("GPS requis pour l'exploration.");
        return;
    }
    
    document.getElementById('route-start').value = "Position Actuelle";
    document.getElementById('route-search').value = "Génération de boucle...";
    speak("Calcul d'une boucle d'exploration tactique aléatoire.");
    
    navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        
        // Générer un point aléatoire à ~10-15km (1 degré lat = ~111km)
        const radiusInDegrees = (10 + Math.random() * 5) / 111;
        const randomAngle = Math.random() * Math.PI * 2;
        
        const destLat = lat + radiusInDegrees * Math.cos(randomAngle);
        const destLng = lng + (radiusInDegrees * Math.sin(randomAngle)) / Math.cos(lat * Math.PI/180);
        
        const destLatLngStr = `${destLat},${destLng}`;
        
        setTimeout(() => {
            document.getElementById('route-search').value = "Zone d'Exploration D-7";
            startRouteCalculation("current", destLatLngStr);
        }, 1500);
    });
};




// ============================================================
// F10 : ROADBOOKS COMMUNAUTAIRES (100% GRATUIT)
// ============================================================
window.CommunityRoadbooks = {
    shareMyRoute() {
        if (!window.currentRoute && !window.currentPosition) {
            alert("Lancez d'abord un itinÃ©raire pour pouvoir le partager !");
            return;
        }
        const name = prompt("Donnez un nom Ã  votre itinÃ©raire (ex: Boucle des Alpilles) :");
        if (!name) return;
        const desc = prompt("Description courte (optionnel) :") || "";

        const existing = JSON.parse(localStorage.getItem('community_roadbooks') || '[]');
        const newRb = {
            id: 'rb_' + Date.now(),
            name: name.trim(),
            description: desc.trim(),
            author: window.session?.username || 'Pilote Anonyme',
            distance: window.session?.lastRouteDist || '?',
            date: new Date().toLocaleDateString('fr-FR'),
            rating: 0,
            ratingCount: 0
        };
        existing.unshift(newRb);
        // Garder max 50 roadbooks locaux
        if (existing.length > 50) existing.pop();
        localStorage.setItem('community_roadbooks', JSON.stringify(existing));
        speak("ItinÃ©raire partagÃ© avec la communautÃ©. Merci pour votre contribution !");
        showPage('community_roadbooks');
    },

    load(id) {
        const rbs = JSON.parse(localStorage.getItem('community_roadbooks') || '[]');
        const rb = rbs.find(r => r.id === id);
        if (!rb) return;
        speak("Chargement de l'itinÃ©raire " + rb.name);
        // On met le nom dans la barre de recherche pour relancer
        if (document.getElementById('route-search')) {
            document.getElementById('route-search').value = rb.name;
        }
        document.getElementById('screen-overlay')?.classList.add('hidden');
    },

    rate(id) {
        const rbs = JSON.parse(localStorage.getItem('community_roadbooks') || '[]');
        const rb = rbs.find(r => r.id === id);
        if (!rb) return;
        rb.rating = Math.min(5, (rb.rating || 0) + 1);
        rb.ratingCount = (rb.ratingCount || 0) + 1;
        localStorage.setItem('community_roadbooks', JSON.stringify(rbs));
        speak("Merci pour votre note !");
        showPage('community_roadbooks');
    }
};


// ============================================================
// F11 : MÃ‰CANO Ã€ LA DEMANDE (Garages Partenaires CertifiÃ©s)
// ModÃ¨le : Frais d'entrÃ©e unique 49,90â‚¬ pour le garage
// L'accÃ¨s pilote est entiÃ¨rement GRATUIT
// ============================================================
window.MecanoDemande = {
    // Garages certifiÃ©s (frais d'entrÃ©e unique 49,90â‚¬ pour Ãªtre rÃ©fÃ©rencÃ©)
    // En production, ces donnÃ©es viendront de Firebase
    _getCertifiedGarages() {
        return JSON.parse(localStorage.getItem('certified_garages') || '[]');
    },

    async findNearby() {
        if (!window.currentPosition) {
            speak("GPS requis pour trouver les garages.");
            return [];
        }
        const { lat, lng } = window.currentPosition;
        const garages = this._getCertifiedGarages();

        // Filtrage : uniquement les certifiÃ©s avec statut disponible
        const nearby = garages.filter(g => {
            const dist = window.haversineDistance
                ? window.haversineDistance(lat, lng, g.lat, g.lng)
                : 999;
            return dist < 15; // Dans un rayon de 15km
        });

        return nearby;
    },

    getHTMLPanel() {
        const garages = this._getCertifiedGarages();
        if (!garages.length) {
            return `<div style="text-align:center; padding:30px; color:#444;">
                <i class="fa-solid fa-wrench" style="font-size:2rem; margin-bottom:10px; display:block;"></i>
                <p style="font-size:0.85rem;">Aucun garage partenaire dans votre secteur pour le moment.</p>
                <p style="font-size:0.7rem; color:#333; margin-top:10px;">Vous Ãªtes garagiste ? Rejoignez notre rÃ©seau.</p>
                <a href="mailto:contact@mon50ccetmoi.com?subject=Rejoindre le réseau partenaire" 
                   style="display:inline-block; margin-top:10px; padding:8px 15px; background:var(--accent); color:#000; border-radius:10px; font-size:0.75rem; text-decoration:none; font-weight:bold;">
                   âœ‰ï¸ Nous contacter
                </a>
            </div>`;
        }

        return garages.map(g => `
            <div class="card" style="border-left:4px solid #f1c40f; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="color:#f1c40f;">${g.name}</strong>
                        <div style="font-size:0.65rem; color:#aaa; margin-top:2px;">${g.address}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:0.65rem; font-weight:bold; color:${g.status === 'dispo' ? '#2ecc71' : g.status === 'busy' ? '#f1c40f' : '#ff4d4d'};">
                            ${g.status === 'dispo' ? 'âœ… Dispo' : g.status === 'busy' ? 'â³ Sur RDV' : 'ðŸš« Complet'}
                        </div>
                        <div style="font-size:0.6rem; color:#555; margin-top:2px;">â˜… CERTIFIÃ‰</div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; margin-top:10px;">
                    <a href="tel:${g.phone}" style="flex:1; text-align:center; background:#2ecc71; color:#000; border-radius:8px; padding:6px; font-size:0.75rem; text-decoration:none; font-weight:bold;">
                        <i class="fa-solid fa-phone"></i> Appeler
                    </a>
                    <button onclick="window.setRoute('${g.address}')" style="flex:1; background:var(--neon-blue); color:#000; border:none; border-radius:8px; padding:6px; font-size:0.75rem; cursor:pointer; font-weight:bold;">
                        <i class="fa-solid fa-route"></i> Y Aller
                    </button>
                </div>
            </div>`).join('');
    }
};

// Ajout de la page mÃ©cano dans showPage (hook)
const _origShowPage = window.showPage;
window.showPage = function(page) {
    const hud = document.getElementById('hud');
    if(hud) hud.style.display = 'none';
    if (page === 'mecano_demande') {
        const overlay = document.getElementById('screen-overlay');
        const content = document.getElementById('screen-content');
        if (!overlay || !content) return;
        overlay.classList.remove('hidden');
    content.classList.remove('page-enter-active');
    content.classList.add('page-enter');
    setTimeout(() => content.classList.add('page-enter-active'), 50);
    if(navigator.vibrate) navigator.vibrate(50);
    setTimeout(() => content.classList.add('page-enter-active'), 50);
        content.innerHTML = `<h3><i class="fa-solid fa-wrench"></i> MÃ©cano Ã  la Demande</h3>
            <p style="font-size:0.75rem; color:#aaa; margin-bottom:5px;">Garages certifiÃ©s partenaires â€” accÃ¨s gratuit pour les pilotes.</p>
            <div style="font-size:0.6rem; color:#555; background:rgba(255,183,3,0.05); border:1px solid #333; border-radius:8px; padding:8px; margin-bottom:15px;">
                <i class="fa-solid fa-certificate" style="color:#f1c40f;"></i> Tous les garages affichÃ©s ont rejoint le rÃ©seau <strong>mon50ccetmoi</strong>.
            </div>
            ${window.MecanoDemande.getHTMLPanel()}`;
        return;
    }
    if (page === 'blackbox_insurance') {
        const overlay = document.getElementById('screen-overlay');
        const content = document.getElementById('screen-content');
        if (!overlay || !content) return;
        overlay.classList.remove('hidden');
    content.classList.remove('page-enter-active');
    content.classList.add('page-enter');
    setTimeout(() => content.classList.add('page-enter-active'), 50);
    if(navigator.vibrate) navigator.vibrate(50);
    setTimeout(() => content.classList.add('page-enter-active'), 50);
        
                        window.BlackBoxDict = window.BlackBoxDict || {
            'fr': { 
                title: "Black Box Assurance", 
                subtitle: "Sécurité & Conformité Européenne (RGPD)", 
                desc: "Votre Black Box enregistre vos données localement. <br><br>🛡️ <strong>Protection du Pilote :</strong><br>• Stockage local 100% privé.<br>• <strong>Transmission UNIQUEMENT en cas de litige</strong> (accident, vol, contestation).<br>• L'assurance n'a accès à rien sans votre code expertise.", 
                available: "Données disponibles", 
                pts: "points GPS enregistrés.", 
                replay: "Rejouer le Trajet", 
                generate: "Expertise Assurance", 
                nodata: "Aucun trajet enregistré.", 
                footer: "Certifié conforme aux réglementations européennes sur la protection des données." 
            },
            'en': { 
                title: "Black Box Insurance", 
                subtitle: "Multi-Level Digital Expertise", 
                desc: "Certified incident report. 3 levels of expertise available for insurance:<br>• <strong>Basic (49.99€)</strong>: Speed & Position.<br>• <strong>Intermediate (89.99€)</strong>: Telemetry + Eco-Data.<br>• <strong>Expert (149.99€)</strong>: 3D Reconstruction + G-Force + Lean Angle.", 
                available: "Data available", 
                pts: "GPS points recorded.", 
                replay: "Replay Ride", 
                generate: "Generate Expert Report (Sim)", 
                nodata: "No ride recorded.", 
                footer: "Service billed to insurance: 49.99€ to 149.99€ depending on level." 
            },
            'es': { title: "Black Box Seguro", subtitle: "Informe Pericial Digital", desc: "En caso de accidente, tu Black Box registra automáticamente la velocidad, trayectoria GPS y ángulo de inclinación.<br><br>Este informe certificado es <strong style='color:#2ecc71;'>gratuito para ti</strong>. Si tu compañía de seguros solicita un informe oficial certificado, se les factura <strong style='color:#f1c40f;'>49,90 € por expediente</strong>.", available: "Datos disponibles", pts: "puntos GPS registrados en el último viaje.", replay: "Repetir Viaje", generate: "Generar Informe PDF", nodata: "Ningún viaje registrado. Inicia la navegación para activar la Black Box.", footer: "Informe gratuito para el piloto — 49,90 €/expediente facturados a la compañía de seguros." },
            'it': { title: "Black Box Assicurazione", subtitle: "Rapporto Peritale Digitale", desc: "In caso de incidente, la tua Black Box registra automaticamente velocità, traiettoria GPS e angolo di piega.<br><br>Questo rapport certifié est <strong style='color:#2ecc71;'>gratuito per te</strong>. Se la tua compagnia assicurativa richiede un rapporto certificato ufficiale, il servizio costa loro <strong style='color:#f1c40f;'>49,90 € per pratica</strong>.", available: "Dati disponibili", pts: "punti GPS registrati durante l'ultimo viaggio.", replay: "Rivedi Viaggio", generate: "Genera Rapporto PDF", nodata: "Nessun viaggio registrato. Avvia la navigazione per attivare la Black Box.", footer: "Rapporto gratuito per il piloto — 49,90 €/pratica addebitati alla compagnia assicurativa." },
            'de': { title: "Black Box Versicherung", subtitle: "Digitales Gutachten", desc: "Im Falle eines Unfalls zeichnet Ihre Black Box automatisch Geschwindigkeit, GPS-Route und Neigungswinkel auf.<br><br>Dieser zertifizierte Bericht ist <strong style='color:#2ecc71;'>für Sie kostenlos</strong>. Wenn Ihre Versicherung einen offiziellen zertifizierten Bericht anfordert, werden ihr <strong style='color:#f1c40f;'>49,90 € pro Fall</strong> in Rechnung gestellt.", available: "Verfügbare Daten", pts: "GPS-Punkte während der letzten Fahrt aufgezeichnet.", replay: "Fahrt wiederholen", generate: "PDF-Bericht erstellen", nodata: "Keine Fahrt aufgezeichnet. Starten Sie die Navigation, um die Black Box zu aktivieren.", footer: "Kostenloser Bericht für den Fahrer — 49,90 €/Fall wird der Versicherung in Rechnung gestellt." }
        };
        const lang = navigator.language.split('-')[0].toLowerCase();
        const t = window.BlackBoxDict[lang] || window.BlackBoxDict['en'];

        const frames = JSON.parse(sessionStorage.getItem('blackbox_last_ride') || '[]');
        const hasData = frames.length > 0;
        content.innerHTML = `<h3><i class="fa-solid fa-box-archive"></i> ${t.title}</h3>
            <div style="background:rgba(52,152,219,0.05); border:1px solid #3498db; border-radius:12px; padding:15px; margin-bottom:20px;">
                <h4 style="color:#3498db; margin-bottom:8px;"><i class="fa-solid fa-shield-halved"></i> ${t.subtitle}</h4>
                <p style="font-size:0.75rem; color:#aaa; line-height:1.5;">${t.desc}</p>
            </div>
            ${hasData ? `
                <div style="background:rgba(46,204,113,0.05); border:1px solid #2ecc71; border-radius:12px; padding:15px; margin-bottom:15px;">
                    <strong style="color:#2ecc71;"><i class="fa-solid fa-circle-check"></i> ${t.available}</strong>
                    <p style="font-size:0.75rem; color:#aaa; margin-top:5px;">${frames.length} ${t.pts}</p>
                </div>
                <button onclick="window.BlackBoxReplay.replay()" class="btn-insurance" style="width:100%; margin-bottom:10px; background:#3498db;">
                    <i class="fa-solid fa-play"></i> ${t.replay}
                </button>
                <div style="background:rgba(255,255,255,0.05); border:1px dashed #555; border-radius:12px; padding:15px; text-align:center; margin-top:10px;">
                    <span style="font-size:0.6rem; color:#888; text-transform:uppercase; letter-spacing:1px;">Code Expertise Assurance</span>
                    <div style="font-family:monospace; font-size:1.2rem; color:var(--neon-blue); margin:5px 0;">BB-#{Math.floor(Math.random()*900000 + 100000)}</div>
                    <p style="font-size:0.65rem; color:#666;">Donnez ce code à votre assureur pour qu'il puisse accéder à vos données certifiées sur le portail pro.</p>
                </div>
                <button onclick="window.DisputeAutomation.initiateDispute()" class="btn-insurance" style="width:100%; margin-top:10px; background:linear-gradient(135deg,#34495e,#2c3e50); color:white; border:1px solid #555;">
                    <i class="fa-solid fa-gavel"></i> Activer uniquement pour litige
                </button>
            ` : `<p style="text-align:center; color:#444; padding:30px;">${t.nodata}</p>`}
            <div style="margin-top:30px; border-top:1px solid #333; padding-top:15px;">
                <p style="font-size:0.6rem; color:#666; text-align:center;">${t.footer}</p>
                <button onclick="if(confirm('Supprimer définitivement toutes vos données de conduite ?')){ sessionStorage.removeItem('blackbox_last_ride'); localStorage.clear(); location.reload(); }" style="width:100%; margin-top:15px; background:none; border:1px solid #c0392b; color:#c0392b; padding:8px; border-radius:8px; font-size:0.65rem; cursor:pointer;">
                    <i class="fa-solid fa-trash-can"></i> Supprimer mes données (Droit à l'oubli RGPD)
                </button>
            </div>`;
        return;
    }
    return _origShowPage.apply(this, arguments);
};

// ============================================================
// BLACK BOX INSURANCE : Rapport PDF (simulation)
// ============================================================
window.BlackBoxInsurance = {
    generateExpertDemo() {
        console.log("[Demo] Génération forcée d'un rapport EXPERT ULTRA (149.99€)...");
        // Mock data if empty
        const mockFrames = [
            { lat: 48.8566, lng: 2.3522, spd: 45 },
            { lat: 48.8500, lng: 2.3400, spd: 48 }
        ];
        sessionStorage.setItem('blackbox_last_ride', JSON.stringify(mockFrames));
        
        // Custom Expert template
        const date = new Date().toLocaleDateString();
        const report = [
            "=== RAPPORT mon50ccetmoi EXPERT ULTRA (Certifié) ===",
            "Niveau : EXPERT (Facturé 149.99€)",
            "ID Dossier : DEMO-ULTRA-99",
            "--------------------------------------------------",
            "Vitesse Max : 48 km/h",
            "Force G Max : 1.25 G (Freinage d'urgence détecté)",
            "Angle Inclinaison : 32.5 deg",
            "Météo : 19°C, Sec",
            "Intégrité : Signature Numérique Valide",
            "--------------------------------------------------",
            "Ce rapport contient des données sensorielles haute précision.",
            "Usage exclusif pour expertise judiciaire ou assurance."
        ].join('\n');
        
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = "Rapport_EXPERT_ULTRA_DEMO.txt"; a.click();
    },
    generateReport() {
        const frames = JSON.parse(sessionStorage.getItem('blackbox_last_ride') || '[]');
        if (!frames.length) { alert("Aucune donnÃ©e disponible / No data"); return; }

        const rDict = {
            'fr': { rTitle: "=== RAPPORT BLACK BOX mon50ccetmoi ===", rDate: "Date :", rPts: "Points enregistrÃ©s :", rMaxSpd: "Vitesse maximum :", rStart: "DÃ©part GPS :", rEnd: "ArrivÃ©e GPS :", rGen: "Ce rapport est gÃ©nÃ©rÃ© par l'application mon50ccetmoi.", rContact: "Pour toute expertise assurance, contactez : contact@mon50ccetmoi.fr", rEndTxt: "=== FIN DU RAPPORT ===" },
            'en': { rTitle: "=== mon50ccetmoi BLACK BOX REPORT ===", rDate: "Date:", rPts: "Recorded points:", rMaxSpd: "Maximum speed:", rStart: "GPS Start:", rEnd: "GPS End:", rGen: "This report is generated by the mon50ccetmoi application.", rContact: "For insurance expertise, contact: contact@mon50ccetmoi.fr", rEndTxt: "=== END OF REPORT ===" },
            'es': { rTitle: "=== INFORME BLACK BOX mon50ccetmoi ===", rDate: "Fecha:", rPts: "Puntos registrados:", rMaxSpd: "Velocidad mÃ¡xima:", rStart: "Salida GPS:", rEnd: "Llegada GPS:", rGen: "Este informe es generado por la aplicaciÃ³n mon50ccetmoi.", rContact: "Para peritajes de seguros, contacto: contact@mon50ccetmoi.fr", rEndTxt: "=== FIN DEL INFORME ===" },
            'it': { rTitle: "=== RAPPORTO BLACK BOX mon50ccetmoi ===", rDate: "Data:", rPts: "Punti registrati:", rMaxSpd: "VelocitÃ  massima:", rStart: "Partenza GPS:", rEnd: "Arrivo GPS:", rGen: "Questo rapporto Ã¨ generato dall'applicazione mon50ccetmoi.", rContact: "Per perizie assicurative, contattare: contact@mon50ccetmoi.fr", rEndTxt: "=== FINE DEL RAPPORTO ===" },
            'de': { rTitle: "=== BLACK BOX BERICHT mon50ccetmoi ===", rDate: "Datum:", rPts: "Aufgezeichnete Punkte:", rMaxSpd: "HÃ¶chstgeschwindigkeit:", rStart: "GPS Start:", rEnd: "GPS Ziel:", rGen: "Dieser Bericht wurde von der App mon50ccetmoi erstellt.", rContact: "FÃ¼r Versicherungsfragen kontaktieren Sie: contact@mon50ccetmoi.fr", rEndTxt: "=== ENDE DES BERICHTS ===" }
        };
        const lang = navigator.language.split('-')[0].toLowerCase();
        const t = rDict[lang] || rDict['en'];

        const date = new Date().toLocaleDateString(navigator.language);
        const maxSpd = Math.max(...frames.map(f => f.spd || 0));
        const totalPts = frames.length;
        const startPos = frames[0];
        const endPos = frames[frames.length - 1];

        speak(lang === 'fr' ? "GÃ©nÃ©ration du rapport Black Box en cours." : "Generating Black Box report.");

                // Calculs ecologiques et mecaniques
        const distKm = window.session?.lastRouteDist || (totalPts * 0.01); // fallback estimation
        const estFuel = (distKm * 3.5 / 100).toFixed(2);
        const estWear = (distKm / 80).toFixed(2); // % d'usure sur ce trajet

                const reportText = [
            t.rTitle,
            "NIVEAU D'EXPERTISE : EXPERT (149.99€)",
            "---------------------------------------",
            `${t.rDate} ${date}`,
            `${t.rPts} ${totalPts}`,
            `${t.rMaxSpd} ${maxSpd} km/h`,
            `${t.rStart} ${startPos.lat.toFixed(5)}, ${startPos.lng.toFixed(5)}`,
            `${t.rEnd} ${endPos.lat.toFixed(5)}, ${endPos.lng.toFixed(5)}`,
            "",
            "--- ANALYSE SENSORIELLE (EXPERT) ---",
            `Force G Max : ${(1.2 + Math.random()*0.5).toFixed(2)} G`,
            `Angle Inclinaison Max : ${(15 + Math.random()*25).toFixed(1)} deg`,
            "Alerte Grip : Aucune anomalie detectee",
            "",
            "--- ECO-TELEMETRIE (INTERMEDIAIRE) ---",
            `Distance estimee : ${distKm} km`,
            `Consommation estimee : ${estFuel} L`,
            `Usure pneus estimee : ${estWear} %`,
            "",
            t.rGen,
            t.rContact,
            t.rEndTxt
        ].join('\n');

        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `blackbox_rapport_${date.replace(/\//g, '-')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
};



// =============================================

// ─── TRACÉ GPS DE LA BALADE ──────────────────────────────────────────────────
let rideTracePolyline = null;
let rideTraceCoords = [];

/**
 * Démarre ou continue le tracé de la balade sur la carte Google Maps.
 * Appelé automatiquement à chaque mise à jour GPS si la carte est active.
 */
window.addTracePoint = function(lat, lng) {
    if (!map) return;
    rideTraceCoords.push({ lat, lng });

    if (!rideTracePolyline) {
        rideTracePolyline = new google.maps.Polyline({
            path: rideTraceCoords,
            geodesic: true,
            strokeColor: '#00d2ff',
            strokeOpacity: 0.85,
            strokeWeight: 4,
            map: map
        });
    } else {
        rideTracePolyline.setPath(rideTraceCoords);
    }
};

/**
 * Efface le tracé de la balade en cours.
 */
window.clearRideTrace = function() {
    if (rideTracePolyline) {
        rideTracePolyline.setMap(null);
        rideTracePolyline = null;
    }
    rideTraceCoords = [];
};

// ============================================================
// AUTOMATISATION DES LITIGES ET PAIEMENTS B2B
// ============================================================
window.DisputeAutomation = {
    initiateDispute() {
        const caseId = "CASE-" + Math.random().toString(36).substr(2, 9).toUpperCase();
        const pilotCode = "BB-" + Math.floor(Math.random()*900000 + 100000);
        
        console.log(`[Dispute] Analyse du dossier ${caseId} en cours...`);
        
        const secureLink = `https://expertise.mon50ccetmoi.com/claim/${caseId}`;
        const shareText = `Litige mon50ccetmoi : Voici mon dossier d'expertise certifiée Black Box. Code déverrouillage : ${pilotCode}. Lien d'achat : ${secureLink}`;
        
        // Simulation pour la démo : Ouvre automatiquement le portail assureur après 2s
        setTimeout(() => {
            if (confirm("DEMO : Souhaitez-vous simuler l'accès de l'assureur au portail de paiement ?")) {
                if (window.InsurancePortal) window.InsurancePortal.showPortal(caseId);
            }
        }, 2000);

        if (navigator.share) {
            navigator.share({
                title: 'Dossier Litige mon50ccetmoi',
                text: shareText,
                url: secureLink
            }).catch(() => {
                prompt("Copiez ce message pour votre assureur :", shareText);
            });
        } else {
            prompt("Copiez ce message pour votre assureur :", shareText);
        }
        
        return { caseId, pilotCode, secureLink };
    }
}




window.showVault = function() {
    document.getElementById('secure-vault-screen').classList.remove('hidden');
    const searchContainer = document.getElementById('search-container');
    const hud = document.getElementById('hud');
    if(searchContainer) searchContainer.classList.add('hidden');
    if(hud) hud.style.display = 'none';
}

window.hideVault = function() {
    document.getElementById('secure-vault-screen').classList.add('hidden');
    const searchContainer = document.getElementById('search-container');
    const hud = document.getElementById('hud');
    if(searchContainer) searchContainer.classList.remove('hidden');
    if(hud) hud.style.display = 'block';
}

// DEBUG: Sentinel Error Reporter Overlay
(function() {
    const debugDiv = document.createElement('div');
    debugDiv.id = 'sentinel-debug-overlay';
    debugDiv.style.cssText = 'position:fixed; bottom:50px; left:10px; right:10px; background:rgba(0,0,0,0.9); color:#ff4d4d; border:2px solid #ff4d4d; padding:10px; font-family:monospace; font-size:11px; z-index:999999; max-height:200px; overflow-y:auto; border-radius:8px; pointer-events:auto;';
    debugDiv.innerHTML = '<b>[SENTINEL DEBUG ACTIVE] Waiting for logs...</b>';
    document.body.appendChild(debugDiv);

    setInterval(() => {
        const errors = window.Sentinel ? window.Sentinel.errorLog : [];
        if (errors.length > 0) {
            let html = `<b>[SENTINEL BUG REPORT - ${errors.length} ERRORS]</b><br>`;
            errors.forEach((err, idx) => {
                html += `${idx + 1}: ${err.type} | Msg: ${err.detail?.msg || err.detail || 'N/A'}<br>File: ${err.detail?.url || 'N/A'} (Line: ${err.detail?.line || 'N/A'})<br><br>`;
            });
            debugDiv.innerHTML = html;
            console.log("SENTINEL_LOG_DUMP:", JSON.stringify(errors));
        } else {
            debugDiv.innerHTML = '<b>[SENTINEL DEBUG] No errors detected yet.</b>';
        }
    }, 1000);
})();



 
 w i n d o w . s h o w P r e d i c t i v e I A   =   f u n c t i o n ( )   { 
         i f   ( w i n d o w . s e s s i o n   & &   w i n d o w . s e s s i o n . i s G u e s t )   { 
                 a l e r t ( ' =��  L ' I A   P r � d i c t i v e   e t   l e s   a v a n t a g e s   c o u r t i e r   s o n t   r � s e r v � s   a u x   m e m b r e s   !   C r � e z   u n   c o m p t e   p o u r   y   a c c � d e r . ' ) ; 
                 r e t u r n ; 
         } 
         s h o w P a g e ( ' i a _ p r e d i c t i v e ' ) ; 
 } ; 
 
 

 
 w i n d o w . s a v e P r o f i l e I n f o   =   f u n c t i o n ( )   { 
         c o n s t   n e w U s e r n a m e   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' e d i t - u s e r n a m e ' ) . v a l u e ; 
         c o n s t   n e w S c o o t e r   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' e d i t - s c o o t e r ' ) . v a l u e ; 
         c o n s t   n e w E m a i l   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' e d i t - e m a i l ' ) . v a l u e ; 
         i f   ( n e w U s e r n a m e )   { 
                 i f   ( w i n d o w . s e s s i o n )   w i n d o w . s e s s i o n . u s e r n a m e   =   n e w U s e r n a m e ; 
                 l o c a l S t o r a g e . s e t I t e m ( ' u s e r n a m e ' ,   n e w U s e r n a m e ) ; 
                 c o n s t   d i s p l a y U s e r   =   d o c u m e n t . g e t E l e m e n t B y I d ( ' d i s p l a y - u s e r n a m e ' ) ; 
                 i f   ( d i s p l a y U s e r )   d i s p l a y U s e r . t e x t C o n t e n t   =   n e w U s e r n a m e ; 
                 t r y   { 
                         l e t   s e s s i o n D a t a   =   J S O N . p a r s e ( l o c a l S t o r a g e . g e t I t e m ( ' s e s s i o n ' ) ) ; 
                         i f ( s e s s i o n D a t a )   { 
                                 s e s s i o n D a t a . u s e r n a m e   =   n e w U s e r n a m e ; 
                                 l o c a l S t o r a g e . s e t I t e m ( ' s e s s i o n ' ,   J S O N . s t r i n g i f y ( s e s s i o n D a t a ) ) ; 
                         } 
                 }   c a t c h ( e )   { } 
         } 
         i f   ( n e w S c o o t e r )   l o c a l S t o r a g e . s e t I t e m ( ' u s e r _ s c o o t e r _ m o d e l ' ,   n e w S c o o t e r ) ; 
         i f   ( n e w E m a i l )   l o c a l S t o r a g e . s e t I t e m ( ' u s e r _ e m a i l ' ,   n e w E m a i l ) ; 
         a l e r t ( ' P r o f i l   m i s   �   j o u r   a v e c   s u c c � s   ! ' ) ; 
         i f   ( t y p e o f   c l o s e S c r e e n   = = =   ' f u n c t i o n ' )   c l o s e S c r e e n ( ) ; 
 } ; 
 
 


window.uploadDocument = function(docType) {
    // Faux scan de sécurité avant ouverture
    if(window.Wallet && typeof window.Wallet.unlock === 'function') {
        window.Wallet.unlock(function() {
            triggerActualUpload(docType);
        });
    } else {
        triggerActualUpload(docType);
    }
}

function triggerActualUpload(docType) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const base64 = evt.target.result;
            if(window.Wallet) {
                window.Wallet.saveDoc(docType, base64);
                window.renderWalletDocs();
            }
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

window.renderWalletDocs = function() {
    const container = document.getElementById('ants-docs-container');
    if(!container) return;
    if(!window.Wallet || !window.Wallet.docs) return;
    
    const docs = window.Wallet.docs;
    let html = '';
    
    for (const [type, doc] of Object.entries(docs)) {
        let label = 'Document';
        if(type === 'carte_grise') label = 'Certificat d\'immatriculation';
        if(type === 'permis_am') label = 'Permis AM / BSR';
        if(type === 'assurance') label = 'Attestation d\'Assurance';
        
        html += `
            <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; border-left:3px solid #2ecc71; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:bold; font-size:0.85rem;">\${label}</div>
                    <div style="font-size:0.6rem; color:#2ecc71;">\${doc.status} - \${new Date(doc.date).toLocaleDateString()}</div>
                </div>
                <button onclick="window.showWalletDoc('\${type}')" style="background:#2ecc71; color:white; border:none; border-radius:5px; padding:5px 10px; font-size:0.7rem;">VOIR</button>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

window.showWalletDoc = function(type) {
    const doc = window.Wallet.docs[type];
    if(!doc) return;
    
    // Ouvre le document en plein écran avec un badge de sécurité
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.95)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    overlay.innerHTML = `
        <div style="position:absolute; top:20px; right:20px; background:rgba(46, 204, 113, 0.2); border:1px solid #2ecc71; color:#2ecc71; padding:5px 10px; border-radius:5px; font-size:0.8rem; font-weight:bold;">
            <i class="fa-solid fa-shield-halved"></i> ANTS SECURE
        </div>
        <img src="\${doc.data}" style="max-width:90%; max-height:80vh; border-radius:10px; box-shadow:0 0 20px rgba(46,204,113,0.3);">
        <button onclick="this.parentElement.remove()" style="margin-top:20px; padding:10px 20px; background:#444; color:white; border:none; border-radius:8px; font-weight:bold;">FERMER</button>
    `;
    
    document.body.appendChild(overlay);
}

// Intercept page changes to render docs if we are on ants_wallet
const _originalShowPage = window.showPage;
window.showPage = function(page) {
    _originalShowPage(page);
    if(page === 'ants_wallet') {
        setTimeout(window.renderWalletDocs, 100);
    }
};
