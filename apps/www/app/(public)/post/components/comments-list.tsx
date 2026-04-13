"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { AlertCircleIcon, MessageCircleDashedIcon } from "lucide-react";
import { useMemo } from "react";
import { PostCard } from "@/app/(public)/feed/components/post-card";
import { PostCardSkeleton } from "@/app/(public)/feed/components/post-card-skeleton";
import { useInfiniteBoundaryLoader } from "@/hooks/use-infinite-boundary-loader";
import { useWindowVirtualizerOffset } from "@/hooks/use-window-virtualizer-offset";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  PUBLIC_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchPostCommentsPage } from "@/lib/query-fetchers";
import type { CommentsResponse } from "@/lib/query-types";
import type { CommentData } from "@/types/post";

type CommentsListProps = {
  postId: string;
  isAuthenticated: boolean;
};

export function CommentsList({ postId, isAuthenticated }: CommentsListProps) {
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

  const totalRows = useMemo(
    () => (hasNextPage ? comments.length + 1 : comments.length),
    [comments.length, hasNextPage],
  );

  const { containerRef, scrollMargin } =
    useWindowVirtualizerOffset<HTMLDivElement>();

  const virtualizer = useWindowVirtualizer({
    count: totalRows,
    estimateSize: () => 180,
    overscan: 12,
    paddingEnd: 80,
    scrollMargin,
    getItemKey: (index) => {
      if (hasNextPage && index === totalRows - 1) return "loader";
      return comments[index]?.id ?? `row-${index}`;
    },
  });

  const items = virtualizer.getVirtualItems();
  const nextCursor = data?.pages[data.pages.length - 1]?.nextCursor ?? null;

  useInfiniteBoundaryLoader({
    boundaryIndex: totalRows - 1,
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    items,
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
    <div
      ref={containerRef}
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        width: "100%",
        position: "relative",
      }}
    >
      {items.map((row) => {
        const isLoaderRow = hasNextPage && row.index === totalRows - 1;
        const comment = comments[row.index];

        return (
          <div
            key={row.key}
            ref={virtualizer.measureElement}
            className="pb-4"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${row.start - scrollMargin}px)`,
            }}
          >
            {isLoaderRow ? (
              <PostCardSkeleton />
            ) : (
              comment && (
                <PostCard
                  isComment
                  isAuthenticated={isAuthenticated}
                  key={comment.id}
                  data={comment}
                  className="border-b"
                />
              )
            )}
          </div>
        );
      })}

      {/* {!hasNextPage && comments.length > 0 && ( */}
      {/*   <p className="text-sm text-muted-foreground text-center py-2"> */}
      {/*     You&apos;ve reached the end. */}
      {/*   </p> */}
      {/* )} */}
    </div>
  );
}
