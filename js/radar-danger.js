/**
 * radar-danger.js — Page dédiée au Radar de Danger Communautaire & Navigation GPS In-App
 * Conforme Code de la Route (Article R412-6-2 : Aide à la conduite et à la navigation)
 * Itinéraires 50cc optimisés sans autoroute ni voie rapide (Article R421-2)
 */

const DANGER_TYPES = [
  { id: 'POTHOLE',    icon: '🕳️', label: 'Nid-de-poule',    color: '#ff6600' },
  { id: 'GRAVEL',     icon: '⚠️', label: 'Gravillons',       color: '#ffaa00' },
  { id: 'SLIPPERY',   icon: '🌧️', label: 'Route glissante', color: '#3399ff' },
  { id: 'ROADWORKS',  icon: '🚧', label: 'Travaux',          color: '#ff9900' },
  { id: 'ACCIDENT',   icon: '🚨', label: 'Accident',         color: '#ff0044' },
  { id: 'BLIND_SPOT', icon: '🚛', label: 'Angle mort camion',color: '#9c27b0' },
  { id: 'POLICE',     icon: '👮', label: 'Contrôle',         color: '#6666ff' },
  { id: 'ANIMAL',     icon: '🦊', label: 'Animal sur route', color: '#8bc34a' },
];

let map = null;
let userMarker = null;
let dangerMarkers = [];
let currentPosition = null;
let currentGeohash = null;
let firestoreUnsubscribe = null;
let selectedDangerType = null;
let signalCount = 0;

// Variables de Navigation Turn-by-Turn GPS
let directionsService = null;
let directionsRenderer = null;
let autocomplete = null;
let currentRoute = null;
let isNavigating = false;
let activeStepIndex = 0;
let voiceGuidanceEnabled = true;
let currentSpeed = 0;
let lastPosition = null;
let lastPositionTime = null;
let lastAnnouncedStepIndex = -1;
let lastAnnouncedHazardId = null;

// Utilitaire Geohash simple (Base32) pour filtrage Firestore (OWASP A11 / F-4)
const B32_CODES = "0123456789bcdefghjkmnpqrstuvwxyz";
function encodeGeohash(lat, lng, precision = 5) {
  let chars = [], bits = 0, bitsTotal = 0, hash_value = 0;
  let maxLat = 90, minLat = -90, maxLng = 180, minLng = -180, mid;
  while (chars.length < precision) {
    if (bitsTotal % 2 === 0) {
      mid = (maxLng + minLng) / 2;
      if (lng > mid) { hash_value = (hash_value << 1) + 1; minLng = mid; }
      else { hash_value = (hash_value << 1) + 0; maxLng = mid; }
    } else {
      mid = (maxLat + minLat) / 2;
      if (lat > mid) { hash_value = (hash_value << 1) + 1; minLat = mid; }
      else { hash_value = (hash_value << 1) + 0; maxLat = mid; }
    }
    bits++; bitsTotal++;
    if (bits === 5) { chars.push(B32_CODES[hash_value]); bits = 0; hash_value = 0; }
  }
  return chars.join('');
}

// --- Initialisation carte et services de navigation ---
function initMap() {
  if (typeof google === 'undefined') {
    showError("Google Maps non disponible. Vérifiez votre connexion.");
    return;
  }

  const defaultPos = { lat: 48.8566, lng: 2.3522 }; // Paris par défaut

  map = new google.maps.Map(document.getElementById('radar-map'), {
    center: defaultPos,
    zoom: 14,
    mapId: CONFIG?.MAPS?.MAP_ID || undefined,
    disableDefaultUI: true,
    styles: darkMapStyle()
  });

  // Services Google Directions pour le Turn-by-Turn
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: false,
    polylineOptions: {
      strokeColor: '#00f0ff',
      strokeWeight: 6,
      strokeOpacity: 0.85
    }
  });

  // Initialisation du champ de recherche de destination (Places Autocomplete)
  initAutocomplete();

  // Géolocalisation de l'utilisateur
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      pos => updateUserPosition(pos),
      err => console.warn('[Radar Danger] Géoloc refusée:', err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 2000 }
    );
  }

  // Stats
  loadStats();
}

