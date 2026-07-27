import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { cn } from "@umamin/ui/lib/utils";
import { AlertCircleIcon, MessageCircleDashedIcon } from "lucide-react";
import { Fragment } from "react";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { shouldShowInFeedAd } from "@/lib/ad-placements";
import type { FeedSort } from "@/lib/feed-sort";
import { Link } from "@/lib/navigation";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  PUBLIC_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchPostsPage } from "@/lib/query-fetchers";
import type { FeedItem, FeedResponse } from "@/lib/types";
import { useIntersectionLoadMore } from "../-lib/hooks";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";
import { RepostHeader } from "./repost-header";

export function PostList({
  sort,
  isAuthenticated,
  currentUserId,
}: {
  sort: FeedSort;
  isAuthenticated: boolean;
  currentUserId?: string;
}) {
  const viewerKey = currentUserId ?? "public";
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery<FeedResponse>({
    queryKey: queryKeys.posts(sort, viewerKey),
    enabled: sort !== "following" || isAuthenticated,
    queryFn: ({ pageParam }) =>
      fetchPostsPage(
        (pageParam as string | null) ?? null,
        isAuthenticated,
        sort,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: isAuthenticated ? PRIVATE_STALE_TIME : PUBLIC_STALE_TIME,
    ...infiniteQueryDefaults,
  });
  const hasResolvedData = data !== undefined;

  // De-duplicate feed items across pages.
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

  // Non-virtualized: a sentinel below the last card pages the feed as it nears
  // the viewport (see useIntersectionLoadMore — the react-virtual dependency
  // apps/www used is unavailable in apps/web).
  const { setSentinel } = useIntersectionLoadMore<HTMLDivElement>({
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    loadMoreKey: nextCursor,
    onLoadMore: fetchNextPage,
  });

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
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }

  // Tabs render inline (not the shared LinkTabs) because sort lives in the
  // querystring: TanStack Router carries it via the Link `search` prop, whereas
  // LinkTabs only takes href strings and the nav shim would hand `?sort=…` to
  // `to`, which doesn't parse as search. Same markup as LinkTabs.
  const tabs = [
    { label: "Hot", sort: "hot" as const },
    ...(isAuthenticated
      ? [{ label: "Following", sort: "following" as const }]
      : []),
    { label: "Latest", sort: "latest" as const },
  ];

  return (
    <div className="w-full">
      <nav className="mb-5 flex w-full border-b">
        {tabs.map((tab) => {
          const active = sort === tab.sort;
          return (
            <Link
              key={tab.sort}
              to="/feed"
              search={tab.sort === "hot" ? {} : { sort: tab.sort }}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex-1 border-b-2 px-2 pb-2.5 text-center text-sm font-semibold transition-colors",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {hasResolvedData && allItems.length === 0 && !isFetching && (
        <Alert>
          <MessageCircleDashedIcon />
          <AlertTitle>No data yet</AlertTitle>
          <AlertDescription>
            Start the conversation by creating a new post!
          </AlertDescription>
        </Alert>
      )}

      {/* social-top (top ad) */}
      <ClientOnlyAdContainer className="mb-5" placement="feed_top" />

      <div className="w-full [--list-row-height:380px]">
        {allItems.map((item, index) => {
          const key =
            item.type === "post"
              ? `post:${item.post.id}`
              : `repost:${item.repost.id}`;
          const showAd = shouldShowInFeedAd(index);

          return (
            <Fragment key={key}>
              <div className="list-row pb-4">
                {item.type === "post" ? (
                  <PostCard
                    isAuthenticated={isAuthenticated}
                    currentUserId={currentUserId}
                    data={item.post}
                  />
                ) : (
                  <div className="mt-2">
                    <RepostHeader
                      user={item.repost.user}
                      createdAt={item.repost.createdAt}
                    />
                    <div className="mt-4 sm:pr-0">
                      <PostCard
                        isAuthenticated={isAuthenticated}
                        currentUserId={currentUserId}
                        data={item.post}
                      />
                    </div>
                  </div>
                )}
              </div>
              {showAd && (
                <ClientOnlyAdContainer
                  className="mb-4 pb-4"
                  placement="feed_inline"
                />
              )}
            </Fragment>
          );
        })}

        {hasNextPage && (
          <>
            <div ref={setSentinel} aria-hidden className="h-px w-full" />
            <PostCardSkeleton />
          </>
        )}
      </div>
    </div>
  );
}
