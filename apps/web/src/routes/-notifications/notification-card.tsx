import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { UserIcon } from "lucide-react";
import { TimeAgo } from "@/components/time-ago";
import { Link } from "@/lib/navigation";
import { formatNotificationText } from "@/lib/notification-text";
import type { NotificationItem } from "@/lib/types";

function notificationHref(notification: NotificationItem): string | null {
  switch (notification.type) {
    case "like":
    case "comment":
    case "vote":
      return `/post/${notification.targetId}`;
    case "follow":
      return notification.actor ? `/user/${notification.actor.username}` : null;
    case "message":
      return "/inbox";
    case "reply":
      return notification.targetId
        ? `/inbox/${notification.targetId}`
        : "/inbox?tab=sent";
    case "thread":
      return notification.targetId
        ? `/inbox/${notification.targetId}`
        : "/inbox";
    case "group_join":
    case "group_invite":
    case "group_request":
    case "group_accept":
      return `/groups/${notification.targetId}`;
    case "group_mention":
      return `/groups/${notification.targetId}/chat`;
    default:
      return null;
  }
}

export function NotificationCard({
  notification,
  isNew,
}: {
  notification: NotificationItem;
  isNew?: boolean;
}) {
  const { actor, type, count, preview, updatedAt } = notification;
  const actorName = actor ? (actor.displayName ?? actor.username) : null;
  const href = notificationHref(notification);

  const body = (
    <div className="flex items-center gap-3 py-4">
      <Avatar className="size-9">
        <AvatarImage src={actor?.imageUrl ?? ""} alt="" />
        <AvatarFallback>
          {actor ? (
            actor.username.slice(0, 2).toUpperCase()
          ) : (
            <UserIcon className="size-4 text-muted-foreground" />
          )}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {formatNotificationText(type, count, actorName)}
        </p>
        {preview ? (
          <p className="truncate text-sm text-muted-foreground">{preview}</p>
        ) : null}
        <TimeAgo date={updatedAt} className="text-xs text-muted-foreground" />
      </div>

      {isNew && (
        <span className="shrink-0">
          <span aria-hidden className="block size-2 rounded-full bg-pink-500" />
          <span className="sr-only">New</span>
        </span>
      )}
    </div>
  );

  if (!href) {
    return body;
  }

  return (
    <Link href={href} className="block hover:bg-muted/50 transition-colors">
      {body}
    </Link>
  );
}
