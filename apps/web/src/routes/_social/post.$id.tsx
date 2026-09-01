import { createFileRoute, notFound } from "@tanstack/react-router";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { RouteSegmentError } from "@/components/route-segment-error";
import { loadViewer } from "@/lib/loader-viewer";
import { PUBLIC_STALE_TIME, queryKeys } from "@/lib/query";
import { pageSeo } from "@/lib/seo";
import type { CommentsResponse, PostData } from "@/lib/types";
import { CommentsList } from "./-components/comments-list";
import { PostCardMain } from "./-components/post-card-main";
import { PostCardSkeleton } from "./-components/post-card-skeleton";
import { PostHeader } from "./-components/post-header";
import ReplyForm from "./-components/reply-form";
import {
  loaderFetchPost,
  loaderFetchPostCommentsPage,
} from "./-lib/loader-queries";

const truncate = (text: string, max = 160) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

export const Route = createFileRoute("/_social/post/$id")({
  loader: async ({ context, params }) => {
    const { id } = params;
    const me = await loadViewer(context.queryClient);
    const viewerId = me?.user?.id ?? null;

    // Post and comments both branch on `viewerId` but not on each other, so
    // they share one round trip's latency instead of chaining. Cost of the
    // reorder: a 404'd post pays one wasted comments read.
    const [post] = await Promise.all([
      loaderFetchPost(id, !!viewerId),
      context.queryClient.ensureInfiniteQueryData({
        queryKey: queryKeys.postComments(id),
        queryFn: ({ pageParam }) =>
          loaderFetchPostCommentsPage(
            id,
            (pageParam as string | null) ?? null,
            !!viewerId,
          ),
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage: CommentsResponse) =>
          lastPage.nextCursor ?? null,
        staleTime: PUBLIC_STALE_TIME,
      }),
    ]);

    if (!post) {
      throw notFound();
    }

    // Prime the per-post cache the cards patch (like/repost/comment writes).
    context.queryClient.setQueryData(queryKeys.post(id), post);

    return {
      id,
      post: post as PostData,
      viewerId,
      isAuthenticated: !!viewerId,
      currentUser: me?.user ?? null,
    };
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    if (!post) {
      return pageSeo({
        title: "Post not found",
        description: "This post does not exist on Umamin.",
        robots: "noindex",
      });
    }

    const authorName =
      post.author?.displayName ?? post.author?.username ?? "User";
    const description = truncate(post.content, 160);
    const title = truncate(`${authorName}: ${post.content}`, 70);

    return pageSeo({
      title,
      description,
      path: `/post/${loaderData.id}`,
      ogType: "article",
      twitterCard: "summary",
    });
  },
  pendingComponent: PostPending,
  errorComponent: (props) => (
    <RouteSegmentError {...props} heading="We couldn’t load this post." />
  ),
  notFoundComponent: () => (
    <main className="-mt-24 min-h-svh w-full sm:max-w-lg mx-auto flex items-center justify-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Post not found</h1>
        <p className="mt-2 text-muted-foreground">
          This post may have been deleted.
        </p>
      </div>
    </main>
  ),
  component: Post,
});

function Post() {
  const { id, post, isAuthenticated, viewerId, currentUser } =
    Route.useLoaderData();
  const imageId = `umamin-${post.id}`;

  return (
    // -mt-24 cancels the _social layout's pt-24 — the focused view hides the
    // global top chrome. pb clears the fixed reply bar (and the mobile nav).
    <main className="-mt-24 min-h-svh w-full sm:max-w-lg mx-auto bg-background pb-40 lg:pb-28">
      <PostHeader
        postId={id}
        authorId={post.author.id}
        imageId={imageId}
        isAuthenticated={isAuthenticated}
        currentUserId={viewerId ?? undefined}
      />

      <PostCardMain
        isAuthenticated={isAuthenticated}
        imageId={imageId}
        data={post}
      />

      <ClientOnlyAdContainer
        placement="post_detail"
        className="my-6 px-7 sm:px-6"
      />

      <div className="space-y-6 my-6">
        <CommentsList
          isAuthenticated={isAuthenticated}
          currentUserId={viewerId ?? undefined}
          postId={id}
        />
      </div>

      {currentUser && (
        <div className="fixed inset-x-0 bottom-20 lg:bottom-0 z-30 border-t bg-background/80 backdrop-blur">
          <div className="mx-auto w-full sm:max-w-lg px-4 py-3">
            <ReplyForm user={currentUser} postId={id} />
          </div>
        </div>
      )}
    </main>
  );
}

function PostPending() {
  return (
    <main className="-mt-24 min-h-svh w-full sm:max-w-lg mx-auto bg-background">
      <div className="flex items-center justify-between border-b px-2 py-2">
        <Skeleton className="size-9 rounded-md" />
        <Skeleton className="h-5 w-12" />
        <Skeleton className="size-9 rounded-md" />
      </div>

      <PostCardSkeleton />

      <div className="space-y-6 my-6">
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    </main>
  );
}
