"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { cn } from "@umamin/ui/lib/utils";
import {
  AlertCircleIcon,
  MessageCircleDashedIcon,
  PinIcon,
} from "lucide-react";
import { PostCard } from "@/app/(public)/feed/components/post-card";
import { PostCardSkeleton } from "@/app/(public)/feed/components/post-card-skeleton";
import { useInfiniteBoundaryLoader } from "@/hooks/use-infinite-boundary-loader";
import { useWindowVirtualizerOffset } from "@/hooks/use-window-virtualizer-offset";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  PUBLIC_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import {
  fetchCurrentUserOptional,
  fetchUserPostsPage,
} from "@/lib/query-fetchers";
import type { FeedResponse } from "@/lib/query-types";
import type { FeedItem } from "@/types/post";

export function ProfilePostList({
  username,
  // When YouTabs is shown above (own profile) it already provides the divider,
  // so skip the top border to avoid a double line.
  showDivider = true,
}: {
  username: string;
  showDivider?: boolean;
}) {
  // Client-side auth (does not make the profile page dynamic). Shares the
  // app-wide currentUser cache, so it's usually a cache hit. Drives button
  // enablement + own-post menu on the cards.
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });
  const currentUserId = currentUser?.user?.id;
  const isAuthenticated = !!currentUserId;

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery<FeedResponse>({
    queryKey: queryKeys.userPosts(username),
    queryFn: ({ pageParam }) =>
      fetchUserPostsPage(username, (pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: PUBLIC_STALE_TIME,
    ...infiniteQueryDefaults,
  });
  const hasResolvedData = data !== undefined;

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

  const totalRows = hasNextPage ? allItems.length + 1 : allItems.length;
  const { containerRef, scrollMargin } =
    useWindowVirtualizerOffset<HTMLDivElement>();

  const virtualizer = useWindowVirtualizer({
    count: totalRows,
    // Over-estimated on purpose (same PostCard as the feed): a late
    // mid-scroll measurement under an under-estimate drags the page footer
    // into the list; over-estimating degrades to a transient gap.
    estimateSize: () => 380,
    paddingEnd: 100,
    overscan: 5,
    scrollMargin,
    getItemKey: (index) => {
      if (hasNextPage && index === totalRows - 1) return "loader";
      const item = allItems[index];
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
      <div className="w-full mx-auto mt-6">
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>
            Failed to load posts. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!hasResolvedData || isLoading) {
    return (
      <div className="w-full mx-auto space-y-4 mt-6">
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }

  if (allItems.length === 0 && !isFetching) {
    return (
      <div className="mt-6">
        <Alert>
          <MessageCircleDashedIcon />
          <AlertTitle>No posts yet</AlertTitle>
          <AlertDescription>
            This user hasn&apos;t posted anything.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={cn("w-full", showDivider ? "mt-6 border-t pt-6" : "mt-4")}>
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
              ) : (
                (() => {
                  const item = allItems[row.index];
                  if (!item || item.type !== "post") return null;
                  return (
                    <div key={item.post.id}>
                      {item.post.isPinned && (
                        <div className="mb-2 flex items-center px-2 text-sm text-muted-foreground sm:px-0">
                          <PinIcon className="mr-1 size-4" />
                          <span>Pinned</span>
                        </div>
                      )}
                      <PostCard
                        isAuthenticated={isAuthenticated}
                        currentUserId={currentUserId}
                        data={item.post}
                      />
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
