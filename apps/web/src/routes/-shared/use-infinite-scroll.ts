import { useEffect, useRef } from "react";

// Lightweight IntersectionObserver auto-loader. apps/www drove infinite lists
// with @tanstack/react-virtual (window virtualizer) + a boundary-loader hook;
// neither is a dependency of apps/web, so the private surfaces use a plain
// sentinel-driven loader instead (non-virtualized). Attach the returned ref to
// a sentinel element rendered after the last row; it calls `onLoadMore` when
// the sentinel scrolls into view and there is a next page.
export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage]);

  return sentinelRef;
}
