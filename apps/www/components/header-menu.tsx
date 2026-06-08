"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@umamin/ui/components/dropdown-menu";
import {
  EllipsisVerticalIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  UsersRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";

// Quick-access menu on the focused-view header (profile, inbox, notifications,
// settings) where the account drawer isn't reachable: group/settings shortcuts
// plus the theme toggle (otherwise only in the drawer).
export function HeaderMenu() {
  const { resolvedTheme, setTheme } = useTheme();
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const user = data?.user;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="More options">
          <EllipsisVerticalIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {user ? (
          <>
            <DropdownMenuItem asChild>
              <Link href="/groups">
                <UsersRoundIcon />
                Groups
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <SettingsIcon />
                Settings and privacy
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}

        <DropdownMenuItem
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <SunIcon className="dark:hidden" />
          <MoonIcon className="hidden dark:block" />
          Toggle theme
        </DropdownMenuItem>

        {user ? null : (
          <DropdownMenuItem asChild>
            <Link href="/login">Login</Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
