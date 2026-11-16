import { userTable } from "@umamin/db/schema/user";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import {
  STREAK_MIN_DISPLAY,
  STREAK_RESTORES_PER_MONTH,
  type StreakRestore,
  type StreakUpdate,
  toStreakDay,
  toStreakMonth,
} from "../lib/streak";
import type { Db } from "./db";

/**
 * Counts a shared note or a post toward the user's streak in one PK update with no prior
 * read: the day after the last counted day extends it, any later day restarts
 * it at 1. Returns the new state, or null when today or a later day was already
 * counted. The WHERE skips the row, so a same-day re-save writes nothing, and a
 * save that started before Manila midnight but lands after a newer one can't
 * move the stored day backwards and reset the streak.
 */
export async function recordStreak(
  db: Pick<Db, "update">,
  userId: string,
  today = toStreakDay(),
): Promise<StreakUpdate | null> {
  const next = sql`CASE WHEN ${userTable.streakDay} = ${today - 1}
    THEN ${userTable.streak} + 1 ELSE 1 END`;

  const [row] = await db
    .update(userTable)
    .set({
      streak: next,
      // SQLite evaluates every SET expression against the pre-update row, so
      // this `next` matches the value written to streak.
      streakBest: sql`max(${userTable.streakBest}, ${next})`,
      streakDay: today,
      // A save the day after one missed day resets the streak; keep what it
      // was so a restore later today can bring it back.
      streakBroken: sql`CASE WHEN ${userTable.streakDay} = ${today - 2}
        THEN ${userTable.streak} ELSE 0 END`,
      // Keep Drizzle's $onUpdate from bumping updated_at: a streak update isn't a
      // profile edit.
      updatedAt: sql`${userTable.updatedAt}`,
    })
    .where(
      and(
        eq(userTable.id, userId),
        or(isNull(userTable.streakDay), lt(userTable.streakDay, today)),
      ),
    )
    .returning({
      streak: userTable.streak,
      streakBroken: userTable.streakBroken,
    });

  return row
    ? { streak: row.streak, streakDay: today, streakBroken: row.streakBroken }
    : null;
}

/**
 * Spends one of the month's restores on a streak that broke yesterday. The
 * restore covers the missed day and today, so the streak lands on today with
 * its old count and the next day's save extends it. Works whether or not
 * today's save already reset it (see restorableStreak). One conditional
 * update with no prior read: a double tap spends one restore, and a streak
 * that isn't restorable or a month with none left matches no row and returns
 * null.
 */
export async function restoreStreak(
  db: Pick<Db, "update">,
  userId: string,
  now = Date.now(),
): Promise<StreakRestore | null> {
  const today = toStreakDay(now);
  const month = toStreakMonth(now);

  const [row] = await db
    .update(userTable)
    .set({
      streak: sql`CASE WHEN ${userTable.streakDay} = ${today}
        THEN ${userTable.streakBroken} ELSE ${userTable.streak} END`,
      streakDay: today,
      streakBroken: 0,
      streakRestoresUsed: sql`CASE WHEN ${userTable.streakRestoreMonth} = ${month}
        THEN ${userTable.streakRestoresUsed} + 1 ELSE 1 END`,
      streakRestoreMonth: month,
      updatedAt: sql`${userTable.updatedAt}`,
    })
    .where(
      and(
        eq(userTable.id, userId),
        sql`((${userTable.streakDay} = ${today - 2} AND ${userTable.streak} >= ${STREAK_MIN_DISPLAY})
          OR (${userTable.streakDay} = ${today} AND ${userTable.streakBroken} >= ${STREAK_MIN_DISPLAY}))`,
        hasRestoreLeft(month),
      ),
    )
    .returning({
      streak: userTable.streak,
      streakRestoresUsed: userTable.streakRestoresUsed,
    });

  return row
    ? {
        streak: row.streak,
        streakDay: today,
        streakBroken: 0,
        streakRestoresUsed: row.streakRestoresUsed,
        streakRestoreMonth: month,
      }
    : null;
}

/** SQL twin of restoresLeft(state, month) > 0. */
export function hasRestoreLeft(month: number) {
  return sql`(${userTable.streakRestoreMonth} IS NOT ${month}
    OR ${userTable.streakRestoresUsed} < ${STREAK_RESTORES_PER_MONTH})`;
}
