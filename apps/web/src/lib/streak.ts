// Note streaks count Manila calendar days (UTC+8, no DST). One fixed boundary
// for everyone keeps server and client in agreement without storing a
// timezone per user; most of the user base is in the Philippines.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// A 1-day streak only means "posted today", so it isn't shown publicly.
export const NOTE_STREAK_MIN_DISPLAY = 2;

// What a save that changed the streak returns to the client.
export type NoteStreak = { noteStreak: number; noteStreakDay: number };

export type NoteStreakState = {
  noteStreak?: number | null;
  noteStreakDay?: number | null;
};

/** Manila calendar day number (days since the epoch, shifted to UTC+8). */
export function streakDay(date: Date | number = Date.now()): number {
  const ms = typeof date === "number" ? date : date.getTime();
  return Math.floor((ms + MANILA_OFFSET_MS) / DAY_MS);
}

/**
 * The live streak. The stored count is only refreshed on save, so a streak
 * whose last counted day is older than yesterday is already broken even
 * though the row (or a cached payload) still carries the old count.
 */
export function activeNoteStreak(
  state: NoteStreakState,
  today = streakDay(),
): number {
  const { noteStreak, noteStreakDay } = state;
  if (!noteStreak || noteStreakDay == null) return 0;
  return noteStreakDay >= today - 1 ? noteStreak : 0;
}

/** True when the streak is alive but ends tonight unless the user saves. */
export function isNoteStreakAtRisk(
  state: NoteStreakState,
  today = streakDay(),
): boolean {
  return (
    activeNoteStreak(state, today) > 0 && state.noteStreakDay === today - 1
  );
}

/** The streak worth showing publicly, or 0 below the display threshold. */
export function displayNoteStreak(
  state: NoteStreakState,
  today = streakDay(),
): number {
  const streak = activeNoteStreak(state, today);
  return streak >= NOTE_STREAK_MIN_DISPLAY ? streak : 0;
}

/**
 * The streak fields a public payload may carry. A hidden streak (under the
 * display threshold, or broken) ships as empty, so the payload doesn't reveal
 * the day of someone's last shared note. Owner reads keep the raw values.
 */
export function publicNoteStreak(
  state: NoteStreakState,
  today = streakDay(),
): { noteStreak: number; noteStreakDay: number | null } {
  return displayNoteStreak(state, today) > 0
    ? {
        noteStreak: state.noteStreak ?? 0,
        noteStreakDay: state.noteStreakDay ?? null,
      }
    : { noteStreak: 0, noteStreakDay: null };
}
