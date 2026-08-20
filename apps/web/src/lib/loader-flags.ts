import type { QueryClient } from "@tanstack/react-query";
import { loaderFetchJson } from "./loader-fetch";
import { PRIVATE_STALE_TIME, queryKeys } from "./query";
import type { FeatureFlagsResponse } from "./types";

const HIDDEN: FeatureFlagsResponse = { pro: false };

/**
 * Primes the feature flags for a route that gates a surface on one, so SSR
 * renders the gated state directly instead of flashing it.
 *
 * Goes through `loaderFetchJson` — a loader runs in the Worker on a hard load,
 * where the browser fetchers' relative URLs throw. Shares the query cache entry
 * with `useFeatureFlags()` below it.
 *
 * Resolves to hidden if the read fails: a flags outage must not take a whole
 * page down over a cosmetic gate.
 */
export async function loadFeatureFlags(
  queryClient: QueryClient,
): Promise<FeatureFlagsResponse> {
  return queryClient.ensureQueryData({
    queryKey: queryKeys.featureFlags(),
    queryFn: () =>
      loaderFetchJson<FeatureFlagsResponse>("/api/flags").catch(() => HIDDEN),
    staleTime: PRIVATE_STALE_TIME,
  });
}
