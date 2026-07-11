import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChatAnnouncement } from "@/components/chat-announcement";
import { getSession } from "@/lib/auth";
import { normalizeFeedSort } from "@/lib/feed-sort";
import { getQueryClient } from "@/lib/get-query-client";
import { PRIVATE_STALE_TIME, PUBLIC_STALE_TIME, queryKeys } from "@/lib/query";
import type { FeedResponse } from "@/lib/query-types";
import { getPostsPage } from "@/lib/server/data";
import { FeedClient } from "./components/feed-client";
import { PostCardSkeleton } from "./components/post-card-skeleton";

export default function Feed({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  if (process.env.NEXT_PUBLIC_SOCIAL_UNDER_MAINTENANCE === "true") {
    redirect("/social");
  }

  return (
    <main className="pb-40">
      <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
        <div className="space-y-6">
          <ChatAnnouncement className="mx-4 sm:mx-0" />
          <Suspense
            fallback={
              <div className="w-full mx-auto space-y-4">
                <PostCardSkeleton />
                <PostCardSkeleton />
                <PostCardSkeleton />
              </div>
            }
          >
            <HydratedFeed searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

// Session-dependent prefetch lives in a Suspense'd hole (cacheComponents
// requires the cookie read to sit behind Suspense; it also keeps this off the
// build-time prerender path). Resolving the viewer here lets us hydrate the
// exact viewer-keyed query the client renders — so an authed first page is
// served once from SSR instead of a wasted public page plus a second full
// /api/posts fetch. Logged-out viewers still get the shared public page.
async function HydratedFeed({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const sort = normalizeFeedSort((await searchParams).sort);
  const { user } = await getSession();
  const viewerId = user?.id ?? null;

  // Following has nothing to show a signed-out viewer.
  if (sort === "following" && !viewerId) {
    redirect("/login");
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: queryKeys.posts(sort, viewerId ?? "public"),
    queryFn: ({ pageParam }) =>
      getPostsPage({
        cursor: (pageParam as string | null) ?? null,
        sort,
        viewerId,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: FeedResponse) => lastPage.nextCursor ?? null,
    staleTime: viewerId ? PRIVATE_STALE_TIME : PUBLIC_STALE_TIME,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FeedClient
        sort={sort}
        initialUserId={viewerId}
        isAuthenticated={!!user}
      />
    </HydrationBoundary>
  );
}