// --- Mise à jour de la position et vitesse réelle (Speedometer & Guidage) ---
function updateUserPosition(pos) {
  currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };

  // Calcul vitesse réelle (depuis GPS ou calcul delta distance/temps)
  let speedKmH = 0;
  if (pos.coords.speed !== null && pos.coords.speed !== undefined && pos.coords.speed >= 0) {
    speedKmH = Math.round(pos.coords.speed * 3.6); // conversion m/s -> km/h
  } else if (lastPosition && lastPositionTime && typeof google !== 'undefined' && google.maps.geometry) {
    const timeSec = (Date.now() - lastPositionTime) / 1000;
    if (timeSec > 0.5) {
      const distM = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(lastPosition.lat, lastPosition.lng),
        new google.maps.LatLng(currentPosition.lat, currentPosition.lng)
      );
      speedKmH = Math.min(99, Math.round((distM / timeSec) * 3.6));
    }
  }
  lastPosition = { ...currentPosition };
  lastPositionTime = Date.now();
  currentSpeed = speedKmH;

  // Mise à jour compteur de vitesse dans le HUD
  const speedEl = document.getElementById('hud-speed');
  if (speedEl) {
    speedEl.textContent = currentSpeed;
    speedEl.classList.toggle('warning', currentSpeed > 45 && currentSpeed <= 50);
    speedEl.classList.toggle('danger', currentSpeed > 50);
  }

  // Recharger les dangers si on change de zone Geohash (précision 4 = ~20km)
  const newGeohash = encodeGeohash(currentPosition.lat, currentPosition.lng, 4);
  if (newGeohash !== currentGeohash) {
    currentGeohash = newGeohash;
    loadDangers(currentGeohash);
  }

  // Mise à jour marqueur de position utilisateur
  if (!userMarker) {
    userMarker = new google.maps.Marker({
      position: currentPosition,
      map,
      title: 'Ma position',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#00f0ff',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
      zIndex: 999
    });
    map.setCenter(currentPosition);
  } else {
    userMarker.setPosition(currentPosition);
  }

  // Si le guidage Turn-by-Turn est actif : centrer et mettre à jour la manœuvre
  if (isNavigating) {
    map.setCenter(currentPosition);
    updateNavigationHUD();
  }

  document.getElementById('gps-status').textContent = '📍 GPS actif';
  document.getElementById('gps-status').style.color = '#00f0ff';
}

// --- Chargement des dangers Firestore filtrés par Geohash ---
function loadDangers(userGeohash) {
  if (typeof db === 'undefined' || !userGeohash) return;

  if (firestoreUnsubscribe) firestoreUnsubscribe();

  firestoreUnsubscribe = db.collection('hazards')
    .where('geohash', '>=', userGeohash)
    .where('geohash', '<=', userGeohash + '\uf8ff')
    .where('status', '==', 'active')
    .limit(100)
    .onSnapshot(snapshot => {
      dangerMarkers.forEach(m => m.setMap(null));
      dangerMarkers = [];

      const feed = document.getElementById('danger-feed');
      const items = [];

      snapshot.forEach(doc => {
        const d = doc.data();
        const type = DANGER_TYPES.find(t => t.id === d.type) || DANGER_TYPES[0];

        if (d.lat && d.lng && map) {
          const marker = new google.maps.Marker({
            position: { lat: d.lat, lng: d.lng },
            map,
            title: type.label,
            label: { text: type.icon, fontSize: '20px' },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: type.color,
              fillOpacity: 0.2,
              strokeColor: type.color,
              strokeWeight: 2,
            }
          });

          // Stocker les métadonnées pour détection de proximité pendant la navigation
          marker.customHazard = { id: doc.id, label: type.label, lat: d.lat, lng: d.lng, icon: type.icon };

          const infoWindow = new google.maps.InfoWindow({
            content: `<div style="font-family:Inter,sans-serif; color:#000; font-size:13px; padding:4px;">
              <strong>${type.icon} ${type.label}</strong><br>
              Signalé par la communauté<br>
              <span style="color:#888; font-size:11px;">${formatAge(d.created_at)}</span>
            </div>`
          });
          marker.addListener('click', () => infoWindow.open(map, marker));
          dangerMarkers.push(marker);
        }

        const timeAgo = formatAge(d.created_at);
        items.push(`
          <div class="feed-item">
            <span class="feed-icon">${type.icon}</span>
            <div class="feed-body">
              <span class="feed-label">${type.label}</span>
              <span class="feed-time">${timeAgo}</span>
            </div>
            <span class="feed-votes" title="${d.confirmations || 0} confirmations">
              <i class="fa-solid fa-thumbs-up"></i> ${d.confirmations || 0}
            </span>
          </div>
        `);
      });

      if (feed) feed.innerHTML = items.length ? items.join('') : '<p class="feed-empty">Aucun danger signalé dans la zone. Bonne route ! 🟢</p>';
      const countBadge = document.getElementById('signal-count');
      if (countBadge) countBadge.textContent = snapshot.size;
    }, err => console.error('[Radar Danger] Firestore error:', err));
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE DE NAVIGATION TURN-BY-TURN GPS IN-APP (Aide à la conduite R412-6-2)
// ─────────────────────────────────────────────────────────────────────────────

