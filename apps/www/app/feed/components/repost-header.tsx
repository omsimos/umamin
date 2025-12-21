"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { cn } from "@umamin/ui/lib/utils";
import { BadgeCheckIcon, Repeat2Icon } from "lucide-react";
import Link from "next/link";
import { isOlderThanOneYear, shortTimeAgo } from "@/lib/utils";
import type { PublicUser } from "@/types/user";

export function RepostHeader({
  user,
  createdAt,
  content,
}: {
  user: PublicUser;
  createdAt: Date;
  content?: string | null;
}) {
  const verified =
    !!user.username &&
    process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(",").includes(user.username);

  if (!content) {
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

  return (
    <div className="flex items-start gap-3 px-2 sm:px-0">
      <Avatar
        className={cn({
          "avatar-shine": isOlderThanOneYear(user?.createdAt),
        })}
      >
        <AvatarImage src={user.imageUrl ?? ""} alt="User avatar" />
        <AvatarFallback>
          <Repeat2Icon className="size-4" />
        </AvatarFallback>
      </Avatar>

      <div className="flex-1">
        <div className="flex items-center justify-between text-[15px]">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Link
                href={`/user/${user.username}`}
                className="font-semibold hover:underline"
              >
                {user.displayName ?? user.username}
              </Link>
              {verified && <BadgeCheckIcon className="w-4 h-4 text-pink-500" />}
            </span>
            <span className="text-muted-foreground">@{user.username}</span>
          </div>
          <span className="text-muted-foreground text-xs">
            {shortTimeAgo(createdAt)}
          </span>
        </div>
        {content && <p className="text-sm mt-2">{content}</p>}
      </div>
    </div>
  );
}
