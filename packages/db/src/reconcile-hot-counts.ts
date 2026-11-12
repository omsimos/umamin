import process from "node:process";
import { hotCounts, reconcileHotCount } from "./hot-counts";
import { db } from "./index";

/**
 * Recomputes Hot's people counts (commenter_count, liker_count, voter_count,
 * resharer_count) from the engagement tables. Run it once after a deploy that
 * changes how they're kept:
 *
 *   pnpm --filter=@umamin/db reconcile:hot
 *
 * or through the "Reconcile Hot counts" workflow, which has each environment's
 * credentials. migrate.yml and the Worker deploy run in no fixed order, so
 * migration 0033's backfill can run while the old Worker still serves. A like,
 * vote, comment or share in that gap leaves a count off by one for good.
 *
 * Idempotent. Each UPDATE only writes rows whose stored count is wrong, since
 * Turso bills per row written. It reads every post, so keep it a manual step.
 */
async function main() {
  for (const [column, count] of Object.entries(hotCounts)) {
    const result = await db.run(reconcileHotCount(column, count));
    console.log(`${column}: fixed ${result.rowsAffected} posts`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
