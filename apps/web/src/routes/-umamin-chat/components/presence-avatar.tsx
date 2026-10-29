import { cn } from "@umamin/ui/lib/utils";
import { thinking } from "blobatar/expression";
import type { PartnerStatus } from "@/lib/chat/types";
import { SeedAvatar } from "./seed-avatar";

// Adapted from blobatar's presence-avatar registry item. Typing is the
// "thinking" face rather than its own dot: the person is still online.
const DOT: Record<PartnerStatus, string> = {
  online: "bg-emerald-500",
  typing: "bg-emerald-500",
  away: "bg-amber-500",
  left: "bg-muted-foreground",
};

/** The partner's face with a presence dot. Decorative: callers show the alias
 *  and the status as text beside it. */
export function PresenceAvatar({
  seed,
  alias,
  status,
  className,
}: {
  seed: string;
  alias: string;
  status: PartnerStatus;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex shrink-0", className)}
    >
      <SeedAvatar
        seed={seed}
        alias={alias}
        expression={status === "typing" ? thinking : undefined}
        className="size-full"
      />
      <span
        className={cn(
          // Sized against the avatar so it reads the same at any size.
          "ring-background absolute top-0 right-0 size-[28%] rounded-full ring-2 transition-colors",
          DOT[status],
        )}
      />
    </span>
  );
}
