"use client";

import { Button } from "@umamin/ui/components/button";
import { BellIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { usePushNotifications } from "@/hooks/use-push-notifications";

const DISMISS_KEY = "push-prompt-dismissed";

// One contextual, dismissible nudge to enable push on the highest-intent
// surface — the notifications page. Shows ONLY when push is supported, not yet
// enabled on this device, not blocked, and not previously dismissed; it
// self-removes once enabled (state leaves "off") or dismissed. The canonical
// on/off control lives in Settings; this is discovery only. Reuses the shared
// hook so the enable flow is never forked.
export function PushPrompt() {
  const { state, enable, isPending } = usePushNotifications();
  // Start hidden so the server/first-client render matches; reveal after we've
  // read the persisted dismissal (avoids a hydration flash).
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed || state !== "off") {
    return null;
  }

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    // Appears asynchronously after mount; a <section> with an accessible name
    // is implicitly a region landmark, so screen readers can find it (named by
    // its visible title, no drift).
    <section
      aria-labelledby="push-prompt-title"
      className="mb-4 flex items-center gap-3 rounded-lg border border-pink-500/30 bg-pink-500/5 p-4"
    >
      <BellIcon className="size-5 shrink-0 text-pink-500" />
      <div className="min-w-0 flex-1">
        <p id="push-prompt-title" className="text-sm font-medium leading-none">
          Turn on push notifications
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Get notified about replies, follows, and messages even when Umamin
          isn't open.
        </p>
      </div>
      <Button
        size="sm"
        onClick={enable}
        disabled={isPending}
        className="shrink-0 rounded-full"
      >
        Enable
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-muted-foreground"
      >
        <XIcon />
      </Button>
    </section>
  );
}
