"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@umamin/ui/lib/utils";
import { UsersRoundIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GROUP_CHAT_ENABLED } from "@/lib/group";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import {
  fetchCurrentUserOptional,
  fetchGroupUnread,
} from "@/lib/query-fetchers";

// Bottom-nav Groups entry. Shares the currentUser + group-unread caches with the
// /groups hub (same query keys) — no extra requests, no extra writes. The dot is
// presence-only (the unread signal is one boolean per group), derived from
// group.lastMessageAt vs the read watermark; it clears when a room is opened.
export function NavGroups() {
  const pathname = usePathname();
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const { data: unread } = useQuery({
    queryKey: queryKeys.groupUnread(),
    queryFn: fetchGroupUnread,
    // Off while group chat is disabled — no messages means no unread signal.
    enabled: GROUP_CHAT_ENABLED && !!data?.user,
    staleTime: PRIVATE_STALE_TIME,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: true,
  });

  const hasUnread = (unread ?? []).some((u) => u.hasUnread);
  const active = pathname === "/groups" || pathname.startsWith("/groups/");

  return (
    <Link
      href="/groups"
      title="Groups"
      aria-current={active ? "page" : undefined}
      aria-label={hasUnread ? "Groups (unread messages)" : "Groups"}
      className={cn(active && "text-foreground!")}
    >
      <span className="relative">
        <UsersRoundIcon className="h-6 w-6" />
        {hasUnread && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary ring-2 ring-background"
          />
        )}
      </span>
    </Link>
  );
}
