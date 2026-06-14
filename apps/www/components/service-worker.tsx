"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    // Version the script URL so a new release re-registers the worker, which
    // installs fresh versioned caches and purges the old ones (see sw.js).
    const version = process.env.NEXT_PUBLIC_VERSION ?? "dev";

    const register = () => {
      // updateViaCache:"none" so the SW script itself is never served from the
      // HTTP cache — new push/notificationclick handlers ship on every release.
      navigator.serviceWorker
        .register(`/sw.js?v=${version}`, { updateViaCache: "none" })
        .catch((err) => {
          console.error("Service worker registration failed:", err);
        });
    };

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
