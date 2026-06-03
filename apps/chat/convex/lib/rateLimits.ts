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
  globalFindMatch: {
    kind: "token bucket",
    rate: 1500,
    period: MINUTE,
    capacity: 500,
  },
  globalSendMessage: {
    kind: "token bucket",
    rate: 3000,
    period: 10 * SECOND,
    capacity: 1000,
  },
  globalReact: {
    kind: "token bucket",
    rate: 4000,
    period: 10 * SECOND,
    capacity: 1500,
  },
  globalTyping: {
    kind: "token bucket",
    rate: 6000,
    period: 10 * SECOND,
    capacity: 2000,
  },
  globalPresenceHeartbeat: {
    kind: "token bucket",
    rate: 20000,
    period: 10 * SECOND,
    capacity: 5000,
  },
});

/** Per-session policies must always pass a key. Keep this wrapper as the only
 *  per-session entrypoint so a call site can't accidentally create a global
 *  bucket with user-level limits. */
export type SessionRateLimitName =
  | "sendMessage"
  | "findMatch"
  | "react"
  | "typing";

export type GlobalRateLimitName =
  | "globalFindMatch"
  | "globalSendMessage"
  | "globalReact"
  | "globalTyping"
  | "globalPresenceHeartbeat";

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
