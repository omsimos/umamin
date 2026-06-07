"use client";

import type { InfiniteData } from "@tanstack/react-query";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import { Label } from "@umamin/ui/components/label";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ScanFaceIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { unblockUserAction } from "@/app/actions/user";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchBlockedUsersPage } from "@/lib/query-fetchers";
import type { BlockedUsersResponse } from "@/lib/query-types";

export function BlockedUsersSection() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<BlockedUsersResponse>({
    queryKey: queryKeys.blockedUsers(),
    queryFn: ({ pageParam }) =>
      fetchBlockedUsersPage((pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const unblockMutation = useMutation({
    mutationFn: async (user: { id: string; username: string }) => {
      const res = await unblockUserAction({ userId: user.id });
      if (res && "error" in res && res.error) {
        throw new Error(res.error);
      }
      return user;
    },
    onSuccess: ({ id: userId, username }) => {
      // Drop the row immediately; the server tag is already busted so the
      // unblocked user's content reappears on the next feed/notes refetch.
      queryClient.setQueryData<InfiniteData<BlockedUsersResponse>>(
        queryKeys.blockedUsers(),
        (current) =>
          current && {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              data: page.data.filter((user) => user.id !== userId),
            })),
          },
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.postsRoot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notesRoot() });
      // Removed (not invalidated): the profile-viewer query is enabled: false
      // and resolved via getQueryData, so a stale entry would short-circuit.
      queryClient.removeQueries({
        queryKey: queryKeys.userProfileViewer(username),
      });
      toast.success("User unblocked.");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Couldn't unblock user.");
    },
  });

  const blockedUsers = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <section>
      <Label>Blocked Users</Label>
      <div className="space-y-4 rounded-md border p-4 mt-2">
        {error ? (
          <p className="text-sm text-muted-foreground">
            Failed to load blocked users. Please try again later.
          </p>
        ) : isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : blockedUsers.length === 0 && !hasNextPage ? (
          // !hasNextPage: a page can resolve to zero users (deleted accounts)
          // while more block edges remain — show only "Load more" then.
          <p className="text-sm text-muted-foreground italic">
            You haven't blocked anyone.
          </p>
        ) : (
          <ul className="divide-y">
            {blockedUsers.map((user) => (
              <li
                key={user.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Link href={`/user/${user.username}`}>
                  <Avatar>
                    <AvatarImage
                      className="rounded-full"
                      src={user.imageUrl ?? ""}
                      alt={`@${user.username}'s avatar`}
                    />
                    <AvatarFallback>
                      <ScanFaceIcon />
                    </AvatarFallback>
                  </Avatar>
                </Link>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/user/${user.username}`}
                    className="text-sm font-medium leading-none block truncate"
                  >
                    {user.displayName || user.username}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">
                    @{user.username} · blocked{" "}
                    {formatDistanceToNow(new Date(user.blockedAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    unblockMutation.isPending &&
                    unblockMutation.variables?.id === user.id
                  }
                  onClick={() =>
                    unblockMutation.mutate({
                      id: user.id,
                      username: user.username,
                    })
                  }
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        )}

        {hasNextPage && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
