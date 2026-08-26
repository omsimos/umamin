import type { Context, HonoRequest } from "hono";
import type { AppEnv } from "./env";
import { formatErrorChain, INTERNAL_SERVER_ERROR } from "./errors";
import { extractClientIp } from "./ip";
import { captureRequestException } from "./posthog";
import { checkReadRateLimit, RATE_LIMIT_ERROR } from "./ratelimit";

// ── JSON envelope helpers (ported from apps/www lib/private-json + public-json) ─

const PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
} as const;

export function privateJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: PRIVATE_CACHE_HEADERS });
}

// `max-age` is the browser TTL; `s-maxage`/SWR feed the in-Worker Cache API TTL
// below. Same directive shape apps/www emitted (the CDN read it; here the Cache
// API does).
function cacheControl(
  maxAgeSeconds: number,
  browserMaxAgeSeconds = 0,
): Record<string, string> {
  return {
    "Cache-Control": `public, max-age=${browserMaxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds}`,
  };
}

export function publicJson(
  body: unknown,
  maxAgeSeconds: number,
  browserMaxAgeSeconds = 0,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: cacheControl(maxAgeSeconds, browserMaxAgeSeconds),
  });
}

/**
 * Re-stamp cache headers on a Response a handler built itself (the 401/403/404
 * early exits). Those were returned as-is, and a private body with NO
 * Cache-Control is heuristically cacheable by browsers and shared caches —
 * apps/www routed every early exit through privateJson/publicJson, so the
 * envelope is enforced here rather than at ~25 call sites.
 */
function stamp(res: Response, headers: Record<string, string>): Response {
  // Headers on a Response handed back by fetch()/cache.match() are immutable,
  // so rebuild rather than mutate in place.
  const out = new Response(res.body, res);
  for (const [key, value] of Object.entries(headers)) {
    out.headers.set(key, value);
  }
  return out;
}

type AppContext = Context<{ Bindings: AppEnv }>;

// Private handlers get the FULL context (may resolve the viewer session).
// `null` is a valid body (missing entity) — it still gets the private envelope.
type PrivateReadHandler = (c: AppContext) => Promise<Response | object | null>;

// Public handlers get ONLY the request + env — no Context, so they have no
// resolveSession(c) path (type-enforced: a public/cached response must never
// depend on or leak viewer identity, plan R5). `env` covers DB access.
type PublicReadHandler = (
  req: HonoRequest,
  env: AppEnv,
) => Promise<Response | object>;

/**
 * Per-viewer GET scaffold: IP read rate limit → handler → privateJson envelope
 * (no-store + Vary: Cookie). Never enters the Cache API. `label` keeps each
 * route's log prefix ("Error <label>:").
 */
export function withPrivateRead(label: string, handler: PrivateReadHandler) {
  return async (c: AppContext): Promise<Response> => {
    try {
      const ip = extractClientIp((name) => c.req.header(name));
      if (!(await checkReadRateLimit(c.env, ip))) {
        return privateJson({ error: RATE_LIMIT_ERROR }, 429);
      }
      const result = await handler(c);
      return result instanceof Response
        ? stamp(result, PRIVATE_CACHE_HEADERS)
        : privateJson(result);
    } catch (error) {
      console.error(`Error ${label}:`, formatErrorChain(error));
      captureRequestException(c, error, { properties: { read: label } });
      return privateJson({ error: INTERNAL_SERVER_ERROR }, 500);
    }
  };
}

/**
 * Build the Cache API key.
 *
 * With `cacheKeyParams` the key is the pathname plus ONLY those query params,
 * sorted and with empty values dropped. Without it the whole URL is the key.
 *
 * The default is deliberately the conservative one: a route that reads a param
 * nobody declared would otherwise collide different responses onto one entry
 * and serve the wrong page. Declaring is an optimisation, forgetting is not a
 * correctness bug.
 *
 * What declaring buys: `?sort=hot`, `?sort=hot&cursor=`, and `?sort=hot&utm=x`
 * all collapse to one entry instead of three, so equivalent requests hit the
 * cache and an arbitrary query param can no longer mint unbounded cache misses
 * (each of which is a Turso read) behind the per-IP read limit.
 */
function buildCacheKey(
  url: URL,
  cacheKeyParams: readonly string[] | undefined,
): Request {
  if (!cacheKeyParams) {
    return new Request(url.toString(), { method: "GET" });
  }

  const canonical = new URL(url.origin + url.pathname);
  for (const name of [...cacheKeyParams].sort()) {
    const value = url.searchParams.get(name);
    if (value) canonical.searchParams.set(name, value);
  }
  return new Request(canonical.toString(), { method: "GET" });
}

/**
 * CDN-cached public GET scaffold. `caches.default` (per-colo) replaces Vercel's
 * s-maxage CDN cache (fact #1). Canonical key → handler → waitUntil(cache.put)
 * with s-maxage. Errors (429/500) use maxAge 0 so they're never cached.
 *
 * INVARIANTS (grep-gated to this file): `caches.default` appears ONLY here; a
 * response carrying Set-Cookie is NEVER cached (would leak one viewer's cookie
 * to the next). Public handlers cannot receive a session (see PublicReadHandler).
 */
export function withPublicRead(
  label: string,
  maxAgeSeconds: number,
  handler: PublicReadHandler,
  browserMaxAgeSeconds = 0,
  cacheKeyParams?: readonly string[],
) {
  return async (c: AppContext): Promise<Response> => {
    // `caches.default` is a Workers global; the DOM lib types `caches` as a bare
    // CacheStorage, so narrow it here (the sole `caches.default` use, R5 invariant).
    const cache = (caches as unknown as { default: Cache }).default;
    const cacheKey = buildCacheKey(new URL(c.req.url), cacheKeyParams);

    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    try {
      const ip = extractClientIp((name) => c.req.header(name));
      if (!(await checkReadRateLimit(c.env, ip))) {
        return publicJson({ error: RATE_LIMIT_ERROR }, 0, 0, 429);
      }

      const result = await handler(c.req, c.env);
      // A handler-built Response is an early exit (404) — pin it uncacheable,
      // same as apps/www's `publicJson(body, 0, { status })`. A 200 keeps the
      // route's normal TTL.
      const res =
        result instanceof Response
          ? stamp(
              result,
              cacheControl(result.status === 200 ? maxAgeSeconds : 0),
            )
          : publicJson(result, maxAgeSeconds, browserMaxAgeSeconds);

      // Cache only cacheable successes, and NEVER a response with Set-Cookie.
      if (
        res.status === 200 &&
        maxAgeSeconds > 0 &&
        !res.headers.has("set-cookie")
      ) {
        c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
      }
      return res;
    } catch (error) {
      console.error(`Error ${label}:`, formatErrorChain(error));
      captureRequestException(c, error, { properties: { read: label } });
      return publicJson({ error: INTERNAL_SERVER_ERROR }, 0, 0, 500);
    }
  };
}
