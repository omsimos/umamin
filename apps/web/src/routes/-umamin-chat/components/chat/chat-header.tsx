import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@umamin/ui/components/alert-dialog";
import { Button } from "@umamin/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@umamin/ui/components/dropdown-menu";
import { cn } from "@umamin/ui/lib/utils";
import {
  EllipsisVerticalIcon,
  HeartIcon,
  LogOutIcon,
  ShuffleIcon,
} from "lucide-react";
import { useState } from "react";
import { interestById } from "@/lib/chat/content";
import type { GameStreak, Partner } from "@/lib/chat/types";
import { SeedAvatar } from "../seed-avatar";
import { SessionBackButton, SessionHeader } from "../shell/session-frame";

const STATUS_LABEL = {
  online: "online",
  typing: "typing…",
  away: "away",
  left: "left",
} as const;

const STATUS_DOT = {
  online: "bg-emerald-500",
  typing: "bg-emerald-500",
  away: "bg-amber-500",
  left: "bg-muted-foreground",
} as const;

export function ChatHeader({
  partner,
  gameStreak,
  stayConnectedActive,
  mutual = false,
  revealTease = false,
  onStayConnected,
  onOpenConnect,
  onNewMatch,
  onEndChat,
}: {
  partner: Partner;
  gameStreak?: GameStreak;
  stayConnectedActive: boolean;
  /** Both tapped the heart, so it now opens the handle exchange. */
  mutual?: boolean;
  /** The partner left a handle you haven't matched yet: badge the heart. */
  revealTease?: boolean;
  onStayConnected: () => void;
  onOpenConnect?: () => void;
  onNewMatch: () => void;
  onEndChat: () => void;
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const shared = interestById(partner.sharedInterests[0]);
  const streak = gameStreak?.current ?? 0;
  const status = partner.status ?? "online";

  return (
    <SessionHeader>
      <SessionBackButton label="End chat" onClick={() => setConfirmEnd(true)} />

      <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1 py-0.5">
        <SeedAvatar
          seed={partner.avatarSeed}
          alias={partner.alias}
          className="size-8"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {partner.alias}
          </span>
          <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full transition-colors",
                STATUS_DOT[status],
              )}
            />
            <span className="shrink-0">{STATUS_LABEL[status]}</span>
            {shared && (
              <span className="truncate">
                · <span aria-hidden>{shared.emoji}</span> {shared.label}
              </span>
            )}
            {streak >= 2 && (
              <span className="text-primary shrink-0 font-semibold tabular-nums">
                ·{" "}
                <span
                  aria-hidden
                  className={cn(
                    "inline-block",
                    streak >= 3 &&
                      "animate-chat-flame-flicker motion-reduce:animate-none",
                  )}
                >
                  🔥×{streak}
                </span>
                <span className="sr-only">
                  Combo: {streak} successful rounds in a row
                </span>
              </span>
            )}
          </span>
        </span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        // aria-label wins accessible-name computation, so the tease has to live
        // in the label itself.
        aria-label={
          revealTease
            ? `${partner.alias} shared a handle, open connection`
            : mutual
              ? "Open connection"
              : "Stay connected"
        }
        aria-pressed={mutual ? undefined : stayConnectedActive}
        className={cn(
          "relative shrink-0 rounded-full",
          stayConnectedActive && "text-primary",
        )}
        onClick={mutual && onOpenConnect ? onOpenConnect : onStayConnected}
      >
        <HeartIcon
          className={cn(
            "size-5 transition-transform active:scale-90",
            stayConnectedActive && "fill-current",
          )}
        />
        {revealTease && (
          <span
            aria-hidden
            className="bg-primary ring-background absolute top-1.5 right-1.5 size-2 rounded-full ring-2"
          />
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Chat options"
            className="shrink-0 rounded-full"
          >
            <EllipsisVerticalIcon className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onNewMatch}>
            <ShuffleIcon />
            New match
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmEnd(true)}
          >
            <LogOutIcon />
            End chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              The conversation will be gone for good. Nothing is saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep chatting</AlertDialogCancel>
            <AlertDialogAction onClick={onEndChat}>End chat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SessionHeader>
  );
}
