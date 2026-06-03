const CACHE_NAME = 'mon50cc-cache-v70005';
const urlsToCache = [
  '/',
  '/index.html?v=70008',
  '/css/premium.css?v=70008',
  '/css/style.css?v=70008',
  '/js/config.js?v=70008',
  '/js/infallible.js?v=70008',
  '/js/crypto-native.js?v=70008',
  '/js/app-core.js?v=70008',
  '/js/app-map.js?v=70008',
  '/js/app-ui.js?v=70008',
  '/js/app-features.js?v=70008',
  '/js/app-wallet.js?v=70008',
  '/js/app-garage.js?v=70008',
  '/js/i18n.js?v=70008',
  '/js/auth.js?v=70008',
  '/js/database.js?v=70008'
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
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Offline fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
