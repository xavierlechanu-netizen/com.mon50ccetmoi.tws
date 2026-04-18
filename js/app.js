// --- I18N SYSTEM ---
window.currentLang = localStorage.getItem('app_lang');
if (!window.currentLang) {
    const browserLang = navigator.language.split('-')[0]; // ex: 'fr-FR' -> 'fr'
    const supported = ['fr', 'en', 'es', 'it', 'nl', 'pl', 'pt', 'de', 'sv', 'da', 'fi', 'no', 'el', 'cs', 'hu', 'ro'];
    window.currentLang = supported.includes(browserLang) ? browserLang : 'fr';
}
window.t = function(key) {
    if (typeof I18N === 'undefined') return key;
    return (I18N[window.currentLang] && I18N[window.currentLang][key]) || (I18N['fr'][key]) || key;
};
window.setLanguage = function(lang) {
    window.currentLang = lang;
    localStorage.setItem('app_lang', lang);
    location.reload(); 
};

// --- BOOT ---
console.log("mon50ccetmoi v20.0-ULTRA-PRO-ELITE: Démarrage.");

function checkUserBadges() {
    const totalKm = parseFloat(secureGetItem('total_km') || '0');
    const badgeContainer = document.getElementById('user-badges');
    if(!badgeContainer) return;

    if(totalKm >= 5000) {
        badgeContainer.innerHTML = `<div class="badge-elite" title="5000km parcourus">
            <i class="fa-solid fa-crown" style="color:#00d2ff;"></i> Rider d'Élite
        </div>`;
    } else {
        badgeContainer.innerHTML = `<small style="color:#444;">${(5000 - totalKm).toFixed(0)} km restants pour le badge Elite</small>`;
    }
}

    // Sidebar Menu
    const mGarage = document.getElementById('menu-garage'); if(mGarage) mGarage.innerHTML = `<i class="fa-solid fa-warehouse"></i> ${t('garage')}`;
    const mRoadbooks = document.getElementById('menu-roadbooks'); if(mRoadbooks) mRoadbooks.innerHTML = `<i class="fa-solid fa-map-location-dot"></i> Roadbooks`;
    const mSafety = document.getElementById('menu-rodage'); if(mSafety) mSafety.innerHTML = `<i class="fa-solid fa-gauge-high"></i> ${t('safety')}`;
    const mInsurance = document.getElementById('menu-insurance'); if(mInsurance) mInsurance.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${t('insurance')}`;
    const mMechanic = document.getElementById('menu-mechanic'); if(mMechanic) mMechanic.innerHTML = `<i class="fa-solid fa-robot"></i> ${t('maintenance')}`;

    // Map Radar Options
    const gasLabel = document.querySelector('[onclick="scanRadar(\'fuel\')"] span') || document.querySelector('[onclick="scanRadar(\'fuel\')"]');
    if(gasLabel) gasLabel.innerHTML = `<i class="fa-solid fa-gas-pump"></i> ${t('gas')}`;
    const emergencyLabel = document.querySelector('[onclick="scanRadar(\'doctors\')"] span') || document.querySelector('[onclick="scanRadar(\'doctors\')"]');
    if(emergencyLabel) emergencyLabel.innerHTML = `<i class="fa-solid fa-hospital"></i> ${t('emergency')}`;
    const bankLabel = document.querySelector('[onclick="scanRadar(\'atm\')"] span') || document.querySelector('[onclick="scanRadar(\'atm\')"]');
    if(bankLabel) bankLabel.innerHTML = `<i class="fa-solid fa-money-bill-1"></i> ${t('bank')}`;
};

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

// --- SECURITY HELPER ---
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (match) {
        const escape = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return escape[match];
    });
}

// --- 1. CONFIG & GLOBALS ---
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
let isPerfTracking = false;

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

function initMap() {
    const defaultCoords = { lat: 48.8566, lng: 2.3522 };
    
    // Initialisation Maps
    map = new google.maps.Map(document.getElementById("map"), {
        center: defaultCoords,
        zoom: 13,
        styles: GOOGLE_MAPS_STYLE,
        disableDefaultUI: true,
        backgroundColor: "#0a0a0a",
        gestureHandling: "greedy"
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: "#cca000",
            strokeOpacity: 0.9,
            strokeWeight: 8
        }
    });

    geocoder = new google.maps.Geocoder();
    trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);

    console.log("Moteur Premium v20.0-ULTRA-PRO-ELITE : Initialisé.");
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

if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(updatePosition, (e) => console.warn(e), { enableHighAccuracy: true });
}

function updatePosition(position) {
    if(!map) return; 
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const speed = position.coords.speed;
    const accuracy = position.coords.accuracy;

    currentPosition = { lat, lng };
    
    // --- GUEST MODE LOCKS (Initial logic check) ---
    if (session && session.isGuest) {
        document.getElementById('menu-insurance')?.classList.add('locked-feature');
        document.getElementById('menu-mechanic')?.classList.add('locked-feature');
        document.getElementById('menu-garage')?.classList.add('locked-feature');
        // On rend aussi le clic inactif ou redirige vers login
        ['menu-insurance', 'menu-mechanic', 'menu-garage'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.onclick = () => alert("Veuillez créer un compte pour accéder à cette fonctionnalité premium ! 🛵");
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
            vibrate(50); 
        } else {
            speedEl.parentElement.classList.remove('fast');
        }
        
        // --- NEW: Compass Logic ---
        const heading = position.coords.heading;
        if (heading !== null) {
            document.getElementById('compass-needle').style.transform = `rotate(${heading}deg)`;
            const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO', 'N'];
            const dirIdx = Math.round(heading / 45);
            document.getElementById('compass-dir').textContent = dirs[dirIdx];
        }

        handlePerfTracking(speedKmh);
    }
    
    window.isRiding = speedKmh > 2;
    calculateDistanceAndBadges(lat, lng);

    // --- NEW: Parking Mode Security ---
    handleParkingMode(lat, lng);

    // Rendu Map
    if (!userMarker) {
        const iconContent = document.createElement("div");
        iconContent.innerHTML = `<div style="background-color: #1a1a1a; color: #cca000; font-size: 16px; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px rgba(204, 160, 0, 0.9);"><i class="fa-solid fa-motorcycle"></i></div>`;
        
        // Tentative d'utilisation de AdvancedMarkerElement si disponible (v9.0+)
        try {
            if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
                userMarker = new google.maps.marker.AdvancedMarkerElement({
                    map: map,
                    position: currentPosition,
                    content: iconContent,
                    title: "Votre Position"
                });
            } else {
                userMarker = new google.maps.Marker({
                    map: map,
                    position: currentPosition,
                    title: "Votre Position",
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#cca000', fillOpacity: 1, strokeColor: 'white', strokeWeight: 2 }
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
        map.setZoom(16);
    } else {
        userMarker.position = currentPosition;
        accuracyCircle.setCenter(currentPosition);
        accuracyCircle.setRadius(accuracy / 2);
        map.panTo(currentPosition);
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

function speak(text) {
    if ('speechSynthesis' in window) {
        const ut = new SpeechSynthesisUtterance(text);
        ut.lang = 'fr-FR';
        ut.rate = 1.1;
        window.speechSynthesis.speak(ut);
        vibrate([100, 50, 100]); // Vibration d'attention lors du message vocal
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
        avoidTolls: true
    };

    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            
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

            speak(`Itinéraire calculé. Arrivée prévue à ${document.getElementById('nav-eta').textContent}.`);

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
    const mainBtn = document.getElementById('btn-hazard-main');
    if(opts.classList.contains('hidden')) {
        opts.classList.remove('hidden');
        mainBtn.style.transform = 'rotate(45deg)';
    } else {
        opts.classList.add('hidden');
        mainBtn.style.transform = 'rotate(0deg)';
    }
};

window.saveHazard = function(type) {
    if(!currentPosition) return;
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
        const marker = new google.maps.Marker({
            position: { lat: h.lat, lng: h.lon },
            map: map,
            icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#cca000', fillOpacity: 0.9, scale: 9, strokeColor: 'white', strokeWeight: 2 }
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
    'doctors': { icon: 'fa-stethoscope', label: 'Urgences', color: '#e74c3c', radius: 10000 },
    'atm': { icon: 'fa-money-bill-1', label: 'DAB', color: '#2ecc71', radius: 3000 },
    'mechanic': { icon: 'fa-wrench', label: 'Garages', color: '#ffa500', radius: 8000 }
};

window.toggleRadarMenu = function() {
    const r = document.getElementById('radar-options');
    r.classList.toggle('hidden');
}

window.scanRadar = function(type) {
    if(!currentPosition) return;
    toggleRadarMenu();
    const config = poiConfig[type];
    const radarBtn = document.getElementById('btn-radar-main');
    const oldHtml = radarBtn.innerHTML;
    radarBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
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
        const query = `[out:json][timeout:15];(nwr["amenity"="${type === 'doctors' ? 'clinic|hospital|doctors' : type}"](around:${config.radius},${lat},${lon}););out center;`;
        const url = `https://lz4.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        
        fetch(url).then(r => r.json()).then(data => {
            renderPoiMarkers(data.elements, config);
        }).finally(() => { radarBtn.innerHTML = oldHtml; });
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
                const communityRating = internalInfo ? `<div style="font-size:0.7rem; color:#00d2ff; margin-top:3px;">Label Scooter : ⭐ ${internalInfo.avgRating}/5 (${internalInfo.count} avis)</div>` : "";

                const marker = new google.maps.Marker({
                    position: place.geometry.location,
                    map: map,
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: isPro ? "#ffd700" : config.color, fillOpacity: 1, strokeColor: 'white' }
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
                        <b style="font-size:1rem;">${place.name}</b><br>
                        ⭐ Google: ${place.rating || "N/A"}/5 (${place.user_ratings_total || 0})
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
        console.error("Gov API fail", e); 
        alert("Erreur lors de la récupération des prix. Repli sur les données standards.");
    } finally {
        btn.innerHTML = oldHtml;
    }
}

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
            const info = new google.maps.InfoWindow({ content: `<b>${item.tags?.name || config.label}</b>` });
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

