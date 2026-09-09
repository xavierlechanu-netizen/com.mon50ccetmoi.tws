const CACHE_NAME = 'mon50cc-cache-v1110000';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/css/design-system.css',
  '/js/esg-telemetry.js',
  '/js/mon50cc-bundle.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Cache initial des ressources critiques
        return Promise.allSettled(
          STATIC_ASSETS.map(url => cache.add(url).catch(err => {
            console.warn('[SW] Failed to cache:', url, err);
          }))
        );
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
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
  // Ignorer les requêtes non-GET et les requêtes cross-origin non prévues
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);

  // Stratégie 1 : Network-First pour les pages HTML (Navigation)
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Si le réseau répond, on met à jour le cache et on retourne la réponse
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Si le réseau échoue (hors ligne), on cherche dans le cache
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            // Si pas dans le cache, on affiche la page hors ligne
            return caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // Stratégie 2 : Cache-First pour les assets statiques (CSS, JS, Images, Fonts)
  const isStaticAsset = url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|woff2|webp)$/i);
  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;

        // Si absent du cache, on va le chercher sur le réseau et on le cache
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(err => {
          console.warn('[SW] Fetch statique échoué en mode hors-ligne:', event.request.url);
          throw err;
        });
      })
    );
    return;
  }

  // Fallback global : Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(err => {
        if (cachedResponse) return cachedResponse;
        throw err;
      });
      return cachedResponse || fetchPromise;
    })
  );
});
