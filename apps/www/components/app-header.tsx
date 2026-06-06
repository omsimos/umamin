"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import Link from "next/link";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { UmaminLogo } from "./umamin-logo";

export function AppHeader() {
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const user = data?.user;

  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full bg-background bg-opacity-40 bg-clip-padding backdrop-blur-xl backdrop-filter lg:hidden">
      <div className="container relative flex h-16 max-w-7xl items-center justify-between">
        {user ? (
          <Link href={`/user/${user.username}`} aria-label="Your profile">
            <Avatar className="size-9">
              <AvatarImage src={user.imageUrl ?? ""} alt="" />
              <AvatarFallback>
                {user.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Login
          </Link>
        )}

        <Link
          href="/feed"
          aria-label="umamin"
          className="absolute left-1/2 -translate-x-1/2"
        >
          <UmaminLogo className="size-8" />
        </Link>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
