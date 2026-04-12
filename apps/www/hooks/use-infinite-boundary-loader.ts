"use client";

import { useEffect, useRef } from "react";

type VirtualBoundaryItem = {
  index: number;
};

type UseInfiniteBoundaryLoaderOptions = {
  boundaryIndex: number;
  enabled?: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  items: VirtualBoundaryItem[];
  loadMoreKey: string | null;
  onLoadMore: () => Promise<unknown> | unknown;
};

export function useInfiniteBoundaryLoader({
  boundaryIndex,
  enabled = true,
  hasNextPage,
  isFetchingNextPage,
  items,
  loadMoreKey,
  onLoadMore,
}: UseInfiniteBoundaryLoaderOptions) {
  const lastTriggeredKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !hasNextPage) {
      lastTriggeredKeyRef.current = null;
      return;
    }

    if (isFetchingNextPage || items.length === 0) {
      return;
    }

    const lastItem = items[items.length - 1];
    const nextKey = loadMoreKey ?? `boundary:${boundaryIndex}`;

    if (!lastItem || lastItem.index < boundaryIndex) {
      return;
    }

    if (lastTriggeredKeyRef.current === nextKey) {
      return;
    }

    lastTriggeredKeyRef.current = nextKey;
    void onLoadMore();
  }, [
    boundaryIndex,
    enabled,
    hasNextPage,
    isFetchingNextPage,
    items,
    loadMoreKey,
    onLoadMore,
  ]);
}
