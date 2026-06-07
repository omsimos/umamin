"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { UserIcon } from "lucide-react";
import Link from "next/link";
import { TimeAgo } from "@/components/time-ago";
import { formatNotificationText } from "@/lib/notification-text";
import type { NotificationItem } from "@/lib/query-types";

function notificationHref(notification: NotificationItem): string | null {
  switch (notification.type) {
    case "like":
    case "comment":
    case "vote":
      // A deleted post renders its own "post unavailable" husk on the detail
      // page — no special handling here.
      return `/post/${notification.targetId}`;
    case "follow":
      return notification.actor ? `/user/${notification.actor.username}` : null;
    case "message":
      return "/inbox";
    case "reply":
      return "/inbox?tab=sent";
    default:
      return null;
  }
}

export function NotificationCard({
  notification,
}: {
  notification: NotificationItem;
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
