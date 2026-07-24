import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { privateQueryDefaults, queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";

// Shared, deduped current-user observer (ported from apps/www hooks). Every call
// site subscribes to one cache entry (queryKeys.currentUser); privateQueryDefaults
// disables refetch-on-mount/focus/reconnect, so a list row mounting into view
// reads the cached value instead of firing a fresh /api/me each time. Pass
// `isAuthenticated` so the query stays idle for logged-out viewers.
export function useCurrentUser(enabled = true) {
  return useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    ...privateQueryDefaults,
    enabled,
  });
}

// IntersectionObserver-based infinite-load sentinel. Phase 3b workaround for the
// absent `@tanstack/react-virtual` dependency (apps/www virtualized these lists
// and drove loading off the virtualizer's boundary row) — the ported lists
// render every item and place a sentinel element below the last row; when it
// scrolls into view we page. `loadMoreKey` de-dupes repeat triggers for the same
// page boundary (mirrors the old useInfiniteBoundaryLoader guard).
export function useIntersectionLoadMore<TElement extends HTMLElement>({
  hasNextPage,
  isFetchingNextPage,
  loadMoreKey,
  onLoadMore,
  rootMargin = "600px",
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadMoreKey: string | null;
  onLoadMore: () => Promise<unknown> | unknown;
  rootMargin?: string;
}) {
  const sentinelRef = useRef<TElement | null>(null);
  const lastTriggeredKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || isFetchingNextPage) return;

        const nextKey = loadMoreKey ?? "boundary";
        if (lastTriggeredKeyRef.current === nextKey) return;

        lastTriggeredKeyRef.current = nextKey;
        void onLoadMore();
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, loadMoreKey, onLoadMore, rootMargin]);

  // Reset the de-dupe latch once a fresh page has landed (the key advanced).
  useEffect(() => {
    if (!isFetchingNextPage) {
      lastTriggeredKeyRef.current = loadMoreKey;
    }
  }, [loadMoreKey, isFetchingNextPage]);

  const setSentinel = useCallback((node: TElement | null) => {
    sentinelRef.current = node;
  }, []);

  return { sentinelRef, setSentinel };
}
