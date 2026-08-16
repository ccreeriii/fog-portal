const CACHE_NAME = 'fog-portal-v4';
const ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/css/v2-styles.css',
    '/css/v3-styles.css',
    '/css/v4-styles.css',
    '/js/app.js',
    '/js/v2-discipleship.js',
    '/js/v3-worship.js',
    '/js/v4-communications.js',
    '/manifest.json',
    '/img/logo.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then(keys => {
        return Promise.all(keys.map(key => {
            if(key !== CACHE_NAME) return caches.delete(key);
        }));
    }));
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // Never cache API calls
    if(e.request.method !== 'GET' || e.request.url.includes('/api/')) return;
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
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
