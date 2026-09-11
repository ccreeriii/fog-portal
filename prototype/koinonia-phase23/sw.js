/**
 * KOINONIA — PHASE 0.22.1 SERVICE WORKER
 * PWA Offline Caching & Shell Management
 */

const CACHE_NAME = "koinonia-v0.22.1-r5";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles.css?v=0.22.1-r5",
  "./game.js",
  "./game.js?v=0.22.1-r5",
  "./manifest.json",
  "./assets/branding/favicon.ico",
  "./assets/branding/favicon-32x32.png",
  "./assets/branding/apple-touch-icon.png",
  "./assets/branding/icon-192.png",
  "./assets/branding/icon-512.png",
  "./assets/branding/icon-maskable-512.png",
  "./assets/branding/koinonia-header-logo.png",
  "./assets/branding/koinonia-logo-banner.png",
  "./data/shared_core.js?v=0.22.1-r5",
  "./data/remote_shared_core.js?v=0.22.1-r5",
  "./data/shared_core_provider.js?v=0.22.1-r5",
  "./data/places.js?v=0.22.1-r5",
  "./data/quests.js?v=0.22.1-r5",
  "./data/progression.js?v=0.22.1-r5",
  "./data/campaigns.js?v=0.22.1-r5",
  "./data/events.js?v=0.22.1-r5",
  "./data/memories.js?v=0.22.1-r5",
  "./data/sports.js?v=0.22.1-r5",
  "./data/circles.js?v=0.22.1-r5",
  "./data/campfires.js?v=0.22.1-r5",
  "./data/arcade.js?v=0.22.1-r5",
  "./data/presence_client.js?v=0.22.1-r5",
  "./data/studio_engine.js?v=0.22.1-r5",
  "./data/beta_identity.js?v=0.22.1-r5"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn("SW: Non-fatal caching warning during install:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET requests
  if (req.method !== "GET") return;

  // Never cache WebSocket, health, or API requests
  if (url.pathname === "/realtime" || url.pathname === "/health" || url.pathname.startsWith("/api/")) {
    return;
  }

  // HTML navigation requests: Network first, fall back to cached index
  if (req.mode === "navigate" || (req.headers.get("accept") && req.headers.get("accept").includes("text/html"))) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      }).catch(() => {
        return caches.match("./index.html") || caches.match("./");
      })
    );
    return;
  }

  // Static assets: Cache first, fallback to network
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkRes));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      });
    })
  );
});
