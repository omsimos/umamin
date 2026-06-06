"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Badge } from "@umamin/ui/components/badge";
import { cn } from "@umamin/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  BadgeCheckIcon,
  CalendarDaysIcon,
  MessageSquareXIcon,
  MoonIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { hasUmaminPlus } from "@/lib/utils";
import type { PublicUser } from "@/types/user";
import { FollowListDrawer } from "./follow-list-drawer";
import { ShareButton } from "./share-button";

const CopyLink = dynamic(() => import("./copy-link"), { ssr: false });

export function UserCard({
  user,
  // Optional top-right header slot (e.g. Edit profile on your own card).
  action,
}: {
  user: PublicUser;
  action?: ReactNode;
}) {
  return (
    <div>
      <section className="flex gap-4">
        <Avatar
          className={cn("md:size-20 size-16", {
            "avatar-shine": hasUmaminPlus(user?.createdAt),
          })}
        >
          <AvatarImage
            className="rounded-full"
            src={user?.imageUrl ?? ""}
            alt={`${user?.username}'s avatar`}
          />
          <AvatarFallback className="md:text-4xl text-xl">
            {user?.username?.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-1">
              <p className="font-semibold md:text-xl">
                {user.displayName ? user.displayName : user.username}
              </p>
              {process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(",").includes(
                user.username,
              ) && <BadgeCheckIcon className="w-4 h-4 text-pink-500" />}
            </div>

            <ShareButton username={user.username} />
          </div>
          <p className="text-muted-foreground text-sm">@{user.username}</p>
        </div>

        {action ? (
          <div className="ml-auto shrink-0 self-start">{action}</div>
        ) : null}
      </section>

      <section className="mt-4">
        <p
          className={cn("min-w-0 text-sm break-words", {
            "break-all": user?.bio?.split(" ").length === 1,
          })}
        >
          {user?.bio}
        </p>

        <FollowListDrawer
          username={user.username}
          followerCount={user.followerCount ?? 0}
          followingCount={user.followingCount ?? 0}
        />

        <div className="mt-4 space-y-1">
          {user.quietMode && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MessageSquareXIcon className="size-4" />
              <Badge variant="secondary">
                <MoonIcon /> In quiet mode
              </Badge>
            </div>
          )}

          <CopyLink username={user.username} />

          <div className="text-muted-foreground text-sm flex items-center gap-2">
            <CalendarDaysIcon className="size-4" />
            Joined{" "}
            {formatDistanceToNow(user.createdAt, {
              addSuffix: true,
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
