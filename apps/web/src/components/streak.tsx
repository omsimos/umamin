import { cn } from "@umamin/ui/lib/utils";
import { ZapIcon } from "lucide-react";
import { useStreakToday } from "@/hooks/use-streak-today";
import {
  activeStreak,
  displayStreak,
  isStreakAtRisk,
  STREAK_MIN_DISPLAY,
  type StreakState,
} from "@/lib/streak";

// A bolt, not a flame: the flame already means "reacted" on note cards.
export function StreakIcon({ className }: { className?: string }) {
  return (
    <ZapIcon
      aria-hidden
      className={cn("fill-amber-500 text-amber-500", className)}
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
      <StreakIcon className="size-3.5" />
      {streak}
      <span className="sr-only"> day streak</span>
    </span>
  );
}

/**
 * The composer line under the note box and the post composer: a reminder on
 * the streak's last day, then a quiet count once today is counted.
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
  const streak = today === null ? 0 : activeStreak(state, today);
  if (today === null || !streak) return null;

  let text: string;
  if (isStreakAtRisk(state, today)) {
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
        "flex items-center gap-1.5 text-sm text-muted-foreground",
        className,
      )}
    >
      <StreakIcon className="size-4 shrink-0" />
      {text}
    </p>
  );
}
