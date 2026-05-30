import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

export const RATE_LIMIT_ERROR =
  "Too many requests. Please try again in a minute.";

// Build the client only when both env vars are present. We deliberately avoid
// Redis.fromEnv() because it throws when they are unset — here a missing config
// must degrade to a no-op so local dev needs no Redis (see the rate-limit plan).
//
// KV_REST_API_URL / KV_REST_API_TOKEN are injected by Vercel's Upstash/KV
// marketplace integration. Use the REST endpoint + read-write token — NOT
// REDIS_URL / KV_URL, which are TCP connection strings the HTTP client can't use.
const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

type LimiterName = "auth" | "message" | "write";

// analytics:false keeps the Upstash command count (and cost) minimal; flip it on
// per-limiter if you want the Upstash dashboard insights. Each limiter gets its
// own ephemeralCache so an in-memory block for one never leaks into another.
const limiters: Record<LimiterName, Ratelimit> | null = redis
  ? {
      // login + signup — protects against brute force and Argon2 CPU burn.
      auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "60 s"),
        prefix: "rl:auth",
        ephemeralCache: new Map(),
        analytics: false,
      }),
      // anonymous message sends — the main spam/cost vector.
      message: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "60 s"),
        prefix: "rl:message",
        ephemeralCache: new Map(),
        analytics: false,
      }),
      // general authenticated mutations (likes/follows/comments/reposts).
      // Defined now so wiring guards later is a one-liner.
      write: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "60 s"),
        prefix: "rl:write",
        ephemeralCache: new Map(),
        analytics: false,
      }),
    }
  : null;

/**
 * Best-effort client IP for keying limits. On Vercel the left-most entry of
 * `x-forwarded-for` is the real client. Falls back to a constant when the header
 * is absent (e.g. local dev) so behaviour stays deterministic.
 */
export async function getClientIp(): Promise<string> {
  const forwardedFor = (await headers()).get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "127.0.0.1";
}

/**
 * Returns true if the request may proceed. When Redis is not configured (no
 * KV_REST_API_* env), this always allows — a deliberate no-op so the app runs
 * locally without Redis. In production, set the env vars to enforce limits.
 */
export async function checkRateLimit(
  name: LimiterName,
  identifier: string,
): Promise<boolean> {
  if (!limiters) return true;
  const { success } = await limiters[name].limit(identifier);
  return success;
}
