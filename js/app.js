try {
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
window.currentLang = localStorage.getItem('app_lang') || 'fr';

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
console.log("mon50ccetmoi v50000.7-GOLD-STABLE : Production Ready.");

let map;
let directionsService;
let directionsRenderer;
let geocoder;
let trafficLayer;
let userMarker = null;
let accuracyCircle = null;
let currentPosition = null; 
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
    if (window.session.isTrialExpired) {
        const overlay = document.getElementById('sub-overlay');
        if (overlay) overlay.classList.remove('hidden');
        speak("Alerte abonnement : Votre période d'essai gratuite est terminée.");
    }
}

// Style Premium Dark "Gold & Black" pour Google Maps
const GOOGLE_MAPS_STYLE = [
    { "elementType": "geometry", "stylers": [{ "color": "#1a1a1a" }] },
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1a1a1a" }] },
    { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#333333" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#111111" }] },
    { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

window.appStarted = false;

window.initMapController = function() {
    if (map) return; 
    console.log("mon50cc Maps : Initialisation du contrôleur...");
    
    const mapElement = document.getElementById('map');
    const statusEl = document.getElementById('loader-status');
    if (!mapElement) return;

    try {
        if (typeof google === 'undefined' || !google.maps) {
            throw new Error("SDK_NOT_LOADED");
        }

        map = new google.maps.Map(mapElement, {
            center: { lat: 48.8566, lng: 2.3522 },
            zoom: 15,
            styles: GOOGLE_MAPS_STYLE,
            disableDefaultUI: true,
            backgroundColor: "#0a0a0a",
            gestureHandling: "greedy"
        });

        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({ map: map, suppressMarkers: true });
        geocoder = new google.maps.Geocoder();
        trafficLayer = new google.maps.TrafficLayer();
        trafficLayer.setMap(map);

        if (statusEl) statusEl.textContent = "Systèmes opérationnels.";
    } catch (e) {
        console.error("Maps init failed:", e);
        // FALLBACK: TACTICAL RADAR MODE
        mapElement.innerHTML = `
            <div class="radar-fallback" style="height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#050505; color:var(--neon-blue);">
                <i class="fa-solid fa-satellite-dish fa-spin" style="font-size:3rem; margin-bottom:20px;"></i>
                <div style="font-family:'JetBrains Mono'; font-weight:900;">RADAR_TACTIQUE_ACTIF</div>
                <div style="font-size:0.7rem; opacity:0.6; margin-top:10px;">SDK_FAILOVER: SENSOR_LIAISON_ESTABLISHED</div>
            </div>
        `;
        if (statusEl) statusEl.textContent = "Mode Radar (Maps Error)...";
        if (window.NeuralHUD) window.NeuralHUD.logToConsole("MAP_FAILOVER: RADAR_MODE_ENGAGED");
    } finally {
        if (typeof initDatabase === "function") initDatabase();
        // On attend un peu que les autres modules se chargent
        setTimeout(() => window.startApp(), 500);
    }
}

window.startApp = function() {
    if (window.appStarted) return;
    window.appStarted = true;
    
    console.log("mon50cc : Initialisation globale...");
    
    try {
        // Initialisation sécurisée des modules
        if (window.NeuralHUD && typeof window.NeuralHUD.init === "function") window.NeuralHUD.init();
        if (window.GuardianAngel && typeof window.GuardianAngel.init === "function") window.GuardianAngel.init();
        if (window.NeuralSync && typeof window.NeuralSync.init === "function") window.NeuralSync.init();
        if (window.Wallet && typeof window.Wallet.init === "function") window.Wallet.init();
        
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.visibility = 'hidden', 800);
        }

        // --- GUEST MODE BANNER ---
        if (window.session && window.session.isGuest) {
            const guestBanner = document.getElementById('guest-banner');
            if (guestBanner) guestBanner.classList.remove('hidden');
        }

        // Lancement de la géolocalisation après le démarrage de l'UI
        checkLegalConsent();
    } catch (e) {
        console.error("App startup bug prevented:", e);
    }
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

window.initMap = function() {
    window.initMapController();
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

// --- 2. GPS & TEMPS RÉEL ---
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log("Anti-veille actif.");
        }
    } catch (err) { console.warn(err); }
}

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
        <button onclick="window.close()" style="background:transparent; border:none; color:#666; font-size:0.8rem; text-decoration:underline;">Quitter l'application</button>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-accept-legal').onclick = () => {
        localStorage.setItem('legal_consent_accepted', 'true');
        modal.remove();
        startGeolocation();
    };
}

