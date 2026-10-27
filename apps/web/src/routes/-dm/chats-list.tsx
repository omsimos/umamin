import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { Avatar, AvatarImage } from "@umamin/ui/components/avatar";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { cn } from "@umamin/ui/lib/utils";
import { AlertCircleIcon, MessagesSquareIcon } from "lucide-react";
import { BlobatarFallback } from "@/components/blobatar-fallback";
import { TimeAgo } from "@/components/time-ago";
import type { DmThreadItem, DmThreadsResponse } from "@/lib/dm/types";
import { Link } from "@/lib/navigation";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchDmThreadsPage } from "@/lib/query-fetchers";
import { useInfiniteScroll } from "../-shared/use-infinite-scroll";

function ThreadRow({ thread }: { thread: DmThreadItem }) {
  const name = thread.peer.displayName ?? thread.peer.username;
  const preview =
    thread.preview === null
      ? "Message unsent"
      : `${thread.lastFromMe ? "You: " : ""}${thread.preview}`;
  return (
    <Link
      href={`/inbox/chats/${thread.peer.username}`}
      className="hover:bg-muted/60 focus-visible:ring-ring/50 flex items-center gap-3 rounded-xl px-2 py-2.5 outline-none focus-visible:ring-[3px]"
    >
      <Avatar className="size-12">
        <AvatarImage src={thread.peer.imageUrl ?? ""} alt="" />
        <BlobatarFallback seed={thread.peer.id} />
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              "truncate text-sm",
              thread.unread ? "font-bold" : "font-semibold",
            )}
          >
            {name}
          </span>
          <TimeAgo
            date={new Date(thread.lastMessageAt)}
            className="text-muted-foreground shrink-0 text-xs"
          />
        </span>
        <span
          className={cn(
            "block truncate text-sm",
            thread.unread
              ? "text-foreground font-medium"
              : "text-muted-foreground",
          )}
        >
          {preview}
        </span>
      </span>
      {thread.unread && (
        <span
          role="img"
          aria-label="Unread"
          className="bg-primary size-2.5 shrink-0 rounded-full"
        />
      )}
    </Link>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2 py-2.5">
      <Skeleton className="size-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export function ChatsList() {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<DmThreadsResponse>({
    queryKey: queryKeys.dmThreads(),
    queryFn: ({ pageParam }) =>
      fetchDmThreadsPage((pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
    // Returning to the tab after reading a chat should show it read.
    refetchOnMount: true,
  });

  const threads = data?.pages.flatMap((page) => page.data) ?? [];
  const sentinelRef = useInfiniteScroll({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertDescription>
          Failed to load chats. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (data === undefined || isLoading) {
    return (
      <div className="space-y-1">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <Alert>
        <MessagesSquareIcon />
        <AlertTitle>No chats yet</AlertTitle>
        <AlertDescription>
          When you and someone follow each other, tap the chat button on their
          profile to start a conversation.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-1 mb-8">
      {threads.map((t) => (
        <ThreadRow key={t.threadId} thread={t} />
      ))}
      {hasNextPage && (
        <div ref={sentinelRef}>
          <RowSkeleton />
        </div>
      )}
    </div>
  );
}
