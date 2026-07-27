import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../src/server-lib/env";
import {
  checkRateLimit,
  checkReadRateLimit,
  RATE_LIMIT_ERROR,
} from "../src/server-lib/ratelimit";

// Miniflare doesn't simulate the Workers Rate Limiting binding, so a stub stands
// in for env.RL_* (plan: "miniflare ratelimit simulators if supported, else a
// binding stub"). This exercises binding-name mapping, threshold handling, and
// the fail-open posture — the parts server-lib owns.

// A counting stub matching the RateLimit binding shape (per-key call budget).
function fakeLimiter(limit: number): RateLimit {
  const counts = new Map<string, number>();
  return {
    limit: vi.fn(async ({ key }: { key: string }) => {
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return { success: n <= limit };
    }),
  } as unknown as RateLimit;
}

function envWith(overrides: Partial<Record<keyof Env, RateLimit>>): AppEnv {
  return overrides as unknown as AppEnv;
}

describe("ratelimit (binding stub)", () => {
  it("allows up to the limit then denies, mapping name → binding", async () => {
    const env = envWith({ RL_AUTH: fakeLimiter(5) });
    const key = "auth:1.2.3.4";
    const results: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      results.push(await checkRateLimit(env, "auth", key));
    }
    expect(results).toEqual([true, true, true, true, true, false, false]);
  });

  it("uses the binding matching the limiter name", async () => {
    const write = fakeLimiter(1);
    const env = envWith({ RL_WRITE: write, RL_AUTH: fakeLimiter(1) });
    await checkRateLimit(env, "write", "k");
    expect(write.limit).toHaveBeenCalledWith({ key: "k" });
  });

  it("keeps keys independent", async () => {
    const env = envWith({ RL_MESSAGE: fakeLimiter(1) });
    expect(await checkRateLimit(env, "message", "a")).toBe(true);
    expect(await checkRateLimit(env, "message", "b")).toBe(true);
    expect(await checkRateLimit(env, "message", "a")).toBe(false);
  });

  it("fails OPEN with a loud log when the binding is missing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await checkRateLimit(envWith({}), "auth", "x")).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("RL_AUTH missing"),
    );
    spy.mockRestore();
  });

  it("checkReadRateLimit keys per IP under the read limiter", async () => {
    const read = fakeLimiter(100);
    await checkReadRateLimit(envWith({ RL_READ: read }), "9.9.9.9");
    expect(read.limit).toHaveBeenCalledWith({ key: "read:9.9.9.9" });
  });

  it("exposes the canonical error string", () => {
    expect(RATE_LIMIT_ERROR).toMatch(/too many requests/i);
  });
});
