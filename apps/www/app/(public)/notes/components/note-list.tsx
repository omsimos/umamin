"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { AlertCircleIcon, MessageCircleDashedIcon } from "lucide-react";
import { useMemo } from "react";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { useInfiniteBoundaryLoader } from "@/hooks/use-infinite-boundary-loader";
import { useWindowVirtualizerOffset } from "@/hooks/use-window-virtualizer-offset";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  PUBLIC_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchNotesPage } from "@/lib/query-fetchers";
import type { NoteItem, NotesResponse } from "@/lib/query-types";
import { NoteCard } from "./note-card";
import { NoteCardSkeleton } from "./note-card-skeleton";

export function NoteList({ isAuthenticated }: { isAuthenticated: boolean }) {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery<NotesResponse>({
    queryKey: queryKeys.notes(),
    queryFn: ({ pageParam }) =>
      fetchNotesPage((pageParam as string | null) ?? null, isAuthenticated),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: isAuthenticated ? PRIVATE_STALE_TIME : PUBLIC_STALE_TIME,
    ...infiniteQueryDefaults,
  });
  const hasResolvedData = data !== undefined;

  // De-duplicate posts by id across pages
  const allPosts: NoteItem[] = (() => {
    const flat = data?.pages.flatMap((p) => p.data) ?? [];
    const map = new Map<string, NoteItem>();
    for (const item of flat) map.set(item.id, item);
    return Array.from(map.values());
  })();

  const AD_FREQUENCY = 8;

  const isAdRow = (rowIndex: number) =>
    (rowIndex + 1) % (AD_FREQUENCY + 1) === 0;

  const dataIndexForRow = (rowIndex: number) => {
    const adsAtOrBefore = Math.floor((rowIndex + 1) / (AD_FREQUENCY + 1));
    const adsBefore = isAdRow(rowIndex) ? adsAtOrBefore - 1 : adsAtOrBefore;
    return rowIndex - adsBefore;
  };

  const totalRows = useMemo(() => {
    const contentRows =
      allPosts.length + Math.floor(allPosts.length / AD_FREQUENCY);
    return hasNextPage ? contentRows + 1 : contentRows;
  }, [allPosts.length, hasNextPage]);

  const { containerRef, scrollMargin } =
    useWindowVirtualizerOffset<HTMLDivElement>();

  const virtualizer = useWindowVirtualizer({
    count: totalRows,
    estimateSize: () => 250, // average height for post/ad; virtualizer will remeasure
    paddingEnd: 100,
    overscan: 12,
    scrollMargin,
    getItemKey: (index) => {
      if (hasNextPage && index === totalRows - 1) return "loader";
      if (isAdRow(index)) {
        const adIndex = Math.floor((index + 1) / (AD_FREQUENCY + 1));
        return `notes-inline-ad-${adIndex}`;
      }
      const post = allPosts[dataIndexForRow(index)];
      return post?.id ?? `row-${index}`;
    },
  });

  const items = virtualizer.getVirtualItems();
  const nextCursor = data?.pages[data.pages.length - 1]?.nextCursor ?? null;

  useInfiniteBoundaryLoader({
    boundaryIndex: totalRows - 1,
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    items,
    loadMoreKey: nextCursor,
    onLoadMore: fetchNextPage,
  });

  if (error) {
    return (
      <div className="w-full mx-auto">
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>
            Failed to load data. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!hasResolvedData || isLoading) {
    return (
      <div className="w-full mx-auto space-y-4">
        <NoteCardSkeleton />
        <NoteCardSkeleton />
        <NoteCardSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full">
      {hasResolvedData && allPosts.length === 0 && !isFetching && (
        <Alert>
          <MessageCircleDashedIcon />
          <AlertTitle>No data yet</AlertTitle>
          <AlertDescription>
            Start the conversation by creating a new post!
          </AlertDescription>
        </Alert>
      )}

      {/* v2-notes (top ad) */}
      <ClientOnlyAdContainer className="mb-5" placement="notes_top" />

      <div
        ref={containerRef}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {items.map((row) => {
          const isLoaderRow = hasNextPage && row.index === totalRows - 1;
          const isInlineAdRow = !isLoaderRow && isAdRow(row.index);

          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              className="pb-4"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${row.start - scrollMargin}px)`,
              }}
            >
              {isLoaderRow ? (
                <NoteCardSkeleton />
              ) : isInlineAdRow ? (
                <ClientOnlyAdContainer
                  className="mb-4"
                  placement="notes_inline"
                />
              ) : (
                (() => {
                  const post = allPosts[dataIndexForRow(row.index)];
                  if (!post) return null;

                  return (
                    <NoteCard
                      isAuthenticated={isAuthenticated}
                      key={post.id}
                      data={post}
                    />
                  );
                })()
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
