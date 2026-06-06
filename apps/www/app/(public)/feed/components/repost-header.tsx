"use client";

import { BadgeCheckIcon, Repeat2Icon } from "lucide-react";
import Link from "next/link";
import { shortTimeAgo } from "@/lib/utils";
import type { PublicUser } from "@/types/user";

// Plain-repost attribution line — quotes are real posts with their own card.
export function RepostHeader({
  user,
  createdAt,
}: {
  user: PublicUser;
  createdAt: Date;
}) {
  const verified =
    !!user.username &&
    process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(",").includes(user.username);

  return (
    <div className="flex px-2 sm:px-0 items-center text-muted-foreground text-sm">
      <Repeat2Icon className="inline size-4 mr-1" />
      <Link
        href={`/user/${user.username}`}
        className="hover:underline mr-1 font-semibold"
      >
        @{user.username}
      </Link>
      {verified && <BadgeCheckIcon className="w-4 h-4 text-pink-500 mr-1" />}
      <span>reposted {shortTimeAgo(createdAt)}</span>
    </div>
  );
}
