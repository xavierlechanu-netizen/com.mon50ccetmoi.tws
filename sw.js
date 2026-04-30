const CACHE_NAME = 'mon50ccetmoi-v50000.0-GOD-VIEW';
const ASSETS = [
  './',
  './index.html',
  './login.html',
  './css/style.css',
  './js/config.js',
  './js/app.js',
  './js/auth.js',
  './js/crypto-js.min.js',
  './js/neural-hud.js',
  './js/wallet.js',
  './js/blackbox.js',
  './js/guardian-angel.js',
  './js/sentinel.js',
  './js/i18n.js',
  './manifest.json',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css'
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
  // Sanitize and check hostname for external APIs
  try {
      const url = new URL(event.request.url);
      if (['api.open-meteo.com', 'nominatim.openstreetmap.org', 'overpass-api.de'].includes(url.hostname)) {
          return;
      }
  } catch(e) { /* Invalid URL */ }

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