function initAutocomplete() {
  const input = document.getElementById('nav-destination-input');
  if (!input || typeof google === 'undefined' || !google.maps.places) return;

  autocomplete = new google.maps.places.Autocomplete(input, {
    componentRestrictions: { country: 'fr' },
    fields: ['geometry', 'name', 'formatted_address']
  });

  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    if (!place || !place.geometry || !place.geometry.location) {
      return;
    }
    const clearBtn = document.getElementById('nav-clear-btn');
    if (clearBtn) clearBtn.style.display = 'block';
    calculateRouteToLocation(place.geometry.location, place.name || place.formatted_address);
  });

  input.addEventListener('input', () => {
    const clearBtn = document.getElementById('nav-clear-btn');
    if (clearBtn) clearBtn.style.display = input.value.trim() ? 'block' : 'none';
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      calculateRoute();
    }
  });
}

function quickNavSearch(query) {
  const input = document.getElementById('nav-destination-input');
  if (input) {
    input.value = query;
    const clearBtn = document.getElementById('nav-clear-btn');
    if (clearBtn) clearBtn.style.display = 'block';
  }
  calculateRoute();
}

function clearNavigationSearch() {
  const input = document.getElementById('nav-destination-input');
  if (input) input.value = '';
  const clearBtn = document.getElementById('nav-clear-btn');
  if (clearBtn) clearBtn.style.display = 'none';
  cancelRoutePreview();
}

function calculateRoute() {
  const input = document.getElementById('nav-destination-input');
  const dest = input ? input.value.trim() : '';
  if (!dest) {
    showToast('Saisis une adresse ou un lieu de destination.');
    return;
  }
  calculateRouteToLocation(dest, dest);
}

function calculateRouteToLocation(destination, destName) {
  if (!currentPosition) {
    showToast('Attente de votre position GPS...');
    return;
  }
  if (!directionsService) {
    showToast('Service de navigation non initialisé.');
    return;
  }

  showToast('Calcul de l\'itinéraire 50cc...');
  const btn = document.getElementById('btn-calculate-route');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

  // Respect du Code de la route (Article R421-2) : INTERDICTION d'autoroutes et voies rapides pour les 50cc
  const request = {
    origin: new google.maps.LatLng(currentPosition.lat, currentPosition.lng),
    destination: destination,
    travelMode: google.maps.TravelMode.DRIVING,
    avoidHighways: true,
    avoidTolls: true,
    provideRouteAlternatives: false
  };

  directionsService.route(request, (result, status) => {
    if (btn) btn.innerHTML = '<i class="fa-solid fa-route"></i>';

    if (status === google.maps.DirectionsStatus.OK) {
      currentRoute = result.routes[0];
      directionsRenderer.setDirections(result);

      const leg = currentRoute.legs[0];
      document.getElementById('preview-duration').textContent = leg.duration ? leg.duration.text : '--';
      document.getElementById('preview-distance').textContent = leg.distance ? leg.distance.text : '--';

      // Vérifier les dangers signalés sur cet itinéraire
      const hazardCount = countHazardsOnRoute(currentRoute);
      document.getElementById('preview-hazards-count').textContent = hazardCount;

      document.getElementById('route-preview-box').style.display = 'block';
      showToast('✅ Itinéraire trouvé ! Sans autoroute.');
    } else {
      console.warn('[Nav] Erreur route:', status);
      showToast('Impossible de trouver un itinéraire 50cc vers cette destination.');
    }
  });
}

