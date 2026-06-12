import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@umamin/ui/components/drawer";
import { cn } from "@umamin/ui/lib/utils";
import { MAX_VIBE_LEVEL, vibeProgress } from "../../../../convex/vibe";
import type {
  GameStreak,
  GameTally,
  GuessTally,
  VibeState,
} from "../../../lib/session/types";
import { useMediaQuery } from "../../../lib/use-media-query";
import { VIBE_LEVELS, vibeLevelMeta } from "../../../lib/vibe-levels";
import { SeedAvatar } from "../../seed-avatar";
import type { Reactor } from "../reaction-details";
import { VibeRing } from "./vibe-ring";

function progressNote(vibe: VibeState): string {
  if (vibe.level >= MAX_VIBE_LEVEL) return "Maxed out — kindred spirits.";
  const p = vibeProgress(vibe.score, vibe.level);
  if (p < 0.34) return `Fresh into level ${vibe.level} — keep it flowing.`;
  if (p < 0.75) return `Halfway-ish to level ${vibe.level + 1}.`;
  return `So close to level ${vibe.level + 1}!`;
}

function VibeSummary({
  vibe,
  gameTally,
  guessTally,
  gameStreak,
  self,
  partner,
}: {
  vibe: VibeState;
  gameTally: GameTally;
  guessTally: GuessTally;
  gameStreak: GameStreak;
  self: Reactor;
  partner: Reactor;
}) {
  const meta = vibeLevelMeta(vibe.level);
  const pct = Math.round(vibeProgress(vibe.score, vibe.level) * 100);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-center">
        <VibeRing vibe={vibe} className="z-10">
          <SeedAvatar
            seed={self.avatarSeed}
            alias={self.alias}
            className="size-14"
          />
        </VibeRing>
        <VibeRing vibe={vibe} className="-ml-3">
          <SeedAvatar
            seed={partner.avatarSeed}
            alias={partner.alias}
            className="size-14"
          />
        </VibeRing>
      </div>
      <div className="text-center">
        <p className="font-display text-lg font-semibold">
          <span aria-hidden>{meta.emoji}</span> Level {vibe.level} — {meta.name}
        </p>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {progressNote(vibe)}
        </p>
      </div>
      {/* No raw score anywhere — the arc is the feedback. */}
      <div
        role="progressbar"
        aria-label={`Vibe progress within level ${vibe.level}`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="bg-muted h-1.5 w-full max-w-60 overflow-hidden rounded-full"
      >
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${meta.ring[0]}, ${meta.ring[1]})`,
          }}
        />
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs tabular-nums">
        {gameTally.rounds > 0 && (
          <span>
            <span aria-hidden>🎯</span> Vibe check {gameTally.matched}/
            {gameTally.rounds}
          </span>
        )}
        {guessTally.rounds > 0 && (
          <span>
            <span aria-hidden>🔮</span> Mind reads {guessTally.correct}/
            {guessTally.rounds}
          </span>
        )}
        {gameStreak.best > 0 && (
          <span>
            <span aria-hidden>🔥</span> Best combo ×{gameStreak.best}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-center text-xs">
        Fills when you both talk, play, match and react.
      </p>
      <ul className="w-full space-y-1.5" aria-label="Unlock track">
        {VIBE_LEVELS.map((l) => {
          const reached = vibe.level >= l.level;
          return (
            <li
              key={l.level}
              className={cn(
                "flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm",
                reached ? "bg-muted/50" : "opacity-60",
              )}
            >
              <span aria-hidden className="leading-5">
                {reached ? "✓" : "○"}
              </span>
              <span className="min-w-0">
                <span className="font-medium">
                  <span aria-hidden>{l.emoji}</span> L{l.level} {l.name}
                </span>
                {l.unlocks && (
                  <span className="text-muted-foreground block text-xs">
                    {l.unlocks}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Tapping the header's partner cluster opens this — the vibe meter's detail
 *  view. Bottom sheet on mobile, dialog at the shell's rail breakpoint. */
export function VibeSheet({
  open,
  onOpenChange,
  ...summary
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vibe: VibeState;
  gameTally: GameTally;
  guessTally: GuessTally;
  gameStreak: GameStreak;
  self: Reactor;
  partner: Reactor;
}) {
  // Same breakpoint as the shell's rail/drawer split (lg).
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Your vibe</DialogTitle>
            <DialogDescription className="sr-only">
              Shared chemistry level and unlock track for this chat
            </DialogDescription>
          </DialogHeader>
          <VibeSummary {...summary} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Your vibe</DrawerTitle>
          <DrawerDescription className="sr-only">
            Shared chemistry level and unlock track for this chat
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <VibeSummary {...summary} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
