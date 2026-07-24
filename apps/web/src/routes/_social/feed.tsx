import { createFileRoute, redirect } from "@tanstack/react-router";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { AppHeader } from "@/components/app-header";
import { ChatAnnouncement } from "@/components/chat-announcement";
import { RouteSegmentError } from "@/components/route-segment-error";
import { type FeedSort, normalizeFeedSort } from "@/lib/feed-sort";
import { loaderFetchJsonOrNull } from "@/lib/loader-fetch";
import { PRIVATE_STALE_TIME, PUBLIC_STALE_TIME, queryKeys } from "@/lib/query";
import type { CurrentUserResponse, FeedResponse } from "@/lib/types";
import { FeedClient } from "./-components/feed-client";
import { PostCardSkeleton } from "./-components/post-card-skeleton";
import { loaderFetchPostsPage } from "./-lib/loader-queries";

type FeedSearch = { sort: FeedSort };

export const Route = createFileRoute("/_social/feed")({
  validateSearch: (search: Record<string, unknown>): FeedSearch => ({
    sort: normalizeFeedSort(search.sort as string | undefined),
  }),
  loaderDeps: ({ search }) => ({ sort: search.sort }),
  loader: async ({ context, deps }) => {
    // Operator kill-switch (parity with apps/www feed/page.tsx): flipping the
    // flag takes the feed offline behind the /social maintenance notice.
    if (import.meta.env.VITE_SOCIAL_UNDER_MAINTENANCE === "true") {
      throw redirect({ to: "/social" });
    }

    const { sort } = deps;
    // Resolve the viewer server-side (401 → null) so page 1 is served under the
    // correct viewer-keyed query — no wasted public page + second /api/posts.
    const me = await loaderFetchJsonOrNull<CurrentUserResponse>("/api/me", 401);
    const viewerId = me?.user?.id ?? null;

    // Following has nothing to show a signed-out viewer.
    if (sort === "following" && !viewerId) {
      throw redirect({ to: "/login" });
    }

    // Prime the shared current-user cache so menus/composer read it warm.
    if (me?.user) {
      context.queryClient.setQueryData(queryKeys.currentUser(), me);
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
  head: () => ({
    meta: [
      { title: "Umamin — Feed" },
      {
        name: "description",
        content:
          "The Umamin feed — anonymous posts, notes, and conversations from the community.",
      },
    ],
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
