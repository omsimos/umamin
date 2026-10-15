import { Marker, MarkerContent } from "@umamin/ui/components/marker";
import { cn } from "@umamin/ui/lib/utils";
import type { ReactNode } from "react";

/** A centered row in the message stream with no author side: game results,
 *  burned whispers and milestones. */
export function SystemMoment({
  children,
  className,
  separator = false,
  animate = false,
}: {
  children: ReactNode;
  className?: string;
  /** Rule lines either side, for one-line moments. */
  separator?: boolean;
  /** Pop the row in on mount (fresh moments only; history renders static). */
  animate?: boolean;
}) {
  return (
    <Marker
      variant={separator ? "separator" : "default"}
      className={cn(
        "justify-center py-1 text-xs",
        animate && "animate-chat-pop-in motion-reduce:animate-none",
        className,
      )}
    >
      <MarkerContent className="text-center">{children}</MarkerContent>
    </Marker>
  );
}
