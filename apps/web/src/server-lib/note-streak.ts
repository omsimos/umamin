import { userTable } from "@umamin/db/schema/user";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { type NoteStreak, streakDay } from "../lib/streak";
import type { Db } from "./db";

/**
 * Counts a note save toward the user's streak in one PK update with no prior
 * read: the day after the last counted day extends it, any later day restarts
 * it at 1. Returns the new state, or null when today was already counted (the
 * WHERE skips the row, so a same-day re-save writes nothing).
 */
export async function recordNoteStreak(
  db: Pick<Db, "update">,
  userId: string,
  today = streakDay(),
): Promise<NoteStreak | null> {
  const next = sql`CASE WHEN ${userTable.noteStreakDay} = ${today - 1}
    THEN ${userTable.noteStreak} + 1 ELSE 1 END`;

  const [row] = await db
    .update(userTable)
    .set({
      noteStreak: next,
      // SQLite evaluates every SET expression against the pre-update row, so
      // this `next` matches the value written to note_streak.
      noteStreakBest: sql`max(${userTable.noteStreakBest}, ${next})`,
      noteStreakDay: today,
      // Keep Drizzle's $onUpdate from bumping updated_at: a note save isn't a
      // profile edit.
      updatedAt: sql`${userTable.updatedAt}`,
    })
    .where(
      and(
        eq(userTable.id, userId),
        or(isNull(userTable.noteStreakDay), ne(userTable.noteStreakDay, today)),
      ),
    )
    .returning({ noteStreak: userTable.noteStreak });

  return row ? { noteStreak: row.noteStreak, noteStreakDay: today } : null;
}
