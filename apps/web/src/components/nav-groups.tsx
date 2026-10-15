import { useQuery } from "@tanstack/react-query";
import { cn } from "@umamin/ui/lib/utils";
import { UsersRoundIcon } from "lucide-react";
import { GROUP_CHAT_ENABLED } from "@/lib/group";
import { Link, usePathname } from "@/lib/navigation";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import {
  fetchCurrentUserOptional,
  fetchGroupUnread,
} from "@/lib/query-fetchers";

/** Whether any joined group has unread chat. Shares the currentUser +
 *  group-unread caches with the /groups hub (same query keys), so every
 *  surface showing the dot costs one request between them. The dot is
 *  presence-only (one boolean per group) and clears when a room is opened. */
export function useGroupUnread(): boolean {
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

  return (unread ?? []).some((u) => u.hasUnread);
}

// Bottom-nav Groups entry, shown while the Chat tab isn't launched.
export function NavGroups() {
  const pathname = usePathname();
  const hasUnread = useGroupUnread();
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
