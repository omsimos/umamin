import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { AlertCircleIcon, MessageCircleDashedIcon } from "lucide-react";
import { useMemo } from "react";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  PUBLIC_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchPostCommentsPage } from "@/lib/query-fetchers";
import type { CommentData, CommentsResponse } from "@/lib/types";
import { useIntersectionLoadMore } from "../-lib/hooks";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";

type CommentsListProps = {
  postId: string;
  isAuthenticated: boolean;
  currentUserId?: string;
};

export function CommentsList({
  postId,
  isAuthenticated,
  currentUserId,
}: CommentsListProps) {
  const {
    data,
    error,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useInfiniteQuery<CommentsResponse>({
    queryKey: queryKeys.postComments(postId),
    queryFn: ({ pageParam }) =>
      fetchPostCommentsPage(
        postId,
        (pageParam as string | null) ?? null,
        isAuthenticated,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: isAuthenticated ? PRIVATE_STALE_TIME : PUBLIC_STALE_TIME,
    ...infiniteQueryDefaults,
  });
  const hasResolvedData = data !== undefined;

  const comments = useMemo(() => {
    const flat = data?.pages.flatMap((page) => page.data) ?? [];
    const map = new Map<string, CommentData>();
    for (const item of flat) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return Array.from(map.values());
  }, [data]);

  const nextCursor = data?.pages[data.pages.length - 1]?.nextCursor ?? null;

  const { setSentinel } = useIntersectionLoadMore<HTMLDivElement>({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    loadMoreKey: nextCursor,
    onLoadMore: fetchNextPage,
  });

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertTitle>Failed to load comments</AlertTitle>
        <AlertDescription>Please try again later.</AlertDescription>
      </Alert>
    );
  }

  if (!hasResolvedData || isLoading) {
    return (
      <div className="space-y-6">
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }

  if (hasResolvedData && comments.length === 0 && !hasNextPage && !isFetching) {
    return (
      <div className="px-2">
        <Alert>
          <MessageCircleDashedIcon className="h-4 w-4" />
          <AlertTitle>No comments yet</AlertTitle>
          <AlertDescription>
            Be the first to start the conversation.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full [--list-row-height:180px]">
      {comments.map((comment) => (
        <div key={comment.id} className="list-row pb-4">
          <PostCard
            isComment
            isAuthenticated={isAuthenticated}
            currentUserId={currentUserId}
            data={comment}
            className="border-b"
          />
        </div>
      ))}

      {hasNextPage && (
        <>
          <div ref={setSentinel} aria-hidden className="h-px w-full" />
          <PostCardSkeleton />
        </>
      )}
    </div>
  );
}
