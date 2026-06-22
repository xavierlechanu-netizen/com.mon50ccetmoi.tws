/**
 * OfflineMapManager — mon50ccetmoi v100.00-GOLD
 * Gestion complète des cartes hors ligne avec Leaflet + OpenStreetMap
 * Basculement automatique : Google Maps (online) ↔ Leaflet (offline)
 */

window.OfflineMapManager = (function() {
    'use strict';

    // ── Configuration ────────────────────────────────────────────
    const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const TILE_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    const MIN_ZOOM_CACHE = 10;
    const MAX_ZOOM_CACHE = 16;
    const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

    // ── État interne ─────────────────────────────────────────────
    let leafletMap = null;
    let leafletMarker = null;
    let leafletRoute = null;
    let isOfflineMode = false;
    let isInitialized = false;
    let downloadJobId = null;
    let swMessageChannel = null;

    // ── Détection réseau ─────────────────────────────────────────
    function isOnline() {
        return navigator.onLine;
    }

    window.addEventListener('online', () => {
        console.log('[OfflineMap] Réseau rétabli → retour Google Maps');
        switchToGoogleMaps();
        showNetworkToast('🟢 Réseau rétabli — Carte HD réactivée', 'online');
    });

    window.addEventListener('offline', () => {
        console.log('[OfflineMap] Hors ligne → basculement Leaflet');
        switchToLeaflet();
        showNetworkToast('🔴 Mode Hors Ligne — Carte locale active', 'offline');
    });

    // ── Génération des URLs de tuiles pour une zone ──────────────
    function lat2tile(lat, zoom) {
        return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    }
    function lon2tile(lon, zoom) {
        return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
    }

    function generateTileUrls(lat, lng, radiusKm) {
        const urls = [];
        // Conversion km en degrés (approximation)
        const latDelta = radiusKm / 111;
        const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

        const minLat = lat - latDelta;
        const maxLat = lat + latDelta;
        const minLng = lng - lngDelta;
        const maxLng = lng + lngDelta;

        const subdomains = ['a', 'b', 'c'];

        for (let z = MIN_ZOOM_CACHE; z <= MAX_ZOOM_CACHE; z++) {
            const xMin = lon2tile(minLng, z);
            const xMax = lon2tile(maxLng, z);
            const yMin = lat2tile(maxLat, z);
            const yMax = lat2tile(minLat, z);

            for (let x = xMin; x <= xMax; x++) {
                for (let y = yMin; y <= yMax; y++) {
                    const s = subdomains[(x + y) % 3];
                    urls.push(`https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`);
                }
            }
        }
        return urls;
    }

    // ── Initialisation de la carte Leaflet ───────────────────────
    function initLeaflet() {
        if (leafletMap) return;

        const leafletDiv = document.getElementById('leaflet-map');
        if (!leafletDiv) {
            console.error('[OfflineMap] #leaflet-map introuvable');
            return;
        }

        // Position initiale : Paris ou position GPS actuelle
        const pos = window.currentPosition || { lat: 48.8566, lng: 2.3522 };

        if (typeof L === "undefined") return;
        leafletMap = L.map('leaflet-map', {
            center: [pos.lat, pos.lng],
            zoom: 15,
            zoomControl: false,
            attributionControl: false
        });

        // Couche de tuiles OSM avec fallback
        L.tileLayer(TILE_URL, {
            attribution: TILE_ATTRIBUTION,
            subdomains: ['a', 'b', 'c'],
            maxZoom: 19,
            crossOrigin: true
        }).addTo(leafletMap);

        // Icône personnalisée moto (style HUD)
        const motoIcon = L.divIcon({
            className: '',
            html: `<div style="
                background: #1a1a1a;
                color: #ffb700;
                border: 2px solid #fff;
                border-radius: 50%;
                width: 36px; height: 36px;
                display: flex; align-items: center; justify-content: center;
                font-size: 16px;
                box-shadow: 0 0 15px rgba(255,183,0,0.8);
            "><i class="fa-solid fa-motorcycle"></i></div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        // Marqueur position utilisateur
        const initPos = window.currentPosition || { lat: 48.8566, lng: 2.3522 };
        leafletMarker = L.marker([initPos.lat, initPos.lng], { icon: motoIcon }).addTo(leafletMap);

        console.log('[OfflineMap] Carte Leaflet initialisée.');
        isInitialized = true;
    }

    // ── Mise à jour de la position sur Leaflet ───────────────────
    function updateLeafletPosition(lat, lng) {
        if (!leafletMap || !leafletMarker) return;
        leafletMarker.setLatLng([lat, lng]);
        leafletMap.panTo([lat, lng]);
    }

    // ── Basculement Google Maps → Leaflet ────────────────────────
    function switchToLeaflet() {
        if (isOfflineMode) return;
        isOfflineMode = true;

        const googleDiv = document.getElementById('map');
        const leafletDiv = document.getElementById('leaflet-map');
        const offlineBadge = document.getElementById('offline-mode-badge');

        if (googleDiv) googleDiv.style.display = 'none';
        if (leafletDiv) leafletDiv.style.display = 'block';
        if (offlineBadge) offlineBadge.classList.remove('hidden');

        // Initialiser Leaflet si pas encore fait
        if (!isInitialized) initLeaflet();

        // Centrer sur la position actuelle
        if (window.currentPosition && leafletMap) {
            leafletMap.setView([window.currentPosition.lat, window.currentPosition.lng], 15);
        }

        console.log('[OfflineMap] Mode OFFLINE activé — Leaflet actif');
    }

    // ── Basculement Leaflet → Google Maps ────────────────────────
    function switchToGoogleMaps() {
        if (!isOfflineMode) return;
        isOfflineMode = false;

        const googleDiv = document.getElementById('map');
        const leafletDiv = document.getElementById('leaflet-map');
        const offlineBadge = document.getElementById('offline-mode-badge');

        if (googleDiv) googleDiv.style.display = 'block';
        if (leafletDiv) leafletDiv.style.display = 'none';
        if (offlineBadge) offlineBadge.classList.add('hidden');

        console.log('[OfflineMap] Mode ONLINE activé — Google Maps actif');
    }

    // ── Recherche Nominatim (offline-friendly) ───────────────────
    async function searchNominatim(query, lat, lng) {
        try {
            const params = new URLSearchParams({
                q: query,
                format: 'json',
                limit: 5,
                // Pas de filtre countrycodes — conformité Règlement (UE) 2018/302 (Geo-blocking)
                viewbox: `${lng - 0.5},${lat + 0.5},${lng + 0.5},${lat - 0.5}`,
                bounded: 1,
                email: 'contact@mon50ccetmoi.com'
            });
            const resp = await fetch(`${NOMINATIM_URL}/search?${params}`, {
                headers: { 'Accept-Language': 'fr' }
            });
            if (!resp.ok) throw new Error('Nominatim error');
            return await resp.json();
        } catch (e) {
            console.warn('[OfflineMap] Nominatim failed:', e);
            return [];
        }
    }

    // ── Toast réseau ─────────────────────────────────────────────
    function showNetworkToast(msg, type) {
        const existing = document.getElementById('network-status-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'network-status-toast';
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'online' ? 'rgba(0,30,10,0.95)' : 'rgba(30,0,10,0.95)'};
            border: 1px solid ${type === 'online' ? '#00ff88' : '#ff0055'};
            color: #fff;
            padding: 10px 20px;
            border-radius: 30px;
            font-size: 0.8rem;
            font-family: 'JetBrains Mono', monospace;
            letter-spacing: 1px;
            z-index: 99999;
            box-shadow: 0 0 20px ${type === 'online' ? 'rgba(0,255,136,0.4)' : 'rgba(255,0,85,0.4)'};
            animation: toast-slide-in 0.3s ease-out;
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    // ── Téléchargement d'une zone ────────────────────────────────
    async function downloadZone(lat, lng, radiusKm = 15, zoneName = 'Ma Zone') {
        if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
            alert('Service Worker non actif. Rechargez la page et réessayez.');
            return;
        }

        const urls = generateTileUrls(lat, lng, radiusKm);
        const totalCount = urls.length;

        // Avertissement taille
        const estimatedMb = Math.round(totalCount * 8 / 1024 * 10) / 10; // ~8KB par tuile

        if (!confirm(`📥 Télécharger la zone "${zoneName}" ?\n\n${totalCount} tuiles (~${estimatedMb} Mo)\nRayon : ${radiusKm} km\n\nCela peut prendre quelques minutes.`)) {
            return;
        }

        downloadJobId = Date.now().toString();
        showDownloadProgress(0, totalCount, zoneName);

        // Envoi au Service Worker via MessageChannel
        const channel = new MessageChannel();
        swMessageChannel = channel;

        channel.port1.onmessage = (event) => {
            const data = event.data;
            if (data.type === 'CACHE_PROGRESS') {
                showDownloadProgress(data.cached + data.failed, data.total, zoneName, data.percent);
            } else if (data.type === 'CACHE_COMPLETE') {
                const savedZones = JSON.parse(localStorage.getItem('offline_zones') || '[]');
                savedZones.push({
                    id: downloadJobId,
                    name: zoneName,
                    lat, lng, radiusKm,
                    tiles: data.cached,
                    date: new Date().toLocaleDateString('fr-FR'),
                    estimatedMb
                });
                localStorage.setItem('offline_zones', JSON.stringify(savedZones));

                hideDownloadProgress();
                showNetworkToast(`✅ Zone "${zoneName}" prête hors ligne (${data.cached} tuiles)`, 'online');
                refreshZoneList();
                downloadJobId = null;
            }
        };

        navigator.serviceWorker.controller.postMessage({
            type: 'CACHE_TILES',
            urls,
            jobId: downloadJobId
        }, [channel.port2]);
    }

    // ── UI : Barre de progression ────────────────────────────────
    function showDownloadProgress(current, total, zoneName, percent) {
        let progressEl = document.getElementById('offline-download-progress');
        if (!progressEl) {
            progressEl = document.createElement('div');
            progressEl.id = 'offline-download-progress';
            progressEl.style.cssText = `
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%);
                width: 90%;
                max-width: 400px;
                background: rgba(0,5,15,0.97);
                border: 1px solid var(--neon-blue);
                border-radius: 15px;
                padding: 15px 20px;
                z-index: 99998;
                box-shadow: 0 0 30px rgba(0,210,255,0.3);
                font-family: 'JetBrains Mono', monospace;
                color: #fff;
            `;
            document.body.appendChild(progressEl);
        }

        const pct = percent || Math.round((current / total) * 100);
        const safeZoneName = document.createElement('div');
        safeZoneName.textContent = zoneName;
        const escapedZoneName = safeZoneName.innerHTML;
        progressEl.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <i class="fa-solid fa-download" style="color:var(--neon-blue); animation: pulse 1s infinite;"></i>
                <div>
                    <div style="font-size:0.75rem; color:var(--neon-blue); letter-spacing:1px;">TÉLÉCHARGEMENT EN COURS</div>
                    <div style="font-size:0.9rem; font-weight:bold;">${escapedZoneName}</div>
                </div>
                <div style="margin-left:auto; font-size:1.2rem; font-weight:900; color:var(--neon-blue);">${pct}%</div>
            </div>
            <div style="height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, var(--neon-blue), #00ff88); transition:width 0.5s ease; box-shadow:0 0 10px var(--neon-blue);"></div>
            </div>
            <div style="margin-top:8px; font-size:0.65rem; color:#666; text-align:right;">${current} / ${total} tuiles</div>
        `;
    }

    function hideDownloadProgress() {
        const el = document.getElementById('offline-download-progress');
        if (el) {
            el.style.opacity = '0';
            el.style.transition = 'opacity 0.5s';
            setTimeout(() => el.remove(), 500);
        }
    }

    // ── Affichage des zones sauvegardées ─────────────────────────
    function refreshZoneList() {
        const container = document.getElementById('offline-zones-list');
        if (!container) return;

        const zones = JSON.parse(localStorage.getItem('offline_zones') || '[]');

        if (zones.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:20px; color:#444; font-size:0.8rem;">
                    <i class="fa-solid fa-map-location-dot" style="font-size:2rem; margin-bottom:10px; display:block; opacity:0.3;"></i>
                    Aucune zone téléchargée
                </div>
            `;
            return;
        }

        container.innerHTML = zones.map((z, idx) => {
            const safeZoneName = document.createElement('div');
            safeZoneName.textContent = z.name;
            return `
            <div style="
                background:rgba(0,20,40,0.8);
                border:1px solid rgba(0,210,255,0.3);
                border-radius:12px;
                padding:12px 15px;
                margin-bottom:10px;
                display:flex;
                align-items:center;
                gap:12px;
            ">
                <div style="width:40px;height:40px;border-radius:50%;background:rgba(0,210,255,0.1);border:1px solid rgba(0,210,255,0.4);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fa-solid fa-map" style="color:var(--neon-blue);"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:bold;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${safeZoneName.innerHTML}</div>
                    <div style="font-size:0.65rem;color:#666;margin-top:2px;">${z.tiles} tuiles • ~${z.estimatedMb} Mo • ${z.date}</div>
                    <div style="font-size:0.65rem;color:#444;">Rayon: ${z.radiusKm} km</div>
                </div>
                <button onclick="window.OfflineMapManager.deleteZone(${idx})" style="
                    background:rgba(255,0,85,0.15);
                    border:1px solid rgba(255,0,85,0.5);
                    color:#ff4d6d;
                    border-radius:8px;
                    padding:6px 10px;
                    font-size:0.7rem;
                    cursor:pointer;
                    flex-shrink:0;
                ">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `}).join('');
    }

    // ── Supprimer une zone ───────────────────────────────────────
    function deleteZone(idx) {
        if (!confirm('Supprimer cette zone hors ligne ?')) return;
        const zones = JSON.parse(localStorage.getItem('offline_zones') || '[]');
        zones.splice(idx, 1);
        localStorage.setItem('offline_zones', JSON.stringify(zones));
        refreshZoneList();
        // Note: Les tuiles individuelles restent dans le cache SW (trop complexe à cibler)
        // Un "Tout effacer" est disponible dans le panneau
    }

    // ── Vider tout le cache ──────────────────────────────────────
    function clearAllTiles() {
        if (!confirm('⚠️ Effacer TOUTES les tuiles hors ligne ?\nVos zones enregistrées seront supprimées.')) return;

        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => {
                localStorage.removeItem('offline_zones');
                refreshZoneList();
                showNetworkToast('🗑️ Cache tuiles effacé', 'offline');
            };
            navigator.serviceWorker.controller.postMessage(
                { type: 'CLEAR_TILES_CACHE' },
                [channel.port2]
            );
        }
    }

    // ── Obtenir les stats du cache ────────────────────────────────
    function getStats(callback) {
        if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
            callback({ count: 0, estimatedMb: 0 });
            return;
        }
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => callback(e.data);
        navigator.serviceWorker.controller.postMessage(
            { type: 'GET_TILES_STATS' },
            [channel.port2]
        );
    }

    // ── Télécharger la zone autour du GPS actuel ─────────────────
    function downloadCurrentZone() {
        const pos = window.currentPosition;
        if (!pos) {
            showNetworkToast('📍 Attendez le signal GPS...', 'offline');
            return;
        }
        const radiusSel = document.getElementById('offline-radius-select');
        const radius = radiusSel ? parseInt(radiusSel.value) : 15;
        const nameSel = document.getElementById('offline-zone-name');
        const name = nameSel && nameSel.value.trim() ? nameSel.value.trim() : 'Ma Région';
        downloadZone(pos.lat, pos.lng, radius, name);
    }

    // ── Initialisation publique ───────────────────────────────────
    function init() {
        console.log('[OfflineMap] Initialisation...');

        // Vérifier si on démarre hors ligne
        if (!isOnline()) {
            console.log('[OfflineMap] Démarrage en mode hors ligne');
            setTimeout(switchToLeaflet, 1000);
        }

        // Pré-charger Leaflet CSS si pas déjà là
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        // Écouter les mises à jour GPS pour Leaflet
        const origUpdatePos = window.updatePositionLeaflet;
        window.updatePositionLeaflet = function(lat, lng) {
            if (isOfflineMode) updateLeafletPosition(lat, lng);
        };

        refreshZoneList();
    }

    // ── API publique ─────────────────────────────────────────────
    return {
        init,
        switchToLeaflet,
        switchToGoogleMaps,
        downloadCurrentZone,
        downloadZone,
        deleteZone,
        clearAllTiles,
        getStats,
        refreshZoneList,
        isOffline: () => isOfflineMode,
        updatePosition: updateLeafletPosition
    };

})();
