import process from "node:process";
import { eq, sql } from "drizzle-orm";

import { db } from "./index";
import { postCommentTable, postTable } from "./schema/post";
import { userTable } from "./schema/user";

/**
 * One-off, OFFLINE backfill of the cosmetic "Aura" score from historical
 * engagement counts. Run manually AFTER migration 0016 lands, never from
 * migrate.yml:
 *
 *   pnpm --filter=@umamin/db backfill:aura
 *
 * Approximate by design (v1 aura is non-audit-grade): it reads the denormalized
 * counters, so it OVER-counts vs the go-forward award rules — it includes
 * self-likes, every comment (not first-per-post), and engagement from blocked
 * relationships, and skips the new-account age gate. Idempotent: it SETS (not
 * increments) each total, so re-running is safe.
 *
 * Weights MUST stay in sync with apps/www/lib/points.ts (AURA_POINTS) — they
 * can't be imported across the package boundary.
 *
 * Loads all users + two GROUP-BY aggregate result sets into memory in one pass
 * (not keyset-paged like the plan's §10 sketch) — fine for a one-off offline
 * run at current scale; paginate over the user PK if the table grows large.
 */
const W = {
  like: 2,
  comment: 5,
  repost: 3, // covers plain reposts AND quotes (both bump postTable.repostCount)
  pollVote: 1,
  commentLike: 1,
  follow: 10,
} as const;

const WRITE_CHUNK = 25;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function main() {
  // Engagement RECEIVED per author, aggregated in one scan each.
  const postSums = await db
    .select({
      authorId: postTable.authorId,
      likeSum: sql<number>`COALESCE(SUM(${postTable.likeCount}), 0)`,
      commentSum: sql<number>`COALESCE(SUM(${postTable.commentCount}), 0)`,
      repostSum: sql<number>`COALESCE(SUM(${postTable.repostCount}), 0)`,
      pollVoteSum: sql<number>`COALESCE(SUM(${postTable.pollVoteCount}), 0)`,
    })
    .from(postTable)
    .groupBy(postTable.authorId);

  const commentLikeSums = await db
    .select({
      authorId: postCommentTable.authorId,
      likeSum: sql<number>`COALESCE(SUM(${postCommentTable.likeCount}), 0)`,
    })
    .from(postCommentTable)
    .groupBy(postCommentTable.authorId);

  const users = await db
    .select({ id: userTable.id, followerCount: userTable.followerCount })
    .from(userTable);

  const postMap = new Map(postSums.map((r) => [r.authorId, r]));
  const commentLikeMap = new Map(
    commentLikeSums.map((r) => [r.authorId, Number(r.likeSum)]),
  );

  const updates: { id: string; points: number }[] = [];
  for (const u of users) {
    const p = postMap.get(u.id);
    const points =
      u.followerCount * W.follow +
      (p
        ? Number(p.likeSum) * W.like +
          Number(p.commentSum) * W.comment +
          Number(p.repostSum) * W.repost +
          Number(p.pollVoteSum) * W.pollVote
        : 0) +
      (commentLikeMap.get(u.id) ?? 0) * W.commentLike;

    // Default is already 0 — only write rows that actually earned something.
    if (points > 0) {
      updates.push({ id: u.id, points });
    }
  }

  for (const batch of chunk(updates, WRITE_CHUNK)) {
    await Promise.all(
      batch.map((u) =>
        db
          .update(userTable)
          .set({ points: u.points })
          .where(eq(userTable.id, u.id)),
      ),
    );
  }

  console.log(
    `Aura backfill complete: ${updates.length}/${users.length} users seeded with points > 0.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Aura backfill failed:", err);
    process.exit(1);
  });
