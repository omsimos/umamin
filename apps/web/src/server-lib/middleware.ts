import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import {
  LEGACY_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_RENEWED_COOKIE_NAME,
} from "./cookies";
import { securityHeaders } from "./csp";
import { isBearerAuthed, originMatchesHost } from "./csrf";
import type { AppEnv } from "./env";
import { extractClientIp } from "./ip";
import { isIpDenied } from "./ip-denylist";

type Middleware = MiddlewareHandler<{ Bindings: AppEnv }>;

// CF's assets binding serves hashed static files before the Worker runs, but
// keep the same extension skip apps/www's proxy matcher used so the denylist /
// cookie-renewal work never touches an asset that slips through. Every real page
// route is extensionless.
const STATIC_EXT =
  /\.(?:png|jpg|jpeg|gif|webp|svg|ico|js|css|json|webmanifest|txt|xml|html|woff|woff2|ttf|map)$/;

function isStaticPath(path: string): boolean {
  return STATIC_EXT.test(path);
}

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
// Re-slide the cookie's browser lifetime at most once per interval (the server
// session slides independently in validateSessionToken).
const SESSION_RENEW_INTERVAL_MS = 1000 * 60 * 60 * 24 * 7;

/**
 * Front-door IP denylist for all non-asset traffic (mirrors proxy.ts). 403s a
 * denied IP; no-ops without a KV binding; per-IP (blocks shared egress too).
 */
export function ipDenylist(): Middleware {
  return async (c, next) => {
    if (!isStaticPath(new URL(c.req.url).pathname)) {
      const ip = extractClientIp((name) => c.req.header(name));
      if (await isIpDenied(c.env.KV, ip)) {
        return c.text("Access blocked", 403);
      }
    }
    await next();
  };
}

/**
 * Same-origin CSRF guard for page mutations (form posts / future server fns).
 * Mirrors apps/www proxy.ts: EVERY non-GET must pass Origin-vs-Host — not just
 * cookie-authed ones — so an anonymous page POST added later can't slip in
 * unguarded. API `/api/*` actions also self-enforce via the action() factory,
 * and bearer (mobile) traffic is exempt.
 */
export function csrfOriginCheck(): Middleware {
  return async (c, next) => {
    const method = c.req.method;
    const isMutation =
      method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

    if (isMutation && !isBearerAuthed(c) && !originMatchesHost(c)) {
      return c.body(null, 403);
    }
    await next();
  };
}

/**
 * Attach the ported security headers to the outgoing response WITHOUT buffering
 * the SSR stream — set headers only, never read the body (plan R6).
 *
 * Also pins SSR HTML to `no-store`. Next served every dynamic page as
 * `private, no-store, max-age=0`; a Worker sends no Cache-Control at all, which
 * leaves authenticated HTML (and the Set-Cookie the renewal middleware may
 * append) heuristically cacheable by browsers and storable by any intermediary.
 * `/api/*` responses set their own envelope and are left alone.
 */
export function securityHeadersMiddleware(): Middleware {
  return async (c, next) => {
    await next();
    for (const [key, value] of Object.entries(securityHeaders(c.env))) {
      c.header(key, value);
    }

    const isHtml = c.res.headers.get("content-type")?.includes("text/html");
    if (isHtml && !c.res.headers.has("cache-control")) {
      c.header("Cache-Control", "private, no-store, max-age=0");
    }
  };
}

// True when the handled response already writes a session cookie. Hono APPENDS
// Set-Cookie, and for a repeated name the browser keeps the LAST one — so
// renewing on top of a route that just minted a session would overwrite the
// fresh token with the request's stale one. The Google OAuth callback is exactly
// that case: a GET that mints a session.
function setsSessionCookie(res: Response): boolean {
  const values =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : (res.headers.get("set-cookie")?.split("\n") ?? []);

  return values.some(
    (value) =>
      value.startsWith(`${SESSION_COOKIE_NAME}=`) ||
      value.startsWith(`${LEGACY_SESSION_COOKIE_NAME}=`),
  );
}

/**
 * Sliding session-cookie renewal — port of proxy.ts. GET page routes only
 * (skips /api/* and static), and only once per SESSION_RENEW_INTERVAL_MS via the
 * non-secret SESSION_RENEWED marker so ~all authed navigations drop the
 * Set-Cookie.
 */
export function cookieRenewal(): Middleware {
  return async (c, next) => {
    await next();

    if (c.req.method !== "GET") return;
    const path = new URL(c.req.url).pathname;
    if (path.startsWith("/api/") || isStaticPath(path)) return;
    if (setsSessionCookie(c.res)) return;

    const token =
      getCookie(c, SESSION_COOKIE_NAME) ??
      getCookie(c, LEGACY_SESSION_COOKIE_NAME);
    if (!token) return;

    const marker = getCookie(c, SESSION_RENEWED_COOKIE_NAME);
    const renewedAt = marker ? Number(marker) : 0;
    const due =
      !Number.isFinite(renewedAt) ||
      renewedAt <= 0 ||
      Date.now() - renewedAt >= SESSION_RENEW_INTERVAL_MS;
    if (!due) return;

    const secure = process.env.NODE_ENV === "production";
    const base = {
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
      sameSite: "Lax" as const,
      httpOnly: true,
      secure,
    };
    setCookie(c, SESSION_COOKIE_NAME, token, base);
    setCookie(c, SESSION_RENEWED_COOKIE_NAME, String(Date.now()), base);
    if (LEGACY_SESSION_COOKIE_NAME !== SESSION_COOKIE_NAME) {
      setCookie(c, LEGACY_SESSION_COOKIE_NAME, "", { ...base, maxAge: 0 });
    }
  };
}
