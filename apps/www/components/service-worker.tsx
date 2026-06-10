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
      navigator.serviceWorker.register(`/sw.js?v=${version}`).catch((err) => {
        console.error("Service worker registration failed:", err);
      });
    };

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
