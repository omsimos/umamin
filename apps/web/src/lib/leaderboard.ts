import { STREAK_MIN_DISPLAY } from "./streak";
import type { GroupBadgeData } from "./types";

export const LEADERBOARD_TABS = ["aura", "streak"] as const;
export type LeaderboardTab = (typeof LEADERBOARD_TABS)[number];

export const LEADERBOARD_LIMIT = 50;
// "Your rank" stops counting here so one viewer's read never walks more than
// this many index entries. Past it the page says "not in the top 1,000 yet".
export const LEADERBOARD_RANK_CAP = 1000;
// Public list TTL. The settings hint quotes it, so keep them in sync.
export const LEADERBOARD_MAX_AGE_SECONDS = 600;

// Below these a user isn't listed or ranked: no aura yet, or a streak too
// short to show publicly (profiles hide a 1-day streak too).
export const LEADERBOARD_MIN_VALUE: Record<LeaderboardTab, number> = {
  aura: 1,
  streak: STREAK_MIN_DISPLAY,
};

export function parseLeaderboardTab(
  value: string | null | undefined,
): LeaderboardTab | null {
  return (LEADERBOARD_TABS as readonly string[]).includes(value ?? "")
    ? (value as LeaderboardTab)
    : null;
}

export type LeaderboardUser = {
  id: string;
  username: string;
  displayName: string | null;
  imageUrl: string | null;
  groupBadge: GroupBadgeData | null;
};

export type LeaderboardEntry = {
  rank: number;
  value: number;
  user: LeaderboardUser;
};

export type LeaderboardResponse = {
  tab: LeaderboardTab;
  entries: LeaderboardEntry[];
};

export type LeaderboardRankResponse = {
  // null when the viewer is hidden, below the tab's minimum, or past the cap.
  rank: number | null;
  value: number;
  hidden: boolean;
};

/**
 * Competition ranks ("1224") for values already sorted high to low: tied
 * values share a rank and the next distinct value skips past them. Matches
 * the "your rank" count, which is 1 + the number of strictly higher values.
 */
export function competitionRanks(values: number[]): number[] {
  const ranks: number[] = [];
  for (let i = 0; i < values.length; i++) {
    ranks.push(i > 0 && values[i] === values[i - 1] ? ranks[i - 1] : i + 1);
  }
  return ranks;
}
