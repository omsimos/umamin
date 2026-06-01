import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostCardMain } from "@/app/(public)/feed/components/post-card-main";
import { getPostAction, getPostPublicAction } from "@/app/actions/post";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { getSession } from "@/lib/auth";
import { getQueryClient } from "@/lib/get-query-client";
import { queryKeys } from "@/lib/query";
import type { CommentsResponse } from "@/lib/query-types";
import { getPostCommentsPage } from "@/lib/server/data";
import { toPublicUser } from "@/types/user";
import { CommentsList } from "../components/comments-list";
import { PostHeader } from "../components/post-header";
import ReplyForm from "../components/reply-form";

const truncate = (text: string, max = 160) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPostPublicAction(id);

  if (!post) {
    return {
      title: "Post not found",
      description: "This post does not exist on Umamin.",
      // Don't let soft-404s (deleted/never-existed posts) get indexed. [audit #40]
      robots: { index: false },
    };
  }

  const authorName =
    post.author?.displayName ?? post.author?.username ?? "User";
  const content = truncate(post.content, 160);
  const title = truncate(`${authorName}: ${post.content}`, 70);

  return {
    title,
    description: content,
    // Relative — resolved against metadataBase (www.umamin.link). Was built
    // from getBaseUrl()/VERCEL_URL, i.e. the throwaway per-deploy host. [#36/#37]
    alternates: { canonical: `/post/${id}` },
    keywords: [
      "Umamin",
      "post",
      "anonymous messaging",
      "social",
      "community",
      authorName,
      post.author?.username ? `@${post.author.username}` : undefined,
    ].filter(Boolean) as string[],
    openGraph: {
      type: "article",
      title,
      description: content,
      url: `/post/${id}`,
      authors: post.author?.username
        ? [`https://www.umamin.link/user/${post.author.username}`]
        : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description: content,
    },
  };
}

export default async function Post({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getSession();
  const { id } = await params;
  const currentUser = user ? toPublicUser(user) : null;

  const data = await getPostAction(id);
  const queryClient = getQueryClient();

  if (!data) {
    notFound();
  }

  queryClient.setQueryData(queryKeys.post(id), data);

  await queryClient.prefetchInfiniteQuery({
    queryKey: queryKeys.postComments(id),
    queryFn: ({ pageParam }) =>
      getPostCommentsPage({
        postId: id,
        cursor: (pageParam as string | null) ?? null,
        viewerId: user?.id,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: CommentsResponse) =>
      lastPage.nextCursor ?? null,
    staleTime: 120_000,
  });

  // Shared between the header's Save Image and the post card's screenshot target.
  const imageId = `umamin-${data.id}`;

  return (
    // -mt-24 cancels the (public) layout's pt-24 — the focused view hides the
    // global top chrome, so content starts at the top; pb clears the fixed reply
    // bar (and the mobile bottom nav beneath it).
    <main className="-mt-24 min-h-svh w-full sm:max-w-lg mx-auto bg-background pb-40 lg:pb-28">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PostHeader
          postId={id}
          authorId={data.author.id}
          imageId={imageId}
          isAuthenticated={!!user}
          currentUserId={user?.id}
        />

        <PostCardMain isAuthenticated={!!user} imageId={imageId} data={data} />

        <ClientOnlyAdContainer
          placement="post_detail"
          className="my-6 px-7 sm:px-6"
        />

        <div className="space-y-6 my-6">
          <CommentsList
            isAuthenticated={!!user}
            currentUserId={user?.id}
            postId={id}
          />
        </div>
      </HydrationBoundary>

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
