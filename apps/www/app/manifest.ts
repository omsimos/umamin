import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Stable app identity — never change this. Without it the id defaults to
    // start_url, so a future start_url change would read as a brand-new app
    // (duplicate install / broken update path) on Android/Play.
    id: "/",
    name: "Umamin",
    short_name: "Umamin",
    description:
      "Umamin is an open-source social platform for sending and receiving encrypted anonymous messages.",
    lang: "en",
    dir: "ltr",
    categories: ["social", "communication"],
    // Public, always-200 entry. /inbox is auth-only (redirects to /login) and
    // robots-disallowed, which fails PWA installability/start_url audits.
    // PwaRedirectGate forwards standalone users by auth: signed-in -> /inbox,
    // signed-out -> /login (so a TWA launch never bounces /inbox -> /login). [#35]
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192x192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512x512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Public surfaces only — auth-gated routes (e.g. /inbox, /notifications)
    // would fail the shortcut's installability/start-target audit.
    shortcuts: [
      {
        name: "Open social feed",
        short_name: "Feed",
        url: "/feed",
        icons: [
          { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
        ],
      },
      {
        name: "Read notes",
        short_name: "Notes",
        url: "/notes",
        icons: [
          { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
        ],
      },
    ],
    screenshots: [
      {
        src: "/screenshots/01-link.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "Share your link and collect anonymous messages",
      },
      {
        src: "/screenshots/02-encrypted.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "Messages are encrypted in your sealed inbox",
      },
      {
        src: "/screenshots/04-groups.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "Join groups and members-only group chat",
      },
    ],
  };
}
