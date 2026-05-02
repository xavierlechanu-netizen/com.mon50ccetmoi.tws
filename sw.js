const CACHE_NAME = 'mon50ccetmoi-v50000.6-GOD-STABLE';
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

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell v6 (GOD STABLE)');
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
          console.log('[ServiceWorker] PURGING OLD CACHE:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if (url.pathname.endsWith('index.html') || url.pathname === '/') {
      event.respondWith(
          fetch(event.request).catch(() => caches.match(event.request))
      );
      return;
  }

  if (url.hostname.includes('google.com') || 
      url.hostname.includes('gstatic.com')) {
      return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
        }).catch(() => {
            return response || new Response('Network error', { status: 408 });
        });

        return response || fetchPromise;
      })
  );
});