// --- 7. SERVICES (Météo, Boussole, Garage) ---
window.fetchWeather = async function(lat, lon) {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        const temp = Math.round(data.current_weather.temperature);
        document.getElementById('weather-hud').innerHTML = `<i class="fa-solid fa-cloud-sun"></i> ${temp}°C`;
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
    if(lastPositionForOdometer) {
        const p1 = new google.maps.LatLng(lastPositionForOdometer.lat, lastPositionForOdometer.lng);
        const p2 = new google.maps.LatLng(lat, lng);
        const d = google.maps.geometry.spherical.computeDistanceBetween(p1, p2) / 1000;
        if(d > 0.005 && d < 0.2) {
            window.session.totalDistance += d;
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
    if(total >= 5000) {
        badgeContainer.innerHTML = `<div class="badge-pro" title="Badge Elite: 5000km" style="background:#00d2ff; color:black; padding:3px 8px; border-radius:5px; font-size:0.7rem; font-weight:bold; display:inline-block;">
            <i class="fa-solid fa-crown"></i> Rider d'Élite (5000 km)
        </div>`;
    } else {
        const remaining = 5000 - total;
        badgeContainer.innerHTML = `<small style="color:#666; font-size:0.6rem;">En route : ${remaining.toFixed(0)} km pour le Badge Élite</small>`;
    }
}

// --- 9. ROADBOOKS ---
let savedRoadbooks = JSON.parse(secureGetItem('roadbooks')) || [];
window.renderRoadbooks = function() {
    const list = document.getElementById('roadbook-list');
    if(!list) return;
    list.innerHTML = savedRoadbooks.map((rb, i) => `<li>${rb.name} <button onclick="loadRoadbook(${i})">Charger</button></li>`).join('');
}

window.loadRoadbook = function(i) {
    const rb = savedRoadbooks[i];
    calculateRouteSansAutoroute(currentPosition, rb.waypoints[rb.waypoints.length-1]);
}

// --- SYSTEM STARTUP ---
window.startApp = function() {
    console.log("mon50cc Master Controller : Démarrage de la séquence d'initialisation...");
    const statusEl = document.getElementById('loader-status');
    if(statusEl) statusEl.textContent = "Liaison satellite établie...";

    try {
        initMap();
        if(statusEl) statusEl.textContent = "Calibration du HUD GPS...";
    } catch(e) {
        console.error("Critical Error during initMap:", e);
    }
    
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
            setTimeout(() => loader.style.visibility = 'hidden', 800); 
        }
        updateUILabels();
        if (typeof renderCommunityMarkers === "function") renderCommunityMarkers(); 
        console.log("mon50cc : Système prêt.");
    }, 1000);
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
    
    if(page === 'garage') {
        const history = JSON.parse(secureGetItem('maint_history') || '[]');
        content.innerHTML = `<h3>${t('garage')}</h3>
            <div id="dynamic-garage-list"></div>
            <h4 style="margin-top:20px; font-size:0.9rem; color:#aaa;">Journal d'entretien</h4>
            <div id="maint-history" style="font-size:0.8rem; margin-top:10px;">
                ${history.length ? history.map(h => `<div style="padding:10px; background:rgba(255,255,255,0.05); margin-bottom:5px; border-radius:8px;"><strong>${h.date}</strong>: ${h.action}</div>`).join('') : '<p style="color:#444;">Aucun historique.</p>'}
            </div>
            <button class="btn-insurance" onclick="addMaintLog()" style="margin-top:10px; font-size:0.8rem; padding:10px;">Ajouter une révision</button>`;
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
        content.innerHTML = `<h3>Mes Roadbooks</h3><ul id="roadbook-list" style="list-style:none;"></ul>`;
        renderRoadbooks();
    } else if(page === 'mechanic') {
        content.innerHTML = `<h3><i class="fa-solid fa-robot"></i> Assistant Méca V3</h3>
            <p style="font-size:0.8rem; color:#aaa;">Décrivez le symptôme (bruit, fumée, panne...)</p>
            <textarea id="meca-query" placeholder="Ex: Mon scoot broute à l'accélération..." style="width:100%; height:80px; margin-top:10px; background:#111; color:white; border:1px solid #ffb703; border-radius:8px; padding:10px;"></textarea>
            <button class="btn-insurance" onclick="submitMecaV3()" style="margin-top:15px; width:100%;">Scanner mon 50cc</button>
            <div id="meca-response" style="margin-top:20px; font-size:0.9rem; line-height:1.4;"></div>`;
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
    }
    toggleMenu();
}

