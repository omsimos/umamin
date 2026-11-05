import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { Uma } from "@/components/uma";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { dismissAnnouncement } from "@/lib/announcements";
import { queryKeys } from "@/lib/query";

export function UmaAnnouncement({ className }: { className?: string }) {
  const { contentModeration } = useFeatureFlags();
  const queryClient = useQueryClient();
  // The card sits above the feed, so appearing once /api/flags answers would
  // push every post down. It renders only when the flag is already known as
  // the card mounts: primed by the route loader for SSR, or cached on a client
  // navigation. Otherwise it waits until it next mounts.
  const [flagKnownAtMount] = useState(
    () => queryClient.getQueryData(queryKeys.featureFlags()) !== undefined,
  );

  if (!flagKnownAtMount || !contentModeration) return null;

  return (
    <aside
      aria-label="Meet Uma"
      data-announcement="uma"
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-card p-3 sm:items-center sm:p-4",
        className,
      )}
    >
      <Uma className="mt-0.5 size-9 sm:mt-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Meet Uma</p>
        <p className="text-sm text-muted-foreground">
          Uma folds posts that look like drama into one line. Tap any fold to
          read it, or turn folding off in Settings.
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground"
        aria-label="Dismiss"
        onClick={() => dismissAnnouncement("uma")}
      >
        <XIcon />
      </Button>
    </aside>
  );
}
