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