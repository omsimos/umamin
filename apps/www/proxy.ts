import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  LEGACY_SESSION_COOKIE_NAME,
  readCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_RENEWED_COOKIE_NAME,
} from "./lib/cookies";
import { extractClientIp } from "./lib/ip";
import { isIpDenied } from "./lib/server/ip-denylist";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
// Only re-slide the session cookie's browser lifetime once per interval instead
// of on every GET — the session's 30-day window means a weekly refresh keeps it
// comfortably alive while dropping the Set-Cookie header from ~all authed
// navigations. The server-side session record slides independently in
// validateSessionToken.
const SESSION_RENEW_INTERVAL_MS = 1000 * 60 * 60 * 24 * 7;

// True when the session cookie is due for a browser-lifetime refresh: no
// renewal marker yet (fresh login / cleared marker → self-heals by renewing) or
// the last refresh is older than the interval.
function shouldRenewSession(request: NextRequest): boolean {
  const marker = request.cookies.get(SESSION_RENEWED_COOKIE_NAME)?.value;
  const renewedAt = marker ? Number(marker) : 0;
  if (!Number.isFinite(renewedAt) || renewedAt <= 0) {
    return true;
  }
  return Date.now() - renewedAt >= SESSION_RENEW_INTERVAL_MS;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Front-door IP denylist for all non-API traffic (the matcher excludes /api;
  // API mutations are covered by withAction). In-process-cached SET; no-ops
  // without Redis. NOTE: per-IP, so it blocks shared egress IPs (CGNAT) too.
  if (await isIpDenied(extractClientIp((name) => request.headers.get(name)))) {
    return new NextResponse("Access blocked", { status: 403 });
  }

  if (request.method === "GET") {
    const response = NextResponse.next();
    const token = readCookieValue(
      request.cookies,
      SESSION_COOKIE_NAME,
      LEGACY_SESSION_COOKIE_NAME,
    );
    // Only extend cookie expiration on GET requests since we can be sure a new
    // session wasn't set when handling the request — and only once per renewal
    // interval, not on every navigation.
    if (token !== null && shouldRenewSession(request)) {
      const secure = process.env.NODE_ENV === "production";
      response.cookies.set(SESSION_COOKIE_NAME, token, {
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
        sameSite: "lax",
        httpOnly: true,
        secure,
      });
      response.cookies.set(SESSION_RENEWED_COOKIE_NAME, String(Date.now()), {
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
        sameSite: "lax",
        httpOnly: true,
        secure,
      });

      if (LEGACY_SESSION_COOKIE_NAME !== SESSION_COOKIE_NAME) {
        response.cookies.set(LEGACY_SESSION_COOKIE_NAME, "", {
          path: "/",
          maxAge: 0,
          sameSite: "lax",
          httpOnly: true,
          secure,
        });
      }
    }
    return response;
  }

  const originHeader = request.headers.get("Origin");
  // NOTE: You may need to use `X-Forwarded-Host` instead
  const hostHeader = request.headers.get("Host");
  if (originHeader === null || hostHeader === null) {
    return new NextResponse(null, {
      status: 403,
    });
  }
  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    return new NextResponse(null, {
      status: 403,
    });
  }
  if (origin.host !== hostHeader) {
    return new NextResponse(null, {
      status: 403,
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match page + Server Action traffic only (where the denylist / CSRF check /
     * session renewal actually matter). Skip:
     * - api (API routes; mutations are covered by withAction)
     * - _next (framework build output: static, image, data)
     * - any path ending in a static-asset extension: the PWA manifest + service
     *   worker (manifest.webmanifest, sw.js, offline.html), icons/screenshots/
     *   splash, logos, .well-known/assetlinks.json, and the metadata files
     *   (favicon.ico, sitemap.xml, robots.txt, opengraph-image.png, ...).
     * Every real page route is extensionless — usernames/tags/ids are [\w-]
     * only — so an explicit extension list can never drop a page from coverage.
     */
    "/((?!api|_next|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|js|css|json|webmanifest|txt|xml|html|woff|woff2|ttf|map)$).*)",
  ],
};
