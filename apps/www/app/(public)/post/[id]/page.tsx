import type { Metadata } from "next";
import type { PostResponse } from "@/lib/query-types";
import { fetchMetadataJson } from "@/lib/server-metadata";
import { getBaseUrl } from "@/lib/utils";
import { PostView } from "./post-view";

const truncate = (text: string, max = 160) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await fetchMetadataJson<PostResponse>(`/api/public/posts/${id}`);

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
  const { id } = await params;
  return (
    <main className="w-full sm:max-w-lg mx-auto bg-background">
      <PostView id={id} />
    </main>
  );
}
