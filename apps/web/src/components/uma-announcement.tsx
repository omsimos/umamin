import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Uma } from "@/components/uma";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

const DISMISSED_KEY = "umamin:uma-announcement-dismissed";

export function UmaAnnouncement({ className }: { className?: string }) {
  const { contentModeration } = useFeatureFlags();
  // Hidden until mounted so a prior dismissal never flashes the card.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISSED_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible || !contentModeration) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage unavailable — the dismissal lasts for this visit only.
    }
  };

  return (
    <aside
      aria-label="Meet Uma"
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
        onClick={dismiss}
      >
        <XIcon />
      </Button>
    </aside>
  );
}
