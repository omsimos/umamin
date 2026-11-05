import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { UmaminChatLink } from "@/components/umamin-chat-link";
import { type AnnouncementId, dismissAnnouncement } from "@/lib/announcements";

export function ChatAnnouncement({
  className,
  title = "Umamin Chat is here",
  description = "Anonymous chats, matched by your interests.",
  utm = "announcement",
  id = "chat",
}: {
  className?: string;
  title?: string;
  description?: string;
  utm?: string;
  /** Each placement keeps its own dismissal. */
  id?: AnnouncementId;
}) {
  return (
    <aside
      aria-label="Umamin Chat announcement"
      data-announcement={id}
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
        className="relative size-7 shrink-0 text-muted-foreground after:absolute after:-inset-2 after:content-['']"
        aria-label="Dismiss announcement"
        onClick={() => dismissAnnouncement(id)}
      >
        <XIcon />
      </Button>
    </aside>
  );
}
