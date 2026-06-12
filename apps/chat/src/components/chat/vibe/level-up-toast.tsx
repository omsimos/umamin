import { cn } from "@umamin/ui/lib/utils";
import { useEffect } from "react";
import { vibeLevelMeta } from "../../../lib/vibe-levels";

const TOAST_MS = 3000;

/** Non-blocking level-up moment: one shimmer band sweeps the viewport while a
 *  pill toast names the level and what it unlocked. Mount to show (the parent
 *  keys/remounts per level); auto-dismisses. */
export function LevelUpToast({
  level,
  onDone,
  onShowVibe,
}: {
  level: number;
  onDone: () => void;
  /** Tap-through to the vibe sheet. */
  onShowVibe: () => void;
}) {
  const meta = vibeLevelMeta(level);

  useEffect(() => {
    navigator.vibrate?.(10);
    const t = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-20 overflow-hidden"
      >
        <div
          className={cn(
            "animate-shimmer-sweep motion-reduce:animate-none absolute inset-y-0 left-0 w-1/3 opacity-0",
            "bg-gradient-to-r from-transparent via-white/10 to-transparent",
          )}
        />
      </div>
      {/* role=status doubles as the polite announcement for screen readers. */}
      <div
        role="status"
        className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center px-4"
      >
        <button
          type="button"
          onClick={() => {
            onShowVibe();
            onDone();
          }}
          className={cn(
            "animate-pop-in motion-reduce:animate-none pointer-events-auto",
            "bg-popover/95 flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-lg backdrop-blur",
            "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
          )}
        >
          <span aria-hidden>{meta.emoji}</span>
          <span className="flex min-w-0 flex-col items-start text-left">
            <span>
              Level {level} — {meta.name}
            </span>
            {meta.unlocks && (
              <span className="text-muted-foreground text-xs">
                {meta.unlocks} unlocked
              </span>
            )}
          </span>
        </button>
      </div>
    </>
  );
}
