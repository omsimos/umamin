import { userTable } from "@umamin/db/schema/user";
import { and, asc, eq, gt, gte, sql } from "drizzle-orm";
import {
  competitionRanks,
  LEADERBOARD_LIMIT,
  LEADERBOARD_MIN_VALUE,
  LEADERBOARD_RANK_CAP,
  type LeaderboardRankResponse,
  type LeaderboardResponse,
  type LeaderboardTab,
} from "../lib/leaderboard";
import { getGroupBadgeMap, withGroupBadge } from "./data";
import type { Db } from "./db";

// Must match the WHERE of user_points_rank_idx / user_streak_best_rank_idx in
// packages/db/src/schema/user.ts. SQLite only uses a partial index when the
// query contains the index's terms, so this stays a literal (no bound
// parameters) and every leaderboard query includes it.
const ELIGIBLE = sql`${userTable.bannedAt} IS NULL AND ${userTable.leaderboardHidden} = 0`;

const RANK_COLUMN = {
  aura: userTable.points,
  streak: userTable.streakBest,
} as const;

export function leaderboardListQuery(db: Db, tab: LeaderboardTab) {
  const column = RANK_COLUMN[tab];
  return db
    .select({
      id: userTable.id,
      username: userTable.username,
      displayName: userTable.displayName,
      imageUrl: userTable.imageUrl,
      equippedGroupId: userTable.equippedGroupId,
      value: column,
    })
    .from(userTable)
    .where(and(ELIGIBLE, gte(column, LEADERBOARD_MIN_VALUE[tab])))
    .orderBy(sql`${column} DESC`, asc(userTable.createdAt))
    .limit(LEADERBOARD_LIMIT);
}

export function leaderboardRankCountQuery(
  db: Db,
  tab: LeaderboardTab,
  value: number,
) {
  const column = RANK_COLUMN[tab];
  const higher = db
    .select({ one: sql`1` })
    .from(userTable)
    .where(and(ELIGIBLE, gt(column, value)))
    .limit(LEADERBOARD_RANK_CAP)
    .as("higher");
  return db.select({ count: sql<number>`count(*)` }).from(higher);
}

export async function getLeaderboard(
  db: Db,
  tab: LeaderboardTab,
): Promise<LeaderboardResponse> {
  const rows = await leaderboardListQuery(db, tab);
  const badgeMap = await getGroupBadgeMap(db, rows);
  const ranks = competitionRanks(rows.map((row) => row.value));

  return {
    tab,
    entries: rows.map(({ value, equippedGroupId, ...user }, i) => {
      const { groupBadge } = withGroupBadge({ equippedGroupId }, badgeMap);
      return { rank: ranks[i], value, user: { ...user, groupBadge } };
    }),
  };
}

/**
 * The viewer's rank on one board. Reads the viewer's row fresh rather than
 * from the session, whose user row sits in a 12 s isolate cache and would lag
 * right after the opt-out toggle. A hidden or below-minimum viewer costs one
 * PK read and no count.
 */
export async function getViewerRank(
  db: Db,
  tab: LeaderboardTab,
  viewerId: string,
): Promise<LeaderboardRankResponse> {
  const [viewer] = await db
    .select({
      value: RANK_COLUMN[tab],
      hidden: userTable.leaderboardHidden,
      bannedAt: userTable.bannedAt,
    })
    .from(userTable)
    .where(eq(userTable.id, viewerId))
    .limit(1);

  if (!viewer) return { rank: null, value: 0, hidden: false };

  const hidden = viewer.hidden || viewer.bannedAt != null;
  if (hidden || viewer.value < LEADERBOARD_MIN_VALUE[tab]) {
    return { rank: null, value: viewer.value, hidden };
  }

  const [row] = await leaderboardRankCountQuery(db, tab, viewer.value);
  const higher = Number(row?.count ?? 0);
  return {
    rank: higher < LEADERBOARD_RANK_CAP ? higher + 1 : null,
    value: viewer.value,
    hidden: false,
  };
}
