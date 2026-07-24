import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
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
import type { FeedItem, FeedResponse } from "@/lib/types";
import { useIntersectionLoadMore } from "../-lib/hooks";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";

export function ProfilePostList({
  username,
  // When YouTabs is shown above (own profile) it already provides the divider,
  // so skip the top border to avoid a double line.
  showDivider = true,
}: {
  username: string;
  showDivider?: boolean;
}) {
  // Client-side auth. Shares the app-wide currentUser cache (usually a hit).
  // Drives button enablement + own-post menu on the cards.
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

  const nextCursor = data?.pages[data.pages.length - 1]?.nextCursor ?? null;

  const { setSentinel } = useIntersectionLoadMore<HTMLDivElement>({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
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
      {allItems.map((item) => {
        if (item.type !== "post") return null;
        return (
          <div key={item.post.id} className="pb-4">
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
      })}

      {hasNextPage && (
        <>
          <div ref={setSentinel} aria-hidden className="h-px w-full" />
          <PostCardSkeleton />
        </>
      )}
    </div>
  );
}
