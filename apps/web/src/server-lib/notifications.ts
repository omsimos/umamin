import {
  type NotificationType,
  notificationTable,
} from "@umamin/db/schema/notification";
import { sql } from "drizzle-orm";
import { hasBlockBetween } from "./blocks";
import type { Db } from "./db";
import type { AppEnv } from "./env";
import { sendPushForNotification } from "./notification-push";
import { captureServerException } from "./posthog";

const PREVIEW_MAX_LENGTH = 80;

type NotifyParams = {
  recipientId: string;
  type: NotificationType;
  targetId?: string;
  actorId?: string | null;
  // Plaintext only (post/comment content) — never encrypted message content.
  preview?: string | null;
  // Set by callers that already probed user_block in their own write
  // (like/comment/vote), so notify doesn't spend a second round trip on it.
  blockChecked?: boolean;
};

export type NotifyDeps = {
  db: Db;
  env: AppEnv;
  // Off-critical-path scheduler (the Worker's ctx.waitUntil). The push fan-out
  // is handed to it so it never blocks the parent action's response. When
  // omitted (cron / tests) the fan-out is awaited inline instead.
  defer?: (promise: Promise<unknown>) => void;
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
 * The Next.js `updateTag` cache busts are gone (authed reads are direct Turso
 * now → read-your-writes); the best-effort Web Push runs off the response's
 * critical path via `deps.defer` (ctx.waitUntil).
 * Suppressed when a block exists in either direction between actor and
 * recipient; the push fan-out sits behind the same guard.
 */
export async function notify(
  deps: NotifyDeps,
  {
    recipientId,
    type,
    targetId = "",
    actorId = null,
    preview = null,
    blockChecked = false,
  }: NotifyParams,
): Promise<void> {
  if (actorId === recipientId) {
    return;
  }

  if (actorId && !blockChecked) {
    try {
      if (await hasBlockBetween(deps.db, recipientId, actorId)) {
        return;
      }
    } catch (err) {
      // Best-effort like the insert below: a failed probe drops the
      // notification rather than risking one that a block should suppress.
      console.error("notify block probe failed", err);
      captureServerException(deps.env, deps.defer, err, {
        properties: { notify: type, recipientId },
      });
      return;
    }
  }

  const trimmedPreview = preview ? preview.slice(0, PREVIEW_MAX_LENGTH) : null;

  try {
    await deps.db
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

    // Fire a best-effort Web Push. It must never throw into the parent action —
    // hence the inner .catch and the defer isolation.
    const push = sendPushForNotification(deps.db, deps.env, {
      recipientId,
      type,
      targetId,
      actorId,
    }).catch((err) => console.error("push send failed", err));

    if (deps.defer) {
      deps.defer(push);
    } else {
      await push;
    }
  } catch (err) {
    console.error("notify failed", err);
    captureServerException(deps.env, deps.defer, err, {
      properties: { notify: type, recipientId },
    });
  }
}
