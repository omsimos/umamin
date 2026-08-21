import { useQuery } from "@tanstack/react-query";
import { privateQueryDefaults, queryKeys } from "@/lib/query";
import { fetchFeatureFlags } from "@/lib/query-fetchers";
import type { FeatureFlagsResponse } from "@/lib/types";

const HIDDEN: FeatureFlagsResponse = { pro: false };

/**
 * Reads the Worker-resolved flags. A route that gates on a flag prefetches this
 * in its loader (lib/loader-flags.ts), so the first render already has the
 * answer — without that, a surface the flag HIDES would paint before being
 * removed.
 *
 * Defaults to hidden while loading and on error, matching the server's
 * fail-closed resolution.
 */
export function useFeatureFlags(): FeatureFlagsResponse {
  const { data } = useQuery({
    queryKey: queryKeys.featureFlags(),
    queryFn: fetchFeatureFlags,
    ...privateQueryDefaults,
  });

  return data ?? HIDDEN;
}
