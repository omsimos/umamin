import { readFileSync } from "node:fs";
import { join } from "node:path";
import createMDX from "@next/mdx";

import type { NextConfig } from "next";

// Displayed app version comes from the top CHANGELOG entry — the same source the
// release pipeline tags from, so the navbar always matches the deployed build.
// `next build` runs with cwd=apps/www; the second path covers a root-cwd build.
function getAppVersion(): string {
  for (const path of [
    join(process.cwd(), "../../CHANGELOG.md"),
    join(process.cwd(), "CHANGELOG.md"),
  ]) {
    try {
      const match = readFileSync(path, "utf8").match(/^## \[([^\]]+)\]/m);
      if (match) return `v${match[1]}`;
    } catch {
      // try the next candidate path
    }
  }
  return "v0.0.0";
}

function buildContentSecurityPolicy() {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://pagead2.googlesyndication.com",
    "https://partner.googleadservices.com",
    "https://fundingchoicesmessages.google.com",
    "https://vercel.live",
  ];

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'self'"]],
    ["object-src", ["'none'"]],
    ["script-src", scriptSrc],
    [
      "connect-src",
      [
        "'self'",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://pagead2.googlesyndication.com",
        "https://googleads.g.doubleclick.net",
        "https://ep1.adtrafficquality.google",
        // Direct browser->R2 image uploads (presigned PUT).
        ...(process.env.R2_ACCOUNT_ID
          ? [`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`]
          : []),
      ],
    ],
    ["img-src", ["'self'", "data:", "blob:", "https:"]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["font-src", ["'self'", "data:"]],
    [
      "frame-src",
      [
        "https://www.googletagmanager.com",
        "https://googleads.g.doubleclick.net",
        "https://tpc.googlesyndication.com",
        "https://*.googlesyndication.com",
        // Embedded Spotify track players on /notes.
        "https://open.spotify.com",
      ],
    ],
    ["manifest-src", ["'self'"]],
    ["media-src", ["'self'"]],
    ["worker-src", ["'self'", "blob:"]],
  ];

  if (process.env.NODE_ENV === "production") {
    directives.push(["upgrade-insecure-requests", []]);
  }

  return directives
    .map(([name, values]) =>
      values.length > 0 ? `${name} ${values.join(" ")}` : name,
    )
    .join("; ");
}

function buildSecurityHeaders() {
  const headers = [
    {
      // Report-Only: surfaces violations in the browser console WITHOUT
      // blocking anything, so AdSense/GTM can't break (this CSP was previously
      // removed because enforcing it broke ads). Once the console stays clean,
      // rename the key to "Content-Security-Policy" to actually enforce it.
      key: "Content-Security-Policy-Report-Only",
      value: buildContentSecurityPolicy(),
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Permissions-Policy",
      value:
        "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()",
    },
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin",
    },
  ];

  if (process.env.NODE_ENV === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains; preload",
    });
  }

  return headers;
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERSION: getAppVersion(),
  },
  reactCompiler: true,
  cacheComponents: true,
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
  images: {
    remotePatterns: [new URL("https://lh3.googleusercontent.com/a/**")],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  transpilePackages: ["@umamin/db", "@umamin/encryption", "@umamin/ui"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: buildSecurityHeaders(),
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
  },
});

export default withMDX(nextConfig);
