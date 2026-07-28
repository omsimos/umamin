// ── Loader-side fetch seam (Phase 3b) ────────────────────────────────────────
// Route loaders run in BOTH environments:
//   • SSR (the Worker): a network fetch to our own origin is NOT an option —
//     Cloudflare blocks a Worker from fetch()ing its own zone (recursion
//     protection), and in vite dev the self-request deadlocks the dev Worker.
//     Instead the loader dispatches IN-PROCESS to the same Hono `apiApp` the
//     network route uses: identical handlers, middleware, and session
//     resolution (the caller's cookie is forwarded on a synthetic Request),
//     with zero extra invocation.
//   • Client navigation: the loader re-runs in the browser, where relative
//     URLs + `credentials:"include"` behave exactly like the query-fetchers.ts
//     browser fetchers. We branch on `import.meta.env.SSR`.
//
// `@tanstack/react-start/server`, `@/server-lib/ssr-env`, and `@/api` are
// server-only imports — every loader is client-reachable, so they are pulled
// in via dynamic `import()` INSIDE the `import.meta.env.SSR` branch, which is
// statically false in the client build and tree-shaken out entirely. All three
// are REAL modules (no `cloudflare:*` virtual specifiers): dev-time import
// analysis transforms this file for the browser too, where a workerd-only
// specifier fails to resolve — bindings arrive via ssr-env instead, stamped by
// the server entry.
//
// The queryKey a loader primes is IDENTICAL to the one the client component's
// `useInfiniteQuery`/`useQuery` reads, so the router-query integration
// (routerWithQueryClient) dehydrates the primed cache on the server and the
// client hydrates it without a second fetch.
//
// ── API ───────────────────────────────────────────────────────────────────────
//   loaderFetchJson<T>(path): Promise<T>
//     — environment-aware GET returning parsed JSON; throws on non-2xx (so a
//       loader failure surfaces to the route's errorComponent). Use for reads
//       that must exist.
//
//   loaderFetchJsonOrNull<T>(path, ...nullStatuses): Promise<T | null>
//     — like loaderFetchJson but resolves to null for the given status codes
//       (default 401 + 404) instead of throwing.
//
//   loaderFetchOptional<T>(path, clientFetcher, emptyValue, nullStatuses?)
//     — delegates to an existing browser fetcher on the client and soft-fails
//       the listed statuses to `emptyValue` on the server, so the SSR pass can
//       redirect/notFound instead of crashing the loader.

// waitUntil outlives the synthetic request; swallow rejections so a background
// cache.put failure can't crash the SSR pass.
function stubExecutionContext(): ExecutionContext {
  return {
    waitUntil(promise: Promise<unknown>) {
      void promise.catch(() => {});
    },
    passThroughOnException() {},
    props: {},
  } as ExecutionContext;
}

// Headers the synthetic request must inherit from the page request. The
// credential headers pick the viewer; the IP headers are what the read limiter
// and denylist key on — WITHOUT them extractClientIp falls back to its local-dev
// constant, so every SSR loader read in the fleet shares ONE limiter bucket
// (100/60s per colo) and page loads start 429ing under normal traffic.
const FORWARDED_SSR_HEADERS = [
  "cookie",
  "authorization",
  "cf-connecting-ip",
  "x-real-ip",
  "x-forwarded-for",
] as const;

// Exported for the unit test: an allowlist copy, never a wholesale clone (the
// page request's accept/content-* headers would misdescribe the JSON dispatch).
export function buildSsrHeaders(source: Headers): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_SSR_HEADERS) {
    const value = source.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

async function ssrDispatch(path: string): Promise<Response> {
  const [{ getRequest }, { apiApp }, { getSsrEnv }] = await Promise.all([
    import("@tanstack/react-start/server"),
    import("@/api"),
    import("@/server-lib/ssr-env"),
  ]);
  const request = getRequest();
  const headers = buildSsrHeaders(request.headers);
  // apiApp is mounted at /api by the outer server — strip the prefix for the
  // in-process dispatch so the same handler matches.
  const url = new URL(
    path.replace(/^\/api(?=\/)/, ""),
    new URL(request.url).origin,
  );
  return apiApp.fetch(
    new Request(url, { headers }),
    getSsrEnv(),
    stubExecutionContext(),
  );
}

async function fetchResponse(path: string): Promise<Response> {
  if (import.meta.env.SSR) return ssrDispatch(path);
  return fetch(path, { credentials: "include" });
}

/**
 * Does the SSR page request carry a session cookie at all?
 *
 * A request without one CANNOT resolve a viewer, so a loader can skip its
 * `/api/me` dispatch — and the session lookup plus user read behind it —
 * instead of paying for a guaranteed 401. That is the common case on the public
 * pages (logged-out visitors and crawlers).
 *
 * Returns `null` on the client, where the cookie is httpOnly and therefore
 * invisible: callers must fall back to asking the API. In practice the client
 * has `/api/me` in the query cache already, so nothing is lost.
 *
 * Presence is NOT authentication — the token still gets validated by whatever
 * the loader calls next. This only rules out the negative case.
 */
export async function ssrSessionCookiePresent(): Promise<boolean | null> {
  if (!import.meta.env.SSR) return null;

  const [{ getRequest }, { LEGACY_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME }] =
    await Promise.all([
      import("@tanstack/react-start/server"),
      import("@/server-lib/cookies"),
    ]);

  return cookieHeaderHasAny(getRequest().headers.get("cookie"), [
    SESSION_COOKIE_NAME,
    LEGACY_SESSION_COOKIE_NAME,
  ]);
}

// Exported for the unit test. Matches on the NAME only — a cookie whose value
// happens to contain the name, or a name that is a prefix of another
// (`session` vs `session_r`), must not count as a match.
export function cookieHeaderHasAny(
  header: string | null | undefined,
  names: readonly string[],
): boolean {
  if (!header) return false;

  return header.split(";").some((pair) => {
    const separator = pair.indexOf("=");
    const name = (separator === -1 ? pair : pair.slice(0, separator)).trim();
    return names.includes(name);
  });
}

export async function loaderFetchJson<T>(path: string): Promise<T> {
  const response = await fetchResponse(path);
  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }
  return (await response.json()) as T;
}

export async function loaderFetchJsonOrNull<T>(
  path: string,
  ...nullStatuses: number[]
): Promise<T | null> {
  const statuses = nullStatuses.length > 0 ? nullStatuses : [401, 404];
  const response = await fetchResponse(path);
  if (statuses.includes(response.status)) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }
  return (await response.json()) as T;
}

export async function loaderFetchOptional<T>(
  path: string,
  clientFetcher: () => Promise<T>,
  emptyValue: T,
  nullStatuses: number[] = [401],
): Promise<T> {
  if (!import.meta.env.SSR) return clientFetcher();

  const response = await ssrDispatch(path);
  if (nullStatuses.includes(response.status)) return emptyValue;
  if (!response.ok) throw new Error(`Request failed for ${path}`);
  return (await response.json()) as T;
}
