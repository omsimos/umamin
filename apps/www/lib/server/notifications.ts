import "server-only";

import { db } from "@umamin/db";
import {
  type NotificationType,
  notificationTable,
} from "@umamin/db/schema/notification";
import { sql } from "drizzle-orm";
import { updateTag } from "next/cache";

const PREVIEW_MAX_LENGTH = 80;

type NotifyParams = {
  recipientId: string;
  type: NotificationType;
  targetId?: string;
  actorId?: string | null;
  // Plaintext only (post/comment content) — never encrypted message content.
  preview?: string | null;
};

/**
 * Counts notification rows newer than the viewer's seen-watermark. Pure: the
 * badge query fetches the newest rows and watermark in parallel, so the
 * filtering happens here instead of SQL (avoids a dependent-query waterfall).
 */
export function countUnseen(
  rows: { updatedAt: Date }[],
  lastSeenNotificationsAt: Date | null,
): number {
  const lastSeenMs = lastSeenNotificationsAt?.getTime() ?? 0;
  return rows.filter((row) => row.updatedAt.getTime() > lastSeenMs).length;
}

/**
 * Records an in-app notification as a single aggregated upsert: one row per
 * (recipient, type, target), bumping `count` and the latest actor on repeats.
 * Best-effort by design — a notification must never fail its parent action.
 */
export async function notify({
  recipientId,
  type,
  targetId = "",
  actorId = null,
  preview = null,
}: NotifyParams) {
  if (actorId === recipientId) {
    return;
  }

  const trimmedPreview = preview ? preview.slice(0, PREVIEW_MAX_LENGTH) : null;

  try {
    await db
      .insert(notificationTable)
      .values({
        recipientId,
        type,
        targetId,
        actorId,
        preview: trimmedPreview,
        updatedAt: sql`(unixepoch())`,
      })
      .onConflictDoUpdate({
        target: [
          notificationTable.recipientId,
          notificationTable.type,
          notificationTable.targetId,
        ],
        set: {
          count: sql`${notificationTable.count} + 1`,
          actorId,
          preview: trimmedPreview,
          // $onUpdate doesn't fire inside DO UPDATE — set explicitly.
          updatedAt: sql`(unixepoch())`,
        },
      });

    // Badge and list carry separate tags so mark-seen can refresh the badge
    // without busting the list cache the page just populated.
    updateTag(`notifications:${recipientId}`);
    updateTag(`notifications-badge:${recipientId}`);
  } catch (err) {
    console.error("notify failed", err);
  }
}
