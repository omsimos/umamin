import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { AlertCircleIcon, MessageCircleDashedIcon } from "lucide-react";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchMessagesPage } from "@/lib/query-fetchers";
import type { MessagesResponse } from "@/lib/types";
import { useInfiniteScroll } from "../-shared/use-infinite-scroll";
import { ReceivedMessageCard } from "./received-card";
import { ReceivedMessageCardSkeleton } from "./received-message-card-skeleton";

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
    queryKey: queryKeys.receivedMessages(),
    queryFn: ({ pageParam }) =>
      fetchMessagesPage("received", (pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const messages = data?.pages.flatMap((page) => page.messages) ?? [];
  const sentinelRef = useInfiniteScroll({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
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

  if (data === undefined || isLoading) {
    return (
      <div className="w-full mx-auto space-y-4 mb-8">
        <ReceivedMessageCardSkeleton />
        <ReceivedMessageCardSkeleton />
        <ReceivedMessageCardSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full">
      {messages.length === 0 && !isFetching && (
        <Alert>
          <MessageCircleDashedIcon />
          <AlertTitle>No messages yet</AlertTitle>
          <AlertDescription>
            Share your link and receive messages here.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 [--list-row-height:240px]">
        {messages.map((msg) => (
          <div key={msg.id} className="list-row">
            <ReceivedMessageCard data={msg} />
          </div>
        ))}
      </div>

      {hasNextPage && (
        <div ref={sentinelRef} className="mt-4">
          <ReceivedMessageCardSkeleton />
        </div>
      )}
    </div>
  );
}
