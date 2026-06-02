import { RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import { MINUTE, SECOND } from "../constants";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // ~5 messages / 10s, small burst — anti-spam.
  sendMessage: {
    kind: "token bucket",
    rate: 5,
    period: 10 * SECOND,
    capacity: 5,
  },
  // ~10 match/skip requests / min — anti-abuse.
  findMatch: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 5 },
  // reactions — modest.
  react: { kind: "token bucket", rate: 20, period: 10 * SECOND, capacity: 10 },
});
