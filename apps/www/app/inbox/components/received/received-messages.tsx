"use client";

import { useThrottledCallback } from "@tanstack/react-pacer/throttler";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SelectMessage } from "@umamin/db/schema/message";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { AlertCircleIcon, MessageCircleDashedIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Cursor } from "@/types";
import type { PublicUser } from "@/types/user";
import { ReceivedMessageCard } from "./received-card";
import { ReceivedMessageCardSkeleton } from "./received-message-card-skeleton";

type MessagesResponse = {
  messages: (SelectMessage & { receiver: PublicUser })[];
  nextCursor: Cursor | null;
};

export function ReceivedMessages() {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery<MessagesResponse>({
    queryKey: ["received_messages"],
    queryFn: async ({ pageParam }) => {
      const cursor = (pageParam as string) ?? "";
      const url = cursor
        ? `/api/messages?type=received&cursor=${cursor}`
        : "/api/messages?type=received";

      const res = await fetch(url, {
        cache: "default",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Network response was not ok");
      }

      return (await res.json()) as MessagesResponse;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,

    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const allPosts = data?.pages.flatMap((page) => page.messages) ?? [];

  const virtualizer = useVirtualizer({
    count: hasNextPage ? allPosts.length + 1 : allPosts.length,
    // slightly above real card height to avoid initial gaps; remeasured on mount
    estimateSize: () => 240,
    paddingEnd: 100,
    overscan: 8,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) => {
      if (hasNextPage && index === allPosts.length) return "loader";
      const msg = allPosts[index];
      return msg?.id ?? `row-${index}`;
    },
  });

  const handleNextPage = useThrottledCallback(
    () => {
      fetchNextPage();
    },
    {
      wait: 3000,
    },
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: for virtualizer
  useEffect(() => {
    const [lastItem] = [...virtualizer.getVirtualItems()].reverse();

    if (!lastItem) {
      return;
    }

    if (
      lastItem.index >= allPosts.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      handleNextPage();
    }
  }, [
    hasNextPage,
    allPosts.length,
    isFetchingNextPage,
    handleNextPage,
    virtualizer.getVirtualItems(),
  ]);

  const items = virtualizer.getVirtualItems();

  if (error) {
    return (
      <div className="w-full mx-auto">
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>
            Failed to load posts. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full mx-auto space-y-4 mb-8">
        <ReceivedMessageCardSkeleton />
        <ReceivedMessageCardSkeleton />
        <ReceivedMessageCardSkeleton />
      </div>
    );
  }

  return (
    <div ref={parentRef} className="w-full overflow-auto">
      {allPosts.length === 0 && !isFetching && (
        <Alert>
          <MessageCircleDashedIcon />
          <AlertTitle>No messages yet</AlertTitle>
          <AlertDescription>
            Share your link and receive messages here.
          </AlertDescription>
        </Alert>
      )}

      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {items.map((virtualRow) => {
          const isLoaderRow = virtualRow.index > allPosts.length - 1;
          const msg = allPosts[virtualRow.index];

          if (!isLoaderRow && !msg) return null;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="pb-4"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {isLoaderRow ? (
                hasNextPage ? (
                  <ReceivedMessageCardSkeleton />
                ) : (
                  <div className="text-center mt-4 text-muted-foreground">
                    Nothing more to load
                  </div>
                )
              ) : (
                <ReceivedMessageCard key={msg?.id} data={msg} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
