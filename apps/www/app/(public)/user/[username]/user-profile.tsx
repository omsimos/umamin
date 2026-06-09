"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@umamin/ui/components/dropdown-menu";
import {
  EllipsisIcon,
  MessageSquareMoreIcon,
  MessageSquareXIcon,
  Share2Icon,
  UserCheckIcon,
  UserPlusIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  blockUserAction,
  followUserAction,
  unblockUserAction,
  unfollowUserAction,
} from "@/app/actions/user";
import { shareProfile } from "@/components/share-button";
import { UserCard } from "@/components/user-card";
import { YouTabs } from "@/components/you-tabs";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  PUBLIC_STALE_TIME,
  pageQueryOptions,
  queryKeys,
} from "@/lib/query";
import {
  patchCurrentUser,
  patchUserProfile,
  patchUserProfileViewer,
} from "@/lib/query-cache";
import {
  fetchCurrentUserOptional,
  fetchUserProfile,
  fetchUserProfileViewer,
} from "@/lib/query-fetchers";
import type {
  CurrentUserResponse,
  MessagesResponse,
  UserProfileResponse,
  UserProfileViewerResponse,
} from "@/lib/query-types";
import { getActionError } from "@/lib/utils";
import type { PublicUserWithBadge } from "@/types/user";
import { ProfilePostList } from "./profile-post-list";

type Props = {
  username: string;
  initialUser: PublicUserWithBadge;
};

export function UserProfile({ username, initialUser }: Props) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: user } = useQuery({
    ...pageQueryOptions(
      queryKeys.userProfile(username),
      () => fetchUserProfile(username),
      PUBLIC_STALE_TIME,
    ),
    initialData: initialUser,
  });
  const viewerQueryOptions = pageQueryOptions(
    queryKeys.userProfileViewer(username),
    () => fetchUserProfileViewer(username),
    PRIVATE_STALE_TIME,
  );
  const { data: viewer } = useQuery({
    ...viewerQueryOptions,
    enabled: false,
  });

  const profile = user ?? initialUser;

  // Client-side self-check (app-wide currentUser cache) keeps the profile's
  // server shell static — no cookie read.
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const isFollowing = viewer?.isFollowing === true;
  const isBlocked = viewer?.isBlocked === true;
  const isBlockedBy = viewer?.isBlockedBy === true;
  const isSelf = !!currentUser?.user?.id && currentUser.user.id === profile.id;

  const resolveViewer = async () => {
    const cached = queryClient.getQueryData<UserProfileViewerResponse>(
      queryKeys.userProfileViewer(username),
    );

    if (cached) {
      return cached;
    }

    try {
      return await queryClient.fetchQuery(viewerQueryOptions);
    } catch (error) {
      console.log(error);
      toast.error("Couldn't load profile actions.");
      return null;
    }
  };

  const requireAuthenticatedViewer = async () => {
    const resolvedViewer = await resolveViewer();

    if (!resolvedViewer?.isAuthenticated) {
      router.push("/login");
      return null;
    }

    return resolvedViewer;
  };

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

  const followMutation = useMutation({
    mutationFn: async (prevFollowing: boolean) => {
      const res = prevFollowing
        ? await unfollowUserAction({ userId: profile.id })
        : await followUserAction({ userId: profile.id });
      const actionError = getActionError(res);
      if (actionError) {
        throw new Error(actionError);
      }
      return res;
    },
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
    mutationFn: async (prevBlocked: boolean) => {
      const res = prevBlocked
        ? await unblockUserAction({ userId: profile.id })
        : await blockUserAction({ userId: profile.id });
      const actionError = getActionError(res);
      if (actionError) {
        throw new Error(actionError);
      }
      return res;
    },
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

      // The inbox no longer carries sender ids (anonymity, audit #22), so the
      // blocked sender's messages can't be filtered client-side — the
      // receivedMessages query is invalidated on success to refetch the
      // server-filtered list instead.

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
      toast.error(
        err instanceof Error ? err.message : "Couldn't update block.",
      );
      console.log(err);
    },
    onSuccess: (res, prevBlocked, ctx) => {
      if (prevBlocked) {
        if (res && "alreadyRemoved" in res && res.alreadyRemoved) {
          patchProfileCaches({ isBlocked: false });
        }
        // Settings' blocked-users list has stable refetch options — it only
        // updates via explicit invalidation.
        queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers() });
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

      queryClient.invalidateQueries({
        queryKey: queryKeys.receivedMessages(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers() });
      toast.success("User blocked.");
    },
  });

  const handleBlock = async () => {
    if (blockMutation.isPending) return;

    const resolvedViewer = await requireAuthenticatedViewer();
    if (!resolvedViewer || resolvedViewer.currentUserId === profile.id) {
      return;
    }

    blockMutation.mutate(resolvedViewer.isBlocked);
  };

  // Other profiles fold Share + Block into one overflow menu at the banner's
  // top-right (self gets edit + share instead, handled inside UserCard).
  const profileMenu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="secondary"
          aria-label="More options"
          className="rounded-full bg-background/70 backdrop-blur"
        >
          <EllipsisIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => shareProfile(profile.username)}>
          <span className="flex items-center gap-2">
            <Share2Icon className="size-4" />
            Share
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={blockMutation.isPending}
          onClick={handleBlock}
          className="text-red-500"
        >
          <span className="flex items-center gap-2">
            <MessageSquareXIcon className="size-4" />
            {isBlocked ? "Unblock" : "Block"}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <UserCard
        user={profile}
        isSelf={isSelf}
        headerActions={isSelf ? undefined : profileMenu}
      />

      {isSelf ? null : (
        <div className="flex gap-2 mt-6 w-full">
          <Button
            variant="outline"
            disabled={
              isSelf ||
              isBlocked ||
              isBlockedBy ||
              followMutation.isPending ||
              blockMutation.isPending
            }
            className="flex-1"
            onClick={async () => {
              if (blockMutation.isPending) return;

              const resolvedViewer = await requireAuthenticatedViewer();
              if (
                !resolvedViewer ||
                resolvedViewer.currentUserId === profile.id ||
                resolvedViewer.isBlocked ||
                resolvedViewer.isBlockedBy
              ) {
                return;
              }

              followMutation.mutate(resolvedViewer.isFollowing);
            }}
          >
            {isFollowing ? <UserCheckIcon /> : <UserPlusIcon />}
            {isFollowing ? "Following" : "Follow"}
          </Button>

          <Button
            variant="outline"
            className="flex-1"
            disabled={
              isSelf ||
              isBlocked ||
              isBlockedBy ||
              followMutation.isPending ||
              blockMutation.isPending
            }
            onClick={async () => {
              const resolvedViewer = await requireAuthenticatedViewer();
              if (
                !resolvedViewer ||
                resolvedViewer.currentUserId === profile.id ||
                resolvedViewer.isBlocked ||
                resolvedViewer.isBlockedBy
              ) {
                return;
              }

              router.push(`/to/${profile.username}`);
            }}
          >
            <MessageSquareMoreIcon />
            Message
          </Button>
        </div>
      )}

      {isSelf ? <YouTabs username={profile.username} active="posts" /> : null}

      <ProfilePostList username={username} showDivider={!isSelf} />
    </>
  );
}
