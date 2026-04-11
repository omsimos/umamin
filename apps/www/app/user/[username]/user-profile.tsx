"use client";

import { useAsyncRateLimitedCallback } from "@tanstack/react-pacer/async-rate-limiter";
import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import {
  MessageSquareMoreIcon,
  MessageSquareXIcon,
  UserCheckIcon,
  UserPlusIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  blockUserAction,
  followUserAction,
  unblockUserAction,
  unfollowUserAction,
} from "@/app/actions/user";
import { Menu } from "@/components/menu";
import { UserCard } from "@/components/user-card";
import {
  PRIVATE_STALE_TIME,
  PUBLIC_STALE_TIME,
  pageQueryOptions,
  queryKeys,
} from "@/lib/query";
import {
  patchCurrentUser,
  patchUserProfile,
  patchUserProfileViewer,
  removeMessagesBySender,
} from "@/lib/query-cache";
import { fetchUserProfile, fetchUserProfileViewer } from "@/lib/query-fetchers";
import type {
  CurrentUserResponse,
  MessagesResponse,
  UserProfileResponse,
  UserProfileViewerResponse,
} from "@/lib/query-types";
import type { PublicUser } from "@/types/user";

type Props = {
  username: string;
  initialUser: PublicUser;
};

export function UserProfile({ username, initialUser }: Props) {
  const queryClient = useQueryClient();
  const { data: user } = useQuery({
    ...pageQueryOptions(
      queryKeys.userProfile(username),
      () => fetchUserProfile(username),
      PUBLIC_STALE_TIME,
    ),
    initialData: initialUser,
  });
  const { data: viewer } = useQuery({
    ...pageQueryOptions(
      queryKeys.userProfileViewer(username),
      () => fetchUserProfileViewer(username),
      PRIVATE_STALE_TIME,
    ),
  });

  const profile = user ?? initialUser;

  const isAuthenticated = viewer?.isAuthenticated === true;
  const isFollowing = viewer?.isFollowing === true;
  const isBlocked = viewer?.isBlocked === true;
  const isBlockedBy = viewer?.isBlockedBy === true;
  const isSelf = viewer?.currentUserId === profile.id;

  const patchProfileCaches = ({
    followerCount,
    isFollowing,
    isBlocked,
    isBlockedBy,
    followingDelta,
  }: {
    followerCount?: number;
    isFollowing?: boolean;
    isBlocked?: boolean;
    isBlockedBy?: boolean;
    followingDelta?: number;
  }) => {
    queryClient.setQueryData<UserProfileResponse>(
      queryKeys.userProfile(username),
      (current) =>
        patchUserProfile(current, (currentUser) => ({
          ...currentUser,
          followerCount: followerCount ?? currentUser.followerCount,
        })),
    );

    queryClient.setQueryData<UserProfileViewerResponse>(
      queryKeys.userProfileViewer(username),
      (current) =>
        patchUserProfileViewer(current, (currentViewer) => ({
          ...currentViewer,
          isFollowing: isFollowing ?? currentViewer.isFollowing,
          isBlocked: isBlocked ?? currentViewer.isBlocked,
          isBlockedBy: isBlockedBy ?? currentViewer.isBlockedBy,
        })),
    );

    if (followingDelta) {
      queryClient.setQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
        (current) =>
          patchCurrentUser(current, (currentUser) => ({
            ...currentUser,
            followingCount: Math.max(
              currentUser.followingCount + followingDelta,
              0,
            ),
          })),
      );
    }
  };

  const rateLimitedFollow = useAsyncRateLimitedCallback(
    async (prevFollowing: boolean) =>
      prevFollowing
        ? unfollowUserAction({ userId: profile.id })
        : followUserAction({ userId: profile.id }),
    {
      limit: 4,
      window: 10000,
      windowType: "sliding",
      onReject: () => {
        throw new Error("You're following too fast. Please wait a moment.");
      },
    },
  );

  const followMutation = useMutation({
    mutationFn: async (prevFollowing: boolean) =>
      rateLimitedFollow(prevFollowing),
    onMutate: async (prevFollowing) => {
      const previousProfile = queryClient.getQueryData<UserProfileResponse>(
        queryKeys.userProfile(username),
      );
      const previousViewer =
        queryClient.getQueryData<UserProfileViewerResponse>(
          queryKeys.userProfileViewer(username),
        );
      const previousCurrentUser = queryClient.getQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
      );
      const currentFollowerCount =
        previousProfile?.followerCount ?? profile.followerCount;

      patchProfileCaches({
        followerCount: Math.max(
          currentFollowerCount + (prevFollowing ? -1 : 1),
          0,
        ),
        isFollowing: !prevFollowing,
        followingDelta: prevFollowing ? -1 : 1,
      });

      return {
        previousProfile,
        previousViewer,
        previousCurrentUser,
        prevFollowing,
      };
    },
    onError: (err, _prevFollowing, ctx) => {
      queryClient.setQueryData(
        queryKeys.userProfile(username),
        ctx?.previousProfile,
      );
      queryClient.setQueryData(
        queryKeys.userProfileViewer(username),
        ctx?.previousViewer,
      );
      queryClient.setQueryData(
        queryKeys.currentUser(),
        ctx?.previousCurrentUser,
      );
      toast.error(
        err instanceof Error ? err.message : "Couldn't update follow.",
      );
      console.log(err);
    },
    onSuccess: (res, prevFollowing, ctx) => {
      if (prevFollowing) {
        if (res && "alreadyRemoved" in res && res.alreadyRemoved) {
          patchProfileCaches({
            followerCount: Math.max(
              (ctx?.previousProfile?.followerCount ?? 0) - 1,
              0,
            ),
            isFollowing: false,
          });
        }
        toast.success("Unfollowed.");
        return;
      }

      if (res && "alreadyFollowing" in res && res.alreadyFollowing) {
        queryClient.setQueryData(
          queryKeys.userProfile(username),
          ctx?.previousProfile,
        );
        queryClient.setQueryData(
          queryKeys.userProfileViewer(username),
          ctx?.previousViewer,
        );
        queryClient.setQueryData(
          queryKeys.currentUser(),
          ctx?.previousCurrentUser,
        );
        toast.error("Already following.");
        return;
      }

      toast.success("Following.");
    },
  });

  const blockMutation = useMutation({
    mutationFn: async (prevBlocked: boolean) =>
      prevBlocked
        ? unblockUserAction({ userId: profile.id })
        : blockUserAction({ userId: profile.id }),
    onMutate: async (prevBlocked) => {
      const previousProfile = queryClient.getQueryData<UserProfileResponse>(
        queryKeys.userProfile(username),
      );
      const previousViewer =
        queryClient.getQueryData<UserProfileViewerResponse>(
          queryKeys.userProfileViewer(username),
        );
      const previousCurrentUser = queryClient.getQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
      );
      const previousMessages = queryClient.getQueryData<
        InfiniteData<MessagesResponse>
      >(queryKeys.receivedMessages());

      const nextBlocked = !prevBlocked;
      const willRemoveFollow = nextBlocked && isFollowing;
      const currentFollowerCount =
        previousProfile?.followerCount ?? profile.followerCount;

      patchProfileCaches({
        followerCount: willRemoveFollow
          ? Math.max(currentFollowerCount - 1, 0)
          : currentFollowerCount,
        isFollowing: willRemoveFollow ? false : isFollowing,
        isBlocked: nextBlocked,
        followingDelta: willRemoveFollow ? -1 : 0,
      });

      if (nextBlocked) {
        queryClient.setQueryData<InfiniteData<MessagesResponse>>(
          queryKeys.receivedMessages(),
          (current) => removeMessagesBySender(current, profile.id),
        );
      }

      return {
        previousProfile,
        previousViewer,
        previousCurrentUser,
        previousMessages,
      };
    },
    onError: (err, _prevBlocked, ctx) => {
      queryClient.setQueryData(
        queryKeys.userProfile(username),
        ctx?.previousProfile,
      );
      queryClient.setQueryData(
        queryKeys.userProfileViewer(username),
        ctx?.previousViewer,
      );
      queryClient.setQueryData(
        queryKeys.currentUser(),
        ctx?.previousCurrentUser,
      );
      queryClient.setQueryData(
        queryKeys.receivedMessages(),
        ctx?.previousMessages,
      );
      toast.error("Couldn't update block.");
      console.log(err);
    },
    onSuccess: (res, prevBlocked, ctx) => {
      if (prevBlocked) {
        if (res && "alreadyRemoved" in res && res.alreadyRemoved) {
          patchProfileCaches({ isBlocked: false });
        }
        toast.success("Unblocked.");
        return;
      }

      if (res && "alreadyBlocked" in res && res.alreadyBlocked) {
        queryClient.setQueryData(
          queryKeys.userProfile(username),
          ctx?.previousProfile,
        );
        queryClient.setQueryData(
          queryKeys.userProfileViewer(username),
          ctx?.previousViewer,
        );
        queryClient.setQueryData(
          queryKeys.currentUser(),
          ctx?.previousCurrentUser,
        );
        queryClient.setQueryData(
          queryKeys.receivedMessages(),
          ctx?.previousMessages,
        );
        toast.error("Already blocked.");
        return;
      }

      toast.success("User blocked.");
    },
  });

  const menuItems = [
    {
      title: isBlocked ? "Unblock" : "Block",
      onClick: () => {
        if (!isAuthenticated || isSelf) return;
        blockMutation.mutate(isBlocked);
      },
      className: "text-red-500",
      icon: <MessageSquareXIcon className="h-4 w-4" />,
      disabled: !isAuthenticated || isSelf,
    },
  ];

  return (
    <>
      <UserCard user={profile} />

      <div className="flex gap-2 mt-6 w-full">
        <Button
          variant="outline"
          disabled={!isAuthenticated || isSelf || isBlocked || isBlockedBy}
          className="flex-1"
          onClick={() => {
            if (!isAuthenticated || isSelf) return;
            followMutation.mutate(isFollowing);
          }}
        >
          {isFollowing ? <UserCheckIcon /> : <UserPlusIcon />}
          {isFollowing ? "Following" : "Follow"}
        </Button>

        <Button
          asChild
          variant="outline"
          className="flex-1"
          disabled={!isAuthenticated || isSelf || isBlocked || isBlockedBy}
        >
          <Link href={`/to/${profile.username}`}>
            <MessageSquareMoreIcon />
            Message
          </Link>
        </Button>

        <Menu menuItems={menuItems} />
      </div>
    </>
  );
}