function countHazardsOnRoute(route) {
  if (!route || !route.overview_path || !dangerMarkers.length || typeof google === 'undefined' || !google.maps.geometry) {
    return 0;
  }
  let count = 0;
  const path = route.overview_path;
  const polyline = new google.maps.Polyline({ path });

  dangerMarkers.forEach(m => {
    const latLng = m.getPosition ? m.getPosition() : null;
    if (latLng && google.maps.geometry.poly.isLocationOnEdge(latLng, polyline, 0.001)) {
      count++;
    }
  });
  return count;
}

function cancelRoutePreview() {
  currentRoute = null;
  if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
  const previewBox = document.getElementById('route-preview-box');
  if (previewBox) previewBox.style.display = 'none';
}

function startTurnByTurnNavigation() {
  if (!currentRoute) return;

  isNavigating = true;
  activeStepIndex = 0;
  lastAnnouncedStepIndex = -1;
  lastAnnouncedHazardId = null;

  // Masquer les panneaux standards et afficher le cockpit de guidage
  document.getElementById('nav-floating-card').style.display = 'none';
  document.getElementById('nav-cockpit').style.display = 'flex';
  const fab = document.getElementById('fab-center-btn');
  if (fab) fab.style.display = 'none';

  // Centrage immersif sur la route
  if (map && currentPosition) {
    map.setCenter(currentPosition);
    map.setZoom(17);
  }

  updateNavigationHUD();
  speakText("Démarrage du guidage GPS. Respectez la limitation à 50 km/h.");
}

function stopTurnByTurnNavigation() {
  isNavigating = false;
  currentRoute = null;
  if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });

  document.getElementById('nav-cockpit').style.display = 'none';
  document.getElementById('nav-hazard-banner').style.display = 'none';
  document.getElementById('nav-floating-card').style.display = 'block';
  const previewBox = document.getElementById('route-preview-box');
  if (previewBox) previewBox.style.display = 'none';

  const fab = document.getElementById('fab-center-btn');
  if (fab) fab.style.display = 'flex';

  if (map && currentPosition) {
    map.setZoom(15);
    map.setCenter(currentPosition);
  }

  speakText("Guidage terminé.");
  showToast("Guidage arrêté.");
}

function updateNavigationHUD() {
  if (!isNavigating || !currentRoute) return;

  const leg = currentRoute.legs[0];
  if (!leg || !leg.steps || activeStepIndex >= leg.steps.length) {
    speakText("Vous êtes arrivé à destination.");
    showToast("🏁 Vous êtes arrivé à destination !");
    stopTurnByTurnNavigation();
    return;
  }

  const step = leg.steps[activeStepIndex];
  const userLatLng = new google.maps.LatLng(currentPosition.lat, currentPosition.lng);
  const stepEnd = step.end_location;

  // Calcul distance jusqu'à la fin de la manœuvre actuelle
  let distToNextTurn = 0;
  if (google.maps.geometry && google.maps.geometry.spherical) {
    distToNextTurn = Math.round(google.maps.geometry.spherical.computeDistanceBetween(userLatLng, stepEnd));
  } else {
    distToNextTurn = step.distance.value;
  }

  // Passer à l'étape suivante quand on est à moins de 25m
  if (distToNextTurn < 25 && activeStepIndex < leg.steps.length - 1) {
    activeStepIndex++;
    updateNavigationHUD();
    return;
  }

  const distText = distToNextTurn < 1000 ? `${distToNextTurn} m` : `${(distToNextTurn / 1000).toFixed(1)} km`;
  document.getElementById('turn-distance').textContent = `Dans ${distText}`;

  // Nettoyer balises HTML des consignes Google Maps
  const cleanInstruction = stripHtml(step.instructions || 'Continuez tout droit');
  document.getElementById('turn-street').textContent = cleanInstruction;

  // Consigne suivante
  if (activeStepIndex + 1 < leg.steps.length) {
    const nextClean = stripHtml(leg.steps[activeStepIndex + 1].instructions || '');
    document.getElementById('turn-next-step').textContent = nextClean ? `Puis : ${nextClean}` : '';
  } else {
    document.getElementById('turn-next-step').textContent = 'Arrivée imminente';
  }

  // Icône de direction
  updateManeuverIcon(step.maneuver);

  // Annonce vocale
  if (activeStepIndex !== lastAnnouncedStepIndex) {
    lastAnnouncedStepIndex = activeStepIndex;
    speakText(`Dans ${distText}, ${cleanInstruction}`);
  }

  // Temps restant & ETA
  calculateRemainingTripStats(leg, activeStepIndex, distToNextTurn);

  // Détection des dangers à l'approche (< 250m)
  checkApproachingHazards(userLatLng);
}

