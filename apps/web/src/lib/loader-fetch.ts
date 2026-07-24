import { type ServerFetchContext, serverFetchJson } from "@/lib/query-fetchers";

// ── Loader-side fetch seam (Phase 3b) ────────────────────────────────────────
// Built on the `serverFetchJson({ origin, cookie }, path)` SSR seam from
// query-fetchers.ts. Route loaders run in BOTH environments:
//   • SSR (the Worker): no ambient page origin and no browser cookie jar — a
//     relative `/api/...` request has nothing to resolve against and carries no
//     session. We derive both from Start's per-request server context
//     (`getRequest()` → the Web `Request`): its URL gives the absolute origin,
//     its `cookie` header carries the caller's httpOnly session.
//   • Client navigation: the loader re-runs in the browser, where relative URLs
//     + `credentials:"include"` behave exactly like the query-fetchers.ts
//     browser fetchers. We branch on `import.meta.env.SSR`.
//
// `@tanstack/react-start/server` is a SERVER-ONLY module (Start's import
// protection denies a static import of it from any client-reachable file, and
// every loader is client-reachable). So `getRequest` is pulled in via a dynamic
// `import()` INSIDE the `import.meta.env.SSR` branch — statically false in the
// client build, so the branch (and the import) is tree-shaken out of the client
// bundle entirely.
//
// The queryKey a loader primes is IDENTICAL to the one the client component's
// `useInfiniteQuery`/`useQuery` reads, so the router-query integration
// (routerWithQueryClient) dehydrates the primed cache on the server and the
// client hydrates it without a second fetch.
//
// ── API for the other Phase 3b route groups (copy this file's usage) ─────────
//   getLoaderFetchContext(): Promise<ServerFetchContext>
//     — the { origin, cookie } pair for the current SSR request. SSR-only
//       (async because it dynamically imports the server module); throws
//       off-request. Prefer the helpers below unless you need the raw context
//       (e.g. to hand to a per-resource `serverFetch*` wrapper).
//
//   loaderFetchJson<T>(path): Promise<T>
//     — environment-aware GET returning parsed JSON; throws on non-2xx (so a
//       loader failure surfaces to the route's errorComponent). Use for reads
//       that must exist.
//
//   loaderFetchJsonOrNull<T>(path, ...nullStatuses): Promise<T | null>
//     — like loaderFetchJson but resolves to null for the given status codes
//       (default 401 + 404) instead of throwing. Use for the optional viewer
//       (/api/me → 401 when logged out) and for entities that 404 into a
//       `notFound()` decision the loader makes explicitly.

export async function getLoaderFetchContext(): Promise<ServerFetchContext> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  return {
    origin: new URL(request.url).origin,
    cookie: request.headers.get("cookie") ?? undefined,
  };
}

export async function loaderFetchJson<T>(path: string): Promise<T> {
  if (import.meta.env.SSR) {
    return serverFetchJson<T>(await getLoaderFetchContext(), path);
  }

  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }
  return (await response.json()) as T;
}

// Variant that delegates to an existing browser fetcher on the client (so a
// loader can share the exact fetch/parse path its component's query uses) and
// soft-fails the listed statuses to `emptyValue` on the server — e.g. 401 for
// the optional viewer, 403/404 for a group that went away — so the SSR pass can
// redirect/notFound instead of crashing the loader.
export async function loaderFetchOptional<T>(
  path: string,
  clientFetcher: () => Promise<T>,
  emptyValue: T,
  nullStatuses: number[] = [401],
): Promise<T> {
  if (!import.meta.env.SSR) return clientFetcher();

  const { origin, cookie } = await getLoaderFetchContext();
  const response = await fetch(`${origin}${path}`, {
    headers: cookie ? { cookie } : undefined,
  });

  if (nullStatuses.includes(response.status)) return emptyValue;
  if (!response.ok) throw new Error(`Request failed for ${path}`);
  return (await response.json()) as T;
}

export async function loaderFetchJsonOrNull<T>(
  path: string,
  ...nullStatuses: number[]
): Promise<T | null> {
  const statuses = nullStatuses.length > 0 ? nullStatuses : [401, 404];

  let response: Response;
  if (import.meta.env.SSR) {
    const { origin, cookie } = await getLoaderFetchContext();
    response = await fetch(`${origin}${path}`, {
      headers: cookie ? { cookie } : undefined,
    });
  } else {
    response = await fetch(path, { credentials: "include" });
  }

  if (statuses.includes(response.status)) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }
  return (await response.json()) as T;
}
