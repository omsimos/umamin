"use client";

import { useThrottledCallback } from "@tanstack/react-pacer/throttler";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { AlertCircleIcon, MessageCircleDashedIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import {
  infiniteQueryDefaults,
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
      fetchNotesPage((pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: PUBLIC_STALE_TIME,
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

  const totalRows = useMemo(() => {
    return hasNextPage ? allPosts.length + 1 : allPosts.length;
  }, [allPosts.length, hasNextPage]);

  const virtualizer = useWindowVirtualizer({
    count: totalRows,
    estimateSize: () => 250, // average height for post/ad; virtualizer will remeasure
    paddingEnd: 100,
    overscan: 12,
    getItemKey: (index) => {
      if (hasNextPage && index === totalRows - 1) return "loader";
      const post = allPosts[index];
      return post?.id ?? `row-${index}`;
    },
  });

  const items = virtualizer.getVirtualItems();

  const handleNextPage = useThrottledCallback(
    () => {
      fetchNextPage();
    },
    { wait: 3000 },
  );

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || items.length === 0) return;
    const lastItem = items[items.length - 1];
    const lastIndex = totalRows - 1; // loader row index if hasNextPage
    if (lastItem?.index >= lastIndex) {
      handleNextPage();
    }
  }, [items, hasNextPage, isFetchingNextPage, totalRows, handleNextPage]);

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
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {items.map((row) => {
          const isLoaderRow = hasNextPage && row.index === totalRows - 1;

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
                transform: `translateY(${row.start}px)`,
              }}
            >
              {isLoaderRow ? (
                <NoteCardSkeleton />
              ) : (
                (() => {
                  const post = allPosts[row.index];
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
