"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Badge } from "@umamin/ui/components/badge";
import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  BadgeCheckIcon,
  CalendarDaysIcon,
  MessageSquareXIcon,
  MoonIcon,
  PencilIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ReactNode } from "react";
import { hasUmaminPlus } from "@/lib/utils";
import type { PublicUserWithBadge } from "@/types/user";
import { FollowListDrawer } from "./follow-list-drawer";
import { GroupBadge } from "./group-badge";
import { ShareButton } from "./share-button";

const CopyLink = dynamic(() => import("./copy-link"), { ssr: false });

export function UserCard({
  user,
  isSelf,
  headerActions,
  primaryAction,
}: {
  user: PublicUserWithBadge;
  isSelf?: boolean;
  // Banner top-right slot. Self shows edit + share; other profiles pass the
  // Message + overflow (Share/Block) buttons here.
  headerActions?: ReactNode;
  // Right-aligned action on the name row — the Follow button on other profiles.
  primaryAction?: ReactNode;
}) {
  return (
    <div>
      <div className="relative">
        <div className="relative aspect-[3/1] w-full overflow-hidden rounded-xl bg-muted">
          {user.bannerImageUrl && (
            // biome-ignore lint/performance/noImgElement: pre-optimized R2 asset; bypassing Vercel image optimization is deliberate
            <img
              src={user.bannerImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="absolute right-3 top-3 flex items-center gap-2">
          {isSelf ? (
            <>
              <Button
                asChild
                size="icon"
                variant="secondary"
                aria-label="Edit profile"
                className="rounded-full bg-background/70 backdrop-blur"
              >
                <Link href="/settings">
                  <PencilIcon className="size-4" />
                </Link>
              </Button>

              <ShareButton
                username={user.username}
                variant="secondary"
                className="rounded-full bg-background/70 backdrop-blur"
              />
            </>
          ) : (
            headerActions
          )}
        </div>

        {/* Avatar straddles the banner's bottom-left edge (cover-photo layout).
            Positioning lives on the wrapper because `.avatar-shine` sets
            position: relative (unlayered, so it would override Tailwind's
            absolute utility and drop the avatar below the banner). */}
        <div className="absolute -bottom-8 left-4">
          <Avatar
            className={cn("size-16 ring-4 ring-background md:size-20", {
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
        </div>
      </div>

      {/* Follow sits just below the banner, right-aligned (other profiles). */}
      {primaryAction && (
        <div className="mt-3 flex justify-end">{primaryAction}</div>
      )}

      <section className={primaryAction ? "mt-3" : "mt-11"}>
        <div className="flex items-center space-x-1">
          <p className="font-semibold md:text-xl">
            {user.displayName ? user.displayName : user.username}
          </p>
          {process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(",").includes(
            user.username,
          ) && <BadgeCheckIcon className="w-4 h-4 text-pink-500" />}
          <GroupBadge badge={user.groupBadge} />
        </div>
        <p className="text-muted-foreground text-sm">@{user.username}</p>

        <div className="mt-4">
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
        </div>
      </section>
    </div>
  );
}
