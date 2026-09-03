const CACHE_NAME = 'fog-portal-v5';
const SHELL_FALLBACK_URL = '/index.html';
const ESSENTIAL_SHELL_ASSETS = [
    '/index.html',
    '/css/styles.css?v=12.2',
    '/css/v2-styles.css?v=12.2',
    '/css/v3-styles.css?v=12.2',
    '/css/v4-styles.css?v=12.2',
    '/js/app.js?v=12.2',
    '/js/v2-discipleship.js?v=12.2',
    '/js/v3-worship.js?v=12.2',
    '/js/v4-communications.js?v=12.2',
    '/js/v6-gamification.js?v=12.2',
    '/js/v7-ai-assistant.js?v=12.2',
    '/js/v8-slingshot.js?v=12.2',
    '/js/v8-noahs-ark.js?v=12.2',
    '/js/v8-red-sea.js?v=12.2',
    '/js/v8-peters-leap.js?v=12.2',
    '/js/v8-jonahs-dive.js?v=12.2',
    '/js/v9-growth-games.js?v=12.2',
    '/js/v10-expansion.js?v=12.2',
    '/manifest.json',
    '/img/logo.png'
];
const ESSENTIAL_SHELL_ASSET_KEYS = new Set(ESSENTIAL_SHELL_ASSETS);

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ESSENTIAL_SHELL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key.startsWith('fog-portal-') && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

function isKnownLocalStaticAsset(url) {
    return ESSENTIAL_SHELL_ASSET_KEYS.has(url.pathname + url.search);
}

async function networkFirstNavigation(request) {
    try {
        return await fetch(request);
    } catch (error) {
        const cachedShell = await caches.match(SHELL_FALLBACK_URL);
        if (cachedShell) return cachedShell;
        return new Response('Koinonia is unavailable offline until it has been opened online once.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}

async function cacheFirstStatic(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
        try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
        } catch (error) {
            // A cache-write failure must not break an otherwise valid online response.
        }
    }
    return networkResponse;
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirstNavigation(request));
        return;
    }

    if (isKnownLocalStaticAsset(url)) {
        event.respondWith(cacheFirstStatic(request));
    }
});

// ==========================================
// PUSH NOTIFICATION BACKGROUND LISTENERS
// ==========================================

self.addEventListener('push', (e) => {
    const data = e.data ? e.data.json() : { title: 'FOG Ministries', body: 'You have a new message!' };
    
    const options = {
        body: data.body,
        icon: '/img/logo.png',
        badge: '/img/logo.png',
        vibrate: [200, 100, 200, 100, 200], // Vibrates the phone physically
        data: data.url || '/' // Stores the URL to open when clicked
    };

    e.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close(); // Close the notification popup
    
    e.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            // Check if the app is already open, if so, focus it
            for (let i = 0; i < windowClients.length; i++) {
                let client = windowClients[i];
                if (client.url === '/' && 'focus' in client) return client.focus();
            }
            // If app is closed, open a new window
            if (clients.openWindow) return clients.openWindow(e.notification.data);
        })
    );
});
