"use client";

import { BadgeCheckIcon, Repeat2Icon } from "lucide-react";
import { HoverPrefetchLink } from "@/components/hover-prefetch-link";
import { shortTimeAgo } from "@/lib/utils";
import type { FeedAuthor } from "@/types/user";

// Plain-repost attribution line — quotes are real posts with their own card.
export function RepostHeader({
  user,
  createdAt,
}: {
  user: FeedAuthor;
  createdAt: Date;
}) {
  const verified =
    !!user.username &&
    process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(",").includes(user.username);

  return (
    <div className="flex px-2 sm:px-0 items-center text-muted-foreground text-sm">
      <Repeat2Icon className="inline size-4 mr-1" />
      <HoverPrefetchLink
        href={`/user/${user.username}`}
        className="hover:underline mr-1 font-semibold"
      >
        @{user.username}
      </HoverPrefetchLink>
      {verified && <BadgeCheckIcon className="w-4 h-4 text-pink-500 mr-1" />}
      <span>reposted {shortTimeAgo(createdAt)}</span>
    </div>
  );
}
