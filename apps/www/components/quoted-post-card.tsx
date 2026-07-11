"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { cn } from "@umamin/ui/lib/utils";
import { BarChart3Icon, ScanFaceIcon } from "lucide-react";
import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { PostImages } from "@/components/post-images";
import { shortTimeAgo } from "@/lib/utils";
import type { QuotedPostData } from "@/types/post";

type Props = {
  /** null = quoted post deleted or hidden from this viewer (husk). */
  post: QuotedPostData | null;
  /** False in the composer preview — no navigation while writing the quote. */
  linked?: boolean;
  className?: string;
};

/**
 * The compact embedded card inside a quote post. Deliberately non-interactive
 * (no like/repost buttons, no image lightbox) — the whole card links to the
 * quoted post, where full engagement lives.
 */
export function QuotedPostCard({ post, linked = true, className }: Props) {
  if (!post) {
    return (
      <div
        className={cn(
          "relative z-10 mt-3 rounded-xl border border-muted px-4 py-3 text-sm text-muted-foreground",
          className,
        )}
      >
        This post is unavailable.
      </div>
    );
  }

  const body = (
    <>
      <div className="flex items-center gap-2 text-sm">
        <Avatar className="size-5">
          <AvatarImage src={post.author.imageUrl ?? ""} alt="User avatar" />
          <AvatarFallback>
            <ScanFaceIcon className="size-3" />
          </AvatarFallback>
        </Avatar>
        <span className="truncate font-semibold">
          {post.author.displayName || post.author.username}
        </span>
        <span className="truncate text-muted-foreground">
          @{post.author.username}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {shortTimeAgo(post.createdAt)}
        </span>
      </div>

      {post.content && (
        <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-sm">
          {post.content}
        </p>
      )}

      {/* Embeds stop at one level: the quoted poll renders as a static
          indicator (no options/counts) and the card links through to vote. */}
      {post.pollEndsAt && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <BarChart3Icon className="size-4" />
          Poll
        </p>
      )}

      {post.images && post.images.length > 0 && (
        <PostImages images={post.images} interactive={false} className="mt-2" />
      )}
    </>
  );

  const cardClassName = cn(
    // z-10 keeps the card's own link above the post card's whole-card overlay.
    "relative z-10 mt-3 block rounded-xl border border-muted px-4 py-3",
    linked && "transition-colors hover:bg-muted/30",
    className,
  );

  if (!linked) {
    return <div className={cardClassName}>{body}</div>;
  }

  return (
    <HoverPrefetchLink
      href={`/post/${post.id}`}
      aria-label={`View quoted post by @${post.author.username}`}
      className={cardClassName}
    >
      {body}
    </HoverPrefetchLink>
  );
}
