import { notificationTable } from "@umamin/db/schema/notification";
import { sessionTable } from "@umamin/db/schema/user";
import { lt } from "drizzle-orm";
import { retryUnclassifiedContent } from "./content-retry";
import { getDb } from "./db";
import { drainDmPurge } from "./dm/lifecycle";
import type { AppEnv } from "./env";
import { recomputeHotFeed as recomputeHotFeedRanking } from "./feed-rank";
import { isModerationEnforced } from "./flags";

// Scheduled-handler bodies. Kept as named functions so server.ts's scheduled()
// dispatch is declarative and each job is unit-testable in isolation.

// 0 3 * * * — expired sessions are otherwise pruned only lazily when their
// owner next makes a request, so abandoned sessions accumulate forever. A
// session lookup is a PK seek and stays cheap; the sweep exists to bound the
// table's size, because Turso bills per row scanned. session_expires_idx keeps
// the sweep itself a seek rather than a full scan of what it is pruning.
export async function cleanupSessions(env: AppEnv): Promise<void> {
  const result = await getDb(env)
    .delete(sessionTable)
    .where(lt(sessionTable.expiresAt, Date.now()));
  console.log(`[cron] sessions cleanup: deleted ${result.rowsAffected ?? 0}`);
}

const NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// 0 4 * * * — caps the notification table's size so per-user badge/list scans
// stay bounded; stale aggregates (incl. retracted likes/follows) age out here.
// updatedAt is a timestamp-mode column — compare a Date (unlike the session
// cron's raw-integer expiresAt).
export async function cleanupNotifications(env: AppEnv): Promise<void> {
  const result = await getDb(env)
    .delete(notificationTable)
    .where(
      lt(
        notificationTable.updatedAt,
        new Date(Date.now() - NOTIFICATION_RETENTION_MS),
      ),
    );
  console.log(
    `[cron] notifications cleanup: deleted ${result.rowsAffected ?? 0}`,
  );
}

// */5 * * * * — recompute the hot-feed ranking: one bounded Turso query → one KV
// id-list write, replacing the Redis zset (see server-lib/feed-rank.ts).
export async function recomputeHotFeed(env: AppEnv): Promise<void> {
  await recomputeHotFeedRanking(
    getDb(env),
    env.KV,
    await isModerationEnforced(env),
  );
}

// */5 * * * * — re-classify recent rows a write left unclassified (see
// server-lib/content-retry.ts).
export async function retryUnclassified(
  env: AppEnv,
  defer?: (promise: Promise<unknown>) => void,
): Promise<void> {
  const { attempted, classified } = await retryUnclassifiedContent(
    getDb(env),
    env,
    defer,
  );
  if (attempted > 0) {
    console.log(
      `[cron] moderation retry: classified ${classified}/${attempted}`,
    );
  }
}

// */5 * * * * — wipes the Durable Object storage of conversations whose
// participant deleted their account (queued in the delete transaction).
export async function purgeDeletedDms(env: AppEnv): Promise<void> {
  const purged = await drainDmPurge(env);
  if (purged > 0) console.log(`[cron] dm purge: wiped ${purged} rooms`);
}
