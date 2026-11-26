import type { InfiniteData, QueryKey } from "@tanstack/react-query";
import { focusManager, hashKey, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { PRIVATE_STALE_TIME, refreshInfiniteQueries } from "@/lib/query";

// Private lists opt out of refetchOnMount/refetchOnWindowFocus because those
// refetch every loaded page. Without them, a revisit within gcTime or a push
// tap that only focuses the open window keeps showing the old list. This
// refreshes page 1 instead, at most once per stale window, and only on mount
// or focus: never on a timer. The refresh drops every page after the first,
// so a mount with more pages loaded is left alone: that is someone coming
// back from a thread to their place in the list.
export function useRefreshWhenStale(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  const keyHash = hashKey(queryKey);

  useEffect(() => {
    const key = JSON.parse(keyHash) as QueryKey;

    const refreshIfStale = (reason: "mount" | "focus") => {
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
      if (
        reason === "mount" &&
        isInfinite &&
        (state.data as InfiniteData<unknown>).pages.length > 1
      ) {
        return;
      }
      void (isInfinite
        ? refreshInfiniteQueries(queryClient, key)
        : queryClient.invalidateQueries({ queryKey: key, exact: true }));
    };

    refreshIfStale("mount");
    return focusManager.subscribe((focused) => {
      if (focused) refreshIfStale("focus");
    });
  }, [queryClient, keyHash]);
}
