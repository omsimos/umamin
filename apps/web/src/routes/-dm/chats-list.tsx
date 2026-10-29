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
import { ChatAnnouncement } from "@/components/chat-announcement";
import { RefetchErrorAlert } from "@/components/refetch-error-alert";
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

// Chats only reach mutual follows, so this points people who want someone
// new to Umamin Chat instead.
function StrangerChatPromo() {
  return (
    <ChatAnnouncement
      title="Want to meet someone new?"
      description="Umamin Chat matches you with a stranger who shares your interests."
      utm="inbox-chats"
      dismissKey="umamin:chats-tab-promo-dismissed"
    />
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
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    refetch,
  } = useInfiniteQuery<DmThreadsResponse>({
    queryKey: queryKeys.dmThreads(),
    queryFn: ({ pageParam }) =>
      fetchDmThreadsPage((pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
    // Returning to the tab after reading a chat should show it read, and
    // returning to the app should show chats that moved while it was hidden.
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const threads = data?.pages.flatMap((page) => page.data) ?? [];
  const sentinelRef = useInfiniteScroll({
    // The sentinel stays mounted under a failed page, so without this it would
    // re-fire fetchNextPage on every failure; the retry button takes over.
    hasNextPage: Boolean(hasNextPage) && !isFetchNextPageError,
    isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  if (error && !data) {
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
      <div className="space-y-3">
        <Alert>
          <MessagesSquareIcon />
          <AlertTitle>No chats yet</AlertTitle>
          <AlertDescription>
            When you and someone follow each other, tap Chat on their profile to
            start a conversation.
          </AlertDescription>
        </Alert>
        <StrangerChatPromo />
      </div>
    );
  }

  return (
    <div className="space-y-1 mb-8">
      {error && (
        <RefetchErrorAlert
          onRetry={() => (isFetchNextPageError ? fetchNextPage() : refetch())}
          retrying={isFetching}
        />
      )}
      {threads.map((t) => (
        <ThreadRow key={t.threadId} thread={t} />
      ))}
      {hasNextPage ? (
        <div ref={sentinelRef}>
          <RowSkeleton />
        </div>
      ) : (
        <div className="pt-3">
          <StrangerChatPromo />
        </div>
      )}
    </div>
  );
}
