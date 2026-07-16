const CACHE_NAME = 'mon50cc-cache-v1008002';
const urlsToCache = [
  '/',
  '/index.html?v=1008002',
  '/app.html?v=1008002',
  '/offline.html',
  '/css/premium.css?v=1008002',
  '/css/style.min.css?v=1008002',
  '/js/config.js?v=1008002',
  '/js/infallible.js?v=1008002',
  '/js/error-tracking.js?v=1008002',
  '/js/oracle-voice.js?v=1008002',
  '/js/crypto-native.js?v=1008002',
  '/js/auth.js?v=1008002',
  '/js/database.js?v=1008002',
  '/js/mon50cc-bundle.js'
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
