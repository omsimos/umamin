import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { normalizeFeedSort } from "@/lib/feed-sort";
import { getQueryClient } from "@/lib/get-query-client";
import { queryKeys } from "@/lib/query";
import type { FeedResponse } from "@/lib/query-types";
import { getPostsPage } from "@/lib/server/data";
import { FeedClient } from "./components/feed-client";

export default async function Feed({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  if (process.env.NEXT_PUBLIC_SOCIAL_UNDER_MAINTENANCE === "true") {
    redirect("/social");
  }

  const sort = normalizeFeedSort((await searchParams).sort);
  const queryClient = getQueryClient();

  if (sort !== "following") {
    await queryClient.prefetchInfiniteQuery({
      queryKey: queryKeys.posts(sort),
      queryFn: ({ pageParam }) =>
        getPostsPage({
          cursor: (pageParam as string | null) ?? null,
          sort,
        }),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage: FeedResponse) => lastPage.nextCursor ?? null,
      staleTime: 120_000,
    });
  }

  return (
    <main className="pb-40">
      <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
        <div className="space-y-6">
          <HydrationBoundary state={dehydrate(queryClient)}>
            <FeedClient sort={sort} />
          </HydrationBoundary>
        </div>
      </section>
    </main>
  );
}
