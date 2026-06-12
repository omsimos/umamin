/** Vibe scoring — plain data and pure functions shared by the Convex
 *  functions, the UI, and the mock transport (like decks.ts), so the three
 *  can never disagree on a level. The score is derived arithmetic over
 *  saturating counters stored on the match row; no clock involved, so the
 *  snapshot query stays deterministic. */

/** Score needed to ENTER each level (index 0 = level 1). */
export const VIBE_LEVEL_THRESHOLDS = [0, 25, 55, 90, 130] as const;

export const MAX_VIBE_LEVEL = VIBE_LEVEL_THRESHOLDS.length;

/** Saturation caps bound the score AND, more importantly, the writes — once a
 *  counter saturates the mutation stops patching the match row, so a marathon
 *  chat stops invalidating the snapshot for vibe bookkeeping. */
export const VIBE_MSG_COUNT_CAP = 60;
export const VIBE_REACTION_CAP = 10;
export const VIBE_WHISPER_CAP = 3;
/** Game contributions clamp too (score-side only — the tallies themselves
 *  keep counting): grinding deals alone caps at level 4, so the top level
 *  always requires real two-sided conversation. */
export const VIBE_ROUNDS_CAP = 12;
export const VIBE_SUCCESSES_CAP = 12;

export interface VibeCounters {
  msgsA: number;
  msgsB: number;
  reactions: number;
  whispers: number;
}

export const EMPTY_VIBE_COUNTERS: VibeCounters = {
  msgsA: 0,
  msgsB: 0,
  reactions: 0,
  whispers: 0,
};

export interface VibeInput extends VibeCounters {
  /** Completed game rounds across both modes. */
  rounds: number;
  /** Matched answers + correct guesses. */
  successes: number;
  mutualStayConnected: boolean;
}

/** Shared chemistry, identical for both viewers. `min(msgsA, msgsB)` means a
 *  monologue fills nothing — the meter only moves when both sides engage. */
export function computeVibe(input: VibeInput): {
  score: number;
  level: number;
} {
  const pairs = Math.min(input.msgsA, input.msgsB, VIBE_MSG_COUNT_CAP);
  const score =
    2 * pairs +
    5 * Math.min(input.rounds, VIBE_ROUNDS_CAP) +
    5 * Math.min(input.successes, VIBE_SUCCESSES_CAP) +
    2 * Math.min(input.reactions, VIBE_REACTION_CAP) +
    6 * Math.min(input.whispers, VIBE_WHISPER_CAP) +
    (input.mutualStayConnected ? 20 : 0);
  let level = 1;
  for (let i = VIBE_LEVEL_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (score >= VIBE_LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return { score, level };
}

/** Fraction [0,1] of the way from the current level to the next; 1 at max. */
export function vibeProgress(score: number, level: number): number {
  if (level >= MAX_VIBE_LEVEL) return 1;
  const floor = VIBE_LEVEL_THRESHOLDS[level - 1];
  const ceil = VIBE_LEVEL_THRESHOLDS[level];
  return Math.min(1, Math.max(0, (score - floor) / (ceil - floor)));
}
