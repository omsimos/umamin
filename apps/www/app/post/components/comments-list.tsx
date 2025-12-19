"use client";

import { useThrottledCallback } from "@tanstack/react-pacer/throttler";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { AlertCircleIcon, MessageCircleDashedIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { PostCard } from "@/app/feed/components/post-card";
import type { PostData } from "@/types/post";

type CommentsResponse = {
  data: PostData[];
  nextCursor: string | null;
};

type CommentsListProps = {
  postId: string;
};

export function CommentsList({ postId }: CommentsListProps) {
  const {
    data,
    error,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useInfiniteQuery<CommentsResponse>({
    queryKey: ["post-comments", postId],
    queryFn: async ({ pageParam }) => {
      const url = pageParam
        ? `/api/posts/${postId}/comments?cursor=${pageParam}`
        : `/api/posts/${postId}/comments`;
      const res = await fetch(url, { cache: "default" });
      if (!res.ok) throw new Error("Failed to load comments");
      return (await res.json()) as CommentsResponse;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
  });

  const comments = useMemo(() => {
    const flat = data?.pages.flatMap((page) => page.data) ?? [];
    const map = new Map<string, PostData>();
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

  const virtualizer = useWindowVirtualizer({
    count: totalRows,
    estimateSize: () => 180,
    overscan: 12,
    paddingEnd: 80,
    getItemKey: (index) => {
      if (hasNextPage && index === totalRows - 1) return "loader";
      return comments[index]?.id ?? `row-${index}`;
    },
  });

  const items = virtualizer.getVirtualItems();

  const handleNextPage = useThrottledCallback(
    () => {
      fetchNextPage();
    },
    { wait: 2000 },
  );

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || items.length === 0) return;
    const lastItem = items[items.length - 1];
    const lastIndex = totalRows - 1; // loader row index if hasNextPage
    if (lastItem?.index >= lastIndex) {
      handleNextPage();
    }
  }, [items, hasNextPage, isFetchingNextPage, totalRows, handleNextPage]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertTitle>Failed to load comments</AlertTitle>
        <AlertDescription>Please try again later.</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return <div className="space-y-6">Loading comments...</div>;
  }

  if (comments.length === 0 && !hasNextPage && !isFetching) {
    return (
      <Alert>
        <MessageCircleDashedIcon className="h-4 w-4" />
        <AlertTitle>No comments yet</AlertTitle>
        <AlertDescription>
          Be the first to start the conversation.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div
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
              transform: `translateY(${row.start}px)`,
            }}
          >
            {isLoaderRow ? (
              <div className="flex items-center justify-center text-sm text-muted-foreground py-4">
                {isFetchingNextPage
                  ? "Loading more..."
                  : "Loading more comments..."}
              </div>
            ) : (
              comment && (
                <PostCard
                  isComment
                  key={comment.id}
                  data={comment}
                  className="border-b"
                />
              )
            )}
          </div>
        );
      })}

      {!hasNextPage && comments.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          You&apos;ve reached the end.
        </p>
      )}
    </div>
  );
}
