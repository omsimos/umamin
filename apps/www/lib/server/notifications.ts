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

    updateTag(`notifications:${recipientId}`);
  } catch (err) {
    console.error("notify failed", err);
  }
}
