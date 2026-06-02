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
});

/** The policies above are all token buckets with no inherent key, so a bare
 *  `rateLimiter.limit(ctx, name)` shares one global bucket across everyone —
 *  e.g. a 5-msg/10s cap that throttles all users together. These limits are
 *  per-session anti-abuse, so every call site must scope to the anonymous
 *  session. This wrapper makes the `key` mandatory (callers can't omit it) and
 *  throws a `ConvexError` when exceeded, so the keying contract can't drift. */
export type SessionRateLimitName = "sendMessage" | "findMatch" | "react";

export function limitPerSession(
  ctx: RunMutationCtx,
  name: SessionRateLimitName,
  sessionId: string,
) {
  return rateLimiter.limit(ctx, name, { key: sessionId, throws: true });
}
