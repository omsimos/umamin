import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import { focusManager, hashKey, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { PRIVATE_STALE_TIME, refreshInfiniteQueries } from "@/lib/query";

// Private lists opt out of refetchOnMount/refetchOnWindowFocus because those
// refetch every loaded page. Without them, a revisit within gcTime or a push
// tap that only focuses the open window keeps showing the old list. This
// refreshes page 1 instead, at most once per stale window, and only on mount
// or focus: never on a timer.
// When each list last came from the server. `dataUpdatedAt` can't say: every
// setQueryData patch (a read mark, a reply) resets it, which would make a list
// that is minutes old look fresh. Seeded the first time a list is seen and
// moved only by real fetches.
const serverFetchedAt = new WeakMap<QueryClient, Map<string, number>>();

function fetchTimes(queryClient: QueryClient): Map<string, number> {
  let times = serverFetchedAt.get(queryClient);
  if (!times) {
    const created = new Map<string, number>();
    times = created;
    serverFetchedAt.set(queryClient, created);
    queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        created.has(event.query.queryHash) &&
        (event.action.type === "error" ||
          (event.action.type === "success" && !event.action.manual))
      ) {
        created.set(event.query.queryHash, Date.now());
      }
    });
  }
  return times;
}

export function useRefreshWhenStale(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  const keyHash = hashKey(queryKey);

  useEffect(() => {
    const key = JSON.parse(keyHash) as QueryKey;

    const refreshIfStale = (reason: "mount" | "focus") => {
      const state = queryClient.getQueryState(key);
      if (!state || state.data === undefined) return;
      if (state.fetchStatus === "fetching") return;
      const times = fetchTimes(queryClient);
      if (!times.has(keyHash)) {
        times.set(keyHash, Math.max(state.dataUpdatedAt, state.errorUpdatedAt));
      }
      // A failed attempt counts too, so an outage doesn't retry on every focus.
      const settledAt = times.get(keyHash) ?? 0;
      if (
        !state.isInvalidated &&
        Date.now() - settledAt <= PRIVATE_STALE_TIME
      ) {
        return;
      }

      const isInfinite =
        typeof state.data === "object" &&
        state.data !== null &&
        "pages" in state.data;
      // The refresh drops every page after the first. Someone coming back
      // from a thread, or refocusing while deep in the list, keeps their
      // place; near the top there is nothing below to lose.
      if (
        isInfinite &&
        (state.data as InfiniteData<unknown>).pages.length > 1 &&
        (reason === "mount" || window.scrollY > window.innerHeight)
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
