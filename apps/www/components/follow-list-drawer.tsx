"use client";

import type { InfiniteData } from "@tanstack/react-query";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@umamin/ui/components/drawer";
import { Skeleton } from "@umamin/ui/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import {
  AlertCircleIcon,
  BadgeCheckIcon,
  Loader2Icon,
  UserCheckIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { followUserAction, unfollowUserAction } from "@/app/actions/user";
import { GroupBadge } from "@/components/group-badge";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { patchFollowListUser } from "@/lib/query-cache";
import { fetchFollowersPage, fetchFollowingPage } from "@/lib/query-fetchers";
import type { FollowListResponse, FollowListUser } from "@/lib/query-types";
import { getActionError } from "@/lib/utils";

type FollowTab = "followers" | "following";

type FollowListDrawerProps = {
  username: string;
  followerCount: number;
  followingCount: number;
};

export function FollowListDrawer({
  username,
  followerCount,
  followingCount,
}: FollowListDrawerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<FollowTab>("followers");

  const openOn = (next: FollowTab) => {
    setTab(next);
    setOpen(true);
  };

  const triggers = (
    <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
      <Button
        variant="ghost"
        onClick={() => openOn("following")}
        className="h-auto gap-1 rounded-sm p-0 font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <span className="font-semibold text-foreground">
          {followingCount ?? 0}
        </span>{" "}
        Following
      </Button>
      <Button
        variant="ghost"
        onClick={() => openOn("followers")}
        className="h-auto gap-1 rounded-sm p-0 font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <span className="font-semibold text-foreground">
          {followerCount ?? 0}
        </span>{" "}
        Followers
      </Button>
    </div>
  );

  const body = (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as FollowTab)}
      className="gap-4"
    >
      <TabsList className="w-full">
        <TabsTrigger value="followers" className="flex-1">
          Followers
        </TabsTrigger>
        <TabsTrigger value="following" className="flex-1">
          Following
        </TabsTrigger>
      </TabsList>

      <TabsContent value="followers">
        <FollowList username={username} direction="followers" />
      </TabsContent>
      <TabsContent value="following">
        <FollowList username={username} direction="following" />
      </TabsContent>
    </Tabs>
  );

  if (isDesktop) {
    return (
      <>
        {triggers}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="gap-0 p-0 sm:max-w-md">
            <DialogTitle className="sr-only">
              Connections for @{username}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Followers and following list for @{username}.
            </DialogDescription>
            {/* pt-10 clears the Dialog's absolute top-right close button so it
                doesn't overlap the full-width tabs. */}
            <div className="px-4 pb-5 pt-10">{body}</div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {triggers}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="sr-only">
              Connections for @{username}
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              Followers and following list for @{username}.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">{body}</div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function FollowList({
  username,
  direction,
}: {
  username: string;
  direction: FollowTab;
}) {
  const queryKey =
    direction === "followers"
      ? queryKeys.followers(username)
      : queryKeys.following(username);

  const {
    data,
    error,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<FollowListResponse>({
    queryKey,
    queryFn: ({ pageParam }) =>
      direction === "followers"
        ? fetchFollowersPage(username, (pageParam as string | null) ?? null)
        : fetchFollowingPage(username, (pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const users = useMemo(() => {
    const flat = data?.pages.flatMap((page) => page.data) ?? [];
    const map = new Map<string, FollowListUser>();
    for (const user of flat) {
      if (!map.has(user.id)) {
        map.set(user.id, user);
      }
    }
    return Array.from(map.values());
  }, [data]);

  const viewerId = data?.pages[0]?.viewerId ?? null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root, rootMargin: "200px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertTitle>Couldn&apos;t load list</AlertTitle>
        <AlertDescription>Please try again later.</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 py-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-8 w-20 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground text-sm">
        <UsersIcon className="size-6" />
        <p>
          {direction === "followers"
            ? "No followers yet."
            : "Not following anyone yet."}
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="max-h-[55vh] overflow-y-auto">
      <div className="divide-y">
        {users.map((user) => (
          <FollowUserRow
            key={user.id}
            user={user}
            viewerId={viewerId}
            queryKey={queryKey}
          />
        ))}
      </div>

      {hasNextPage ? (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-4 text-muted-foreground"
        >
          {isFetchingNextPage ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FollowUserRow({
  user,
  viewerId,
  queryKey,
}: {
  user: FollowListUser;
  viewerId: string | null;
  queryKey: readonly string[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isSelf = viewerId != null && viewerId === user.id;

  const followMutation = useMutation({
    mutationFn: async (prevFollowing: boolean) => {
      const res = prevFollowing
        ? await unfollowUserAction({ userId: user.id })
        : await followUserAction({ userId: user.id });
      const actionError = getActionError(res);
      if (actionError) {
        throw new Error(actionError);
      }
      return res;
    },
    onMutate: async (prevFollowing) => {
      const previous =
        queryClient.getQueryData<InfiniteData<FollowListResponse>>(queryKey);
      queryClient.setQueryData<InfiniteData<FollowListResponse>>(
        queryKey,
        (current) =>
          patchFollowListUser(current, user.id, (u) => ({
            ...u,
            isFollowing: !prevFollowing,
          })),
      );
      return { previous };
    },
    onError: (err, _prevFollowing, ctx) => {
      queryClient.setQueryData(queryKey, ctx?.previous);
      toast.error(
        err instanceof Error ? err.message : "Couldn't update follow.",
      );
      console.log(err);
    },
    onSuccess: (res, prevFollowing) => {
      // Reconcile the no-op responses (already following / already removed) so
      // the optimistic toggle matches the server's settled state.
      const settled =
        res && "alreadyFollowing" in res && res.alreadyFollowing
          ? true
          : res && "alreadyRemoved" in res && res.alreadyRemoved
            ? false
            : !prevFollowing;

      queryClient.setQueryData<InfiniteData<FollowListResponse>>(
        queryKey,
        (current) =>
          patchFollowListUser(current, user.id, (u) => ({
            ...u,
            isFollowing: settled,
          })),
      );
    },
  });

  const onFollowClick = () => {
    if (!viewerId) {
      router.push("/login");
      return;
    }
    if (followMutation.isPending) return;
    followMutation.mutate(user.isFollowing);
  };

  const isVerified = process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(
    ",",
  ).includes(user.username);

  return (
    <div className="flex items-center gap-3 py-3">
      {/* Avatar and name are separate links so the group badge (also a link)
          sits beside them without nesting anchors. */}
      <Link href={`/user/${user.username}`} className="shrink-0">
        <Avatar className="size-10">
          <AvatarImage
            src={user.imageUrl ?? ""}
            alt={`${user.username}'s avatar`}
          />
          <AvatarFallback>
            {user.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <Link
            href={`/user/${user.username}`}
            className="truncate font-medium text-sm hover:underline"
          >
            {user.displayName ? user.displayName : user.username}
          </Link>
          {isVerified && (
            <BadgeCheckIcon className="size-3.5 shrink-0 text-pink-500" />
          )}
          <GroupBadge badge={user.groupBadge} />
        </div>
        <p className="truncate text-muted-foreground text-sm">
          @{user.username}
        </p>
      </div>

      {!isSelf ? (
        <Button
          size="sm"
          variant={user.isFollowing ? "outline" : "default"}
          className="shrink-0"
          disabled={followMutation.isPending}
          onClick={onFollowClick}
        >
          {user.isFollowing ? <UserCheckIcon /> : <UserPlusIcon />}
          {user.isFollowing ? "Following" : "Follow"}
        </Button>
      ) : null}
    </div>
  );
}
