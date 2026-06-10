// Cache names are tied to the app version (registered as /sw.js?v=<version> in
// components/service-worker.tsx, read back here from self.location) so every
// release installs fresh caches and the activate handler purges the old ones.
// Without this an installed/PWA user can be stuck on stale assets after a deploy.
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const STATIC_CACHE = `umamin-static-${VERSION}`;
const PAGE_CACHE = `umamin-pages-${VERSION}`;

// Only real static files here. /manifest.webmanifest is a dynamic Next route, and
// caches.addAll() rejects the whole batch if any entry is non-OK, which would
// abort install and silently disable offline support — so it's intentionally out.
const PRECACHE_URLS = [
  "/offline.html",
  "/icon-192x192.png",
  "/icon-512x512.png",
];

// Auth-gated or per-user/per-post dynamic routes: never cache their HTML, so one
// viewer's page can't be served to another and authed content never goes stale.
const DYNAMIC_NAVIGATION_PREFIXES = [
  "/feed",
  "/groups",
  "/inbox",
  "/notes",
  "/notifications",
  "/post",
  "/settings",
  "/to",
  "/user",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
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
            .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    if (
      DYNAMIC_NAVIGATION_PREFIXES.some(
        (prefix) =>
          url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
      )
    ) {
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches
            .open(PAGE_CACHE)
            .then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/offline.html")),
        ),
    );
    return;
  }

  if (["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          const responseClone = response.clone();
          caches
            .open(STATIC_CACHE)
            .then((cache) => cache.put(request, responseClone));
          return response;
        });
      }),
    );
  }
});
