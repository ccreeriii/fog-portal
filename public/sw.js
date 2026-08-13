const CACHE_NAME = 'fog-pwa-cache-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/manifest.json',
    'https://unpkg.com/html5-qrcode',
    'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js'
];

// Install Event: Pre-cache core structural assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate Event: Cleanup old caches if version changes
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event: Network First for Data, Cache First for Static Assets
self.addEventListener('fetch', (e) => {
    // Only intercept GET requests. POST requests (mutations) are handled by our OfflineManager in app.js
    if (e.request.method !== 'GET') return;

    if (e.request.url.includes('/api/')) {
        // API Route: Network First, Fallback to Cache
        e.respondWith(
            fetch(e.request)
                .then((response) => {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, cloned));
                    return response;
                })
                .catch(() => {
                    return caches.match(e.request);
                })
        );
    } else {
        // UI & Static Assets Route: Cache First, Fallback to Network
        e.respondWith(
            caches.match(e.request, { ignoreSearch: true }).then((cached) => {
                return cached || fetch(e.request).then((response) => {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, cloned));
                    return response;
                });
            }).catch(() => {
                // Failsafe for direct navigations when offline
                if (e.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            })
        );
    }
});
