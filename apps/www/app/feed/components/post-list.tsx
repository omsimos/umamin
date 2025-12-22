"use client";

import { useThrottledCallback } from "@tanstack/react-pacer/throttler";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { cn } from "@umamin/ui/lib/utils";
import { AlertCircleIcon, MessageCircleDashedIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import type { FeedItem } from "@/types/post";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";
import { RepostHeader } from "./repost-header";

const AdContainer = dynamic(() => import("@/components/ad-container"), {
  ssr: false,
});

type NotesResponse = {
  data: FeedItem[];
  nextCursor: string | null;
};

export function PostList({
  isAuthenticated,
  currentUserId,
}: {
  isAuthenticated: boolean;
  currentUserId?: string;
}) {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery<NotesResponse>({
    queryKey: ["posts"],
    queryFn: async ({ pageParam }) => {
      const url = pageParam ? `/api/posts?cursor=${pageParam}` : "/api/posts";
      const res = await fetch(url, { cache: "default" });
      if (!res.ok) throw new Error("Network response was not ok");
      return (await res.json()) as NotesResponse;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,

    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // De-duplicate feed items across pages
  const allItems: FeedItem[] = (() => {
    const flat = data?.pages.flatMap((p) => p.data) ?? [];
    const map = new Map<string, FeedItem>();
    for (const item of flat) {
      const key =
        item.type === "post"
          ? `post:${item.post.id}`
          : `repost:${item.repost.id}`;
      if (!map.has(key)) map.set(key, item);
    }
    return Array.from(map.values());
  })();

  const AD_FREQUENCY = 8; // show 1 ad *after* every 8 posts

  const adCountFor = (n: number) => Math.floor(n / AD_FREQUENCY);

  const isAdRow = (rowIndex: number) =>
    (rowIndex + 1) % (AD_FREQUENCY + 1) === 0;

  const dataIndexForRow = (rowIndex: number) => {
    const adsAtOrBefore = Math.floor((rowIndex + 1) / (AD_FREQUENCY + 1));
    const adsBefore = isAdRow(rowIndex) ? adsAtOrBefore - 1 : adsAtOrBefore;
    return rowIndex - adsBefore;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: dep mismatch
  const totalRows = useMemo(() => {
    const rows = allItems.length + adCountFor(allItems.length);
    return hasNextPage ? rows + 1 : rows; // +1 for loader row at the end
  }, [allItems.length, hasNextPage]);

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
      const item = allItems[dataIndex];
      if (!item) return `row-${index}`;
      return item.type === "post" ? item.post.id : item.repost.id;
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
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full">
      {allItems.length === 0 && !isFetching && (
        <Alert>
          <MessageCircleDashedIcon />
          <AlertTitle>No data yet</AlertTitle>
          <AlertDescription>
            Start the conversation by creating a new post!
          </AlertDescription>
        </Alert>
      )}

      {/* social-top (top ad) */}
      <AdContainer className="mb-5" slotId="9864130654" />

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
                <PostCardSkeleton />
              ) : isAdRow(row.index) ? (
                // social-list (inline ad row)
                <AdContainer className="mb-4" slotId="8551048984" />
              ) : (
                (() => {
                  const dataIndex = dataIndexForRow(row.index);
                  const item = allItems[dataIndex];
                  if (!item) return null;

                  if (item.type === "post") {
                    return (
                      <PostCard
                        isAuthenticated={isAuthenticated}
                        currentUserId={currentUserId}
                        key={item.post.id}
                        data={item.post}
                      />
                    );
                  }

                  const repost = item.repost;
                  return (
                    <div className="mt-2">
                      <RepostHeader
                        user={repost.user}
                        createdAt={repost.createdAt}
                        content={repost.content}
                      />

                      <div
                        className={cn(`mt-4 sm:pr-0`, {
                          "pl-8 pr-2 border-b pb-6": repost.content,
                        })}
                      >
                        <PostCard
                          isRepost={!!repost.content}
                          isAuthenticated={isAuthenticated}
                          currentUserId={currentUserId}
                          key={item.post.id}
                          data={item.post}
                        />
                      </div>
                    </div>
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
