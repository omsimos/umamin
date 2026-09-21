import { useEffect } from "react";
import { toast } from "sonner";

const UPDATE_TOAST_ID = "sw-update";
const RELOAD_GUARD_KEY = "umamin:chunk-reload";

// Offers the waiting worker to the user instead of forcing it: reloading under
// someone mid-compose is worse than one more session on the old version.
function offerUpdate(registration: ServiceWorkerRegistration) {
  const waiting = registration.waiting;
  if (!waiting) return;

  toast("A new version of Umamin is ready", {
    id: UPDATE_TOAST_ID,
    duration: 12_000,
    action: {
      label: "Reload",
      onClick: () => {
        let reloaded = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          // Guarded so a first-ever install's clients.claim() (also a
          // controllerchange) never reloads a fresh visitor.
          if (reloaded) return;
          reloaded = true;
          window.location.reload();
        });
        waiting.postMessage({ type: "SKIP_WAITING" });
      },
    },
  });
}

function watchForUpdates(registration: ServiceWorkerRegistration) {
  // A worker can already be parked from an earlier load the user dismissed.
  offerUpdate(registration);

  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      // `installed` with an active controller means an UPDATE is waiting; on a
      // first install there is no controller and nothing to offer.
      if (
        installing.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        offerUpdate(registration);
      }
    });
  });
}

// A hashed chunk can 404 for a page that was open across a deploy (the old
// filename is gone from the asset manifest). Vite raises this event for a
// failed dynamic import; one reload picks up the new HTML and its chunks. The
// session guard stops a genuinely broken deploy from reload-looping.
function onPreloadError(event: Event) {
  event.preventDefault();
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {}
  window.location.reload();
}

export function ServiceWorker() {
  useEffect(() => {
    window.addEventListener("vite:preloadError", onPreloadError);
    return () =>
      window.removeEventListener("vite:preloadError", onPreloadError);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    // Version the script URL so a new release re-registers the worker, which
    // installs fresh versioned caches and purges the old ones (see sw.js).
    const version = import.meta.env.VITE_APP_VERSION ?? "dev";

    const register = () => {
      // updateViaCache:"none" so the SW script itself is never served from the
      // HTTP cache — new push/notificationclick handlers ship on every release.
      navigator.serviceWorker
        .register(`/sw.js?v=${version}`, { updateViaCache: "none" })
        .then(watchForUpdates)
        .catch((err) => {
          console.error("Service worker registration failed:", err);
        });
    };

    // Registration is deferred past `load` so it never competes with the
    // first paint's requests — but hydration can land AFTER load (slow fonts,
    // a long chunk), and a listener added then would never fire.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
