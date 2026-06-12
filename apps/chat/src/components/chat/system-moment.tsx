import { cn } from "@umamin/ui/lib/utils";
import type { ReactNode } from "react";

/** Centered system-style row in the message stream — the shared shell for
 *  game results and one-shot milestone moments. No author side, no
 *  react/reply affordances. */
export function SystemMoment({
  children,
  className,
  animate = false,
}: {
  children: ReactNode;
  className?: string;
  /** Pop the row in on mount (fresh moments only — history renders static). */
  animate?: boolean;
}) {
  return (
    <div className="flex w-full justify-center">
      <div
        className={cn(
          "bg-muted/40 text-muted-foreground max-w-[90%] rounded-xl border border-dashed px-4 py-2 text-center text-xs",
          animate && "animate-pop-in motion-reduce:animate-none",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
