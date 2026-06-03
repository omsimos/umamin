import type { AnyRouter } from "@tanstack/react-router";

const GTM_ID = import.meta.env.VITE_GTM_ID as string | undefined;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function gtmEnabled(): boolean {
  if (!GTM_ID) return false;
  if (!import.meta.env.PROD) return false;
  if (typeof window === "undefined") return false;
  return !window.location.hostname.includes("localhost");
}

// GTM's loader fires the first page_view on container load; SPA route changes
// don't reload the page, so each navigation is pushed to the dataLayer.
export function initAnalytics(router: AnyRouter): void {
  if (!gtmEnabled()) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);

  router.subscribe("onResolved", ({ toLocation }) => {
    window.dataLayer?.push({
      event: "page_view",
      page_path: toLocation.pathname,
      page_location: toLocation.href,
    });
  });
}
