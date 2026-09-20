import { cn } from "@umamin/ui/lib/utils";
import { Loader2Icon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { vibrate } from "@/lib/haptics";
import { isStandaloneMode } from "@/lib/pwa";

// Distance (px) the indicator must be dragged to arm a refresh, the resting
// height while a refresh runs, and the hard cap on how far content follows the
// finger. Pull distance is damped (0.45 of finger travel) so it feels like the
// native rubber band rather than a 1:1 drag.
export const PULL_THRESHOLD = 72;
const HOLD_HEIGHT = 56;
const MAX_PULL = 120;
const DAMPING = 0.45;
const START_SLOP = 8;

type Phase = "idle" | "pulling" | "armed" | "refreshing";

// Pull-to-refresh for a list page, active ONLY in the installed app: the
// standalone stylesheet turns off the browser's own overscroll (and with it
// Chrome's reload gesture), so this is where the gesture is otherwise missing.
// In a browser tab the native behavior stays untouched.
//
// Listeners are attached natively to the wrapper (not React props) so
// touchmove can be non-passive — preventDefault is what stops the page from
// scrolling under the pull — and so touches inside portaled dialogs, which
// live outside this element in the DOM, are never mistaken for a pull.
export function PullToRefresh({
  onRefresh,
  children,
  className,
}: {
  onRefresh: () => Promise<unknown> | unknown;
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !isStandaloneMode()) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let active = false;
    let armed = false;
    let distance = 0;

    const setPhaseBoth = (next: Phase) => {
      phaseRef.current = next;
      setPhase(next);
    };

    const reset = () => {
      tracking = false;
      active = false;
      armed = false;
      distance = 0;
      setPull(0);
      setPhaseBoth("idle");
    };

    const onTouchStart = (e: TouchEvent) => {
      if (phaseRef.current === "refreshing") return;
      if (e.touches.length !== 1 || window.scrollY > 0) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
      active = false;
      armed = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!active) {
        // Commit to the gesture only once it is clearly a downward drag;
        // upward or sideways movement is a scroll or a carousel swipe.
        if (dy < 0 || Math.abs(dx) > Math.abs(dy)) {
          tracking = false;
          return;
        }
        if (dy < START_SLOP) return;
        active = true;
        setPhaseBoth("pulling");
      }

      if (e.cancelable) e.preventDefault();
      distance = Math.min(MAX_PULL, Math.max(0, dy - START_SLOP) * DAMPING);
      setPull(distance);

      const nowArmed = distance >= PULL_THRESHOLD;
      if (nowArmed !== armed) {
        armed = nowArmed;
        setPhaseBoth(nowArmed ? "armed" : "pulling");
        if (nowArmed) vibrate(10);
      }
    };

    const onTouchEnd = () => {
      if (!tracking) return;
      if (!active || !armed) {
        reset();
        return;
      }
      tracking = false;
      active = false;
      setPull(HOLD_HEIGHT);
      setPhaseBoth("refreshing");
      // Kick the refresh off synchronously on release; a throw or rejection
      // still snaps the list back.
      let result: unknown;
      try {
        result = onRefreshRef.current();
      } catch {
        result = undefined;
      }
      Promise.resolve(result)
        .catch(() => {})
        .finally(reset);
    };

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd);
    root.addEventListener("touchcancel", onTouchEnd);
    return () => {
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const dragging = phase === "pulling" || phase === "armed";
  const refreshing = phase === "refreshing";
  const progress = Math.min(1, pull / PULL_THRESHOLD);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center overflow-hidden"
        style={{ height: pull }}
      >
        <div
          className="mt-3 grid size-9 place-items-center rounded-full border bg-background text-muted-foreground shadow-sm"
          style={{
            opacity: refreshing ? 1 : progress,
            transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
          }}
        >
          <Loader2Icon
            className={cn(
              "size-4",
              refreshing && "animate-spin",
              phase === "armed" && "text-foreground",
            )}
          />
        </div>
      </div>
      {refreshing ? (
        <span role="status" className="sr-only">
          Refreshing
        </span>
      ) : null}
      <div
        style={{
          transform: pull ? `translateY(${pull}px)` : undefined,
          // Snap back with a short ease once the finger lifts; follow it 1:1
          // while dragging.
          transition: dragging
            ? "none"
            : "transform 220ms cubic-bezier(0.2, 0, 0, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
