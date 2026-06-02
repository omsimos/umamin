import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const self = (id: string) => ({
  sessionId: id,
  alias: id,
  avatarSeed: id,
  interests: ["music"],
});

describe("cleanup", () => {
  it("deleteMatch removes the match and its messages", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    await t.mutation(api.match.enqueueAndMatch, self("b"));
    await t.mutation(api.chat.send, { sessionId: "a", text: "hi" });
    const a = await t.query(api.chat.snapshot, { sessionId: "a" });
    await t.mutation(internal.cleanup.deleteMatch, {
      matchId: a.matchId as never,
    });
    const after = await t.query(api.chat.snapshot, { sessionId: "a" });
    expect(after.phase).toBe("idle");
    const msgs = await t.run(async (ctx) => ctx.db.query("messages").collect());
    expect(msgs).toHaveLength(0);
  });

  it("sweepDeadSessions deletes sessions past TTL", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("sessions", {
        sessionId: "old",
        alias: "x",
        avatarSeed: "x",
        interests: [],
        lastSeen: Date.now() - 2 * 60 * 60 * 1000,
      });
    });
    await t.mutation(internal.cleanup.sweepDeadSessions, {});
    const left = await t.run(async (ctx) => ctx.db.query("sessions").collect());
    expect(left).toHaveLength(0);
  });
});
