import { cn } from "@umamin/ui/lib/utils";
import type { ReactNode } from "react";
import { vibeProgress } from "../../../../convex/vibe";
import type { VibeState } from "../../../lib/session/types";
import { vibeLevelMeta } from "../../../lib/vibe-levels";

/** Conic-gradient progress ring wrapped around an avatar — the vibe meter's
 *  glanceable face. Fills clockwise toward the next level and shifts hue per
 *  level; costs zero extra header space. Pure CSS background, no animation
 *  beyond an optional one-shot pulse on level-up. */
export function VibeRing({
  vibe,
  pulse = false,
  children,
  className,
}: {
  vibe: VibeState;
  /** One-shot halo when a level-up just landed (remount to retrigger). */
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const meta = vibeLevelMeta(vibe.level);
  const pct = Math.round(vibeProgress(vibe.score, vibe.level) * 100);
  const [from, to] = meta.ring;

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        aria-hidden
        data-testid="vibe-ring"
        data-level={vibe.level}
        className="inline-flex rounded-full p-[2.5px]"
        style={{
          background: `conic-gradient(from -90deg, ${from}, ${to} ${pct}%, var(--border) ${pct}% 100%)`,
        }}
      >
        <span className="bg-background inline-flex rounded-full p-[1.5px]">
          {children}
        </span>
      </span>
      {pulse && (
        <span
          aria-hidden
          className="animate-ring-pulse motion-reduce:animate-none pointer-events-none absolute inset-0 rounded-full opacity-0 shadow-[0_0_0_3px]"
          style={{ color: to }}
        />
      )}
    </span>
  );
}
