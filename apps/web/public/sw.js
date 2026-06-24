/*
 * Priority Manager service worker.
 *
 * Plain runtime caching (no build tooling) for an installable PWA:
 *  - GET-only: never intercepts server actions / mutations (POST).
 *  - Same-origin only: Supabase and other cross-origin calls go straight to network.
 *  - Navigations: network-first, fall back to the cached page, then an offline page.
 *  - Hashed static assets (/_next/static, icons): cache-first with background refresh.
 *  - RSC payloads / everything else: network (not cached, so data never goes stale).
 *
 * Bump VERSION to invalidate old caches on the next activation.
 */
const VERSION = "v1";
const STATIC_CACHE = `pm-static-${VERSION}`;
const PAGE_CACHE = `pm-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never touch mutations (server actions) — only cache safe GETs.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Ignore Supabase and any other cross-origin requests.
  if (url.origin !== self.location.origin) return;

  // Full-page navigations: network-first → cached page → offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  // Hashed static assets: cache-first, refresh in the background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // RSC payloads, data fetches, everything else → network (kept fresh, uncached).
});
