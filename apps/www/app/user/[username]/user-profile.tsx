"use client";

import { useAsyncRateLimitedCallback } from "@tanstack/react-pacer/async-rate-limiter";
import { Button } from "@umamin/ui/components/button";
import {
  MessageSquareMoreIcon,
  MessageSquareXIcon,
  UserCheckIcon,
  UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  blockUserAction,
  followUserAction,
  unblockUserAction,
  unfollowUserAction,
} from "@/app/actions/user";
import { Menu } from "@/components/menu";
import { UserCard } from "@/components/user-card";
import type { PublicUser } from "@/types/user";

type Props = {
  user: PublicUser & {
    isFollowing?: boolean;
    isBlocked?: boolean;
    isBlockedBy?: boolean;
  };
  currentUserId?: string;
  isAuthenticated: boolean;
};

export function UserProfile({ user, currentUserId, isAuthenticated }: Props) {
  const [isFollowing, setIsFollowing] = useState(user.isFollowing === true);
  const [followerCount, setFollowerCount] = useState(user.followerCount ?? 0);
  const [isBlocked, setIsBlocked] = useState(user.isBlocked === true);
  const isBlockedBy = user.isBlockedBy === true;
  const isSelf = currentUserId === user.id;

  const rateLimitedFollow = useAsyncRateLimitedCallback(
    async (prevFollowing: boolean) =>
      prevFollowing
        ? unfollowUserAction({ userId: user.id })
        : followUserAction({ userId: user.id }),
    {
      limit: 4,
      window: 10000,
      windowType: "sliding",
      onReject: () => {
        throw new Error("You're following too fast. Please wait a moment.");
      },
    },
  );

  const handleFollow = async () => {
    if (!isAuthenticated || isSelf) return;

    const prevFollowing = isFollowing;
    const prevFollowerCount = followerCount;

    setIsFollowing(!prevFollowing);
    setFollowerCount((v) => (prevFollowing ? Math.max(v - 1, 0) : v + 1));

    try {
      const res = await rateLimitedFollow(prevFollowing);
      if (prevFollowing) {
        if (res && "alreadyRemoved" in res && res.alreadyRemoved) {
          setIsFollowing(false);
          setFollowerCount(Math.max(prevFollowerCount - 1, 0));
        }
        toast.success("Unfollowed");
      } else {
        if (res && "alreadyFollowing" in res && res.alreadyFollowing) {
          setIsFollowing(prevFollowing);
          setFollowerCount(prevFollowerCount);
          toast.error("You're already following this user.");
          return;
        }
        toast.success("Following");
      }
    } catch (err) {
      setIsFollowing(prevFollowing);
      setFollowerCount(prevFollowerCount);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to update follow. Please try again.",
      );
      console.log(err);
    }
  };

  const handleBlock = async () => {
    if (!isAuthenticated || isSelf) return;

    const prevBlocked = isBlocked;
    setIsBlocked(!prevBlocked);

    try {
      if (prevBlocked) {
        const res = await unblockUserAction({ userId: user.id });
        if (res && "alreadyRemoved" in res && res.alreadyRemoved) {
          setIsBlocked(false);
        }
        toast.success("Unblocked");
      } else {
        const res = await blockUserAction({ userId: user.id });
        if (res && "alreadyBlocked" in res && res.alreadyBlocked) {
          setIsBlocked(true);
          toast.error("User already blocked.");
          return;
        }
        toast.success("User blocked");
        if (isFollowing) {
          setIsFollowing(false);
          setFollowerCount((v) => Math.max(v - 1, 0));
        }
      }
    } catch (err) {
      setIsBlocked(prevBlocked);
      toast.error("Failed to update block. Please try again.");
      console.log(err);
    }
  };

  const menuItems = [
    {
      title: isBlocked ? "Unblock" : "Block",
      onClick: handleBlock,
      className: "text-red-500",
      icon: <MessageSquareXIcon className="h-4 w-4" />,
      disabled: !isAuthenticated || isSelf,
    },
  ];

  return (
    <>
      <UserCard user={{ ...user, followerCount }} />

      <div className="flex gap-2 mt-6 w-full">
        <Button
          variant="outline"
          disabled={!isAuthenticated || isSelf || isBlocked || isBlockedBy}
          className="flex-1"
          onClick={handleFollow}
        >
          {isFollowing ? <UserCheckIcon /> : <UserPlusIcon />}
          {isFollowing ? "Following" : "Follow"}
        </Button>

        <Button
          asChild
          variant="outline"
          className="flex-1"
          disabled={isBlocked || isBlockedBy}
        >
          <Link href={`/to/${user.username}`}>
            <MessageSquareMoreIcon />
            Message
          </Link>
        </Button>

        <Menu menuItems={menuItems} />
      </div>
    </>
  );
}
