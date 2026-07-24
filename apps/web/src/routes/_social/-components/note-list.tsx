import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { Button } from "@umamin/ui/components/button";
import {
  AlertCircleIcon,
  MessageCircleDashedIcon,
  ShuffleIcon,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  PUBLIC_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchNotesPage } from "@/lib/query-fetchers";
import type { NoteItem, NotesResponse } from "@/lib/types";
import { useIntersectionLoadMore } from "../-lib/hooks";
import { NoteCard } from "./note-card";
import { NoteCardSkeleton } from "./note-card-skeleton";

const AD_FREQUENCY = 8;

export function NoteList({
  isAuthenticated,
  currentUserId,
}: {
  isAuthenticated: boolean;
  currentUserId?: string;
}) {
  // Per-viewer query key (mirrors PostList): the public hydration and each
  // authed viewer live in separate cache entries.
  const viewerKey = currentUserId ?? "public";
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery<NotesResponse>({
    queryKey: queryKeys.notes(viewerKey),
    queryFn: ({ pageParam }) =>
      fetchNotesPage((pageParam as string | null) ?? null, isAuthenticated),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: isAuthenticated ? PRIVATE_STALE_TIME : PUBLIC_STALE_TIME,
    ...infiniteQueryDefaults,
  });
  const hasResolvedData = data !== undefined;

  // De-duplicate notes by id across pages.
  const allPosts: NoteItem[] = (() => {
    const flat = data?.pages.flatMap((p) => p.data) ?? [];
    const map = new Map<string, NoteItem>();
    for (const item of flat) map.set(item.id, item);
    return Array.from(map.values());
  })();

  const nextCursor = data?.pages[data.pages.length - 1]?.nextCursor ?? null;

  const { setSentinel } = useIntersectionLoadMore<HTMLDivElement>({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    loadMoreKey: nextCursor,
    onLoadMore: fetchNextPage,
  });

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  const handleShuffle = () => {
    if (allPosts.length < 2) return;

    // Only shuffle among already-loaded notes — no extra fetches.
    const pool = allPosts.filter((post) => post.id !== highlightedId);
    const target = pool[Math.floor(Math.random() * pool.length)];
    if (!target) return;

    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    // Every note is mounted (non-virtualized), so the element is always present.
    const el = document.getElementById(`umamin-${target.id}`);
    el?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "center",
    });

    setHighlightedId(target.id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedId(null), 2000);
  };

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

  if (!hasResolvedData || isLoading) {
    return (
      <div className="w-full mx-auto space-y-4">
        <NoteCardSkeleton />
        <NoteCardSkeleton />
        <NoteCardSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full">
      {hasResolvedData && allPosts.length === 0 && !isFetching && (
        <Alert>
          <MessageCircleDashedIcon />
          <AlertTitle>nothing here yet</AlertTitle>
          <AlertDescription>
            say something into the void — it'll land right here.
          </AlertDescription>
        </Alert>
      )}

      {allPosts.length >= 2 && (
        <div className="mb-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShuffle}
            className="min-h-11 gap-2 rounded-full"
          >
            <ShuffleIcon className="size-4" />
            Surprise me
          </Button>
        </div>
      )}

      {/* v2-notes (top ad) */}
      <ClientOnlyAdContainer className="mb-5" placement="notes_top" />

      <div className="w-full space-y-4">
        {allPosts.map((post, index) => {
          const showAd = (index + 1) % AD_FREQUENCY === 0;
          return (
            <Fragment key={post.id}>
              <NoteCard
                isAuthenticated={isAuthenticated}
                currentUserId={currentUserId}
                data={post}
                index={index}
                isHighlighted={post.id === highlightedId}
              />
              {showAd && (
                <ClientOnlyAdContainer
                  className="mb-4"
                  placement="notes_inline"
                />
              )}
            </Fragment>
          );
        })}

        {hasNextPage && (
          <>
            <div ref={setSentinel} aria-hidden className="h-px w-full" />
            <NoteCardSkeleton />
          </>
        )}
      </div>
    </div>
  );
}
