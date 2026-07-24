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
import { Providers } from "@/components/providers";
import { AD_CLIENT } from "@/lib/ad-placements";
import { getGtmInlineScript } from "@/lib/gtm";
import appCss from "../styles.css?url";

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
      { title: "Umamin — The Platform for Anonymity" },
      {
        name: "description",
        content:
          "Umamin is an open-source social platform for sending and receiving encrypted anonymous messages. Ensure your privacy and share your thoughts freely without revealing your identity.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-icon.png" },
      { rel: "icon", href: "/icon.png", type: "image/png" },
    ],
    scripts: [
      // Pre-paint theme application (before React hydrates).
      { children: THEME_FOUC_SCRIPT },
      // GTM loader + AdSense — production only (mirrors apps/www root layout).
      ...(import.meta.env.PROD && GTM_ID
        ? [{ id: "gtm-loader", children: getGtmInlineScript(GTM_ID) }]
        : []),
      ...(import.meta.env.PROD
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
  component: RootDocument,
});

function RootDocument() {
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
        <Providers>
          <Outlet />
        </Providers>
        <Scripts />
      </body>
    </html>
  );
}
