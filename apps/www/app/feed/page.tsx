import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getQueryClient } from "@/lib/get-query-client";
import { queryKeys } from "@/lib/query";
import type { FeedResponse } from "@/lib/query-types";
import { getPostsPage } from "@/lib/server/data";
import { toPublicUser } from "@/types/user";
import PostForm from "../post/components/post-form";
import { PostList } from "./components/post-list";

export default async function Feed() {
  if (process.env.NEXT_PUBLIC_SOCIAL_UNDER_MAINTENANCE === "true") {
    redirect("/social");
  }

  const { user } = await getSession();
  const queryClient = getQueryClient();
  const publicUser = user ? toPublicUser(user) : null;

  await queryClient.prefetchInfiniteQuery({
    queryKey: queryKeys.posts(),
    queryFn: ({ pageParam }) =>
      getPostsPage({
        cursor: (pageParam as string | null) ?? null,
        viewerId: user?.id,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: FeedResponse) => lastPage.nextCursor ?? null,
    staleTime: 120_000,
  });

  return (
    <main className="pb-40">
      <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
        {user && <PostForm user={publicUser} />}

        <div className="border-y space-y-6 pt-6">
          <HydrationBoundary state={dehydrate(queryClient)}>
            <PostList isAuthenticated={!!user} currentUserId={user?.id} />
          </HydrationBoundary>
        </div>
      </section>
    </main>
  );
}
