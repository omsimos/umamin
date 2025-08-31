/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertCircleIcon, MessageCircleDashedIcon } from "lucide-react";
import { useThrottledCallback } from "@tanstack/react-pacer/throttler";

import { Alert, AlertDescription, AlertTitle } from "@umamin/ui/components/alert";
import { SelectMessage } from "@umamin/db/schema/message";
import { SelectUser } from "@umamin/db/schema/user";
import { Cursor } from "@/types";
import { getMessagesAction } from "@/app/actions/message";
import { ReceivedMessageCard } from "./received-card";
import { ReceivedMessageCardSkeleton } from "./received-message-card-skeleton";

type MessagesResponse = {
  messages?: (SelectMessage & { receiver: SelectUser })[];
  nextCursor?: Cursor | null;
};

export function ReceivedMessages() {
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
      const data = await getMessagesAction({
        cursor: pageParam as Cursor,
        type: "received",
      });
      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const allPosts = data?.pages.flatMap((page) => page.messages) ?? [];

  const virtualizer = useWindowVirtualizer({
    count: hasNextPage ? allPosts.length + 1 : allPosts.length,
    estimateSize: () => 280,
    paddingEnd: 100,
    gap: 16,
    overscan: 6,
  });

  const handleNextPage = useThrottledCallback(
    () => {
      fetchNextPage();
    },
    {
      wait: 3000,
    },
  );

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
    fetchNextPage,
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
      <div className="w-full mx-auto space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <ReceivedMessageCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto">
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

          if ((!isLoaderRow && !msg) || !msg) return null;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
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
