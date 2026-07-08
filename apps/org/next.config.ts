import type { NextConfig } from "next";

// Lean CSP — no ad/analytics/embed origins (this app has none). 'unsafe-inline'
// stays (next-themes' FOUC script + React hydration are inline; no XSS surface
// since all user content renders as React text, never dangerouslySetInnerHTML);
// 'unsafe-eval' is dev-only (Turbopack HMR). Enforced in prod (see header key).
function buildContentSecurityPolicy() {
  const isProd = process.env.NODE_ENV === "production";

  const scriptSrc = ["'self'", "'unsafe-inline'", "https://vercel.live"];
  if (!isProd) scriptSrc.push("'unsafe-eval'");

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'self'"]],
    ["object-src", ["'none'"]],
    ["script-src", scriptSrc],
    ["connect-src", ["'self'"]],
    ["img-src", ["'self'", "data:", "blob:", "https:"]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["font-src", ["'self'", "data:"]],
    ["manifest-src", ["'self'"]],
    ["media-src", ["'self'"]],
    ["worker-src", ["'self'", "blob:"]],
  ];

  if (isProd) {
    directives.push(["upgrade-insecure-requests", []]);
  }

  return directives
    .map(([name, values]) =>
      values.length > 0 ? `${name} ${values.join(" ")}` : name,
    )
    .join("; ");
}

function buildSecurityHeaders() {
  const isProd = process.env.NODE_ENV === "production";
  const headers = [
    {
      // Enforced in prod; Report-Only in dev so Turbopack HMR isn't blocked.
      key: isProd
        ? "Content-Security-Policy"
        : "Content-Security-Policy-Report-Only",
      value: buildContentSecurityPolicy(),
    },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    {
      key: "Permissions-Policy",
      value:
        "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
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
  reactCompiler: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  transpilePackages: ["@umamin/org-db", "@umamin/encryption", "@umamin/ui"],
  async headers() {
    return [{ source: "/(.*)", headers: buildSecurityHeaders() }];
  },
};

export default nextConfig;
