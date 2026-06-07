import "server-only";

import { db } from "@umamin/db";
import { postTable } from "@umamin/db/schema/post";
import { desc, eq } from "drizzle-orm";
import { redis } from "@/lib/redis";
import { getHotScore } from "@/lib/server/hot-score";

// v2: v1 held linear-formula scores; mixing them with log-dampened scores
// would leave never-touched members permanently mis-ordered.
const HOT_FEED_KEY = "feed:hot:v2";
// Deletable (with the seed route) once the one-off v2 seed has run in prod.
const LEGACY_HOT_FEED_KEY = "feed:hot:v1";
const HOT_CURSOR_PREFIX = "rh.";
const HOT_FEED_MAX_ITEMS = 2_000;

const hotRankColumns = {
  id: postTable.id,
  createdAt: postTable.createdAt,
  likeCount: postTable.likeCount,
  pollVoteCount: postTable.pollVoteCount,
  commentCount: postTable.commentCount,
  repostCount: postTable.repostCount,
};

export function isRedisHotCursor(
  cursor: string | null | undefined,
): cursor is string {
  return typeof cursor === "string" && cursor.startsWith(HOT_CURSOR_PREFIX);
}

function parseRedisHotCursor(cursor: string | null | undefined) {
  if (!isRedisHotCursor(cursor)) {
    return 0;
  }

  const offset = Number(cursor.slice(HOT_CURSOR_PREFIX.length));
  return Number.isInteger(offset) && offset >= 0 ? offset : 0;
}

export async function getRedisHotPostIdsPage(
  cursor: string | null | undefined,
  pageSize: number,
  minRankedItems: number,
) {
  if (!redis) {
    return null;
  }

  const offset = parseRedisHotCursor(cursor);
  const rankedItems = await redis.zcard(HOT_FEED_KEY);

  if (rankedItems < minRankedItems || offset >= rankedItems) {
    return null;
  }

  const ids = await redis.zrange<string[]>(
    HOT_FEED_KEY,
    offset,
    offset + pageSize,
    { rev: true },
  );

  if (ids.length < pageSize) {
    return null;
  }

  return {
    ids: ids.slice(0, pageSize),
    nextCursor:
      ids.length > pageSize ? `${HOT_CURSOR_PREFIX}${offset + pageSize}` : null,
  };
}

// Best-effort by design: rank maintenance runs after the action's DB write
// has committed, so a Redis/DB blip here must not fail the action.
export async function refreshHotPostRank(postId: string) {
  if (!redis) {
    return;
  }

  try {
    const [post] = await db
      .select(hotRankColumns)
      .from(postTable)
      .where(eq(postTable.id, postId))
      .limit(1);

    if (!post) {
      await redis.zrem(HOT_FEED_KEY, postId);
      return;
    }

    const added = await redis.zadd(HOT_FEED_KEY, {
      score: getHotScore(post),
      member: post.id,
    });

    // Only a brand-new member can push the set past the cap; re-scores
    // return 0 and skip the trim command.
    if (added) {
      await redis.zremrangebyrank(HOT_FEED_KEY, 0, -(HOT_FEED_MAX_ITEMS + 1));
    }
  } catch (err) {
    console.error("refreshHotPostRank failed", { postId, err });
  }
}

export async function removeHotPostRank(postId: string) {
  if (!redis) {
    return;
  }

  try {
    await redis.zrem(HOT_FEED_KEY, postId);
  } catch (err) {
    console.error("removeHotPostRank failed", { postId, err });
  }
}

/**
 * One-off backfill for the v2 zset (called by the seed-hot-rank route): a
 * fresh key otherwise only fills as posts get touched by engagement, leaving
 * Hot on the SQL fallback (newest-100 window) for days at current volume.
 * Deliberately NOT best-effort — the manual curl should surface failures.
 */
export async function seedHotPostRanks() {
  if (!redis) {
    return null;
  }

  const posts = await db
    .select(hotRankColumns)
    .from(postTable)
    .orderBy(desc(postTable.createdAt), desc(postTable.id))
    .limit(HOT_FEED_MAX_ITEMS);

  if (posts.length > 0) {
    const [first, ...rest] = posts.map((post) => ({
      score: getHotScore(post),
      member: post.id,
    }));
    await redis.zadd(HOT_FEED_KEY, first, ...rest);
  }

  await redis.del(LEGACY_HOT_FEED_KEY);

  return posts.length;
}
