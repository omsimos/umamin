export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 4;
export const POLL_OPTION_MAX_LENGTH = 40;

export const POLL_DURATIONS = ["1h", "6h", "1d", "3d", "7d"] as const;
export type PollDuration = (typeof POLL_DURATIONS)[number];
export const DEFAULT_POLL_DURATION: PollDuration = "1d";

export const POLL_DURATION_LABELS: Record<PollDuration, string> = {
  "1h": "1 hour",
  "6h": "6 hours",
  "1d": "1 day",
  "3d": "3 days",
  "7d": "7 days",
};

export const POLL_PLUS_REQUIRED_ERROR =
  "Polls are an Umamin+ perk — unlocked once your account is a year old.";

export const POLL_ENDED_ERROR = "This poll has ended";

const HOUR_MS = 60 * 60 * 1000;
const DURATION_MS: Record<PollDuration, number> = {
  "1h": HOUR_MS,
  "6h": 6 * HOUR_MS,
  "1d": 24 * HOUR_MS,
  "3d": 3 * 24 * HOUR_MS,
  "7d": 7 * 24 * HOUR_MS,
};

export function pollEndsAtFrom(duration: PollDuration, now = Date.now()): Date {
  return new Date(now + DURATION_MS[duration]);
}

export function isPollEnded(
  endsAt: Date | string | null | undefined,
  now = Date.now(),
): boolean {
  if (!endsAt) return true;
  const ends = new Date(endsAt).getTime();
  if (Number.isNaN(ends)) return true;
  return ends <= now;
}

/**
 * Server-side bounding for the client-supplied option list: strings only,
 * trimmed, length-capped, case-insensitively deduped, capped at the max.
 * Returns [] when fewer than the minimum survive — callers treat that as
 * invalid input rather than creating a degenerate poll.
 */
export function sanitizePollOptions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const labels: string[] = [];

  for (const raw of input) {
    if (typeof raw !== "string") continue;

    const trimmed = raw.trim().slice(0, POLL_OPTION_MAX_LENGTH).trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    labels.push(trimmed);
    if (labels.length >= POLL_MAX_OPTIONS) break;
  }

  return labels.length >= POLL_MIN_OPTIONS ? labels : [];
}

export function pollTotalVotes(options: { voteCount: number }[]): number {
  return options.reduce(
    (sum, option) => sum + Math.max(option.voteCount, 0),
    0,
  );
}

/**
 * Integer percentages via largest-remainder so the displayed values sum to
 * exactly 100 (avoids 33+33+33=99). All-zero polls return all zeros.
 */
export function pollPercentages(options: { voteCount: number }[]): number[] {
  const total = pollTotalVotes(options);
  if (total === 0) return options.map(() => 0);

  const exact = options.map(
    (option) => (Math.max(option.voteCount, 0) * 100) / total,
  );
  const floors = exact.map(Math.floor);
  let remainder = 100 - floors.reduce((sum, value) => sum + value, 0);

  // Hand the leftover points to the largest fractional parts, index-stable
  // on ties so repeated renders never flip percentages.
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);

  const result = [...floors];
  for (const { index } of order) {
    if (remainder <= 0) break;
    result[index] += 1;
    remainder -= 1;
  }

  return result;
}
