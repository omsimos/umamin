import { cn } from "@umamin/ui/lib/utils";
import { ZapIcon } from "lucide-react";
import { displayNoteStreak, type NoteStreakState } from "@/lib/streak";

// A bolt, not a flame: the flame already means "reacted" on note cards.
export function NoteStreakIcon({ className }: { className?: string }) {
  return (
    <ZapIcon
      aria-hidden
      className={cn("fill-amber-500 text-amber-500", className)}
    />
  );
}

/** Compact streak count for a note card's author row. */
export function NoteStreakChip({ state }: { state?: NoteStreakState }) {
  const streak = state ? displayNoteStreak(state) : 0;
  if (!streak) return null;

  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted-foreground tabular-nums"
      title={`${streak}-day note streak`}
    >
      <NoteStreakIcon className="size-3.5" />
      {streak}
      <span className="sr-only">-day note streak</span>
    </span>
  );
}
