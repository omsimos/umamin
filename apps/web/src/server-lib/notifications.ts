import type { NotificationType } from "@umamin/db/schema/notification";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
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
 * The block and mute checks ride in the insert itself (INSERT ... SELECT ...
 * WHERE NOT EXISTS), so suppression costs no extra round trip: a block in
 * either direction or a recipient-side mute inserts nothing and sends no push.
 * Mute is checked here rather than on read so an aggregated row isn't hidden
 * just because its latest actor is muted.
 *
 * `count` approximates people, not events: it only grows when the latest actor
 * differs from the previous one. Toggle types (like, vote, follow) also leave
 * the row untouched and send no push when the same person repeats inside
 * REPEAT_WINDOW_SECONDS.
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

  const trimmedPreview = preview ? preview.slice(0, PREVIEW_MAX_LENGTH) : null;

  // SQLite needs a WHERE on an INSERT ... SELECT that is followed by an
  // upsert, so the anonymous path uses a constant one.
  const guards = [];
  if (actorId) {
    guards.push(
      sql`NOT EXISTS (SELECT 1 FROM user_mute WHERE muter_id = ${recipientId} AND muted_id = ${actorId})`,
    );
    if (!blockChecked) {
      guards.push(
        sql`NOT EXISTS (SELECT 1 FROM user_block WHERE (blocker_id = ${recipientId} AND blocked_id = ${actorId}) OR (blocker_id = ${actorId} AND blocked_id = ${recipientId}))`,
      );
    }
  }
  const where = guards.length > 0 ? sql.join(guards, sql` AND `) : sql`1`;

  try {
    const result = await deps.db.run(sql`
      INSERT INTO notification (id, recipient_id, type, target_id, actor_id, preview, updated_at)
      SELECT ${nanoid()}, ${recipientId}, ${type}, ${targetId}, ${actorId}, ${trimmedPreview}, unixepoch()
      WHERE ${where}
      ON CONFLICT (recipient_id, type, target_id) DO UPDATE SET
        count = notification.count + 1,
        actor_id = excluded.actor_id,
        preview = excluded.preview,
        updated_at = unixepoch()
    `);

    // Nothing written: suppressed by a block or mute, or a throttled repeat.
    if (result.rowsAffected === 0) {
      return;
    }

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
