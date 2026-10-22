// 6C Distribution Service Worker
const CACHE_NAME = '6c-distribution-cache-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/badge-72x72.png',
  '/apple-touch-icon.png',
];

// Install: precache core shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Core precache partial failure:', err);
      });
    })
  );
});

// Activate: clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      }),
    ])
  );
});

// Fetch: Stale-while-revalidate for static assets, network-first for navigation
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension, internal schemes, or API mutations
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // NEVER cache Vite dev server requests, node_modules, HMR, or hashed dynamic imports
  const isViteDev =
    url.pathname.includes('/node_modules/') ||
    url.pathname.includes('/@vite/') ||
    url.pathname.includes('/@id/') ||
    url.pathname.includes('/src/') ||
    url.searchParams.has('v') ||
    url.searchParams.has('t') ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1';

  if (isViteDev) {
    return;
  }

  // Handle SPA Navigation requests (HTML documents)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html').then((cachedIndex) => {
          return (
            cachedIndex ||
            new Response(
              '<!doctype html><html><body><h2>6C Distribution Hors-ligne</h2><p>Application disponible hors-ligne. Rebranchez le réseau pour la synchronisation complète.</p></body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            )
          );
        });
      })
    );
    return;
  }

  // For production static assets (JS, CSS, fonts, images), use Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default: pass through to network
});

// Push Notifications
self.addEventListener('push', (event) => {
  let data = { title: '6C DMS', body: 'Nouvelle notification' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || data.message || 'Notification 6C DMS',
    icon: data.icon || '/pwa-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || '6c-dms-alert',
    renotify: true,
    data: {
      url: data.url || '/',
      ...data,
    },
    actions: [
      { action: 'open', title: 'Consulter' },
      { action: 'close', title: 'Fermer' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title || '6C DMS', options));
});

// Handle notification click on phone/desktop
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle message from React client (e.g., triggering a native phone notification)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title || '6C DMS', {
      icon: '/pwa-192x192.png',
      badge: '/badge-72x72.png',
      vibrate: [200, 100, 200],
      ...options,
    });
  }
});
