import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { Heart } from "lucide-react";
import { interestById } from "../../lib/content";
import type { GameStreak, Partner, VibeState } from "../../lib/session/types";
import { SeedAvatar } from "../seed-avatar";
import { VibeRing } from "./vibe/vibe-ring";

export function ChatHeader({
  partner,
  vibe,
  gameStreak,
  stayConnectedActive,
  mutual = false,
  revealTease = false,
  onStayConnected,
  onOpenConnect,
  onShowVibe,
}: {
  partner: Partner;
  vibe: VibeState;
  gameStreak?: GameStreak;
  stayConnectedActive: boolean;
  /** Both tapped the heart — it now opens the handle exchange instead. */
  mutual?: boolean;
  /** Partner left a handle you haven't matched yet — badge the heart. */
  revealTease?: boolean;
  onStayConnected: () => void;
  onOpenConnect?: () => void;
  /** The whole partner cluster is the vibe meter's tap target. */
  onShowVibe: () => void;
}) {
  const shared = interestById(partner.sharedInterests[0]);
  const streak = gameStreak?.current ?? 0;
  const status =
    partner.status === "typing"
      ? "typing…"
      : partner.status === "away"
        ? "away"
        : partner.status === "left"
          ? "left"
          : "online";
  const tone =
    partner.status === "left"
      ? "text-muted-foreground"
      : partner.status === "away"
        ? "text-amber-600 dark:text-amber-500"
        : "text-emerald-600";

  return (
    <header className="flex items-center gap-3 border-b px-4 py-2.5">
      <button
        type="button"
        onClick={onShowVibe}
        aria-label={`Vibe level ${vibe.level} with ${partner.alias} — open details`}
        className={cn(
          "-mx-1 flex min-w-0 items-center gap-3 rounded-lg px-1 py-0.5 text-left",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
          "transition-[filter] active:brightness-90",
        )}
      >
        <VibeRing vibe={vibe}>
          <SeedAvatar
            seed={partner.avatarSeed}
            alias={partner.alias}
            className="size-8"
          />
        </VibeRing>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {partner.alias}
          </span>
          <span className={cn("block text-[11px]", tone)}>
            <span aria-hidden>●</span> {status}
          </span>
        </span>
      </button>
      {shared && (
        <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 text-[10px]">
          <span aria-hidden>{shared.emoji}</span> {shared.label}
        </span>
      )}
      {/* Live combo only — the game tally moved into the vibe sheet. */}
      {streak >= 2 && (
        <span className="animate-pop-in motion-reduce:animate-none bg-primary/15 text-primary ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums">
          <span
            aria-hidden
            className={cn(
              "inline-block",
              streak >= 3 && "animate-flame-flicker motion-reduce:animate-none",
            )}
          >
            🔥×{streak}
          </span>
          <span className="sr-only">
            Combo: {streak} successful rounds in a row
          </span>
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label={mutual ? "Open connection" : "Stay connected"}
        className={cn(
          "relative ml-auto rounded-full",
          stayConnectedActive && "text-primary",
        )}
        onClick={mutual && onOpenConnect ? onOpenConnect : onStayConnected}
      >
        <Heart className={cn(stayConnectedActive && "fill-current")} />
        {revealTease && (
          <>
            <span
              aria-hidden
              className="bg-primary absolute top-1 right-1 size-2 rounded-full"
            />
            <span className="sr-only">
              {partner.alias} shared a handle — open connection
            </span>
          </>
        )}
      </Button>
    </header>
  );
}
