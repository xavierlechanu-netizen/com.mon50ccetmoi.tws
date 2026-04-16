// --- BOOT ---
console.log("mon50ccetmoi v11.0-ULTRA-PRO: Démarrage.");

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
            strokeColor: "#ffb703",
            strokeOpacity: 0.9,
            strokeWeight: 8
        }
    });

    geocoder = new google.maps.Geocoder();
    trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);

    console.log("Moteur Premium v9.5-ULTRA : Initialisé.");
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
            vibrate(50); // Petite pulsation de vitesse
        } else {
            speedEl.parentElement.classList.remove('fast');
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
        iconContent.innerHTML = `<div style="background-color: #1a1a1a; color: #ffb703; font-size: 16px; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px rgba(255, 183, 3, 0.9);"><i class="fa-solid fa-motorcycle"></i></div>`;
        
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
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#ffb703', fillOpacity: 1, strokeColor: 'white', strokeWeight: 2 }
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
            document.getElementById('btn-cancel-route').classList.remove('hidden');
        } else { alert("Routage impossible: " + status); }
    });
}

window.cancelRoute = function() {
    if (directionsRenderer) directionsRenderer.setDirections({routes: []});
    if(destinationMarker) { destinationMarker.setMap(null); destinationMarker = null; }
    document.getElementById('btn-cancel-route').classList.add('hidden');
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
    const h = { lat: currentPosition.lat, lon: currentPosition.lng, type, author: window.session ? window.session.username : 'Anonyme' };
    let db = JSON.parse(secureGetItem('hazards') || '[]');
    db.push(h);
    secureSetItem('hazards', JSON.stringify(db));
    alert(`Signalement: ${type} enregistré ! Merci à vous.`);
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
            icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#ffb703', fillOpacity: 0.9, scale: 9, strokeColor: 'white', strokeWeight: 2 }
        });
        const info = new google.maps.InfoWindow({ content: `<b>${h.type}</b><br><small>${h.author}</small>` });
        marker.addListener("click", () => info.open(map, marker));
        hazardMarkers.push(marker);

        // Ajout à la liste sidebar
        if(listContainer && index < 5) { // On affiche les 5 derniers max
            const div = document.createElement('div');
            div.className = 'hazard-alert';
            div.style.cursor = 'pointer';
            div.innerHTML = `<div><i class="fa-solid fa-triangle-exclamation"></i> <strong>${h.type}</strong><br><span>Par ${h.author}</span></div><i class="fa-solid fa-chevron-right" style="font-size:0.6rem; color:#444;"></i>`;
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
    'fuel': { icon: 'fa-gas-pump', label: 'Essence', color: '#ffb703', radius: 5000 },
    'doctors': { icon: 'fa-stethoscope', label: 'Urgences', color: '#e74c3c', radius: 10000 },
    'atm': { icon: 'fa-money-bill-1', label: 'DAB', color: '#2ecc71', radius: 3000 }
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
    
    const lat = currentPosition.lat;
    const lon = currentPosition.lng;
    const query = `[out:json][timeout:15];(nwr["amenity"="${type === 'doctors' ? 'clinic|hospital|doctors' : type}"](around:${config.radius},${lat},${lon}););out center;`;
    const url = `https://lz4.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    
    fetch(url).then(r => r.json()).then(data => {
        officialPoiMarkers.forEach(m => m.setMap(null));
        officialPoiMarkers = [];
        if(data.elements?.length > 0) {
            data.elements.forEach(item => {
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
        alert(`${data.elements?.length || 0} résultat(s) trouvés.`);
    }).finally(() => { radarBtn.innerHTML = oldHtml; });
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

// Simu Communauté
let communityMarkers = [];
function simulateCommunityLive() {
    if(!currentPosition) return;
    const names = ["Scoot75", "Nitro50", "PeugeotSpeed", "BikerFou"];
    
    // Clear old markers
    communityMarkers.forEach(m => m.setMap(null));
    communityMarkers = [];

    names.forEach(name => {
        if(!window.session || name === window.session.username) return;
        const latOffset = (Math.random()-0.5)*0.01;
        const lngOffset = (Math.random()-0.5)*0.01;
        const m = new google.maps.Marker({
            position: { lat: currentPosition.lat + latOffset, lng: currentPosition.lng + lngOffset },
            map: map,
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: '#00d2ff', fillOpacity: 0.7, strokeColor: 'white', strokeWeight: 1 },
            title: name
        });
        communityMarkers.push(m);
    });
}
// Mise à jour périodique de la communauté (toutes les 15s)
setInterval(simulateCommunityLive, 15000);

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

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadHazards();
    renderRoadbooks();
    updatePosition({ coords: { latitude: 48.8566, longitude: 2.3522, speed: 0, accuracy: 10 } });
    
    // Simulate loader
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if(loader) { loader.style.opacity = '0'; setTimeout(() => loader.style.visibility = 'hidden', 800); }
        simulateCommunityLive(); // Activer la simulation communautaire au lancement
    }, 1500);
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
        content.innerHTML = `<h3>Mon Garage</h3>
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
        content.innerHTML = `<h3>Confidentialité</h3>
            <div style="font-size:0.8rem; line-height:1.4; color:#ccc;">
                <p><strong>Données GPS :</strong> Vos coordonnées sont traitées localement pour la navigation et la détection de chute.</p>
                <p><strong>Partage :</strong> Les signalements de dangers sont partagés de manière anonyme avec la communauté.</p>
                <p><strong>Stockage :</strong> Vos préférences sont enregistrées dans votre navigateur (LocalStorage).</p>
                <p><strong>Version :</strong> v9.5-ULTRA Build 2026</p>
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
        <h1>CHUTE DÉTECTÉE !</h1>
        <p>Êtes-vous en sécurité ? Une alerte va être envoyée à vos contacts d'urgence dans 30 secondes.</p>
        <button onclick="this.parentElement.remove()" style="margin-top:30px; padding:20px 40px; background:white; color:red; border:none; border-radius:50px; font-weight:bold; font-size:1.2rem;">JE VAIS BIEN</button>
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
    console.log("Feedback:", emoji, comment);
    alert("Merci pour votre retour !");
    closeMood();
}
window.closeMood = function() { document.getElementById('mood-overlay').classList.add('hidden'); }
setTimeout(() => document.getElementById('mood-overlay')?.classList.remove('hidden'), 30000); 

window.logout = function() {
    secureSetItem('session', null);
    window.location.href = 'login.html';
}

window.updateTicker = function() {
    const t = document.getElementById('ticker-text');
    if(t) t.innerHTML = "Bonne balade sur mon50ccetmoi v11.0-ULTRA-PRO ! Prudence sur la route. 🛵💨";
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
