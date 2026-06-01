const CACHE_NAME = 'mon50cc-cache-v70003';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/premium.css',
  '/js/config.js',
  '/js/infallible.js',
  '/js/crypto-native.js',
  '/js/app-core.js',
  '/js/app-map.js',
  '/js/app-ui.js',
  '/js/app-features.js',
  '/js/app-wallet.js',
  '/js/app-garage.js',
  '/js/i18n.js',
  '/js/auth.js',
  '/js/database.js'
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
