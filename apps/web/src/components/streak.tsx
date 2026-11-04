import { cn } from "@umamin/ui/lib/utils";
import { ZapIcon } from "lucide-react";
import { useStreakToday } from "@/hooks/use-streak-today";
import { displayStreak, type StreakState } from "@/lib/streak";

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
