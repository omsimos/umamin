"use client";

import { Button } from "@umamin/ui/components/button";
import {
  MessageSquareMoreIcon,
  UserCheckIcon,
  UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { followUserAction, unfollowUserAction } from "@/app/actions/user";
import { UserCard } from "@/components/user-card";
import type { PublicUser } from "@/types/user";

type Props = {
  user: PublicUser & { isFollowing?: boolean };
  currentUserId?: string;
  isAuthenticated: boolean;
};

export function UserProfile({ user, currentUserId, isAuthenticated }: Props) {
  const [isFollowing, setIsFollowing] = useState(user.isFollowing === true);
  const [followerCount, setFollowerCount] = useState(user.followerCount ?? 0);
  const isSelf = currentUserId === user.id;

  const handleFollow = async () => {
    if (!isAuthenticated || isSelf) return;

    const prevFollowing = isFollowing;
    const prevFollowerCount = followerCount;

    setIsFollowing(!prevFollowing);
    setFollowerCount((v) => (prevFollowing ? Math.max(v - 1, 0) : v + 1));

    try {
      if (prevFollowing) {
        const res = await unfollowUserAction({ userId: user.id });
        if (res && "alreadyRemoved" in res && res.alreadyRemoved) {
          setIsFollowing(false);
          setFollowerCount(Math.max(prevFollowerCount - 1, 0));
        }
        toast.success("Unfollowed");
      } else {
        const res = await followUserAction({ userId: user.id });
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
      toast.error("Failed to update follow. Please try again.");
      console.log(err);
    }
  };

  return (
    <>
      <UserCard user={{ ...user, followerCount }} />

      <div className="flex gap-2 mt-6 w-full">
        <Button
          variant="outline"
          disabled={!isAuthenticated || isSelf}
          className="flex-1"
          onClick={handleFollow}
        >
          {isFollowing ? <UserCheckIcon /> : <UserPlusIcon />}
          {isFollowing ? "Following" : "Follow"}
        </Button>

        <Button asChild variant="outline" className="flex-1">
          <Link href={`/to/${user.username}`}>
            <MessageSquareMoreIcon />
            Message
          </Link>
        </Button>
      </div>
    </>
  );
}
