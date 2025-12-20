import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostAction, getPostPublicAction } from "@/app/actions/post";
import { PostCardMain } from "@/app/feed/components/post-card-main";
import { getSession } from "@/lib/auth";
import { getBaseUrl } from "@/lib/utils";
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

  const data = await getPostAction(id);

  if (!data) {
    notFound();
  }

  return (
    <main className="w-full sm:max-w-lg mx-auto bg-background">
      <PostCardMain
        isAuthenticated={!!user}
        currentUserId={user?.id}
        data={data}
      />

      {user && (
        <div className="w-full py-4 border-b font-medium text-muted-foreground px-7 sm:px-0">
          <ReplyForm user={user} postId={id} />
        </div>
      )}

      <div className="space-y-6 mt-6">
        <CommentsList isAuthenticated={!!user} postId={id} />
        {/* <PostCardWithComments sessionImage={user?.imageUrl} /> */}
        {/* {repliesData.map((comment) => { */}
        {/*   return ( */}
        {/*     <PostCard */}
        {/*       key={comment.createdAt.toString()} */}
        {/*       {...comment} */}
        {/*       className="border-b" */}
        {/*     /> */}
        {/*   ); */}
        {/* })} */}
      </div>
    </main>
  );
}
