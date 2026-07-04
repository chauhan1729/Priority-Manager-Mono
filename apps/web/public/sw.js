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
const VERSION = "v2";
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

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------

const NOTIF_ICON = "/icons/icon-192.png";
const NOTIF_BADGE = "/icons/icon-192.png";

/**
 * Renders a notification. Shared by real push events and by in-page messages
 * (the foreground path posts here because `new Notification()` is an illegal
 * constructor in installed PWAs / on Android — only showNotification() works).
 */
function showPmNotification(payload) {
  const title = payload.title || "Priority Manager";
  return self.registration.showNotification(title, {
    body: payload.body || "",
    // Same tag as the foreground path → the two never stack into a duplicate.
    tag: payload.tag || "pm-generic",
    icon: NOTIF_ICON,
    badge: NOTIF_BADGE,
    silent: Boolean(payload.silent),
    renotify: false,
    data: { url: payload.url || "/daily-plan" },
  });
}

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }
  event.waitUntil(showPmNotification(payload));
});

// Foreground page → SW bridge for showing a notification via the registration.
self.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg && msg.type === "pm-show-notification") {
    event.waitUntil(showPmNotification(msg.payload || {}));
  }
});

// Focus an existing tab (or open one) at the notification's target route.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = (event.notification.data && event.notification.data.url) || "/daily-plan";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin && "focus" in client) {
          client.navigate(targetPath);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetPath);
    }),
  );
});
