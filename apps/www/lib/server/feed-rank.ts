import "server-only";

import { db } from "@umamin/db";
import { postTable } from "@umamin/db/schema/post";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis";

const HOT_FEED_KEY = "feed:hot:v1";
const HOT_CURSOR_PREFIX = "rh.";
const HOT_FEED_MAX_ITEMS = 2_000;

type RankablePost = Pick<
  typeof postTable.$inferSelect,
  "id" | "createdAt" | "likeCount" | "commentCount" | "repostCount"
>;

function getHotFeedScore(post: RankablePost) {
  const engagement =
    post.likeCount + post.commentCount * 3 + post.repostCount * 4;

  // Recency keeps new posts viable; engagement moves active posts upward.
  return post.createdAt.getTime() / 10_000 + engagement * 1_000;
}

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

export async function refreshHotPostRank(postId: string) {
  if (!redis) {
    return;
  }

  const [post] = await db
    .select({
      id: postTable.id,
      createdAt: postTable.createdAt,
      likeCount: postTable.likeCount,
      commentCount: postTable.commentCount,
      repostCount: postTable.repostCount,
    })
    .from(postTable)
    .where(eq(postTable.id, postId))
    .limit(1);

  if (!post) {
    await redis.zrem(HOT_FEED_KEY, postId);
    return;
  }

  await redis.zadd(HOT_FEED_KEY, {
    score: getHotFeedScore(post),
    member: post.id,
  });
  await redis.zremrangebyrank(HOT_FEED_KEY, 0, -(HOT_FEED_MAX_ITEMS + 1));
}

export async function removeHotPostRank(postId: string) {
  if (!redis) {
    return;
  }

  await redis.zrem(HOT_FEED_KEY, postId);
}
