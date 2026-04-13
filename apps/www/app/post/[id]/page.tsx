import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostAction, getPostPublicAction } from "@/app/actions/post";
import { PostCardMain } from "@/app/feed/components/post-card-main";
import { getSession } from "@/lib/auth";
import { getQueryClient } from "@/lib/get-query-client";
import { queryKeys } from "@/lib/query";
import type { CommentsResponse } from "@/lib/query-types";
import { getPostCommentsPage } from "@/lib/server/data";
import { getBaseUrl } from "@/lib/utils";
import { toPublicUser } from "@/types/user";
import { CommentsList } from "../components/comments-list";
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
    };
  }

  const authorName =
    post.author?.displayName ?? post.author?.username ?? "User";
  const content = truncate(post.content, 160);
  const title = truncate(`${authorName}: ${post.content}`, 70);
  const url = `${getBaseUrl()}/post/${id}`;

  return {
    title,
    description: content,
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
      url,
      authors: post.author?.username
        ? [`${getBaseUrl()}/user/${post.author.username}`]
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

  return (
    <main className="w-full sm:max-w-lg mx-auto bg-background">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PostCardMain
          isAuthenticated={!!user}
          currentUserId={user?.id}
          data={data}
        />

        {currentUser && (
          <div className="w-full py-4 border-b font-medium text-muted-foreground px-7 sm:px-0">
            <ReplyForm user={currentUser} postId={id} />
          </div>
        )}

        <div className="space-y-6 my-6">
          <CommentsList isAuthenticated={!!user} postId={id} />
        </div>
      </HydrationBoundary>
    </main>
  );
}
