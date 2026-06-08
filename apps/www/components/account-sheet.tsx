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
  CircleFadingPlusIcon,
  CircleUserRoundIcon,
  LogOutIcon,
  SettingsIcon,
  UsersRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GroupBadge } from "@/components/group-badge";
import { PlusDialog } from "@/components/plus-dialog";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { logout } from "@/lib/auth";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import { hasUmaminPlus } from "@/lib/utils";

const NAV_ITEM_CLASS =
  "flex items-center gap-4 rounded-md py-3 text-lg font-semibold transition-colors hover:text-foreground/80";

// Avatar that opens the account drawer (X-style). Logged-out viewers get a
// plain Login link instead — no drawer to open.
export function AccountSheet({
  avatarClassName,
}: {
  avatarClassName?: string;
}) {
  const queryClient = useQueryClient();
  const [plusOpen, setPlusOpen] = useState(false);
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

  return (
    <>
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
              <DrawerClose asChild>
                <Link
                  href={`/user/${user.username}`}
                  className={NAV_ITEM_CLASS}
                >
                  <CircleUserRoundIcon className="size-6" />
                  Profile
                </Link>
              </DrawerClose>

              <DrawerClose asChild>
                <button
                  type="button"
                  onClick={() => setPlusOpen(true)}
                  className={NAV_ITEM_CLASS}
                >
                  <CircleFadingPlusIcon className="size-6 text-pink-500" />
                  Plus
                </button>
              </DrawerClose>

              <DrawerClose asChild>
                <Link href="/groups" className={NAV_ITEM_CLASS}>
                  <UsersRoundIcon className="size-6" />
                  Groups
                </Link>
              </DrawerClose>

              <DrawerClose asChild>
                <Link href="/settings" className={NAV_ITEM_CLASS}>
                  <SettingsIcon className="size-6" />
                  Settings and privacy
                </Link>
              </DrawerClose>
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
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="font-display font-bold tracking-tighter">
                umamin
              </span>{" "}
              {version}
            </Link>
          </div>
        </DrawerContent>
      </Drawer>

      <PlusDialog
        open={plusOpen}
        onOpenChange={setPlusOpen}
        isPlus={hasUmaminPlus(user.createdAt)}
      />
    </>
  );
}
