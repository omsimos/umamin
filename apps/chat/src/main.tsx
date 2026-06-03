import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/geist";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouteError } from "./components/route-error";
import "./index.css";
import { AD_CLIENT, adsEnabled } from "./lib/ad-placements";
import { routeTree } from "./routeTree.gen";

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  // Catch render/load crashes on any route instead of white-screening.
  defaultErrorComponent: RouteError,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

// Load AdSense once in production (no-ops in dev/test/localhost). Mirrors the
// production-only loader apps/www puts in its root layout.
if (adsEnabled()) {
  const adScript = document.createElement("script");
  adScript.async = true;
  adScript.crossOrigin = "anonymous";
  adScript.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
  document.head.appendChild(adScript);
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
