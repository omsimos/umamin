"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { Button } from "@umamin/ui/components/button";
import { AlertCircleIcon, BellOffIcon } from "lucide-react";
import { useEffect } from "react";
import { markNotificationsSeenAction } from "@/app/actions/notification";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchNotificationsPage } from "@/lib/query-fetchers";
import type { NotificationsResponse } from "@/lib/query-types";
import { NotificationCard } from "./notification-card";
import { NotificationListSkeleton } from "./notification-skeleton";

export function NotificationsList() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
  } = useInfiniteQuery<NotificationsResponse>({
    queryKey: queryKeys.notifications(),
    queryFn: ({ pageParam }) =>
      fetchNotificationsPage((pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  // Visiting the page is what "reads" notifications: advance the server
  // watermark through the newest item actually rendered (not "now" — one
  // arriving after this snapshot must stay unseen), then refresh the bell
  // badge. Empty list → nothing to mark, no write. Failures are swallowed —
  // the watermark just advances on the next visit instead. Primitive dep so a
  // refetch with the same head doesn't re-fire; a newer head re-marks.
  const newest = data?.pages[0]?.notifications[0];
  const seenThroughMs = newest ? new Date(newest.updatedAt).getTime() : null;

  useEffect(() => {
    if (seenThroughMs === null) {
      return;
    }

    markNotificationsSeenAction({ seenThrough: seenThroughMs })
      .then(() => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.notificationBadge(),
        });
      })
      .catch(() => {});
  }, [seenThroughMs, queryClient]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertDescription>
          Failed to load notifications. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  const notifications = data?.pages.flatMap((page) => page.notifications) ?? [];

  if (data === undefined || isLoading) {
    return <NotificationListSkeleton />;
  }

  if (notifications.length === 0 && !isFetching) {
    return (
      <Alert>
        <BellOffIcon />
        <AlertTitle>No notifications yet</AlertTitle>
        <AlertDescription>
          Likes, comments, follows, and new messages will show up here.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <ul className="divide-y">
        {notifications.map((notification) => (
          <li key={notification.id}>
            <NotificationCard notification={notification} />
          </li>
        ))}
      </ul>

      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