function calculateRemainingTripStats(leg, currentIndex, currentStepDist) {
  let remainingDistMeters = currentStepDist;
  for (let i = currentIndex + 1; i < leg.steps.length; i++) {
    remainingDistMeters += leg.steps[i].distance.value;
  }

  const distKm = (remainingDistMeters / 1000).toFixed(1);
  document.getElementById('nav-remaining-dist').textContent = `${distKm} km`;

  // Estimation temps restant (vitesse moyenne 35 km/h en ville)
  const remainingMinutes = Math.max(1, Math.round((remainingDistMeters / 1000) / 35 * 60));
  document.getElementById('nav-remaining-time').textContent = `${remainingMinutes} min`;

  // Heure d'arrivée estimée (ETA)
  const etaDate = new Date(Date.now() + remainingMinutes * 60000);
  const hh = String(etaDate.getHours()).padStart(2, '0');
  const mm = String(etaDate.getMinutes()).padStart(2, '0');
  document.getElementById('nav-eta').textContent = `${hh}:${mm}`;
}

function checkApproachingHazards(userLatLng) {
  let closestHazard = null;
  let minDistance = 999999;

  dangerMarkers.forEach(m => {
    const markerPos = m.getPosition ? m.getPosition() : null;
    if (!markerPos || !google.maps.geometry) return;

    const dist = google.maps.geometry.spherical.computeDistanceBetween(userLatLng, markerPos);
    if (dist < 250 && dist < minDistance) {
      minDistance = dist;
      closestHazard = { marker: m, dist: Math.round(dist) };
    }
  });

  const banner = document.getElementById('nav-hazard-banner');
  if (closestHazard && banner) {
    banner.style.display = 'flex';
    const label = closestHazard.marker.title || 'Obstacle signalé';
    document.getElementById('nhb-title').textContent = label;
    document.getElementById('nhb-dist').textContent = `${closestHazard.dist}m`;

    const hazardId = closestHazard.marker.customHazard?.id;
    if (hazardId && lastAnnouncedHazardId !== hazardId && closestHazard.dist < 200) {
      lastAnnouncedHazardId = hazardId;
      speakText(`Attention, ${label} signalé à ${closestHazard.dist} mètres.`);
    }
  } else if (banner) {
    banner.style.display = 'none';
  }
}

function updateManeuverIcon(maneuver) {
  const icon = document.getElementById('turn-icon');
  if (!icon) return;

  icon.className = 'fa-solid';
  if (!maneuver) {
    icon.classList.add('fa-arrow-up');
    return;
  }

  if (maneuver.includes('right')) {
    icon.classList.add(maneuver.includes('slight') ? 'fa-arrow-trend-up' : 'fa-arrow-turn-right');
  } else if (maneuver.includes('left')) {
    icon.classList.add(maneuver.includes('slight') ? 'fa-arrow-trend-up' : 'fa-arrow-turn-left');
  } else if (maneuver.includes('roundabout')) {
    icon.classList.add('fa-rotate-right');
  } else if (maneuver.includes('uturn')) {
    icon.classList.add('fa-arrow-rotate-left');
  } else if (maneuver.includes('fork') || maneuver.includes('ramp')) {
    icon.classList.add('fa-code-fork');
  } else {
    icon.classList.add('fa-arrow-up');
  }
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function speakText(text) {
  if (!voiceGuidanceEnabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

function toggleVoiceGuidance() {
  voiceGuidanceEnabled = !voiceGuidanceEnabled;
  const icon = document.getElementById('voice-icon');
  if (icon) {
    icon.className = voiceGuidanceEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  }
  showToast(voiceGuidanceEnabled ? '🔊 Guidage vocal activé' : '🔇 Guidage vocal désactivé');
}

// ─────────────────────────────────────────────────────────────────────────────
// FONCTIONS DE SIGNALEMENT ET UTILITAIRES
// ─────────────────────────────────────────────────────────────────────────────

async function loadStats() {
  if (typeof db === 'undefined') return;
  try {
    await db.collection('hazards').where('status', '==', 'active').limit(1).get();
  } catch(e) { /* non bloquant */ }
}

function selectDangerType(id) {
  selectedDangerType = id;
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.id === id);
  });
  const confirmBtn = document.getElementById('btn-confirm-signal');
  if (confirmBtn) confirmBtn.disabled = false;
}

