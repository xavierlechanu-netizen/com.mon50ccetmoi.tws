const CACHE_NAME = 'mon50cc-cache-v1008001';
const urlsToCache = [
  '/',
  '/index.html?v=80000',
  '/app.html?v=80000',
  '/offline.html',
  '/css/premium.css?v=80000',
  '/css/style.css?v=80000',
  '/js/config.js?v=80000',
  '/js/infallible.js?v=80000',
  '/js/crypto-native.js?v=80000',
  '/js/app-core.js?v=80000',
  '/js/app-map.js?v=80000',
  '/js/app-ui.js?v=80000',
  '/js/app-features.js?v=80000',
  '/js/app-wallet.js?v=80000',
  '/js/app-garage.js?v=80000',
  '/js/i18n.js?v=80000',
  '/js/auth.js?v=80000',
  '/js/database.js?v=80000',
  '/js/silicon-valley.js?v=80000',
  '/js/obd-bluetooth.js?v=80000'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Cache each URL individually so one failure doesn't break everything
        return Promise.allSettled(
          urlsToCache.map(url => cache.add(url).catch(err => {
            console.warn('[SW] Failed to cache:', url, err.message || err);
          }))
        );
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
                   .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;
  
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // Mettre à jour le cache silencieusement en arrière-plan
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
      });
      
      // Retourner la version en cache immédiatement (instantané),
      // ou attendre le réseau si non mis en cache
      return cachedResponse || fetchPromise;
    })
  );
});
