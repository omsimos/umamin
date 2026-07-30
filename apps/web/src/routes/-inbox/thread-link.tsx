import { MessagesSquareIcon } from "lucide-react";
import { Link } from "@/lib/navigation";
import { hasUnreadThread } from "./thread-unread";

type Props = {
  messageId: string;
  lastReplyAt: Date | string | null;
  // The viewer's own watermark — the server strips the other side's.
  readAt: Date | string | null;
};

// Kept to a plain centered link rather than a bordered button: it repeats on
// every card in the inbox list, where a boxed control reads as noise.
export function ThreadLink({ messageId, lastReplyAt, readAt }: Props) {
  const unread = hasUnreadThread(lastReplyAt, readAt);

  return (
    <Link
      href={`/inbox/${messageId}`}
      className="-mb-1 mt-3 flex items-center justify-center gap-1.5 py-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
    >
      <MessagesSquareIcon className="size-4 shrink-0" aria-hidden />
      View conversation
      {unread && (
        <>
          <span aria-hidden className="size-2 rounded-full bg-primary" />
          <span className="sr-only">New reply</span>
        </>
      )}
    </Link>
  );
}
