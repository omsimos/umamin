import { getDb } from "./db";
import type { AppEnv } from "./env";
import { recomputeHotFeed as recomputeHotFeedRanking } from "./feed-rank";

// Scheduled-handler bodies. Kept as named functions so server.ts's scheduled()
// dispatch is declarative and each job is unit-testable in isolation.

// 0 3 * * * — delete expired session rows (Turso). TODO(Phase 2).
export async function cleanupSessions(_env: AppEnv): Promise<void> {
  console.log("[cron] sessions cleanup (Phase 2 TODO)");
}

// 0 4 * * * — prune stale notification rows. TODO(Phase 2).
export async function cleanupNotifications(_env: AppEnv): Promise<void> {
  console.log("[cron] notifications cleanup (Phase 2 TODO)");
}

// */5 * * * * — recompute the hot-feed ranking: one bounded Turso query → one KV
// id-list write, replacing the Redis zset (see server-lib/feed-rank.ts).
export async function recomputeHotFeed(env: AppEnv): Promise<void> {
  await recomputeHotFeedRanking(getDb(env), env.KV);
}
