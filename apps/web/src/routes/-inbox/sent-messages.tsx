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
      <div className="w-full mx-auto space-y-3 mb-8">
        <SentMessageCardSkeleton />
        <SentMessageCardSkeleton />
        <SentMessageCardSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full">
      {messages.length === 0 && !isFetching && (
        <Alert>
          <MessageCircleDashedIcon />
          <AlertTitle>No messages yet</AlertTitle>
          <AlertDescription>Send your first message!</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {messages.map((msg) => (
          <SentMessageCard key={msg.id} data={msg} />
        ))}
      </div>

      {hasNextPage && (
        <div ref={sentinelRef} className="mt-4">
          <SentMessageCardSkeleton />
        </div>
      )}
    </div>
  );
}
