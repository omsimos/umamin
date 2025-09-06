"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertCircleIcon, MessageCircleDashedIcon } from "lucide-react";
import { useThrottledCallback } from "@tanstack/react-pacer/throttler";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { SelectNote } from "@umamin/db/schema/note";
import { SelectUser } from "@umamin/db/schema/user";
import { NoteCard } from "./note-card";
import { NoteCardSkeleton } from "./note-card-skeleton";

const AdContainer = dynamic(() => import("@/components/ad-container"), {
  ssr: false,
});

type NotesResponse = {
  data: (SelectNote & { user: SelectUser })[];
  nextCursor: string | null;
};

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
    queryKey: ["notes"],
    queryFn: async ({ pageParam }) => {
      const url = pageParam ? `/api/notes?cursor=${pageParam}` : "/api/notes";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Network response was not ok");
      return res.json();
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const allPosts = data?.pages.flatMap((p) => p.data) ?? [];

  const AD_FREQUENCY = 5; // show 1 ad *after* every 5 posts

  const adCountFor = (n: number) => Math.floor(n / AD_FREQUENCY);

  const isAdRow = (rowIndex: number) =>
    (rowIndex + 1) % (AD_FREQUENCY + 1) === 0;

  const dataIndexForRow = (rowIndex: number) => {
    const adsAtOrBefore = Math.floor((rowIndex + 1) / (AD_FREQUENCY + 1));
    const adsBefore = isAdRow(rowIndex) ? adsAtOrBefore - 1 : adsAtOrBefore;
    return rowIndex - adsBefore;
  };

  const totalRows = useMemo(() => {
    const rows = allPosts.length + adCountFor(allPosts.length);
    return hasNextPage ? rows + 1 : rows; // +1 for loader row at the end
  }, [allPosts.length, hasNextPage]);

  const virtualizer = useWindowVirtualizer({
    count: totalRows,
    estimateSize: () => 250, // average height for post/ad; virtualizer will remeasure
    paddingEnd: 100,
    overscan: 12,
    getItemKey: (index) => {
      if (hasNextPage && index === totalRows - 1) return "loader";
      if (isAdRow(index)) {
        const adIndex = Math.floor((index + 1) / (AD_FREQUENCY + 1));
        return `ad-${adIndex}`;
      }
      const dataIndex = dataIndexForRow(index);
      const post = allPosts[dataIndex];
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

  if (isLoading) {
    return (
      <div className="w-full mx-auto space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <NoteCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      {allPosts.length === 0 && !isFetching && (
        <Alert>
          <MessageCircleDashedIcon />
          <AlertTitle>No data yet</AlertTitle>
          <AlertDescription>
            Start the conversation by creating a new post!
          </AlertDescription>
        </Alert>
      )}

      {/* v2-notes (top ad) */}
      <AdContainer className="mb-5" slotId="1999152698" />

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
              ) : isAdRow(row.index) ? (
                // v2-notes-list (inline ad row)
                <AdContainer className="mb-4" slotId="9012650581" />
              ) : (
                (() => {
                  const dataIndex = dataIndexForRow(row.index);
                  const post = allPosts[dataIndex];
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
