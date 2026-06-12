import type { RunMutationCtx } from "@convex-dev/rate-limiter";
import { RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import { MINUTE, SECOND } from "../constants";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  sendMessage: {
    kind: "token bucket",
    rate: 5,
    period: 10 * SECOND,
    capacity: 5,
  },
  findMatch: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 5 },
  react: { kind: "token bucket", rate: 20, period: 10 * SECOND, capacity: 10 },
  typing: { kind: "token bucket", rate: 30, period: 10 * SECOND, capacity: 10 },
  // Radar pings every QUEUE_PING_MS (10s); slack for visibility-triggered beats.
  queuePing: { kind: "token bucket", rate: 12, period: MINUTE, capacity: 6 },
  // Dealing/dismissing a game round is deliberate and low-frequency.
  gameDeal: { kind: "token bucket", rate: 6, period: MINUTE, capacity: 3 },
  // At most one effective answer per round; slack for stale-round retries.
  gameAnswer: { kind: "token bucket", rate: 15, period: MINUTE, capacity: 5 },
  // Submitting/withdrawing a reveal handle is rare and deliberate.
  revealSubmit: { kind: "token bucket", rate: 4, period: MINUTE, capacity: 3 },
  // Global brakes are keyless, so every call hits the same bucket — sharded so
  // high-frequency mutations (esp. the per-client heartbeat) don't all contend
  // on one rateLimits document and trigger OCC write-conflict retries. Shard
  // counts scale with each limit's expected throughput; rate/capacity stay the
  // global totals and the component divides them across shards.
  globalFindMatch: {
    kind: "token bucket",
    rate: 1500,
    period: MINUTE,
    capacity: 500,
    shards: 5,
  },
  globalSendMessage: {
    kind: "token bucket",
    rate: 3000,
    period: 10 * SECOND,
    capacity: 1000,
    shards: 10,
  },
  globalReact: {
    kind: "token bucket",
    rate: 4000,
    period: 10 * SECOND,
    capacity: 1500,
    shards: 10,
  },
  globalTyping: {
    kind: "token bucket",
    rate: 6000,
    period: 10 * SECOND,
    capacity: 2000,
    shards: 10,
  },
  globalPresenceHeartbeat: {
    kind: "token bucket",
    rate: 20000,
    period: 10 * SECOND,
    capacity: 5000,
    shards: 16,
  },
  globalQueuePing: {
    kind: "token bucket",
    rate: 1200,
    period: 10 * SECOND,
    capacity: 400,
    shards: 8,
  },
  globalGameDeal: {
    kind: "token bucket",
    rate: 600,
    period: MINUTE,
    capacity: 200,
    shards: 5,
  },
  globalGameAnswer: {
    kind: "token bucket",
    rate: 1500,
    period: MINUTE,
    capacity: 500,
    shards: 5,
  },
  globalReveal: {
    kind: "token bucket",
    rate: 300,
    period: MINUTE,
    capacity: 100,
    shards: 5,
  },
});

/** Per-session policies must always pass a key. Keep this wrapper as the only
 *  per-session entrypoint so a call site can't accidentally create a global
 *  bucket with user-level limits. */
export type SessionRateLimitName =
  | "sendMessage"
  | "findMatch"
  | "react"
  | "typing"
  | "queuePing"
  | "gameDeal"
  | "gameAnswer"
  | "revealSubmit";

export type GlobalRateLimitName =
  | "globalFindMatch"
  | "globalSendMessage"
  | "globalReact"
  | "globalTyping"
  | "globalPresenceHeartbeat"
  | "globalQueuePing"
  | "globalGameDeal"
  | "globalGameAnswer"
  | "globalReveal";

export function limitPerSession(
  ctx: RunMutationCtx,
  name: SessionRateLimitName,
  sessionId: string,
) {
  return rateLimiter.limit(ctx, name, { key: sessionId, throws: true });
}

/** Global policies intentionally omit a key. Use these only on public,
 *  write-heavy mutations as an aggregate cost brake. */
export function limitGlobal(ctx: RunMutationCtx, name: GlobalRateLimitName) {
  return rateLimiter.limit(ctx, name, { throws: true });
}
