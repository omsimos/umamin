import { Button } from "@umamin/ui/components/button";
import { X } from "lucide-react";

/** Shown when the lobby is opened from a ?join= deep link. Codes only by
 *  design: no host lookup, so nothing to enumerate and no stale alias to
 *  show when the host is offline. */
export function InviteBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="bg-muted/40 flex items-center justify-between gap-3 rounded-xl border py-2 pr-2 pl-4">
      <p className="text-sm">
        <span aria-hidden>👋</span> You were invited. Start a chat and you'll
        land on whoever shared this link if they're around.
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Dismiss invite"
        onClick={onDismiss}
        className="shrink-0 rounded-full"
      >
        <X />
      </Button>
    </div>
  );
}
