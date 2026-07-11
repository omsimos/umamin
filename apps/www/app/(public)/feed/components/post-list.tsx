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
import { LinkTabs } from "@/components/link-tabs";
import { useInfiniteBoundaryLoader } from "@/hooks/use-infinite-boundary-loader";
import { useWindowVirtualizerOffset } from "@/hooks/use-window-virtualizer-offset";
import type { FeedSort } from "@/lib/feed-sort";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  PUBLIC_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchPostsPage } from "@/lib/query-fetchers";
import type { FeedResponse } from "@/lib/query-types";
import type { FeedItem } from "@/types/post";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";
import { RepostHeader } from "./repost-header";

export function PostList({
  sort,
  isAuthenticated,
  currentUserId,
}: {
  sort: FeedSort;
  isAuthenticated: boolean;
  currentUserId?: string;
}) {
  const viewerKey = currentUserId ?? "public";
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery<FeedResponse>({
    queryKey: queryKeys.posts(sort, viewerKey),
    enabled: sort !== "following" || isAuthenticated,
    queryFn: ({ pageParam }) =>
      fetchPostsPage(
        (pageParam as string | null) ?? null,
        isAuthenticated,
        sort,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: isAuthenticated ? PRIVATE_STALE_TIME : PUBLIC_STALE_TIME,
    ...infiniteQueryDefaults,
  });
  const hasResolvedData = data !== undefined;

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
    // Slightly OVER the typical post/ad height on purpose: rows mounted
    // mid-scroll measure a beat late, and an under-estimate puts the page
    // footer inside the feed during that window. Over-estimating degrades to
    // a transient gap instead.
    estimateSize: () => 380,
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
      <LinkTabs
        className="mb-5"
        tabs={[
          { label: "Hot", href: "/feed", active: sort === "hot" },
          ...(isAuthenticated
            ? [
                {
                  label: "Following",
                  href: "/feed?sort=following",
                  active: sort === "following",
                },
              ]
            : []),
          {
            label: "Latest",
            href: "/feed?sort=latest",
            active: sort === "latest",
          },
        ]}
      />

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
                      />

                      <div className="mt-4 sm:pr-0">
                        <PostCard
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
