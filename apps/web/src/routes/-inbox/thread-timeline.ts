import { format, isSameDay, isToday, isYesterday } from "date-fns";
import type { MessageThreadResponse, ThreadEntry } from "@/lib/types";

export type ThreadTimelineItem =
  | { kind: "day"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      content: string;
      createdAt: Date | null;
      // Display side, already resolved against the viewer's role.
      side: "incoming" | "outgoing";
      // Same side as the row above, within the same day.
      tight: boolean;
      // Last row of its run — carries the run's timestamp.
      endsRun: boolean;
      // Avatars render on the LAST row of an incoming run, so a run reads as
      // one block with a single face rather than a ladder of them.
      showAvatar: boolean;
    };

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d, yyyy");
}

/**
 * Flattens a thread into render-ready rows: the opening message, the legacy
 * first reply (message.reply), then every message_reply entry — with run
 * grouping, avatar placement and day separators resolved up front.
 */
export function buildThreadTimeline({
  message,
  replies,
  viewerRole,
}: Pick<MessageThreadResponse, "message" | "replies" | "viewerRole">): {
  items: ThreadTimelineItem[];
} {
  const viewerIsSender = viewerRole === "sender";
  const messageCreatedAt = toDate(message.createdAt);

  const raw: {
    key: string;
    content: string;
    fromSender: boolean;
    createdAt: Date | null;
  }[] = [
    {
      key: "content",
      content: message.content,
      fromSender: true,
      createdAt: messageCreatedAt,
    },
  ];

  if (message.reply) {
    raw.push({
      key: "legacy-reply",
      content: message.reply,
      fromSender: false,
      // The legacy column carries no timestamp of its own. updatedAt is exact
      // only while it is still the newest write; later entries move it.
      createdAt: replies.length === 0 ? toDate(message.updatedAt) : null,
    });
  }

  for (const entry of replies as ThreadEntry[]) {
    raw.push({
      key: entry.id,
      content: entry.content,
      fromSender: entry.fromSender,
      createdAt: toDate(entry.createdAt),
    });
  }

  const items: ThreadTimelineItem[] = [];
  let lastDay: Date | null = null;
  let prevSide: "incoming" | "outgoing" | null = null;

  raw.forEach((row, index) => {
    const side: "incoming" | "outgoing" =
      row.fromSender === viewerIsSender ? "outgoing" : "incoming";

    let startsDay = false;
    if (row.createdAt) {
      if (!lastDay || !isSameDay(row.createdAt, lastDay)) {
        // A separator only earns its space once the thread spans days.
        if (lastDay) {
          items.push({
            kind: "day",
            key: `day-${row.key}`,
            label: dayLabel(row.createdAt),
          });
          startsDay = true;
        }
        lastDay = row.createdAt;
      }
    }

    const next = raw[index + 1];
    const nextSide = next
      ? next.fromSender === viewerIsSender
        ? "outgoing"
        : "incoming"
      : null;

    items.push({
      kind: "message",
      key: row.key,
      content: row.content,
      createdAt: row.createdAt,
      side,
      tight: !startsDay && prevSide === side,
      endsRun: nextSide !== side,
      showAvatar: side === "incoming" && nextSide !== "incoming",
    });

    prevSide = side;
  });

  return { items };
}
