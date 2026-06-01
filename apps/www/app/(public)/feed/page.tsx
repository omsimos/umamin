import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { ComposeFab } from "@/components/compose-fab";
import { getSession } from "@/lib/auth";
import { normalizeFeedSort } from "@/lib/feed-sort";
import { getQueryClient } from "@/lib/get-query-client";
import { queryKeys } from "@/lib/query";
import type { FeedResponse } from "@/lib/query-types";
import { getPostsPage } from "@/lib/server/data";
import { toPublicUser } from "@/types/user";
import { PostList } from "./components/post-list";

export default async function Feed({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  if (process.env.NEXT_PUBLIC_SOCIAL_UNDER_MAINTENANCE === "true") {
    redirect("/social");
  }

  const sort = normalizeFeedSort((await searchParams).sort);
  const { user } = await getSession();
  const queryClient = getQueryClient();
  const publicUser = user ? toPublicUser(user) : null;

  await queryClient.prefetchInfiniteQuery({
    queryKey: queryKeys.posts(sort),
    queryFn: ({ pageParam }) =>
      getPostsPage({
        cursor: (pageParam as string | null) ?? null,
        sort,
        viewerId: user?.id,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: FeedResponse) => lastPage.nextCursor ?? null,
    staleTime: 120_000,
  });

  return (
    <main className="pb-40">
      <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
        <div className="space-y-6">
          <HydrationBoundary state={dehydrate(queryClient)}>
            <PostList
              sort={sort}
              isAuthenticated={!!user}
              currentUserId={user?.id}
            />
          </HydrationBoundary>
        </div>
      </section>

      {user && <ComposeFab user={publicUser} />}
    </main>
  );
}
