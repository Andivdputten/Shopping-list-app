// Bump this version string any time app.js/index.html/style.css change,
// so returning users get the new files instead of a stale cached copy.
const CACHE_VERSION = "v12";
const CACHE_NAME = `grocery-scanner-${CACHE_VERSION}`;

// Core app files: these change often during development. They're fetched
// network-first (falling back to cache only when offline) so a page load
// can never get stuck serving a stale copy just because it happened to be
// cached once — the cache here is purely an offline fallback, not a source
// of truth while online.
const CORE_FILES = ["./", "./index.html", "./app.js", "./ai.js", "./style.css"];

// Static assets: these essentially never change once created, so caching
// them aggressively (cache-first) is safe and saves a network round trip.
const STATIC_FILES = [
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js"
];

const APP_SHELL = [...CORE_FILES, ...STATIC_FILES];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use allSettled instead of addAll so one failed resource
      // (e.g. offline during install) doesn't block the whole install.
      return Promise.allSettled(
        APP_SHELL.map((url) => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "GET_VERSION") {
    event.source.postMessage({ type: "VERSION", version: CACHE_VERSION });
  }
});

function isCoreFile(url) {
  if (url.pathname.endsWith("/app.js")) return true;
  if (url.pathname.endsWith("/ai.js")) return true;
  if (url.pathname.endsWith("/style.css")) return true;
  if (url.pathname.endsWith("/index.html")) return true;
  // "./" and any path ending in "/" resolve to index.html on GitHub Pages.
  if (url.pathname.endsWith("/")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin && isCoreFile(url)) {
    // Network-first: always try to get the latest version. Only fall back
    // to the cache (so the app still works offline) if the network fails.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  if (isSameOrigin) {
    // Static assets: cache-first, falling back to network, then updating the cache.
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
    return;
  }

  // Cross-origin (e.g. Open Food Facts lookups, the qrcode script):
  // network-first so data stays fresh, falling back to cache if offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
