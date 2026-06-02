import { register as registerPresence } from "@convex-dev/presence/test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import { presence } from "./presence";
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
    registerPresence(t);
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    await t.mutation(api.match.enqueueAndMatch, self("b"));
    await t.mutation(api.chat.send, { sessionId: "a", text: "hi" });
    const a = await t.query(api.chat.snapshot, { sessionId: "a" });
    const matchId = a.matchId as string;
    // Heartbeat so the presence component holds rows keyed on this match.
    await t.mutation(api.presence.heartbeat, {
      roomId: matchId,
      userId: "a",
      sessionId: "a-tab",
      interval: 10000,
    });
    await t.mutation(internal.cleanup.deleteMatch, {
      matchId: matchId as never,
    });
    const after = await t.query(api.chat.snapshot, { sessionId: "a" });
    expect(after.phase).toBe("idle");
    const msgs = await t.run(async (ctx) => ctx.db.query("messages").collect());
    expect(msgs).toHaveLength(0);
    // The presence room is torn down — no leaked component rows.
    const room = await t.run((ctx) => presence.listRoom(ctx, matchId, false));
    expect(room).toHaveLength(0);
  });

  it("sweepEndedMatches detaches the survivor so sweepDeadSessions can reclaim it", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    registerPresence(t);
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    await t.mutation(api.match.enqueueAndMatch, self("b"));
    // a leaves (detached); b is the survivor (still attached to the match).
    await t.mutation(api.chat.leave, { sessionId: "a" });

    // Age the ended match past GRACE and b's session past TTL.
    await t.run(async (ctx) => {
      const match = await ctx.db
        .query("matches")
        .withIndex("by_status_endedAt", (q) => q.eq("status", "ended"))
        .unique();
      if (match) await ctx.db.patch(match._id, { endedAt: 1 });
      const b = await ctx.db
        .query("sessions")
        .withIndex("by_session", (q) => q.eq("sessionId", "b"))
        .unique();
      if (b) await ctx.db.patch(b._id, { lastSeen: 1 });
    });

    await t.mutation(internal.cleanup.sweepEndedMatches, {});

    // The match is gone and b is no longer dangling at it.
    const b = await t.run(async (ctx) =>
      ctx.db
        .query("sessions")
        .withIndex("by_session", (q) => q.eq("sessionId", "b"))
        .unique(),
    );
    expect(b?.currentMatchId).toBeUndefined();

    await t.mutation(internal.cleanup.sweepDeadSessions, {});
    const leftover = await t.run(async (ctx) =>
      ctx.db
        .query("sessions")
        .withIndex("by_session", (q) => q.eq("sessionId", "b"))
        .unique(),
    );
    expect(leftover).toBeNull();
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
