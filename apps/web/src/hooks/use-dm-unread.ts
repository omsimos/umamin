import { useQuery } from "@tanstack/react-query";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchCurrentUserOptional, fetchDmUnread } from "@/lib/query-fetchers";

/** Conversations with an unread message. Refetched on focus, never polled:
 *  an open conversation is live over its socket, everything else waits for
 *  the next visit or a push. */
export function useDmUnread(): number {
  const { dm } = useFeatureFlags();
  const { data: me } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });
  const { data } = useQuery({
    queryKey: queryKeys.dmUnread(),
    queryFn: fetchDmUnread,
    enabled: dm && !!me?.user,
    staleTime: PRIVATE_STALE_TIME,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: true,
  });
  return dm ? (data?.count ?? 0) : 0;
}
