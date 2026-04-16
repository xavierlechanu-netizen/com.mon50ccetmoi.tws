const CACHE_NAME = 'mon50ccetmoi-v11.0-ULTRA-PRO';
const ASSETS = [
  './',
  './index.html',
  './login.html',
  './style.css',
  './app_v7.js',
  './auth.js',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  './screenshot_gps.jpg',
  './screenshot_garage.jpg',
  './screenshot_wide.jpg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(ASSETS);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Ignorer les requêtes vers les API (Météo, Nominatim, Overpass) pour ne pas mettre en cache des erreurs ou des données périmées
  if (event.request.url.includes('api.open-meteo.com') || 
      event.request.url.includes('nominatim.openstreetmap.org') ||
      event.request.url.includes('overpass-api.de')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache-First pour les assets statiques, Network-Fallback
        // Mais on lance aussi un fetch en arrière-plan pour mettre à jour le cache (Stale-While-Revalidate)
        const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
        }).catch(() => null);

        return response || fetchPromise;
      }).catch(() => {
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      })
  );
});
