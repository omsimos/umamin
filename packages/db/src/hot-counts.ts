import { type SQL, sql } from "drizzle-orm";

// Hot's people counts, recomputed from the engagement tables. The live +1/-1
// expressions (apps/web/src/server-lib/hot-counters.ts) and migration 0033's
// backfill must agree with these; apps/web/test/hot-counts-parity.test.ts
// checks all three against one database.
export const hotCounts: Record<string, SQL> = {
  commenter_count: sql`(SELECT COUNT(DISTINCT c.author_id) FROM post_comment c WHERE c.post_id = postTable.id AND c.author_id <> postTable.author_id)`,
  liker_count: sql`(SELECT COUNT(*) FROM post_like l WHERE l.post_id = postTable.id AND l.user_id <> postTable.author_id)`,
  voter_count: sql`(SELECT COUNT(*) FROM poll_vote v WHERE v.post_id = postTable.id AND v.user_id <> postTable.author_id)`,
  resharer_count: sql`(SELECT COUNT(*) FROM (SELECT r.user_id AS u FROM post_repost r WHERE r.post_id = postTable.id UNION SELECT q.author_id FROM postTable q WHERE q.quoted_post_id = postTable.id) WHERE u <> postTable.author_id)`,
};

/** Rewrites only the rows whose stored count is wrong. */
export function reconcileHotCount(column: string, count: SQL): SQL {
  return sql`UPDATE postTable SET ${sql.identifier(column)} = ${count} WHERE ${sql.identifier(column)} <> ${count}`;
}
