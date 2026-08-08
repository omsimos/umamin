// Pure poll constants + helpers, ported verbatim from apps/www/lib/poll.ts
// (server-side subset — the display helpers pollTotalVotes/pollPercentages stay
// in the frontend port). No platform imports.

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 4;
export const POLL_OPTION_MAX_LENGTH = 40;

export const POLL_DURATIONS = ["1h", "6h", "1d", "3d", "7d"] as const;
export type PollDuration = (typeof POLL_DURATIONS)[number];

export const POLL_PLUS_REQUIRED_ERROR =
  "Polls are an Umamin+ perk — free once your account is a year old, or included with Umamin Pro.";

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

/**
 * Server-side bounding for the client-supplied option list: strings only,
 * trimmed, length-capped, case-insensitively deduped, capped at the max.
 * Returns [] when fewer than the minimum survive.
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
