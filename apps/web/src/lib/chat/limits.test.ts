import { describe, expect, it } from "vitest";
import { type BucketConfig, LIMITS, SideLimiter, takeToken } from "./limits";

const config: BucketConfig = { rate: 2, periodMs: 1000, capacity: 3 };

/** Takes until refused; returns how many succeeded. */
function drain(limiter: SideLimiter, key: string, now: number) {
  let taken = 0;
  while (limiter.take(key, "sendMessage", now)) {
    taken += 1;
    if (taken > 1000) throw new Error("bucket never empties");
  }
  return taken;
}

describe("takeToken", () => {
  it("a fresh bucket bursts to capacity, then refuses", () => {
    let state = takeToken(undefined, config, 0);
    let taken = state ? 1 : 0;
    while (state) {
      const next = takeToken(state, config, 0);
      if (!next) break;
      state = next;
      taken += 1;
    }
    expect(taken).toBe(config.capacity);
  });

  it("refills at rate per period, never past capacity", () => {
    const empty = { tokens: 0, updatedAt: 0 };
    // rate 2 per 1000ms: one token after 500ms, none before.
    expect(takeToken(empty, config, 499)).toBeNull();
    expect(takeToken(empty, config, 500)?.tokens).toBeCloseTo(0);
    expect(takeToken(empty, config, 60_000)?.tokens).toBe(config.capacity - 1);
  });

  it("a clock running backwards adds nothing", () => {
    expect(takeToken({ tokens: 0.5, updatedAt: 1000 }, config, 0)).toBeNull();
  });
});

describe("SideLimiter", () => {
  it("allows the configured burst, then refuses until refill", () => {
    const limiter = new SideLimiter();
    const { capacity, periodMs, rate } = LIMITS.sendMessage;
    expect(drain(limiter, "a", 0)).toBe(capacity);
    expect(limiter.take("a", "sendMessage", periodMs / rate)).toBe(true);
    expect(limiter.take("a", "sendMessage", periodMs / rate)).toBe(false);
  });

  it("a refused take does not consume budget", () => {
    const limiter = new SideLimiter();
    const { periodMs, rate } = LIMITS.sendMessage;
    drain(limiter, "a", 0);
    for (let i = 0; i < 5; i++) limiter.take("a", "sendMessage", 1);
    expect(limiter.take("a", "sendMessage", periodMs / rate)).toBe(true);
  });

  it("isolates keys and limiters", () => {
    const limiter = new SideLimiter();
    drain(limiter, "a", 0);
    expect(limiter.take("b", "sendMessage", 0)).toBe(true);
    expect(limiter.take("a", "react", 0)).toBe(true);
  });
});
