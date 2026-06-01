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
    
    const query = searchEl ? (searchEl.inputValue !== undefined ? searchEl.inputValue : searchEl.value) : "";
    const startQuery = startEl ? (startEl.inputValue !== undefined ? startEl.inputValue : startEl.value) : "";
    
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
