"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@umamin/ui/lib/utils";
import {
  CircleUserRoundIcon,
  LayoutDashboardIcon,
  LogInIcon,
  MessagesSquareIcon,
  ScrollTextIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import { ChatPromo } from "./chat-promo";
import { MenubarLink } from "./menubar-link";
import { NavGroups } from "./nav-groups";
import { NavNotifications } from "./nav-notifications";

// Client-side auth (currentUser cache) so the (public) layout stays static —
// logged-in viewers still get a Profile/Share/Settings nav, not the all-/login
// fallback.
export function PublicMenubar() {
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const username = currentUser?.user?.username;
  const isAuthenticated = !!currentUser?.user?.id;
  const pathname = usePathname();
  // On post detail the bottom nav stays (the reply input sits above it), but the
  // desktop top-bar variant is hidden so the focused view owns the top.
  const isPostDetail = pathname.startsWith("/post");

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 mx-auto flex max-w-screen-sm items-center justify-center gap-3 bg-bg bg-opacity-40 bg-clip-padding p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-3xl backdrop-blur-xl backdrop-filter sm:px-10 lg:bottom-auto lg:top-0 lg:z-50 lg:bg-transparent lg:px-14 lg:pb-2 lg:text-[1.75rem] lg:backdrop-blur-none [&>*:hover]:bg-muted *:flex *:w-full *:justify-center *:rounded-lg *:py-5 *:text-center *:text-muted-foreground *:transition-colors *:duration-300",
        isPostDetail && "lg:hidden",
      )}
    >
      {/* Authed users get Groups (with an unread dot); logged-out viewers keep
          the anonymous-chat cross-promo (their no-signup audience). */}
      {isAuthenticated ? <NavGroups /> : <ChatPromo />}

      <MenubarLink href="/notes" title="Notes">
        <ScrollTextIcon className="h-6 w-6" />
      </MenubarLink>

      {username ? (
        // Lands on the profile's Posts tab; Received/Sent are one tap away.
        <MenubarLink
          href={`/user/${username}`}
          ariaLabel="Your profile"
          title="Profile"
        >
          <CircleUserRoundIcon className="h-6 w-6" />
        </MenubarLink>
      ) : (
        <Link href="/login" aria-label="home button" title="Inbox">
          <LayoutDashboardIcon />
        </Link>
      )}

      <MenubarLink href="/feed" title="Social">
        <MessagesSquareIcon className="h-6 w-6" />
      </MenubarLink>

      {isAuthenticated ? (
        <NavNotifications />
      ) : (
        <Link href="/login" title="Login">
          <LogInIcon className="h-6 w-6" />
        </Link>
      )}
    </div>
  );
}
