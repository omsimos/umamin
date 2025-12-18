"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { AlertCircleIcon, MessageCircleDashedIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { PostCard } from "@/app/feed/components/post-card";
import type { CommentData } from "@/types/post";

type CommentsResponse = {
  data: CommentData[];
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
    const map = new Map<string, CommentData>();
    for (const item of flat) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return Array.from(map.values());
  }, [data]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "320px 0px 320px 0px" },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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

  return (
    <div className="space-y-6">
      {comments.length === 0 && !isFetching && (
        <Alert>
          <MessageCircleDashedIcon className="h-4 w-4" />
          <AlertTitle>No comments yet</AlertTitle>
          <AlertDescription>
            Be the first to start the conversation.
          </AlertDescription>
        </Alert>
      )}

      {comments.map((comment) => (
        <PostCard
          isComment
          key={comment.id}
          data={comment}
          className="border-b"
        />
      ))}

      {hasNextPage && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center text-sm text-muted-foreground py-4"
        >
          {isFetchingNextPage ? "Loading more..." : "Loading more comments..."}
        </div>
      )}

      {!hasNextPage && comments.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          You&apos;ve reached the end.
        </p>
      )}
    </div>
  );
}
