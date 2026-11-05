import type { QueryClient } from "@tanstack/react-query";
import { loaderFetchOptional, ssrSessionCookiePresent } from "./loader-fetch";
import { PRIVATE_STALE_TIME, queryKeys } from "./query";
import { fetchCurrentUserOptional } from "./query-fetchers";
import { RequestFailedError } from "./request-error";
import type { CurrentUserResponse } from "./types";

// What /api/me's 401 resolves to in fetchCurrentUserOptional and the loader.
const SIGNED_OUT = {} as CurrentUserResponse;

type LoadViewerOptions = {
  /**
   * Rethrow when the viewer can't be resolved (a 5xx or a network failure).
   * Set it where the answer decides access, like a redirect to /login: reading
   * an outage as "signed out" would send a signed-in user there.
   */
  strict?: boolean;
};

// A server error or a dropped connection says nothing about who the viewer is.
// Other statuses (a 429, say) keep failing the loader as before.
function isViewerUnavailable(error: unknown): boolean {
  if (error instanceof RequestFailedError) return error.status >= 500;
  return true;
}

/**
 * Resolve the viewer for a route loader — the one call every page that renders
 * differently for a signed-in user starts with.
 *
 * Two things it does that a bare `/api/me` dispatch does not:
 *
 *  - **Skips the request entirely for anonymous SSR.** A page request with no
 *    session cookie cannot resolve a viewer, so `/api/me` would only 401 after
 *    a session lookup and a user read. Anonymous traffic is the majority on the
 *    public pages, and this is the first hop of their critical path. The
 *    signed-out answer is primed into the query cache, so the components that
 *    read the current user don't each ask the API again after hydration.
 *  - **Goes through the query cache.** A client navigation reuses the entry SSR
 *    (or the `_private` gate) already primed instead of re-fetching, and the
 *    components below the loader read the same key.
 *
 * Returns `null` when there is no viewer. The cookie check is a negative filter
 * only — a token that IS present is still validated server-side by the request
 * this makes.
 *
 * When `/api/me` fails with a 5xx or a network error, the page renders as
 * signed out instead of failing (unless `strict`). The failed query is left in
 * the error state, not cached as signed out, so it isn't sent to the client
 * and the components there fetch `/api/me` again after hydration.
 */
export async function loadViewer(
  queryClient: QueryClient,
  { strict = false }: LoadViewerOptions = {},
): Promise<CurrentUserResponse | null> {
  if ((await ssrSessionCookiePresent()) === false) {
    queryClient.setQueryData(queryKeys.currentUser(), SIGNED_OUT);
    return null;
  }

  try {
    return await queryClient.ensureQueryData({
      queryKey: queryKeys.currentUser(),
      queryFn: () =>
        loaderFetchOptional<CurrentUserResponse>(
          "/api/me",
          fetchCurrentUserOptional,
          SIGNED_OUT,
        ),
      staleTime: PRIVATE_STALE_TIME,
    });
  } catch (error) {
    if (strict || !isViewerUnavailable(error)) throw error;
    return null;
  }
}

/** `loadViewer` for the common case where only the id matters. */
export async function loadViewerId(
  queryClient: QueryClient,
  options?: LoadViewerOptions,
): Promise<string | null> {
  return (await loadViewer(queryClient, options))?.user?.id ?? null;
}
