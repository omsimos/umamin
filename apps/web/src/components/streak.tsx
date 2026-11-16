import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { ZapIcon } from "lucide-react";
import {
  useRestoreStreak,
  useStreakRestoreState,
} from "@/hooks/use-restore-streak";
import { useStreakToday } from "@/hooks/use-streak-today";
import {
  activeStreak,
  displayStreak,
  isStreakAtRisk,
  restorableStreak,
  restoresLeft,
  STREAK_MIN_DISPLAY,
  type StreakState,
  type StreakTier,
  streakTier,
  toStreakMonth,
} from "@/lib/streak";

// Literal class strings so Tailwind's source scan picks them up. Red, not
// pink, for the month tier: pink is the brand and the verified badge.
const STREAK_TIER_STYLES: Record<StreakTier, string> = {
  base: "fill-amber-500 text-amber-500",
  week: "fill-orange-500 text-orange-500",
  month: "fill-red-500 text-red-500",
  quarter: "fill-violet-500 text-violet-500",
};

// A bolt, not a flame: the flame already means "reacted" on note cards.
export function StreakIcon({
  streak,
  className,
}: {
  // The live streak, which picks the bolt's color tier.
  streak: number;
  className?: string;
}) {
  const tier = streakTier(streak);
  return (
    <ZapIcon
      aria-hidden
      data-tier={tier}
      className={cn(STREAK_TIER_STYLES[tier], className)}
    />
  );
}

/** Compact streak count for an author row on note and post cards. */
export function StreakChip({ state }: { state?: StreakState }) {
  const today = useStreakToday();
  const streak = state && today !== null ? displayStreak(state, today) : 0;
  if (!streak) return null;

  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted-foreground tabular-nums"
      title={`${streak}-day streak`}
    >
      <StreakIcon streak={streak} className="size-3.5" />
      {streak}
      <span className="sr-only"> day streak</span>
    </span>
  );
}

/**
 * The composer line under the note box and the post composer: a restore offer
 * the day after a missed day, a reminder on the streak's last day, then a
 * quiet count once today is counted.
 */
export function StreakReminder({
  state,
  anonymousNote = false,
  className,
}: {
  state: StreakState;
  // The note box's anonymous switch is on, so this save won't count.
  anonymousNote?: boolean;
  className?: string;
}) {
  const today = useStreakToday();
  // Restore state is owner-only and lives on the current-user cache, which
  // the props may not carry. No offer until that cache has loaded.
  const own = useStreakRestoreState();
  const restore = useRestoreStreak();
  if (today === null) return null;

  const restoreState: StreakState = own ?? state;
  const restorable = own ? restorableStreak(own, today) : 0;
  if (restorable > 0) {
    const left = restoresLeft(restoreState, toStreakMonth());
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 text-xs text-muted-foreground",
          className,
        )}
      >
        <p className="flex min-w-0 items-center gap-1">
          <StreakIcon streak={restorable} className="size-3.5 shrink-0" />
          {left > 0
            ? `${restorable}-day streak ended yesterday.`
            : `${restorable}-day streak ended yesterday. No restores left this month.`}
        </p>
        {left > 0 && (
          // A text button the height of the line, with a 36px tap area
          // pulled back into the row by the negative margin.
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-my-2.5 h-9 shrink-0 px-2 text-xs font-semibold text-primary hover:text-primary"
            aria-label={`Restore streak, ${left} left this month`}
            disabled={restore.isPending}
            onClick={() => restore.mutate()}
          >
            Restore · {left} left
          </Button>
        )}
      </div>
    );
  }

  const streak = activeStreak(restoreState, today);
  if (!streak) return null;

  let text: string;
  if (isStreakAtRisk(restoreState, today)) {
    text = anonymousNote
      ? `Anonymous notes don't count toward your ${streak}-day streak.`
      : `${streak}-day streak. Post or share a note today to keep it going.`;
  } else if (streak >= STREAK_MIN_DISPLAY) {
    text = `${streak}-day streak. See you tomorrow.`;
  } else {
    return null;
  }

  return (
    <p
      className={cn(
        "flex items-center gap-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <StreakIcon streak={streak} className="size-3.5 shrink-0" />
      {text}
    </p>
  );
}
