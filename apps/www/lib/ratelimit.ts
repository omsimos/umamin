import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";
import { extractClientIp } from "./ip";
import { redis } from "./redis";

export const RATE_LIMIT_ERROR =
  "Too many requests. Please try again in a minute.";

// `redis` is the shared Upstash client (lib/redis.ts), built only when the KV
// integration env is present; otherwise null so the limiter no-ops (local dev).

type LimiterName =
  | "auth"
  | "message"
  | "read"
  | "write"
  | "group-join"
  | "group-edit"
  | "group-message"
  | "group-read";

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
      // Caps how fast a user can fire join requests (requestToJoinGroupAction).
      // Each request notifies a group owner, so this bounds request spam; the
      // join/accept/approve actions themselves run under the `write` limiter.
      "group-join": new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(8, "60 s"),
        prefix: "rl:group-join",
        ephemeralCache: new Map(),
        analytics: false,
      }),
      // Group meta edits — a name/icon change ripples to every member's badge
      // through the shared feed caches, so edits get a hard daily cooldown.
      "group-edit": new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(2, "1 d"),
        prefix: "rl:group-edit",
        ephemeralCache: new Map(),
        analytics: false,
      }),
      // Throttles cache-miss scraping (varied ?cursor= forces fresh Turso
      // scans); CDN-cached hits never reach the function. Generous — bump if
      // NAT'd networks trip it.
      read: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, "60 s"),
        prefix: "rl:read",
        ephemeralCache: new Map(),
        analytics: false,
      }),
      // Group-chat sends (one row + one tail SET each). Bounds spam without
      // throttling a lively conversation.
      "group-message": new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "60 s"),
        prefix: "rl:group-message",
        ephemeralCache: new Map(),
        analytics: false,
      }),
      // The chat poll/delta read, keyed PER USER (not per IP like `read`) so a
      // NAT'd room of members polling can't throttle one another. The CDN-cached
      // head-check absorbs idle ticks; this only fires on real delta fetches.
      "group-read": new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "60 s"),
        prefix: "rl:group-read",
        ephemeralCache: new Map(),
        analytics: false,
      }),
    }
  : null;

// Surface the misconfiguration loudly in production logs: without Redis,
// checkRateLimit() below allows everything (login brute-force, anonymous-message
// spam, mutation floods all go unthrottled). We don't fail-closed because that
// would brick core features (incl. anonymous messaging) on a transient KV
// outage — set KV_REST_API_* to actually enforce limits.
if (!limiters && process.env.NODE_ENV === "production") {
  console.error(
    "[ratelimit] Redis not configured — rate limiting is DISABLED in production. Set KV_REST_API_* env vars.",
  );
}

// Best-effort client IP for keying limits and the denylist. See lib/ip.ts for
// the header-priority rationale (non-spoofable edge headers first).
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return extractClientIp((name) => h.get(name));
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

// IP-keyed read throttle for the DB-backed GET routes; no-ops without Redis.
export async function checkReadRateLimit(): Promise<boolean> {
  const ip = await getClientIp();
  return checkRateLimit("read", `read:${ip}`);
}
