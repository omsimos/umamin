import type { QueryClient } from "@tanstack/react-query";
import { loaderFetchOptional, ssrSessionCookiePresent } from "./loader-fetch";
import { PRIVATE_STALE_TIME, queryKeys } from "./query";
import { fetchCurrentUserOptional } from "./query-fetchers";
import type { CurrentUserResponse } from "./types";

/**
 * Resolve the viewer for a route loader — the one call every page that renders
 * differently for a signed-in user starts with.
 *
 * Two things it does that a bare `/api/me` dispatch does not:
 *
 *  - **Skips the request entirely for anonymous SSR.** A page request with no
 *    session cookie cannot resolve a viewer, so `/api/me` would only 401 after
 *    a session lookup and a user read. Anonymous traffic is the majority on the
 *    public pages, and this is the first hop of their critical path.
 *  - **Goes through the query cache.** A client navigation reuses the entry SSR
 *    (or the `_private` gate) already primed instead of re-fetching, and the
 *    components below the loader read the same key.
 *
 * Returns `null` when there is no viewer. The cookie check is a negative filter
 * only — a token that IS present is still validated server-side by the request
 * this makes.
 */
export async function loadViewer(
  queryClient: QueryClient,
): Promise<CurrentUserResponse | null> {
  if ((await ssrSessionCookiePresent()) === false) return null;

  return queryClient.ensureQueryData({
    queryKey: queryKeys.currentUser(),
    queryFn: () =>
      loaderFetchOptional<CurrentUserResponse>(
        "/api/me",
        fetchCurrentUserOptional,
        {} as CurrentUserResponse,
      ),
    staleTime: PRIVATE_STALE_TIME,
  });
}

/** `loadViewer` for the common case where only the id matters. */
export async function loadViewerId(
  queryClient: QueryClient,
): Promise<string | null> {
  return (await loadViewer(queryClient))?.user?.id ?? null;
}