async function signalerDanger() {
  if (!window.auth || !window.auth.currentUser) {
    alert('Tu dois être connecté pour signaler un danger.');
    return;
  }
  if (!selectedDangerType) {
    alert('Sélectionne un type de danger.');
    return;
  }
  if (!currentPosition) {
    alert('GPS en cours de localisation... Réessaie dans quelques secondes.');
    return;
  }

  const btn = document.getElementById('btn-confirm-signal');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Envoi...';

  const uid = window.auth.currentUser.uid;

  try {
    const lastSignal = parseInt(localStorage.getItem('last_signal_ts') || '0');
    if (Date.now() - lastSignal < 30000) {
      throw new Error('rate_limit');
    }

    await db.collection('hazards').add({
      type: selectedDangerType,
      lat: currentPosition.lat,
      lng: currentPosition.lng,
      geohash: encodeGeohash(currentPosition.lat, currentPosition.lng, 6),
      uid: uid,
      status: 'active',
      confirmations: 0,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      expires_at: firebase.firestore.Timestamp.fromMillis(Date.now() + 2 * 60 * 60 * 1000)
    });

    localStorage.setItem('last_signal_ts', Date.now().toString());
    showToast('✅ Danger signalé ! Merci de protéger la communauté.');
    closePanelSignal();

    await db.collection('users').doc(uid).update({
      bvcPoints: firebase.firestore.FieldValue.increment(2)
    });

  } catch(e) {
    if (e.message === 'rate_limit') {
      showToast('⏱️ Attends 30 secondes entre deux signalements.');
    } else {
      console.error('[Radar Danger] Erreur signalement:', e);
      showToast('❌ Erreur lors du signalement. Réessaie.');
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-flag"></i> Confirmer le signalement';
  }
}

function openPanelSignal() {
  document.getElementById('panel-signal').classList.add('open');
}

function closePanelSignal() {
  selectedDangerType = null;
  document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('selected'));
  const confirmBtn = document.getElementById('btn-confirm-signal');
  if (confirmBtn) confirmBtn.disabled = true;
  document.getElementById('panel-signal').classList.remove('open');
}

function centerOnUser() {
  if (currentPosition && map) {
    map.setCenter(currentPosition);
    map.setZoom(isNavigating ? 17 : 15);
  }
}

function formatAge(timestamp) {
  if (!timestamp) return 'À l\'instant';
  const ms = timestamp.toMillis ? timestamp.toMillis() : Date.now();
  const diff = Math.floor((Date.now() - ms) / 60000);
  if (diff < 1) return 'À l\'instant';
  if (diff < 60) return `Il y a ${diff} min`;
  return `Il y a ${Math.floor(diff / 60)}h`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

function showError(msg) {
  document.getElementById('radar-map').innerHTML =
    `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ff0055;font-family:Inter,sans-serif;">${msg}</div>`;
}

function darkMapStyle() {
  return [
    { elementType: 'geometry', stylers: [{ color: '#0a0a12' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a12' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#555' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#111' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050510' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ];
}

// Rendre les fonctions accessibles globalement
window.DANGER_TYPES_LIST = DANGER_TYPES;
window.initMap = initMap;
window.selectDangerType = selectDangerType;
window.signalerDanger = signalerDanger;
window.openPanelSignal = openPanelSignal;
window.closePanelSignal = closePanelSignal;
window.centerOnUser = centerOnUser;
window.quickNavSearch = quickNavSearch;
window.clearNavigationSearch = clearNavigationSearch;
window.calculateRoute = calculateRoute;
window.cancelRoutePreview = cancelRoutePreview;
window.startTurnByTurnNavigation = startTurnByTurnNavigation;
window.stopTurnByTurnNavigation = stopTurnByTurnNavigation;
window.toggleVoiceGuidance = toggleVoiceGuidance;
