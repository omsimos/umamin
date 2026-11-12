import { userTable } from "@umamin/db/schema/user";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { type StreakUpdate, toStreakDay } from "../lib/streak";
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
    .returning({ streak: userTable.streak });

  return row ? { streak: row.streak, streakDay: today } : null;
}
