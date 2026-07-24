import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

// Subtle top-of-page navigation progress bar. Replaces @bprogress/next: instead
// of a Next router event provider, it reads TanStack Router's load status
// (`useRouterState`). Same UX as before — a thin 2px bar in the brand accent
// (#970064), no spinner — that creeps forward while a navigation is pending and
// snaps to 100% then fades out on completion.
const ACCENT = "#970064";

export function NavigationProgress() {
  const isLoading = useRouterState({ select: (s) => s.status === "pending" });
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  // Whether the bar is currently shown, read inside the effect without making
  // it a dependency (reacting to `visible` would re-arm the creep interval).
  const visibleRef = useRef(false);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      setProgress(8);
      // Ease toward 90% while pending; the final 10% lands on completion so a
      // slow load never visually "finishes" early.
      const creep = setInterval(() => {
        setProgress((p) => (p < 90 ? p + (90 - p) * 0.12 : p));
      }, 200);
      return () => clearInterval(creep);
    }

    if (visibleRef.current) {
      setProgress(100);
      const done = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 220);
      return () => clearTimeout(done);
    }
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: ACCENT,
          transition: "width 200ms ease, opacity 200ms ease",
          opacity: progress >= 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
