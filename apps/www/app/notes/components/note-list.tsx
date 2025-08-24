/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertCircleIcon, MessageCircleDashedIcon } from "lucide-react";
import { useThrottledCallback } from "@tanstack/react-pacer/throttler";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SelectNote } from "@umamin/db/schema/note";
import { NoteCard } from "./note-card";
import { SelectUser } from "@umamin/db/schema/user";

type NotesResponse = {
  data: (SelectNote & { user: SelectUser })[];
  nextCursor: string | null;
};

export function NoteList() {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery<NotesResponse>({
    queryKey: ["notes"],
    queryFn: async ({ pageParam }) => {
      const url = pageParam ? `/api/notes?cursor=${pageParam}` : "/api/notes";

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Network response was not ok");
      }
      return res.json();
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const allPosts = data?.pages.flatMap((page) => page.data) ?? [];
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: hasNextPage ? allPosts.length + 1 : allPosts.length,
    getScrollElement: () => (typeof window !== "undefined" ? document.documentElement : null),
    estimateSize: () => 216,
    paddingEnd: 100,
  });

  const handleNextPage = useThrottledCallback(
    () => {
      fetchNextPage();
    },
    {
      wait: 3000,
    },
  );

  useEffect(() => {
    const [lastItem] = [...virtualizer.getVirtualItems()].reverse();

    if (!lastItem) {
      return;
    }

    if (
      lastItem.index >= allPosts.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      handleNextPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    allPosts.length,
    isFetchingNextPage,
    handleNextPage,
    virtualizer.getVirtualItems(),
  ]);

  const items = virtualizer.getVirtualItems();

  if (error) {
    return (
      <div className="w-full mx-auto">
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>
            Failed to load data. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full mx-auto space-y-3">
        {/* {Array.from({ length: 3 }).map((_, i) => ( */}
        {/*   <PostCardSkeleton key={i} /> */}
        {/* ))} */}
        <p>loading...</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="w-full">
      {allPosts.length === 0 && !isFetching && (
        <Alert>
          <MessageCircleDashedIcon />
          <AlertTitle>No data yet</AlertTitle>
          <AlertDescription>
            Start the conversation by creating a new post!
          </AlertDescription>
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
          const post = allPosts[virtualRow.index];

          if (!isLoaderRow && !post) return null;

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
                  <p>
                    loading...
                    {/* <PostCardSkeleton /> */}
                  </p>
                ) : (
                  <div className="text-center mt-4 text-muted-foreground">
                    Nothing more to load
                  </div>
                )
              ) : (
                <NoteCard key={post.id} data={post} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
