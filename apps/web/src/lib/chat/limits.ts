/**
 * Per-side token buckets for room ops, with the same rates the Convex build
 * used per session. Bucket state lives in Durable Object memory: hibernation
 * resets it, which only happens after ~10s of silence, so a burst can't use it
 * to refill early.
 */
import { MINUTE, SECOND } from "./constants";

export interface BucketConfig {
  /** Tokens added per `periodMs`. */
  rate: number;
  periodMs: number;
  /** Bucket size; a fresh bucket starts full. */
  capacity: number;
}

export const LIMITS = {
  sendMessage: { rate: 5, periodMs: 10 * SECOND, capacity: 5 },
  react: { rate: 20, periodMs: 10 * SECOND, capacity: 10 },
  typing: { rate: 30, periodMs: 10 * SECOND, capacity: 10 },
  gameDeal: { rate: 6, periodMs: MINUTE, capacity: 3 },
  gameAnswer: { rate: 15, periodMs: MINUTE, capacity: 5 },
  revealSubmit: { rate: 4, periodMs: MINUTE, capacity: 3 },
} as const satisfies Record<string, BucketConfig>;

export type LimiterName = keyof typeof LIMITS;

export interface BucketState {
  tokens: number;
  updatedAt: number;
}

/** Takes one token. Returns the next state, or null when the bucket is empty
 *  (the caller keeps the previous state). */
export function takeToken(
  state: BucketState | undefined,
  config: BucketConfig,
  now: number,
): BucketState | null {
  const prev = state ?? { tokens: config.capacity, updatedAt: now };
  const elapsed = Math.max(0, now - prev.updatedAt);
  const tokens = Math.min(
    config.capacity,
    prev.tokens + (elapsed * config.rate) / config.periodMs,
  );
  if (tokens < 1) return null;
  return { tokens: tokens - 1, updatedAt: now };
}

/** Holds one bucket per (side, limiter). */
export class SideLimiter {
  private buckets = new Map<string, BucketState>();

  take(key: string, name: LimiterName, now: number): boolean {
    const id = `${key}:${name}`;
    const next = takeToken(this.buckets.get(id), LIMITS[name], now);
    if (!next) return false;
    this.buckets.set(id, next);
    return true;
  }
}
