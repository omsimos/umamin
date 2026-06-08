"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@umamin/ui/lib/utils";
import { BellIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import {
  fetchCurrentUserOptional,
  fetchNotificationBadge,
} from "@/lib/query-fetchers";

// Bottom-nav notifications entry (replaces the old Settings slot, which moved
// to the account drawer). Shares the currentUser + badge caches with the
// header bell — no extra requests.
export function NavNotifications() {
  const pathname = usePathname();
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const { data: badge } = useQuery({
    queryKey: queryKeys.notificationBadge(),
    queryFn: fetchNotificationBadge,
    enabled: !!data?.user,
    staleTime: PRIVATE_STALE_TIME,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: true,
  });

  const unseen = badge?.unseen ?? 0;
  const unseenLabel = unseen > 9 ? "9+" : `${unseen}`;
  const active = pathname === "/notifications";

  return (
    <Link
      href="/notifications"
      title="Notifications"
      aria-current={active ? "page" : undefined}
      aria-label={
        unseen > 0 ? `Notifications (${unseenLabel} unread)` : "Notifications"
      }
      className={cn(active && "text-foreground!")}
    >
      <span className="relative">
        <BellIcon className="h-6 w-6" />
        {unseen > 0 && (
          <span
            aria-hidden
            className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground"
          >
            {unseenLabel}
          </span>
        )}
      </span>
    </Link>
  );
}