function startGeolocation() {
    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(updatePosition, (e) => console.warn(e), { enableHighAccuracy: true });
    }
}

// Remplacement du démarrage automatique par la vérification légale
// Retrait de l'appel direct pour éviter les conflits avant l'init de l'UI
// checkLegalConsent(); 

function updatePosition(position) {
    if(!map) return; 
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const speed = position.coords.speed;
    const accuracy = position.coords.accuracy;

    currentPosition = { lat, lng };
    if (window.OracleEngine) window.OracleEngine.updateRegion(lat, lng);
    
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

    // Vitesse (HUD)
    const speedEl = document.getElementById('speed');
    let speedKmh = 0;
    if (speed !== null && speed >= 0) {
        speedKmh = Math.round(speed * 3.6);
        speedEl.textContent = speedKmh;
        
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

        // DYNAMIC ZOOM & TILT
        if (map) {
            // Update movement time for Guardian
            if (speedKmh > 5) {
                lastMovementTime = Date.now();
                if (isGuardianPromptActive) dismissGuardian();
            }

            if (speedKmh > 40) {
                map.setTilt(45);
                map.setZoom(15.5); // Vision lointaine pour radars
            } else if (speedKmh > 5) {
                map.setTilt(30);
                map.setZoom(16.5); // Vision urbaine stable
            } else {
                map.setTilt(0);
                map.setZoom(17.5); // Vue arrêt confortable
            }
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

    // Rendu Map
    if (!userMarker) {
        const totalKm = window.session?.totalDistance || 0;
        const color = totalKm >= 10000 ? '#B9F2FF' : '#cca000'; // DIAMANT SI 10000KM
        const shadow = totalKm >= 10000 ? '0 0 20px #B9F2FF' : '0 0 15px rgba(204, 160, 0, 0.9)';

        const iconContent = document.createElement("div");
        iconContent.innerHTML = `<div style="background-color: #1a1a1a; color: ${color}; font-size: 16px; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; border: 2px solid white; box-shadow: ${shadow}; transition: all 0.5s ease;"><i class="fa-solid fa-motorcycle"></i></div>`;
        
        try {
            if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
                userMarker = new google.maps.marker.AdvancedMarkerElement({
                    map: map,
                    position: currentPosition,
                    content: iconContent,
                    title: "Votre Position Certifiée"
                });
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
            radius: accuracy / 2,
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

        userMarker.position = currentPosition;
        accuracyCircle.setCenter(currentPosition);
        accuracyCircle.setRadius(accuracy / 2);
        
        // On recentre et on décale pour la visibilité
        map.panTo(currentPosition);
        map.panBy(0, -100);
    }

    // Météo Auto
    const wHud = document.getElementById('weather-hud');
    if(wHud && wHud.textContent.includes('--')) {
        window.fetchWeather(lat, lng);
    }

    // --- NEW: Hazard Proximity Verification ---
    checkHazardProximity(lat, lng);

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
    if ('vibrate' in navigator) navigator.vibrate(ms);
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
                'level_up': "Et bim ! Tu as monté de niveau, bravo mon brave."
            },
            'quebec': {
                'start': "Attache ta tuque, l'Oracle est prêt pour une sacrée virée !",
                'speed': "Lâche la patate, tu roules pas mal trop vite là !",
                'threat_detected': "Check ben ça, y'a de quoi de pas net sur le chemin.",
                'level_up': "C'est écoeurant ! T'as gagné un niveau."
            },
            'standard': {
                'start': "Core Universel stabilisé. Liaison totale établie.",
                'speed': "Alerte : Vitesse excessive. Ralentissez immédiatement.",
                'threat_detected': "ANALYSE : Menace identifiée. Prudence conseillée.",
                'level_up': "Félicitations Pilote. Votre expérience a augmenté."
            }
        }
    },

    updateRegion: function(lat, lng) {
        if (lat > 43.1 && lat < 43.4 && lng > 5.2 && lng < 5.6) this.currentRegion = 'marseille';
        else if (lat > 45 && lat < 47 && lng > -74 && lng < -71) this.currentRegion = 'quebec';
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

function speak(phraseKey) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const lang = window.currentLang || 'fr';
    const region = window.OracleEngine.currentRegion;
    
    let text = phraseKey;
    if (window.OracleEngine.regionalLexicon[lang]) {
        text = window.OracleEngine.regionalLexicon[lang][region]?.[phraseKey] || 
               window.OracleEngine.regionalLexicon[lang]['standard']?.[phraseKey] || 
               phraseKey;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = window.OracleEngine.getVoice(lang);
    utterance.lang = lang;
    utterance.rate = 0.95;
    utterance.pitch = window.OracleEngine.gender === 'female' ? 1.05 : 0.9;
    
    window.speechSynthesis.speak(utterance);
    if ('vibrate' in navigator) navigator.vibrate(30);
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

function calculateRouteSansAutoroute(start, end) {
    const request = {
        origin: start,
        destination: end,
        travelMode: 'DRIVING',
        avoidHighways: true,
        avoidTolls: true,
        // En mode rodage, on force la main sur les routes départementales/secondaires
        provideRouteAlternatives: window.isRodageActive
    };

    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            // Si mode rodage, on sélectionne l'itinéraire le plus long ou le plus complexe (moins de vitesse)
            // Pour l'instant on garde le défaut mais on prévient l'utilisateur
            directionsRenderer.setDirections(result);
            
            if (window.isRodageActive) {
                speak("Itinéraire spécial Rodage calculé. Routes tranquilles privilégiées.");
            }
            
            // --- NEW: Advanced HUD Integration ---
            const leg = result.routes[0].legs[0];
            const nextStep = leg.steps[0];
            
            document.getElementById('nav-instruction').classList.remove('hidden');
            document.getElementById('nav-info-bar').classList.remove('hidden');
            document.getElementById('btn-stop-nav').classList.remove('hidden');
            document.getElementById('btn-reroute').classList.remove('hidden');
            
            document.getElementById('next-step-name').innerHTML = nextStep.instructions;
            document.getElementById('next-step-dist').textContent = nextStep.distance.text;
            
            document.getElementById('nav-eta').textContent = new Date(Date.now() + leg.duration.value * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            document.getElementById('nav-dist').textContent = leg.distance.text;
            document.getElementById('nav-time').textContent = leg.duration.text;
            
            // AUTO-ACTIVATE GUARDIAN ANGEL ON NAVIGATION START
            if (!window.isGuardianActive && typeof toggleGuardianAngel === "function") {
                toggleGuardianAngel();
            }

            speak(`Itinéraire calculé. Arrivée prévue à ${document.getElementById('nav-eta').textContent}. Protection Ange Gardien activée.`);

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
        } else { alert("Routage impossible: " + status); }
    });
}

window.cancelRoute = function() {
    if (directionsRenderer) directionsRenderer.setDirections({routes: []});
    if(destinationMarker) { destinationMarker.setMap(null); destinationMarker = null; }
    
    document.getElementById('nav-instruction').classList.add('hidden');
    document.getElementById('nav-info-bar').classList.add('hidden');
    document.getElementById('btn-stop-nav').classList.add('hidden');
    document.getElementById('btn-reroute').classList.add('hidden');
    
    document.getElementById('route-search').value = "";
}

window.searchDestination = function() {
    const query = document.getElementById('route-search').value;
    if(!query || !currentPosition || !geocoder) return;
    geocoder.geocode({ address: query }, (res, status) => {
        if(status === "OK") {
            const dest = res[0].geometry.location;
            calculateRouteSansAutoroute(currentPosition, dest);
            map.panTo(dest);
        } else { alert("Inconnu: " + status); }
    });
}

// --- 4. SERVICES COMMUNAUTAIRES (SIGNALEMENTS) ---
window.toggleHazardMenu = function() {
    const opts = document.getElementById('hazard-options');
    const mainBtn = document.getElementById('btn-hazard-quick') || document.getElementById('btn-hazard-main');
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
    r.classList.toggle('hidden');
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

window.startApp = function() {
    if (window.appStarted) return;
    window.appStarted = true;
    console.log("mon50cc Master Controller : Démarrage de la séquence d'initialisation v26.1...");
    runCinematicStartup();
    
    const statusEl = document.getElementById('loader-status');
    
    // Note: initMap() est désormais appelé directement par le callback Google Maps SDK
    
    checkTrialExpiration();
    updateUILabels();
    
    loadHazards();
    renderRoadbooks();
    updatePosition({ coords: { latitude: 48.8566, longitude: 2.3522, speed: 0, accuracy: 10 } });
    
    // Check Parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('shortcut')) {
        const sc = urlParams.get('shortcut');
        setTimeout(() => {
            if (sc === 'garage') showPage('garage');
            if (sc === 'danger') toggleHazardMenu();
        }, 1000);
    }

    // Hide Loader gracefully
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if(loader) { 
            loader.style.opacity = '0'; 
            setTimeout(() => {
                loader.style.visibility = 'hidden';
                speak("Systèmes opérationnels. Bonne route sur mon 50cc et moi.");
            }, 800); 
        }
        updateUILabels();
        if (typeof renderCommunityMarkers === "function") renderCommunityMarkers(); 
        if (typeof simulateLiveFleet === "function") simulateLiveFleet();
        console.log("mon50cc : Système prêt.");
        
        // Notification de Mise à Jour v25.01
        if(!localStorage.getItem('v25_01_notified')) {
            setTimeout(() => {
                speak("Mise à jour Silver Edition installée. Découvrez le nouveau Sentinel Météo et le HUD optimisé.");
                alert("🥈 MON50CC SILVER EDITION 🥈\n\n- Sentinel Météo : Alertes vocales en cas de pluie.\n- HUD Silver : Interface optimisée pour la vision nocturne.\n- Sécurité : Détecteur de chute 2.0 calibré.");
                localStorage.setItem('v25_01_notified', 'true');
            }, 5000);
        }
    }, 3500); // Wait for cinematic sequence
};

