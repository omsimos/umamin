"use client";

import type { InfiniteData } from "@tanstack/react-query";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { Button } from "@umamin/ui/components/button";
import {
  AlertCircleIcon,
  ArrowUpIcon,
  MessageCircleDashedIcon,
} from "lucide-react";
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
import { fetchFeedHead, fetchPostsPage } from "@/lib/query-fetchers";
import type { FeedResponse } from "@/lib/query-types";
import type { FeedItem } from "@/types/post";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";
import { RepostHeader } from "./repost-header";

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
    refetch,
  } = useInfiniteQuery<FeedResponse>({
    queryKey: queryKeys.posts(),
    queryFn: ({ pageParam }) =>
      fetchPostsPage((pageParam as string | null) ?? null, isAuthenticated),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: isAuthenticated ? PRIVATE_STALE_TIME : PUBLIC_STALE_TIME,
    ...infiniteQueryDefaults,
  });
  const hasResolvedData = data !== undefined;

  const queryClient = useQueryClient();

  // Cheap "new posts" head-check: a Redis-backed (or CDN-cached) timestamp,
  // polled while the tab is visible (refetchInterval pauses when hidden). Never
  // touches Turso. Inactive when Redis is unset (latest === null).
  const { data: head } = useQuery({
    queryKey: ["feed-head"],
    queryFn: fetchFeedHead,
    refetchInterval: 60_000,
    staleTime: 30_000,
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

  const topItem = allItems[0];
  const topCreatedAtMs = topItem
    ? new Date(
        topItem.type === "post"
          ? topItem.post.createdAt
          : topItem.repost.createdAt,
      ).getTime()
    : 0;
  const showNewPosts =
    !!head?.latest && topCreatedAtMs > 0 && head.latest > topCreatedAtMs;

  // Refetch only page 1 (drop later pages — we're scrolling back to top anyway)
  // so the cost stays bounded; the dedupe map above absorbs any overlap.
  const handleShowNewPosts = async () => {
    queryClient.setQueryData<InfiniteData<FeedResponse>>(
      queryKeys.posts(),
      (old) =>
        old
          ? {
              ...old,
              pages: old.pages.slice(0, 1),
              pageParams: old.pageParams.slice(0, 1),
            }
          : old,
    );
    await refetch();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

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
      allItems.length + Math.floor(allItems.length / AD_FREQUENCY);
    return hasNextPage ? contentRows + 1 : contentRows;
  }, [allItems.length, hasNextPage]);

  const { containerRef, scrollMargin } =
    useWindowVirtualizerOffset<HTMLDivElement>();

  const virtualizer = useWindowVirtualizer({
    count: totalRows,
    estimateSize: () => 250, // average height for post/ad; virtualizer will remeasure
    paddingEnd: 100,
    overscan: 5,
    scrollMargin,
    getItemKey: (index) => {
      if (hasNextPage && index === totalRows - 1) return "loader";
      if (isAdRow(index)) {
        const adIndex = Math.floor((index + 1) / (AD_FREQUENCY + 1));
        return `feed-inline-ad-${adIndex}`;
      }
      const item = allItems[dataIndexForRow(index)];
      if (!item) return `row-${index}`;
      return item.type === "post" ? item.post.id : item.repost.id;
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
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full">
      {showNewPosts && (
        <div className="sticky top-2 z-20 mb-4 flex justify-center">
          <Button
            type="button"
            onClick={handleShowNewPosts}
            className="h-auto flex items-center gap-1.5 rounded-full bg-pink-500 px-4 py-1.5 text-sm font-medium text-white shadow-lg transition-colors hover:bg-pink-600 hover:text-white"
          >
            <ArrowUpIcon className="size-4" />
            Show new posts
          </Button>
        </div>
      )}

      {hasResolvedData && allItems.length === 0 && !isFetching && (
        <Alert>
          <MessageCircleDashedIcon />
          <AlertTitle>No data yet</AlertTitle>
          <AlertDescription>
            Start the conversation by creating a new post!
          </AlertDescription>
        </Alert>
      )}

      {/* social-top (top ad) */}
      <ClientOnlyAdContainer className="mb-5" placement="feed_top" />

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
                <PostCardSkeleton />
              ) : isInlineAdRow ? (
                <ClientOnlyAdContainer
                  className="mb-4"
                  placement="feed_inline"
                />
              ) : (
                (() => {
                  const item = allItems[dataIndexForRow(row.index)];
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
                        className={`mt-4 sm:pr-0 ${
                          repost.content ? "pl-8 pr-2 border-b pb-6" : ""
                        }`}
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
