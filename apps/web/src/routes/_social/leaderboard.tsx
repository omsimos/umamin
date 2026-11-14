import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { RouteSegmentError } from "@/components/route-segment-error";
import type { LeaderboardTab } from "@/lib/leaderboard";
import { loadViewerId } from "@/lib/loader-viewer";
import { PUBLIC_STALE_TIME, queryKeys } from "@/lib/query";
import { pageSeo } from "@/lib/seo";
import { BackHeaderPage } from "../-shared/chrome";
import { LeaderboardClient } from "./-components/leaderboard-client";
import { loaderFetchLeaderboard } from "./-lib/loader-queries";

// Aura is the default and stays out of the URL, so a bare /leaderboard is
// canonical instead of redirecting to ?tab=aura (same reasoning as /feed).
type LeaderboardSearch = { tab?: "streak" };

export const Route = createFileRoute("/_social/leaderboard")({
  validateSearch: (search: Record<string, unknown>): LeaderboardSearch => ({
    tab: search.tab === "streak" ? "streak" : undefined,
  }),
  loaderDeps: ({ search }) => ({
    tab: (search.tab ?? "aura") as LeaderboardTab,
  }),
  loader: async ({ context, deps }) => {
    // The list is the same for everyone, so it never waits on the viewer.
    // "Your rank" loads on the client so hover preloads don't spend a private
    // read.
    const [viewerId] = await Promise.all([
      loadViewerId(context.queryClient),
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.leaderboard(deps.tab),
        queryFn: () => loaderFetchLeaderboard(deps.tab),
        staleTime: PUBLIC_STALE_TIME,
      }),
    ]);

    return { tab: deps.tab, viewerId };
  },
  head: () =>
    pageSeo({
      title: "Leaderboard | Umamin",
      description:
        "The Umamin leaderboard: the people with the most aura and the longest streaks.",
      path: "/leaderboard",
    }),
  pendingComponent: LeaderboardPending,
  errorComponent: (props) => (
    <RouteSegmentError {...props} heading="We couldn’t load the leaderboard." />
  ),
  component: Leaderboard,
});

function Leaderboard() {
  // A view-transition navigation can re-render this after the router has
  // dropped the match, and useLoaderData throws an invariant there.
  const data = Route.useMatch({
    shouldThrow: false,
    select: (match) => match.loaderData,
  });
  return data ? <LeaderboardPage {...data} /> : null;
}

function LeaderboardPage({
  tab,
  viewerId,
}: {
  tab: LeaderboardTab;
  viewerId: string | null;
}) {
  const queryClient = useQueryClient();

  return (
    <BackHeaderPage>
      <PullToRefresh
        onRefresh={() =>
          queryClient.invalidateQueries({
            predicate: (query) =>
              query.queryKey[0] === "leaderboard" ||
              query.queryKey[0] === "leaderboard-rank",
          })
        }
      >
        <main className="pb-40">
          <section className="mx-auto w-full max-w-xl pt-6">
            <LeaderboardClient tab={tab} viewerId={viewerId} />
          </section>
        </main>
      </PullToRefresh>
    </BackHeaderPage>
  );
}

function LeaderboardPending() {
  return (
    <BackHeaderPage>
      <main className="pb-40">
        <section className="mx-auto w-full max-w-xl pt-6">
          <div className="mb-4 px-4 sm:px-0">
            <Skeleton className="h-7 w-36" />
          </div>
          <nav className="flex w-full border-b">
            <div className="flex flex-1 justify-center pb-2.5">
              <Skeleton className="h-5 w-10" />
            </div>
            <div className="flex flex-1 justify-center pb-2.5">
              <Skeleton className="h-5 w-20" />
            </div>
          </nav>
          <div className="px-4 sm:px-0">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </BackHeaderPage>
  );
}
