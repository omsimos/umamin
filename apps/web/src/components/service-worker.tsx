import { useEffect } from "react";
import { toast } from "sonner";
import { reloadPage } from "@/lib/reload-page";

const UPDATE_TOAST_ID = "sw-update";
const RELOAD_GUARD_KEY = "umamin:chunk-reload";
const UPDATE_RELOAD_KEY = "umamin:sw-update-reload";

// idle: nothing to offer. waiting: an update is ready but not on screen
// (never offered, or the toast was dismissed). offered: the toast is up.
// activating: this tab asked the waiting worker to take over. reloading: done.
type UpdatePhase = "idle" | "waiting" | "offered" | "activating" | "reloading";

// Offers the waiting worker to the user instead of forcing it: reloading under
// someone mid-compose is worse than one more session on the old version.
// One instance per tab. The controllerchange listener goes on up front, because
// any open tab can activate the update, and that purges the caches every
// other tab was loaded from.
function createUpdateFlow(sw: ServiceWorkerContainer) {
  let phase: UpdatePhase = "idle";
  let registration: ServiceWorkerRegistration | null = null;
  // A first-ever install's clients.claim() is also a controllerchange; only a
  // change away from an existing controller is an update.
  let hadController = !!sw.controller;
  // Another tab already activated the update under this page, so Reload only
  // has to reload.
  let takenOver = false;

  const reload = () => {
    if (phase === "reloading") return;
    phase = "reloading";
    reloadPage();
  };

  const backToWaiting = () => {
    if (phase === "offered") phase = "waiting";
  };

  const activate = () => {
    const waiting = registration?.waiting;
    if (takenOver || !waiting) {
      reload();
      return;
    }
    phase = "activating";
    waiting.addEventListener("statechange", () => {
      // A newer deploy replaced it before it could take over: offer that one.
      if (waiting.state === "redundant" && phase === "activating") {
        phase = "waiting";
        offer();
      }
    });
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  const offer = () => {
    if (phase === "offered" || phase === "activating" || phase === "reloading")
      return;
    if (!takenOver && !registration?.waiting) return;
    phase = "offered";
    toast("A new version of Umamin is ready", {
      id: UPDATE_TOAST_ID,
      duration: 12_000,
      action: { label: "Reload", onClick: activate },
      onDismiss: backToWaiting,
      onAutoClose: backToWaiting,
    });
  };

  const onControllerChange = () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (phase === "reloading") return;
    if (phase === "activating" && !reloadedForUpdateRecently()) {
      reload();
      return;
    }
    // Activated from another tab (or a reload just happened and this one would
    // loop). Replace any toast whose Reload would post to a worker that is no
    // longer waiting.
    takenOver = true;
    phase = "waiting";
    offer();
  };

  // A toast dismissed earlier comes back when the user returns to the tab.
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible" && phase === "waiting") offer();
  };

  const watch = (reg: ServiceWorkerRegistration) => {
    registration = reg;
    // A worker can already be parked from an earlier load the user dismissed.
    if (reg.waiting && phase === "idle") phase = "waiting";
    offer();

    reg.addEventListener("updatefound", () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        // `installed` with an active controller means an UPDATE is waiting; on
        // a first install there is no controller and nothing to offer.
        if (installing.state === "installed" && sw.controller) {
          if (phase === "idle" || phase === "offered") phase = "waiting";
          offer();
        }
      });
    });
  };

  sw.addEventListener("controllerchange", onControllerChange);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return {
    watch,
    stop: () => {
      sw.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}

// Records this reload and reports whether one already happened in the last few
// seconds, so a worker that keeps changing hands can't reload-loop a tab.
function reloadedForUpdateRecently() {
  try {
    const last = Number(sessionStorage.getItem(UPDATE_RELOAD_KEY) ?? 0);
    if (Date.now() - last < 10_000) return true;
    sessionStorage.setItem(UPDATE_RELOAD_KEY, String(Date.now()));
  } catch {}
  return false;
}

// A hashed chunk can 404 for a page that was open across a deploy (the old
// filename is gone from the asset manifest). Vite raises this event for a
// failed dynamic import; one reload picks up the new HTML and its chunks. The
// session guard stops a genuinely broken deploy from reload-looping.
//
// Never preventDefault here: Vite then resolves the import to undefined, and
// lazyRouteComponent crashes reading `default` off it. Inside the guard window
// nothing reloads, so the original error has to reach the route's error UI.
function onPreloadError() {
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

    const flow = createUpdateFlow(navigator.serviceWorker);

    // Version the script URL so a new release re-registers the worker, which
    // installs fresh versioned caches and purges the old ones (see sw.js).
    const version = import.meta.env.VITE_APP_VERSION ?? "dev";

    const register = () => {
      // updateViaCache:"none" so the SW script itself is never served from the
      // HTTP cache — new push/notificationclick handlers ship on every release.
      navigator.serviceWorker
        .register(`/sw.js?v=${version}`, { updateViaCache: "none" })
        .then(flow.watch)
        .catch((err) => {
          console.error("Service worker registration failed:", err);
        });
    };

    // Registration is deferred past `load` so it never competes with the
    // first paint's requests — but hydration can land AFTER load (slow fonts,
    // a long chunk), and a listener added then would never fire.
    if (document.readyState === "complete") {
      register();
      return flow.stop;
    }
    window.addEventListener("load", register, { once: true });
    return () => {
      window.removeEventListener("load", register);
      flow.stop();
    };
  }, []);

  return null;
}
