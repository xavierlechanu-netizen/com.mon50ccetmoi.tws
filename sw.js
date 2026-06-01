const CACHE_NAME = 'mon50cc-cache-v70000';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/premium.css',
  '/js/config.js',
  '/js/infallible.js',
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
            console.warn('[SW] Failed to cache:', url, err);
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
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
