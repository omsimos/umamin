// Cache names are tied to the app version (registered as /sw.js?v=<version> in
// components/service-worker.tsx, read back here from self.location) so every
// release installs fresh caches and the activate handler purges the old ones.
// Without this an installed/PWA user can be stuck on stale assets after a deploy.
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const STATIC_CACHE = `umamin-static-${VERSION}`;
// v2: entries cached under the old denylist (which let private pages in) are
// purged on activate.
const PAGE_CACHE = `umamin-pages-v2-${VERSION}`;
const OFFLINE_URL = "/offline.html";

// Only real static files here. caches.addAll() rejects the whole batch if any
// entry is non-OK, which would abort install and silently disable offline
// support — keep this list to files guaranteed present in public/.
const PRECACHE_URLS = [OFFLINE_URL, "/icon-192x192.png", "/icon-512x512.png"];

// Only these static public pages may be stored for offline use. Everything
// else (private, per-viewer, flag-gated or redirecting pages) goes to the
// network and falls back to the offline page, so a new route is never cached
// by default. Exact paths only: their HTML carries no viewer data.
const CACHEABLE_NAVIGATION_PATHS = new Set([
  "/",
  "/about",
  "/changelog",
  "/login",
  "/register",
  "/terms",
  "/privacy",
  "/child-safety",
]);

// Only a real, same-origin success may be stored. A 404 for a hashed chunk
// (a request landing mid-deploy) or a 500 page would otherwise be pinned for
// the whole version: the static branch is cache-first and never revalidates.
function isCacheable(response) {
  return response.ok && response.type === "basic";
}

function isCacheableNavigation(pathname) {
  return CACHEABLE_NAVIGATION_PATHS.has(pathname);
}

// No skipWaiting() here: a new worker waits until the page opts in (the
// "update available" toast posts SKIP_WAITING below). Taking over mid-session
// would purge the running version's caches under an open page.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
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

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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
    if (!isCacheableNavigation(url.pathname)) {
      event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          // A redirected navigation would store another page's HTML under
          // this URL.
          if (isCacheable(response) && !response.redirected) {
            const responseClone = response.clone();
            event.waitUntil(
              caches
                .open(PAGE_CACHE)
                .then((cache) => cache.put(request, responseClone)),
            );
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL)),
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
          if (isCacheable(response)) {
            const responseClone = response.clone();
            event.waitUntil(
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put(request, responseClone)),
            );
          }
          return response;
        });
      }),
    );
  }
});

// Web Push. Payloads are generic, type-derived strings (server-lib/push.ts) —
// never message content.
self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }
  if (!data?.title) {
    return;
  }

  // Title-only by design: payloads never carry message content (privacy).
  event.waitUntil(
    self.registration.showNotification(data.title, {
      icon: "/icon-192x192.png",
      badge: "/icon-192x192-maskable.png",
      data: { url: data.url || "/feed" },
      tag: data.tag,
      renotify: Boolean(data.tag),
    }),
  );
});

// Reuse the open app window (navigate it in place) rather than stacking a
// second one per tapped notification; a fresh window only when none is open.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/feed";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const target = new URL(url, self.location.origin).href;
        const exact = clientList.find((client) => client.url === target);
        if (exact) {
          return exact.focus();
        }
        const [client] = clientList;
        if (client && "navigate" in client) {
          return client
            .focus()
            .then(() => client.navigate(target))
            .catch(() => self.clients.openWindow(target));
        }
        return self.clients.openWindow(target);
      }),
  );
});
