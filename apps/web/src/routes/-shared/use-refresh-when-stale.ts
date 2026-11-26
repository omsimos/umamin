import type { QueryKey } from "@tanstack/react-query";
import { focusManager, hashKey, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { PRIVATE_STALE_TIME, refreshInfiniteQueries } from "@/lib/query";

// Private lists opt out of refetchOnMount/refetchOnWindowFocus because those
// refetch every loaded page. Without them, a revisit within gcTime or a push
// tap that only focuses the open window keeps showing the old list. This
// refreshes page 1 instead, at most once per stale window, and only on mount
// or focus: never on a timer.
export function useRefreshWhenStale(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  const keyHash = hashKey(queryKey);

  useEffect(() => {
    const key = JSON.parse(keyHash) as QueryKey;

    const refreshIfStale = () => {
      const state = queryClient.getQueryState(key);
      if (!state || state.data === undefined) return;
      if (state.fetchStatus === "fetching") return;
      // Counting a failed attempt keeps an outage from retrying on every focus.
      const settledAt = Math.max(state.dataUpdatedAt, state.errorUpdatedAt);
      if (Date.now() - settledAt <= PRIVATE_STALE_TIME) return;

      const isInfinite =
        typeof state.data === "object" &&
        state.data !== null &&
        "pages" in state.data;
      void (isInfinite
        ? refreshInfiniteQueries(queryClient, key)
        : queryClient.invalidateQueries({ queryKey: key, exact: true }));
    };

    refreshIfStale();
    return focusManager.subscribe((focused) => {
      if (focused) refreshIfStale();
    });
  }, [queryClient, keyHash]);
}
