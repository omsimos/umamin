import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Umamin",
    short_name: "Umamin",
    description:
      "Umamin is an open-source social platform for sending and receiving encrypted anonymous messages.",
    // Public, always-200 entry. /inbox is auth-only (redirects to /login) and
    // robots-disallowed, which fails PWA installability/start_url audits.
    // PwaRedirect still forwards authenticated standalone users to /inbox. [#35]
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
