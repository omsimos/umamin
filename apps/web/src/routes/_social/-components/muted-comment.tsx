import { Button } from "@umamin/ui/components/button";
import { VolumeXIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

// Muted comments stay in the thread as a one-line placeholder so the
// conversation around them still reads in order.
export function MutedComment({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) return children;

  return (
    <div className="flex items-center gap-2 border-b px-4 pb-4 text-sm text-muted-foreground">
      <VolumeXIcon className="size-4 shrink-0" aria-hidden />
      <p className="flex-1">Comment from a muted account</p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setRevealed(true)}
      >
        Show
      </Button>
    </div>
  );
}