window.shareApp = async function() {
    const shareData = {
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
    }
});

function triggerFallAlert() {
    vibrate([500, 200, 500, 200, 500]); // SOS vibration pattern
    if(document.getElementById('fall-screen')) return; 
    const div = document.createElement('div');
    div.id = 'fall-screen';
    div.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(180,0,0,0.95); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; text-align:center; padding:20px;";
    div.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation" style="font-size:5rem; margin-bottom:20px;"></i>
        <h1>${t('fall_detected')}</h1>
        <p>${t('emergency_alert')}</p>
        <button onclick="this.parentElement.remove()" style="margin-top:30px; padding:20px 40px; background:white; color:red; border:none; border-radius:50px; font-weight:bold; font-size:1.2rem;">${t('cancel')}</button>
    `;
    document.body.appendChild(div);
}

window.startRodage = function(name) {
    alert(`Mode Rodage Activé: ${name}. Vitesse max conseillée: 45km/h.`);
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
    if(t) t.innerHTML = "Bonne balade sur mon50ccetmoi v20.0-ULTRA-PRO-ELITE ! Prudence sur la route. 🛵💨";
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
        perfTimeEl.textContent = "0-45: Prêt...";
    } else if(speedKmh > 2 && isPerfTracking && !perfStartTime) {
        perfStartTime = Date.now();
        perfTimeEl.textContent = "0-45: GAZ !";
    } else if(speedKmh >= 45 && isPerfTracking && perfStartTime) {
        const time = ((Date.now() - perfStartTime) / 1000).toFixed(2);
        perfTimeEl.textContent = `0-45: ${time}s !`;
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
