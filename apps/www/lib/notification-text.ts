import type { NotificationType } from "@umamin/db/schema/notification";

const VERBS: Record<"like" | "comment" | "follow", string> = {
  like: "liked your post",
  comment: "commented on your post",
  follow: "followed you",
};

export function formatNotificationText(
  type: NotificationType,
  count: number,
  actorName: string | null,
): string {
  if (type === "message") {
    return count > 1
      ? `You received ${count} anonymous messages`
      : "You received an anonymous message";
  }

  const name = actorName ?? "Someone";

  if (type === "reply") {
    return `${name} replied to your message`;
  }

  const verb = VERBS[type];

  if (count > 1) {
    const others = count - 1;
    return `${name} and ${others} ${others === 1 ? "other" : "others"} ${verb}`;
  }

  return `${name} ${verb}`;
}
