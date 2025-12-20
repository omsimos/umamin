"use client";

import { useThrottledCallback } from "@tanstack/react-pacer/throttler";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { cn } from "@umamin/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircleIcon,
  MessageCircleDashedIcon,
  Repeat2Icon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { shortTimeAgo } from "@/lib/utils";
import type { FeedItem } from "@/types/post";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";

const AdContainer = dynamic(() => import("@/components/ad-container"), {
  ssr: false,
});

type NotesResponse = {
  data: FeedItem[];
  nextCursor: string | null;
};

export function PostList({ isAuthenticated }: { isAuthenticated: boolean }) {
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
    refetchInterval: 30_000,
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

  const AD_FREQUENCY = 5; // show 1 ad *after* every 5 posts

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
                <PostCardSkeleton />
              ) : isAdRow(row.index) ? (
                // v2-notes-list (inline ad row)
                <AdContainer className="mb-4" slotId="9012650581" />
              ) : (
                (() => {
                  const dataIndex = dataIndexForRow(row.index);
                  const item = allItems[dataIndex];
                  if (!item) return null;

                  if (item.type === "post") {
                    return (
                      <PostCard
                        isAuthenticated={isAuthenticated}
                        key={item.post.id}
                        data={item.post}
                      />
                    );
                  }

                  const repost = item.repost;
                  return (
                    <div className="mt-2">
                      {repost.content ? (
                        <div className="flex items-start gap-3 px-2 sm:px-0">
                          <Avatar className="size-9">
                            <AvatarImage
                              src={repost.user.imageUrl ?? ""}
                              alt="User avatar"
                            />
                            <AvatarFallback>
                              <Repeat2Icon className="size-4" />
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1">
                            <div className="flex items-center justify-between text-[15px]">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/user/${repost.user.username}`}
                                  className="font-semibold hover:underline"
                                >
                                  {repost.user.displayName ??
                                    repost.user.username}
                                </Link>
                                <span className="text-muted-foreground">
                                  @{repost.user.username}
                                </span>
                              </div>
                              <span className="text-muted-foreground text-xs">
                                {shortTimeAgo(repost.createdAt)}
                              </span>
                            </div>
                            {repost.content && (
                              <p className="text-sm mt-2">{repost.content}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex px-2 sm:px-0 items-center text-muted-foreground text-sm">
                          <Repeat2Icon className="inline size-4 mr-1" />
                          <Link
                            href={`/user/${repost.user.username}`}
                            className="hover:underline mr-1 font-semibold"
                          >
                            @{repost.user.username}
                          </Link>
                          <span>
                            reposted{" "}
                            {formatDistanceToNow(repost.createdAt, {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      )}

                      <div
                        className={cn(`mt-4 sm:pr-0`, {
                          "pl-8 pr-2 border-b pb-6": repost.content,
                        })}
                      >
                        <PostCard
                          isRepost={!!repost.content}
                          isAuthenticated={isAuthenticated}
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
