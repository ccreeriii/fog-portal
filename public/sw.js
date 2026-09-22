const CACHE_NAME = 'fog-portal-v78';
const SHELL_FALLBACK_URL = '/index.html';
const ESSENTIAL_SHELL_ASSETS = [
    '/index.html',
    '/css/styles.css?v=12.2',
    '/css/v2-styles.css?v=12.2',
    '/css/v3-styles.css?v=12.2',
    '/css/v4-styles.css?v=12.2',
    '/css/community-spotlight-admin.css?v=1',
    '/css/community-spotlight-member.css?v=2',
    '/css/journey-dashboard.css?v=4',
    '/css/member-transition-intake.css?v=1',
    '/css/member-transition-journey.css?v=2',
    '/css/member-transition-leadership.css?v=1',
    '/css/ministry-discernment-leadership.css?v=1',
    '/css/community-features.css?v=3',
    '/css/fog-premium.css?v=17',
    '/css/games-phase2.css?v=1',
    '/css/journal-premium.css?v=1',
    '/css/journal-guardian-guest.css',
    '/js/offline-data.js?v=12.2',
    '/js/app.js?v=13.6',
    '/js/growth-event-mapping-ui.js?v=3',
    '/js/growth-journey-leadership.js?v=3',
    '/js/watchtower.js?v=2',
    '/js/prayer-covenant-monitor.js?v=4',
    '/js/v2-discipleship.js?v=12.4',
    '/js/v3-worship.js?v=12.2',
    '/js/v4-communications.js?v=12.3',
    '/js/community-spotlight-admin.js?v=4',
    '/js/community-spotlight-member.js?v=3',
    '/js/v6-gamification.js?v=12.3',
    '/js/v7-ai-assistant.js?v=12.2',
    '/js/v8-slingshot.js?v=13.0',
    '/js/v8-noahs-ark.js?v=13.0',
    '/js/v8-red-sea.js?v=13.0',
    '/js/v8-peters-leap.js?v=13.0',
    '/js/v8-jonahs-dive.js?v=13.0',
    '/js/v9-growth-games.js?v=13.0',
    '/js/v10-expansion.js?v=13.0',
    '/js/member-transition-intake.js?v=4',
    '/js/member-transition-journey.js?v=2',
    '/js/member-transition-leadership.js?v=1',
    '/js/ministry-discernment-leadership.js?v=2',
    '/js/journey-dashboard.js?v=9',
    '/js/postlaunch-hotfix.js?v=6',
    '/js/community-feature-polish.js?v=7',
    '/js/journal-crypto.js?v=1',
    '/js/journal-guardian-ui.js?v=1',
    '/js/journal-secure-controller.js?v=1',
    '/js/journal-premium-ui.js?v=1',
    '/js/journal-policy-admin.js?v=1',
    '/js/journal-guardian-guest.js',
    '/journal-guardian.html',
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
    if (url.pathname === '/reset-password' || url.pathname.startsWith('/reset-password/')) return;
    if (url.pathname === '/verify-email' || url.pathname.startsWith('/verify-email/')) return;
    if (url.pathname === '/claim' || url.pathname.startsWith('/claim/')) return;
    if (url.pathname === '/recover-account' || url.pathname.startsWith('/recover-account/')) return;
    if (url.pathname === '/js/claim.js' || url.pathname === '/css/claim.css') return;
    if (url.pathname === '/js/account-recovery.js') return;

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
