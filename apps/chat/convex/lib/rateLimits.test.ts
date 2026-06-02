import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { limitPerSession } from "./rateLimits";

const modules = import.meta.glob("../**/*.ts");

describe("rate limits", () => {
  it("scopes the bucket per session — one session's limit does not throttle another", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);

    // sendMessage capacity is 5; drain session "a" entirely.
    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) {
        await limitPerSession(ctx, "sendMessage", "a");
      }
    });
    await expect(
      t.run((ctx) => limitPerSession(ctx, "sendMessage", "a")),
    ).rejects.toThrow();

    // A different session is unaffected (separate bucket, not a global one).
    await expect(
      t.run((ctx) => limitPerSession(ctx, "sendMessage", "b")),
    ).resolves.not.toThrow();
  });
});
