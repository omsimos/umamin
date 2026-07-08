import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";
import { extractClientIp } from "./ip";
import { redis } from "./redis";

export const RATE_LIMIT_ERROR =
  "Too many requests. Please try again in a minute.";

type LimiterName = "auth" | "message" | "write" | "read";

// analytics:false keeps the Upstash command count (and cost) minimal. Each
// limiter gets its own ephemeralCache so an in-memory block can't leak across.
const limiters: Record<LimiterName, Ratelimit> | null = redis
  ? {
      // login — brute force + Argon2 CPU burn protection.
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
      // authenticated mutations (delete, profile/password updates).
      write: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "60 s"),
        prefix: "rl:write",
        ephemeralCache: new Map(),
        analytics: false,
      }),
      // cache-miss scraping of the inbox read route.
      read: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, "60 s"),
        prefix: "rl:read",
        ephemeralCache: new Map(),
        analytics: false,
      }),
    }
  : null;

if (!limiters && process.env.NODE_ENV === "production") {
  console.error(
    "[ratelimit] Redis not configured — rate limiting is DISABLED in production. Set KV_REST_API_* env vars.",
  );
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return extractClientIp((name) => h.get(name));
}

/**
 * Returns true if the request may proceed. No-ops to true when Redis is
 * unconfigured (local dev / transient KV outage) — set KV_REST_API_* to enforce.
 */
export async function checkRateLimit(
  name: LimiterName,
  identifier: string,
): Promise<boolean> {
  if (!limiters) return true;
  const { success } = await limiters[name].limit(identifier);
  return success;
}

// IP-keyed read throttle for the DB-backed GET routes; no-ops without Redis.
export async function checkReadRateLimit(): Promise<boolean> {
  const ip = await getClientIp();
  return checkRateLimit("read", `read:${ip}`);
}