// Fail-safe Loader removal (after 5s)
setTimeout(() => {
    const loader = document.getElementById('app-loader');
    if(loader && loader.style.visibility !== 'hidden') {
        console.warn("Fail-safe: Force hiding loader after timeout.");
        loader.style.opacity = '0';
        setTimeout(() => loader.style.visibility = 'hidden', 800);
    }
}, 5000);

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Prêt. En attente du SDK Maps...");
});

window.toggleMenu = function() {
    const s = document.getElementById('sidebar');
    s.classList.toggle('sidebar-hidden');
}

window.closeScreen = function() {
    document.getElementById('screen-overlay').classList.add('hidden');
}

window.showPage = function(page) {
    const overlay = document.getElementById('screen-overlay');
    const content = document.getElementById('screen-content');
    overlay.classList.remove('hidden');
    
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
                <li onclick="alert('Fonction Scan en cours de déploiement...')"><i class="fa-solid fa-camera"></i> Numériser Carte Grise</li>
                <li onclick="alert('Fonction Scan en cours de déploiement...')"><i class="fa-solid fa-address-card"></i> Numériser Permis AM</li>
                <li onclick="alert('Fonction Scan en cours de déploiement...')"><i class="fa-solid fa-shield-check"></i> Attestation Assurance</li>
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
window.closeMood = function() { document.getElementById('mood-overlay').classList.add('hidden'); }
setTimeout(() => document.getElementById('mood-overlay')?.classList.remove('hidden'), 30000); 

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
// --- AUTO-BOOT ---
// Si le SDK Maps est déjà là, on lance manuellement
if (typeof google !== 'undefined' && google.maps) {
    console.log("SDK Maps déjà présent au chargement de app.js. Démarrage immédiat.");
    window.initMap();
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
} catch(e) { console.error("GLOBAL APP CRASH PREVENTED:", e); }
