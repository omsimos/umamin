import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { Button } from "@umamin/ui/components/button";
import { AlertCircleIcon, BellOffIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { RefetchErrorAlert } from "@/components/refetch-error-alert";
import { actionError, callAction } from "@/lib/api";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchNotificationsPage } from "@/lib/query-fetchers";
import type { NotificationsResponse } from "@/lib/types";
import { useRefreshWhenStale } from "../-shared/use-refresh-when-stale";
import { NotificationCard } from "./notification-card";
import { NotificationListSkeleton } from "./notification-skeleton";

function markNotificationsSeenAction(input: { seenThrough: number }) {
  return callAction<{ success: boolean }>("markNotificationsSeenAction", input);
}

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
    isFetchNextPageError,
    refetch,
  } = useInfiniteQuery<NotificationsResponse>({
    queryKey: queryKeys.notifications(),
    queryFn: ({ pageParam }) =>
      fetchNotificationsPage((pageParam as string | null) ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  useRefreshWhenStale(queryKeys.notifications());

  // Visiting the page "reads" notifications: advance the server watermark
  // through the newest rendered item, then refresh the bell badge.
  const newest = data?.pages[0]?.notifications[0];
  const seenThroughMs = newest ? new Date(newest.updatedAt).getTime() : null;

  // Latch the first watermark this visit renders with, so the mark-seen cache
  // patch below doesn't clear the dots out from under the open page.
  const pageLastSeen = data?.pages[0]?.lastSeen;
  const visitLastSeenRef = useRef<number | undefined>(undefined);
  if (visitLastSeenRef.current === undefined && pageLastSeen !== undefined) {
    visitLastSeenRef.current = pageLastSeen;
  }
  const lastSeen = visitLastSeenRef.current;

  const markedRef = useRef<number | null>(null);

  useEffect(() => {
    if (seenThroughMs === null || seenThroughMs === markedRef.current) {
      return;
    }
    // useRefreshWhenStale's effect runs before this one and may have just
    // started a refresh. Marking the old newest item wouldn't move the server
    // watermark, so the badge would stay lit; wait for the fetch to settle,
    // which flips isFetching and re-runs this. Read from the cache because
    // this render's isFetching predates that refresh.
    if (
      isFetching ||
      queryClient.getQueryState(queryKeys.notifications())?.fetchStatus ===
        "fetching"
    ) {
      return;
    }
    markedRef.current = seenThroughMs;

    markNotificationsSeenAction({ seenThrough: seenThroughMs })
      .then((res) => {
        // The server watermark didn't move, so the rows are still unseen.
        if (actionError(res)) {
          markedRef.current = null;
          return;
        }
        queryClient.invalidateQueries({
          queryKey: queryKeys.notificationBadge(),
        });
        // Advance the cached watermark too — a revisit inside the stale window
        // reuses this cache, so without this it re-lights rows this visit
        // already showed as new.
        queryClient.setQueryData<InfiniteData<NotificationsResponse>>(
          queryKeys.notifications(),
          (current) =>
            current && {
              ...current,
              pages: current.pages.map((page, i) =>
                i === 0 ? { ...page, lastSeen: seenThroughMs } : page,
              ),
            },
        );
      })
      .catch(() => {
        markedRef.current = null;
      });
  }, [seenThroughMs, isFetching, queryClient]);

  if (error && !data) {
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
      {error && (
        <RefetchErrorAlert
          onRetry={() => (isFetchNextPageError ? fetchNextPage() : refetch())}
          retrying={isFetching}
        />
      )}
      <ul className="divide-y">
        {notifications.map((notification) => (
          <li key={notification.id}>
            <NotificationCard
              notification={notification}
              isNew={
                lastSeen !== undefined &&
                new Date(notification.updatedAt).getTime() > lastSeen
              }
            />
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
