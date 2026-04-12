"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { AlertCircleIcon, MessageCircleDashedIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useInfiniteBoundaryLoader } from "@/hooks/use-infinite-boundary-loader";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchMessagesPage } from "@/lib/query-fetchers";
import type { MessagesResponse } from "@/lib/query-types";
import { SentMessageCard } from "./sent-card";
import { SentMessageCardSkeleton } from "./sent-message-card-skeleton";

export function SentMessages() {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery<MessagesResponse>({
    queryKey: queryKeys.sentMessages(),
    queryFn: ({ pageParam }) =>
      fetchMessagesPage("sent", (pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });
  const hasResolvedData = data !== undefined;

  const allPosts = data?.pages.flatMap((page) => page.messages) ?? [];
  const [hasInteracted, setHasInteracted] = useState(false);
  const totalRows = hasNextPage ? allPosts.length + 1 : allPosts.length;

  const virtualizer = useWindowVirtualizer({
    count: totalRows,
    // Chat bubbles are taller; use bigger estimate to prevent overlap before measure
    estimateSize: () => 320,
    paddingEnd: 100,
    overscan: 8,
    getItemKey: (index) => {
      if (hasNextPage && index === totalRows - 1) return "loader";
      const msg = allPosts[index];
      return msg?.id ?? `row-${index}`;
    },
  });

  useEffect(() => {
    if (hasInteracted) {
      return;
    }

    const handleScroll = () => {
      if (window.scrollY > 0) {
        setHasInteracted(true);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasInteracted]);

  const items = virtualizer.getVirtualItems();
  const nextCursor = data?.pages[data.pages.length - 1]?.nextCursor ?? null;

  useInfiniteBoundaryLoader({
    boundaryIndex: totalRows - 1,
    enabled: hasInteracted,
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
            Failed to load messages. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!hasResolvedData || isLoading) {
    return (
      <div className="w-full mx-auto space-y-3 mb-8">
        <SentMessageCardSkeleton />
        <SentMessageCardSkeleton />
        <SentMessageCardSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full">
      {hasResolvedData && allPosts.length === 0 && !isFetching && (
        <Alert>
          <MessageCircleDashedIcon />
          <AlertTitle>No messages yet</AlertTitle>
          <AlertDescription>Send your first message!</AlertDescription>
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
                  <SentMessageCardSkeleton />
                ) : (
                  <div className="text-center mt-4 text-muted-foreground">
                    Nothing more to load
                  </div>
                )
              ) : (
                <SentMessageCard key={msg?.id} data={msg} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
