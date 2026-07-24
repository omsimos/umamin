import type { AppEnv } from "./env";

// Security headers ported from apps/www/next.config.ts (buildSecurityHeaders /
// buildContentSecurityPolicy). Next-specific bits adapted: `vercel.live` is
// dropped (no Vercel toolbar on Workers); everything else — AdSense/GTM, the R2
// upload connect-src, and the /notes music-embed frame-src origins — is kept.
// CSP stays Report-Only (enforcing it once broke ads); flip the header name to
// "Content-Security-Policy" once the console is clean.

function buildCsp(env: AppEnv, isProd: boolean): string {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://pagead2.googlesyndication.com",
    "https://partner.googleadservices.com",
    "https://fundingchoicesmessages.google.com",
  ];

  const connectSrc = [
    "'self'",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://pagead2.googlesyndication.com",
    "https://googleads.g.doubleclick.net",
    "https://ep1.adtrafficquality.google",
  ];
  if (env.R2_ACCOUNT_ID) {
    connectSrc.push(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
  }

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'self'"]],
    ["object-src", ["'none'"]],
    ["script-src", scriptSrc],
    ["connect-src", connectSrc],
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
        // Embedded song players on /notes (see lib/music.ts).
        "https://open.spotify.com",
        "https://embed.music.apple.com",
        "https://w.soundcloud.com",
        "https://www.youtube-nocookie.com",
      ],
    ],
    ["manifest-src", ["'self'"]],
    ["media-src", ["'self'"]],
    ["worker-src", ["'self'", "blob:"]],
  ];

  if (isProd) directives.push(["upgrade-insecure-requests", []]);

  return directives
    .map(([name, values]) =>
      values.length > 0 ? `${name} ${values.join(" ")}` : name,
    )
    .join("; ");
}

export function securityHeaders(
  env: AppEnv,
  isProd = process.env.NODE_ENV === "production",
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy-Report-Only": buildCsp(env, isProd),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy":
      "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  if (isProd) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains; preload";
  }
  return headers;
}
