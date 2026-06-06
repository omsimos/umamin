"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { BellIcon } from "lucide-react";
import Link from "next/link";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import {
  fetchCurrentUserOptional,
  fetchNotificationBadge,
} from "@/lib/query-fetchers";

export function NotificationBell() {
  // Shares the currentUser cache with AppHeader/PublicMenubar — no extra
  // request, and logged-out visitors never hit the badge endpoint.
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const user = data?.user;

  const { data: badge } = useQuery({
    queryKey: queryKeys.notificationBadge(),
    queryFn: fetchNotificationBadge,
    enabled: !!user,
    staleTime: PRIVATE_STALE_TIME,
    refetchOnMount: false,
    refetchOnReconnect: false,
    // Deliberate deviation from stableRefetchOptions: without it the badge
    // never refreshes while a tab sits open. Focus refetch only — no polling.
    refetchOnWindowFocus: true,
  });

  if (!user) {
    return null;
  }

  const unseen = badge?.unseen ?? 0;
  const unseenLabel = unseen > 9 ? "9+" : `${unseen}`;

  return (
    <Button variant="outline" size="icon" className="relative" asChild>
      <Link
        href="/notifications"
        aria-label={
          unseen > 0 ? `Notifications (${unseenLabel} unread)` : "Notifications"
        }
      >
        <BellIcon className="h-[1.2rem] w-[1.2rem]" />
        {unseen > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground"
          >
            {unseenLabel}
          </span>
        )}
      </Link>
    </Button>
  );
}
