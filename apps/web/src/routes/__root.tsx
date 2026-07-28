import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
// Self-hosted variable fonts (replaces next/font/google). Explicit `.css`
// subpaths satisfy TS 6's noUncheckedSideEffectImports (vite/client types
// `*.css`); the family names map to --font-* in styles.css.
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";
import "@fontsource-variable/bricolage-grotesque/index.css";
import type { ReactNode } from "react";
import { NotFoundPage } from "@/components/not-found-page";
import { Providers } from "@/components/providers";
import { RouteSegmentError } from "@/components/route-segment-error";
import { AD_CLIENT, ADS_ENABLED } from "@/lib/ad-placements";
import { getGtmInlineScript } from "@/lib/gtm";
import { appleSplashLinks, pageSeo } from "@/lib/seo";
import appCss from "../styles.css?url";

const SITE_DESCRIPTION =
  "Umamin is an open-source social platform for sending and receiving encrypted anonymous messages. Ensure your privacy and share your thoughts freely without revealing your identity.";

interface RouterContext {
  queryClient: QueryClient;
}

const GTM_ID = import.meta.env.VITE_GTM_ID;

// Mirrors next-themes' pre-paint script (attribute="class", defaultTheme
// "system", enableSystem, storageKey "theme") so the first paint matches the
// stored/system theme — no flash of the wrong theme before hydration.
const THEME_FOUC_SCRIPT = `(function(){try{var s=localStorage.getItem('theme')||'system';var m=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var t=s==='system'?m:s;var e=document.documentElement;e.classList.toggle('dark',t==='dark');e.style.colorScheme=t;}catch(e){}})();`;

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "theme-color", content: "black" },
      { name: "author", content: "Omsimos Collective" },
      // iOS standalone: without these the installed PWA renders as a plain web
      // view (opaque status bar, no app title) — ported from apps/www appleWebApp.
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Umamin" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      // Site-wide defaults. Meta is deduped by name/property with the DEEPEST
      // route winning, so any page's own head() overrides these (no canonical
      // here on purpose — links stack rather than dedupe).
      ...pageSeo({
        title: "Umamin — The Platform for Anonymity",
        description: SITE_DESCRIPTION,
        robots:
          "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      }).meta,
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-icon.png" },
      { rel: "icon", href: "/icon.png", type: "image/png" },
      ...appleSplashLinks,
    ],
    scripts: [
      // Pre-paint theme application (before React hydrates).
      { children: THEME_FOUC_SCRIPT },
      // GTM loader + AdSense — production only (mirrors apps/www root layout).
      ...(import.meta.env.PROD && GTM_ID
        ? [{ id: "gtm-loader", children: getGtmInlineScript(GTM_ID) }]
        : []),
      // Skipped entirely when VITE_ADS_ENABLED=false — the point of the switch
      // is that the third-party loader is never requested, not just that the
      // slots render empty.
      ...(import.meta.env.PROD && ADS_ENABLED
        ? [
            {
              async: true,
              crossOrigin: "anonymous" as const,
              src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`,
            },
          ]
        : []),
    ],
  }),
  // The document lives in `shellComponent` (not `component`) because the shell
  // wraps the root's component AND its errorComponent/notFoundComponent — with
  // the document in `component`, an unmatched URL or an uncaught error would
  // render the fallback IN PLACE of <html>/<body>.
  shellComponent: RootDocument,
  component: () => <Outlet />,
  errorComponent: (props) => <RouteSegmentError {...props} />,
  notFoundComponent: () => <NotFoundPage />,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        {import.meta.env.PROD && GTM_ID ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        ) : null}
        <Providers>{children}</Providers>
        <Scripts />
      </body>
    </html>
  );
}
