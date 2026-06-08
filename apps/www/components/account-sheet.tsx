"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@umamin/ui/components/drawer";
import { cn } from "@umamin/ui/lib/utils";
import {
  CircleUserRoundIcon,
  LogOutIcon,
  SettingsIcon,
  UsersRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { GroupBadge } from "@/components/group-badge";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { logout } from "@/lib/auth";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";

type NavItem = {
  href: string;
  label: string;
  icon: typeof CircleUserRoundIcon;
};

// Avatar that opens the account drawer (X-style). Logged-out viewers get a
// plain Login link instead — no drawer to open.
export function AccountSheet({
  avatarClassName,
}: {
  avatarClassName?: string;
}) {
  const queryClient = useQueryClient();
  const version = process.env.NEXT_PUBLIC_VERSION ?? "v0.0.0";
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const user = data?.user;

  if (!user) {
    return (
      <Link
        href="/login"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Login
      </Link>
    );
  }

  const navItems: NavItem[] = [
    {
      href: `/user/${user.username}`,
      label: "Profile",
      icon: CircleUserRoundIcon,
    },
    { href: "/groups", label: "Groups", icon: UsersRoundIcon },
    { href: "/settings", label: "Settings and privacy", icon: SettingsIcon },
  ];

  return (
    <Drawer direction="left">
      <DrawerTrigger
        aria-label="Open account menu"
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className={cn("size-9", avatarClassName)}>
          <AvatarImage src={user.imageUrl ?? ""} alt="" />
          <AvatarFallback>
            {user.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </DrawerTrigger>

      <DrawerContent className="p-0">
        <DrawerTitle className="sr-only">Account menu</DrawerTitle>
        <DrawerDescription className="sr-only">
          Your profile, groups, and settings.
        </DrawerDescription>

        <div className="flex flex-col gap-6 overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-2">
            <DrawerClose asChild>
              <Link href={`/user/${user.username}`} className="block w-fit">
                <Avatar className="size-12">
                  <AvatarImage src={user.imageUrl ?? ""} alt="" />
                  <AvatarFallback>
                    {user.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="mt-2 flex items-center gap-1.5">
                  <span className="font-bold leading-tight">
                    {user.displayName ?? user.username}
                  </span>
                  {/* linked=false: a plain chip, never an anchor nested in the
                      profile link above. */}
                  <GroupBadge badge={user.groupBadge} linked={false} />
                </span>
                <span className="block text-sm text-muted-foreground">
                  @{user.username}
                </span>
              </Link>
            </DrawerClose>

            <ThemeToggleButton className="-mr-1 shrink-0" />
          </div>

          <DrawerClose asChild>
            <Link
              href={`/user/${user.username}`}
              className="flex gap-4 text-sm"
            >
              <span>
                <span className="font-bold text-foreground">
                  {user.followingCount ?? 0}
                </span>{" "}
                <span className="text-muted-foreground">Following</span>
              </span>
              <span>
                <span className="font-bold text-foreground">
                  {user.followerCount ?? 0}
                </span>{" "}
                <span className="text-muted-foreground">Followers</span>
              </span>
            </Link>
          </DrawerClose>

          <nav className="flex flex-col">
            {navItems.map(({ href, label, icon: Icon }) => (
              <DrawerClose asChild key={href}>
                <Link
                  href={href}
                  className="flex items-center gap-4 rounded-md py-3 text-lg font-semibold transition-colors hover:text-foreground/80"
                >
                  <Icon className="size-6" />
                  {label}
                </Link>
              </DrawerClose>
            ))}
          </nav>

          <form action={logout} className="border-t pt-4">
            <button
              type="submit"
              onClick={() => queryClient.clear()}
              className="flex w-full items-center gap-4 py-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOutIcon className="size-5" />
              Log out
            </button>
          </form>

          <Link
            href={`https://github.com/omsimos/umamin/releases/tag/${version}`}
            target="_blank"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            umamin {version}
          </Link>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
