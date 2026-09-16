/**
 * radar-danger.js — Page dédiée au Radar de Danger Communautaire
 * Utilise et enrichit le système DangerZones existant (danger-zones.js).
 * Affiche une carte Google Maps centrée sur l'utilisateur avec les
 * signalements de la communauté et permet d'en ajouter de nouveaux.
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
let firestoreUnsubscribe = null;
let selectedDangerType = null;
let signalCount = 0;

// --- Initialisation carte ---
function initMap() {
  if (typeof google === 'undefined') {
    showError("Google Maps non disponible. Vérifiez votre connexion.");
    return;
  }

  const defaultPos = { lat: 48.8566, lng: 2.3522 }; // Paris par défaut

  map = new google.maps.Map(document.getElementById('radar-map'), {
    center: defaultPos,
    zoom: 14,
    mapId: (typeof CONFIG !== 'undefined' && CONFIG?.MAPS?.MAP_ID) ? CONFIG.MAPS.MAP_ID : "DEMO_MAP_ID",
    disableDefaultUI: true,
    styles: darkMapStyle()
  });

  // Géolocalisation de l'utilisateur
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      pos => updateUserPosition(pos),
      err => console.warn('[Radar Danger] Géoloc refusée:', err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Charger les signalements Firestore en temps réel
  loadDangers();

  // Stats
  loadStats();
}

function updateUserPosition(pos) {
  currentPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };

    const userMarkerElement = document.createElement("div");
    userMarkerElement.style.width = "20px";
    userMarkerElement.style.height = "20px";
    userMarkerElement.style.backgroundColor = "#00f0ff";
    userMarkerElement.style.border = "2px solid #fff";
    userMarkerElement.style.borderRadius = "50%";
    userMarkerElement.style.boxShadow = "0 0 10px #00f0ff";

    userMarker = new google.maps.marker.AdvancedMarkerElement({
      position: currentPosition,
      map: map,
      title: 'Ma position',
      content: userMarkerElement,
      zIndex: 999
    });
    map.setCenter(currentPosition);
  } else {
    userMarker.setPosition(currentPosition);
  }

  document.getElementById('gps-status').textContent = '📍 GPS actif';
  document.getElementById('gps-status').style.color = '#00f0ff';
}

function loadDangers() {
  if (typeof db === 'undefined') return;

  // Nettoyage de l'écoute précédente
  if (firestoreUnsubscribe) firestoreUnsubscribe();

  // Écoute temps réel sur la collection hazards (OWASP A11 : requête limitée)
  firestoreUnsubscribe = db.collection('hazards')
    .where('status', '==', 'active')
    .orderBy('created_at', 'desc')
    .limit(100)
    .onSnapshot(snapshot => {
      // Retirer les anciens marqueurs
      dangerMarkers.forEach(m => m.setMap(null));
      dangerMarkers = [];

      const feed = document.getElementById('danger-feed');
      const items = [];

      snapshot.forEach(doc => {
        const d = doc.data();
        const type = DANGER_TYPES.find(t => t.id === d.type) || DANGER_TYPES[0];

        // Marqueur carte
        if (d.lat && d.lng && map) {
          const dangerMarkerElement = document.createElement("div");
          dangerMarkerElement.style.width = "32px";
          dangerMarkerElement.style.height = "32px";
          dangerMarkerElement.style.backgroundColor = type.color + "33";
          dangerMarkerElement.style.border = "2px solid " + type.color;
          dangerMarkerElement.style.borderRadius = "50%";
          dangerMarkerElement.style.display = "flex";
          dangerMarkerElement.style.alignItems = "center";
          dangerMarkerElement.style.justifyContent = "center";
          dangerMarkerElement.style.fontSize = "16px";
          dangerMarkerElement.innerText = type.icon;

          const marker = new google.maps.marker.AdvancedMarkerElement({
            position: { lat: d.lat, lng: d.lng },
            map: map,
            title: type.label,
            content: dangerMarkerElement,
          });

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

        // Feed latéral
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
      document.getElementById('signal-count').textContent = snapshot.size;
    }, err => console.error('[Radar Danger] Firestore error:', err));
}

async function loadStats() {
  if (typeof db === 'undefined') return;
  try {
    const snap = await db.collection('hazards')
      .where('status', '==', 'active')
      .limit(1)
      .get();
    // Le count réel n'est pas disponible sans count() (Firestore v9+)
    // On affiche juste ce qu'on a
  } catch(e) { /* non bloquant */ }
}

// --- Signalement ---
function selectDangerType(id) {
  selectedDangerType = id;
  // Mettre à jour l'UI
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.id === id);
  });
  document.getElementById('btn-confirm-signal').disabled = false;
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
    // Rate limiting côté client : 1 signalement par 30 secondes
    const lastSignal = parseInt(localStorage.getItem('last_signal_ts') || '0');
    if (Date.now() - lastSignal < 30000) {
      throw new Error('rate_limit');
    }

    await db.collection('hazards').add({
      type: selectedDangerType,
      lat: currentPosition.lat,
      lng: currentPosition.lng,
      uid: uid,
      status: 'active',
      confirmations: 0,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000) // Expire dans 2h
    });

    localStorage.setItem('last_signal_ts', Date.now().toString());
    showToast('✅ Danger signalé ! Merci de protéger la communauté.');
    closePanelSignal();

    // Récompense BVC
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
  document.getElementById('btn-confirm-signal').disabled = true;
  document.getElementById('panel-signal').classList.remove('open');
}

function centerOnUser() {
  if (currentPosition && map) {
    map.setCenter(currentPosition);
    map.setZoom(15);
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

// Rendre les types de danger disponibles globalement pour le HTML
window.DANGER_TYPES_LIST = DANGER_TYPES;
window.initMap = initMap;
window.selectDangerType = selectDangerType;
window.signalerDanger = signalerDanger;
window.openPanelSignal = openPanelSignal;
window.closePanelSignal = closePanelSignal;
window.centerOnUser = centerOnUser;
