import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarImage } from "@umamin/ui/components/avatar";
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
  Loader2Icon,
  LogOutIcon,
  MessageSquareQuoteIcon,
  SettingsIcon,
  UsersRoundIcon,
} from "lucide-react";
import { toast } from "sonner";
import { BlobatarFallback } from "@/components/blobatar-fallback";
import { GroupBadge } from "@/components/group-badge";
import { useGroupUnread } from "@/components/nav-groups";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { UmaminChatLink } from "@/components/umamin-chat-link";
import { actionError, callAction } from "@/lib/api";
import { ExpectedError } from "@/lib/expected-error";
import { Link, useAppNavigate } from "@/lib/navigation";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";

function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute size-2.5 rounded-full bg-primary ring-2 ring-background",
        className,
      )}
    />
  );
}

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
  const navigate = useAppNavigate();
  const version = import.meta.env.VITE_APP_VERSION ?? "v0.0.0";

  // logout redirects server-side; the client clears its cache and navigates to
  // /login (session cookie already invalidated).
  const logoutMutation = useMutation({
    // callAction never rejects — it returns { error } — so throw here or
    // onError is unreachable and a failed logout would still "succeed".
    mutationFn: async () => {
      const res = await callAction("logout");
      const err = actionError(res);
      if (err) throw new ExpectedError(err);
      return res;
    },
    onSuccess: () => {
      queryClient.clear();
      navigate("/login");
    },
    onError: () => toast.error("Couldn't log out. Please try again."),
  });

  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });

  const user = data?.user;
  const groupUnread = useGroupUnread();

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
    <Drawer direction="left">
      <DrawerTrigger
        aria-label={
          groupUnread
            ? "Open account menu (unread group messages)"
            : "Open account menu"
        }
        className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className={cn("size-9", avatarClassName)}>
          <AvatarImage src={user.imageUrl ?? ""} alt="" />
          <BlobatarFallback seed={user.id} />
        </Avatar>
        {groupUnread && <UnreadDot className="-right-0.5 -top-0.5" />}
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
                  <BlobatarFallback seed={user.id} />
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
              <Link href={`/user/${user.username}`} className={NAV_ITEM_CLASS}>
                <CircleUserRoundIcon className="size-6" />
                Profile
              </Link>
            </DrawerClose>

            <DrawerClose asChild>
              <Link href="/tiers" className={NAV_ITEM_CLASS}>
                <CircleFadingPlusIcon className="size-6" />
                Plus
              </Link>
            </DrawerClose>

            <DrawerClose asChild>
              <Link href="/groups" className={NAV_ITEM_CLASS}>
                <span className="relative">
                  <UsersRoundIcon className="size-6" />
                  {groupUnread && <UnreadDot className="-right-1 -top-1" />}
                </span>
                Groups
                {groupUnread && <span className="sr-only">(unread)</span>}
              </Link>
            </DrawerClose>

            <DrawerClose asChild>
              <UmaminChatLink utm="account" className={NAV_ITEM_CLASS}>
                <MessageSquareQuoteIcon className="size-6" />
                Umamin Chat
              </UmaminChatLink>
            </DrawerClose>

            <DrawerClose asChild>
              <Link href="/settings" className={NAV_ITEM_CLASS}>
                <SettingsIcon className="size-6" />
                Settings and privacy
              </Link>
            </DrawerClose>
          </nav>

          <div className="border-t pt-4">
            <button
              type="button"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
              className="flex w-full items-center gap-4 py-2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {logoutMutation.isPending ? (
                <Loader2Icon className="size-5 animate-spin" />
              ) : (
                <LogOutIcon className="size-5" />
              )}
              Log out
            </button>
          </div>

          <DrawerClose asChild>
            <Link
              href="/changelog"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="font-display font-bold tracking-tighter">
                umamin
              </span>{" "}
              {version}
            </Link>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
