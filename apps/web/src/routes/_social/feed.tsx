import { createFileRoute, redirect } from "@tanstack/react-router";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { AppHeader } from "@/components/app-header";
import { ChatAnnouncement } from "@/components/chat-announcement";
import { RouteSegmentError } from "@/components/route-segment-error";
import { normalizeFeedSort } from "@/lib/feed-sort";
import { loadViewerId } from "@/lib/loader-viewer";
import { PRIVATE_STALE_TIME, PUBLIC_STALE_TIME, queryKeys } from "@/lib/query";
import { pageSeo } from "@/lib/seo";
import type { FeedResponse } from "@/lib/types";
import { FeedClient } from "./-components/feed-client";
import { PostCardSkeleton } from "./-components/post-card-skeleton";
import { loaderFetchPostsPage } from "./-lib/loader-queries";

// `sort` is OPTIONAL and the default is deliberately NOT materialized here.
// The router canonicalizes the URL to whatever validateSearch returns, so
// emitting `sort: "hot"` for a bare request made every `/feed` hit 307 to
// `/feed?sort=hot` — an extra round trip on the most-visited route, on every
// landing-page CTA, and on every PWA/TWA launch (manifest start_url is /feed).
// Omitting it makes the bare URL canonical, which is what the sort tabs already
// assume (`search={tab.sort === "hot" ? {} : …}` in post-list.tsx).
type FeedSearch = { sort?: "following" | "latest" };

export const Route = createFileRoute("/_social/feed")({
  validateSearch: (search: Record<string, unknown>): FeedSearch => ({
    sort:
      search.sort === "following" || search.sort === "latest"
        ? search.sort
        : undefined,
  }),
  loaderDeps: ({ search }) => ({ sort: normalizeFeedSort(search.sort) }),
  loader: async ({ context, deps }) => {
    // Operator kill-switch (parity with apps/www feed/page.tsx): flipping the
    // flag takes the feed offline behind the /social maintenance notice.
    if (import.meta.env.VITE_SOCIAL_UNDER_MAINTENANCE === "true") {
      throw redirect({ to: "/social" });
    }

    const { sort } = deps;
    // Resolve the viewer first so page 1 is served under the correct
    // viewer-keyed query — no wasted public page plus a second /api/posts.
    const viewerId = await loadViewerId(context.queryClient);

    // Following has nothing to show a signed-out viewer.
    if (sort === "following" && !viewerId) {
      throw redirect({ to: "/login" });
    }

    await context.queryClient.ensureInfiniteQueryData({
      queryKey: queryKeys.posts(sort, viewerId ?? "public"),
      queryFn: ({ pageParam }) =>
        loaderFetchPostsPage(
          (pageParam as string | null) ?? null,
          !!viewerId,
          sort,
        ),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage: FeedResponse) => lastPage.nextCursor ?? null,
      staleTime: viewerId ? PRIVATE_STALE_TIME : PUBLIC_STALE_TIME,
    });

    return { sort, viewerId, isAuthenticated: !!viewerId };
  },
  head: () =>
    pageSeo({
      title: "Umamin — Feed",
      description:
        "The Umamin feed — anonymous posts, notes, and conversations from the community.",
      path: "/feed",
    }),
  pendingComponent: FeedPending,
  errorComponent: (props) => (
    <RouteSegmentError {...props} heading="We couldn’t load your feed." />
  ),
  component: Feed,
});

function FeedShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      {/* Mobile: trim the shared pt-24 to the compact header height plus the
          standalone safe-area inset; desktop keeps pt-24 for the Navbar. */}
      <div className="-mt-8 pt-[env(safe-area-inset-top)] lg:mt-0 lg:pt-0">
        {children}
      </div>
    </>
  );
}

function Feed() {
  const { sort, viewerId, isAuthenticated } = Route.useLoaderData();

  return (
    <FeedShell>
      <main className="pb-40">
        <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
          <div className="space-y-6">
            <ChatAnnouncement className="mx-4 sm:mx-0" />
            <FeedClient
              sort={sort}
              initialUserId={viewerId}
              isAuthenticated={isAuthenticated}
            />
          </div>
        </section>
      </main>
    </FeedShell>
  );
}

function FeedPending() {
  return (
    <FeedShell>
      <main className="pb-40">
        <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
          <nav className="mb-5 flex w-full border-b">
            <div className="flex flex-1 justify-center pb-2.5">
              <Skeleton className="h-5 w-12" />
            </div>
            <div className="flex flex-1 justify-center pb-2.5">
              <Skeleton className="h-5 w-14" />
            </div>
          </nav>

          <div className="space-y-6">
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
          </div>
        </section>
      </main>
    </FeedShell>
  );
}
