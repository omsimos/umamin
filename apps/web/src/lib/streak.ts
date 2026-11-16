// Streaks count Manila calendar days (UTC+8, no DST). One fixed boundary
// for everyone keeps server and client in agreement without storing a
// timezone per user; most of the user base is in the Philippines.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// A 1-day streak only means "posted today", so it isn't shown publicly.
export const STREAK_MIN_DISPLAY = 2;

// What a save that changed the streak returns to the client.
// streakBroken is set when this save reset a streak that's still
// restorable today.
export type StreakUpdate = {
  streak: number;
  streakDay: number;
  streakBroken?: number;
};

export type StreakState = {
  streak?: number | null;
  streakDay?: number | null;
  // Owner-only restore state, on the current-user payload and nowhere else.
  streakBroken?: number | null;
  streakRestoresUsed?: number | null;
  streakRestoreMonth?: number | null;
};

export const STREAK_RESTORES_PER_MONTH = 3;

// What a restore returns to the client.
export type StreakRestore = StreakUpdate & {
  streakBroken: number;
  streakRestoresUsed: number;
  streakRestoreMonth: number;
};

/** Manila calendar day number (days since the epoch, shifted to UTC+8). */
export function toStreakDay(date: Date | number = Date.now()): number {
  const ms = typeof date === "number" ? date : date.getTime();
  return Math.floor((ms + MANILA_OFFSET_MS) / DAY_MS);
}

/** Manila calendar month key, year * 12 + month index. */
export function toStreakMonth(date: Date | number = Date.now()): number {
  const ms = typeof date === "number" ? date : date.getTime();
  const manila = new Date(ms + MANILA_OFFSET_MS);
  return manila.getUTCFullYear() * 12 + manila.getUTCMonth();
}

/**
 * The count a restore would bring back today, or 0. A restore is only offered
 * the day after one missed day: either nothing has been saved yet today
 * (streakDay is two days back), or today's save already reset the streak and
 * streakBroken holds what it was.
 */
export function restorableStreak(
  state: StreakState,
  today = toStreakDay(),
): number {
  const { streak, streakDay, streakBroken } = state;
  if (streakDay === today - 2 && (streak ?? 0) >= STREAK_MIN_DISPLAY) {
    return streak ?? 0;
  }
  if (streakDay === today && (streakBroken ?? 0) >= STREAK_MIN_DISPLAY) {
    return streakBroken ?? 0;
  }
  return 0;
}

/** Restores left in the given Manila month. */
export function restoresLeft(
  state: StreakState,
  month = toStreakMonth(),
): number {
  if (state.streakRestoreMonth !== month) return STREAK_RESTORES_PER_MONTH;
  return Math.max(
    0,
    STREAK_RESTORES_PER_MONTH - (state.streakRestoresUsed ?? 0),
  );
}

/**
 * The live streak. The stored count is only refreshed on save, so a streak
 * whose last counted day is older than yesterday is already broken even
 * though the row (or a cached payload) still carries the old count.
 */
export function activeStreak(
  state: StreakState,
  today = toStreakDay(),
): number {
  const { streak, streakDay } = state;
  if (!streak || streakDay == null) return 0;
  return streakDay >= today - 1 ? streak : 0;
}

/** True when the streak is alive but ends tonight unless the user saves. */
export function isStreakAtRisk(
  state: StreakState,
  today = toStreakDay(),
): boolean {
  return activeStreak(state, today) > 0 && state.streakDay === today - 1;
}

/** The streak worth showing publicly, or 0 below the display threshold. */
export function displayStreak(
  state: StreakState,
  today = toStreakDay(),
): number {
  const streak = activeStreak(state, today);
  return streak >= STREAK_MIN_DISPLAY ? streak : 0;
}

export type StreakTier = "base" | "week" | "month" | "quarter";

// Highest first. Each tier recolors the streak bolt; the color names show up
// in the milestone toast, so keep them in sync with STREAK_TIER_STYLES.
export const STREAK_TIERS = [
  { tier: "quarter", minDays: 90, color: "purple" },
  { tier: "month", minDays: 30, color: "red" },
  { tier: "week", minDays: 7, color: "orange" },
] as const satisfies readonly {
  tier: StreakTier;
  minDays: number;
  color: string;
}[];

/** The bolt tier for a live streak count (pass activeStreak, not the raw row). */
export function streakTier(streak: number): StreakTier {
  return STREAK_TIERS.find((t) => streak >= t.minDays)?.tier ?? "base";
}

/** A save's success toast, with the streak count once it's worth showing. */
export function streakToast(message: string, update?: StreakUpdate | null) {
  if (!update || update.streak < STREAK_MIN_DISPLAY) return message;
  // A streak grows one day per save day, so a tier is reached on its exact
  // threshold and the toast fires once per tier.
  const reached = STREAK_TIERS.find((t) => t.minDays === update.streak);
  return reached
    ? `${message} ${update.streak}-day streak. Your bolt is ${reached.color} now.`
    : `${message} ${update.streak}-day streak.`;
}
