const CACHE_NAME = 'mon50ccetmoi-v50.0.11-STABLE';
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
  './js/sentinel-v2.js',
  './js/ghost-rider-v2.js',
  './js/i18n.js',
  './manifest.json',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching system assets');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Purging legacy cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Strategy: Cache First, falling back to Network
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request).then((networkResponse) => {
        // Cache important dynamic assets (like Maps SDK if possible)
        if (event.request.url.includes('googleapis') || event.request.url.includes('gstatic')) {
           return networkResponse; 
        }
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      });
    }).catch(() => {
      // Offline fallback
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
