import { useQuery } from "@tanstack/react-query";
import { privateQueryDefaults, queryKeys } from "@/lib/query";
import { fetchProOffer } from "@/lib/query-fetchers";

/**
 * Whether the Pro offer is launched for this viewer. Hidden while loading and
 * on error, like the server's fail-closed resolution.
 */
export function useProOffer(): boolean {
  const { data } = useQuery({
    queryKey: queryKeys.proOffer(),
    queryFn: fetchProOffer,
    ...privateQueryDefaults,
  });
  return data?.pro ?? false;
}
