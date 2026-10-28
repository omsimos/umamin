import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { UmaminChatLink } from "@/components/umamin-chat-link";

const DISMISSED_KEY = "umamin:chat-announcement-dismissed";

export function ChatAnnouncement({
  className,
  title = "Umamin Chat is here",
  description = "Anonymous chats, matched by your interests.",
  utm = "announcement",
  dismissKey = DISMISSED_KEY,
}: {
  className?: string;
  title?: string;
  description?: string;
  utm?: string;
  /** Each placement keeps its own dismissal. */
  dismissKey?: string;
}) {
  // Hidden until mounted so a prior dismissal never flashes the banner.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(dismissKey)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [dismissKey]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      // Storage unavailable — the dismissal lasts for this visit only.
    }
  };

  return (
    <aside
      aria-label="Umamin Chat announcement"
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-lg border bg-card p-3 sm:flex-nowrap sm:items-center sm:p-4",
        className,
      )}
    >
      <img
        src="/umamin-chat-logo.png"
        alt=""
        width={36}
        height={36}
        className="mt-0.5 size-8 shrink-0 rounded-md sm:mt-0 sm:size-9"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground sm:truncate">
          {description}
        </p>
      </div>
      <Button
        asChild
        size="sm"
        className="order-last w-full shrink-0 rounded-full sm:order-none sm:w-auto"
      >
        <UmaminChatLink utm={utm}>
          Try it
          <ArrowRightIcon />
        </UmaminChatLink>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground"
        aria-label="Dismiss announcement"
        onClick={dismiss}
      >
        <XIcon />
      </Button>
    </aside>
  );
}
