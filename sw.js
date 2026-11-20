// Bump this version on every release. It is required whenever a cache-first file
// (icons, manifest.json, vendor/) changes, because returning users otherwise keep the old copy;
// bumping also deletes old caches. Network-first core files (see CORE_FILES) update without it.
const CACHE_VERSION = "v32";
const CACHE_NAME = `grocery-scanner-${CACHE_VERSION}`;

// Core app files: these change often during development. They're fetched
// network-first (falling back to cache only when offline) so a page load
// can never get stuck serving a stale copy just because it happened to be
// cached once — the cache here is purely an offline fallback, not a source
// of truth while online.
const CORE_FILES = [
  "./",
  "./index.html",
  "./sw-register.js",
  "./style.css",
  "./js/ai-recipes.js",
  "./js/camera.js",
  "./js/constants.js",
  "./js/cook-dialog.js",
  "./js/cooking.js",
  "./js/dom.js",
  "./js/fit-badge.js",
  "./js/food-search.js",
  "./js/format.js",
  "./js/help-text.js",
  "./js/intake.js",
  "./js/item-form.js",
  "./js/info-dialogs.js",
  "./js/items.js",
  "./js/log-product.js",
  "./js/nevo-settings.js",
  "./js/nevo.js",
  "./js/main.js",
  "./js/nutrition.js",
  "./js/pantry-nutrition.js",
  "./js/pantry-scanner.js",
  "./js/pantry.js",
  "./js/persistence.js",
  "./js/product-lookup.js",
  "./js/recipe-ai.js",
  "./js/recipe-builder.js",
  "./js/recipe-ui-text.js",
  "./js/release-notes.js",
  "./js/saved-recipes.js",
  "./js/scanner.js",
  "./js/settings.js",
  "./js/shopping-list.js",
  "./js/state.js",
  "./js/statistics.js",
  "./js/storage.js",
  "./js/tabs.js",
  "./js/targets-settings.js",
  "./js/targets.js",
  "./js/today.js",
  "./js/week-chart.js",
  "./js/xlsx-reader.js",
  "./js/ui.js"
];

// Static assets: these essentially never change once created, so caching
// them aggressively (cache-first) is safe and saves a network round trip.
const STATIC_FILES = [
  "./manifest.json",
  "./Icons/icon-192.png",
  "./Icons/icon-512.png",
  "./Icons/icon-maskable-192.png",
  "./Icons/icon-maskable-512.png",
  "./Icons/apple-touch-icon.png",
  // Self-hosted copy of the scanner library (was loaded from a CDN).
  // Serving it from our own origin removes the third-party script that could read the stored API key.
  "./vendor/html5-qrcode/html5-qrcode.min.js"
];

const APP_SHELL = [...CORE_FILES, ...STATIC_FILES];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use allSettled instead of addAll so one failed resource
      // (e.g. offline during install) doesn't block the whole install.
      return Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
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
  // All of the app's own scripts (including the js/ modules) change together, so they are all network-first.
  // Third-party code in vendor/ never changes for a given version and stays cache-first.
  if (url.pathname.endsWith(".js") && !url.pathname.includes("/vendor/")) return true;
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
          // Only cache successful responses, so a temporary 404/500 can't overwrite the good offline copy.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
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
          // Same rule as above: never store error responses in the cache.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Cross-origin requests (Open Food Facts, the AI API) pass straight to the network without caching.
  // js/persistence.js already keeps its own bounded barcode cache, so caching them here only grew Cache Storage without limit.
});
