import { postTable } from "@umamin/db/schema/post";
import { desc } from "drizzle-orm";
import type { Db } from "./db";
import { getHotScore } from "./hot-score";

// Hot-feed ranking, ported from apps/www's Redis zset to a single Workers KV
// key. The cron (*/5) recomputes the ranking with ONE bounded Turso query and
// ONE KV write; readers slice the ranked-id list with the SAME `rh.<offset>`
// cursor contract apps/www used. Per-write rank refresh (refreshHotPostRank /
// removeHotPostRank in apps/www) is DROPPED — a ≤5-min rank lag is accepted,
// and deleted ids simply fail to hydrate. Fallback when KV is empty/unbound:
// the caller's DB-page path (getCachedPublicHotPostsPage).

// v2: v1 held linear-formula scores; mixing them with log-dampened scores
// would leave never-touched members permanently mis-ordered.
const HOT_FEED_KEY = "feed:hot:v2";
const HOT_CURSOR_PREFIX = "rh.";
// Cap the stored id list (matches the old zset cap) — bounds KV value size and
// how deep the ranked feed can page before falling back.
const HOT_FEED_MAX_ITEMS = 2_000;
// Recent posts the recompute scores in one bounded read (never a full scan).
const HOT_FEED_RECOMPUTE_SCAN = 2_000;
// KV read cache TTL (edge/local) — the list only changes every 5 min, so a
// 60s cacheTtl trims KV reads at no freshness cost.
const HOT_FEED_KV_TTL_SECONDS = 60;

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

/**
 * A page of ranked post ids from the KV list, preserving apps/www's contract:
 * returns null (→ caller's DB fallback) when KV is unbound, the list is shorter
 * than `minRankedItems`, the cursor offset is past the end, or fewer than
 * `pageSize` ids remain. `nextCursor` is `rh.<nextOffset>` when a full page + 1
 * was available, else null.
 */
export async function getRedisHotPostIdsPage(
  kv: KVNamespace | undefined,
  cursor: string | null | undefined,
  pageSize: number,
  minRankedItems: number,
) {
  if (!kv) {
    return null;
  }

  const ranked = await kv.get<string[]>(HOT_FEED_KEY, {
    type: "json",
    cacheTtl: HOT_FEED_KV_TTL_SECONDS,
  });

  if (!ranked) {
    return null;
  }

  const offset = parseRedisHotCursor(cursor);
  const rankedItems = ranked.length;

  if (rankedItems < minRankedItems || offset >= rankedItems) {
    return null;
  }

  // Peek one past the page (offset .. offset+pageSize inclusive) to decide the
  // next cursor — mirrors the old zrange(offset, offset+pageSize) window.
  const ids = ranked.slice(offset, offset + pageSize + 1);

  if (ids.length < pageSize) {
    return null;
  }

  return {
    ids: ids.slice(0, pageSize),
    nextCursor:
      ids.length > pageSize ? `${HOT_CURSOR_PREFIX}${offset + pageSize}` : null,
  };
}

/**
 * Cron body (every 5 min): recompute the ranked-id list from recent posts and
 * write it back as one KV value. One bounded Turso read (recent posts) → static
 * Hot score → sort → top-N ids → one KV put. No-ops without a KV binding.
 */
export async function recomputeHotFeed(
  db: Db,
  kv: KVNamespace | undefined,
): Promise<void> {
  if (!kv) {
    return;
  }

  const posts = await db
    .select(hotRankColumns)
    .from(postTable)
    .orderBy(desc(postTable.createdAt), desc(postTable.id))
    .limit(HOT_FEED_RECOMPUTE_SCAN);

  const ids = posts
    .map((post) => ({ id: post.id, score: getHotScore(post) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, HOT_FEED_MAX_ITEMS)
    .map((entry) => entry.id);

  await kv.put(HOT_FEED_KEY, JSON.stringify(ids));
}
