import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function self(id: string) {
  return {
    sessionId: id,
    sessionSecret: `${id}-secret`,
    alias: id,
    avatarSeed: id,
    interests: ["music"],
  };
}
const auth = (id: string) => ({ sessionId: id, sessionSecret: `${id}-secret` });

describe("matchmaking", () => {
  it("queues the first user (no partner yet)", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    const snap = await t.query(api.chat.snapshot, auth("a"));
    expect(snap.phase).toBe("matching");
  });

  it("pairs two users who share an interest into one match", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    await t.mutation(api.match.enqueueAndMatch, self("b"));
    const a = await t.query(api.chat.snapshot, auth("a"));
    const b = await t.query(api.chat.snapshot, auth("b"));
    expect(a.phase).toBe("active");
    expect(b.phase).toBe("active");
    expect(a.matchId).toBe(b.matchId);
    expect(a.partner?.alias).toBe("b");
  });

  it("does not double-match a third user to an already-claimed partner", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    await t.mutation(api.match.enqueueAndMatch, self("b"));
    await t.mutation(api.match.enqueueAndMatch, self("c"));
    const c = await t.query(api.chat.snapshot, auth("c"));
    expect(c.phase).toBe("matching");
  });

  it("leave dequeues a waiting user (radar cancel) so they are not claimable", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    await t.mutation(api.chat.leave, auth("a"));
    const snap = await t.query(api.chat.snapshot, auth("a"));
    expect(snap.phase).toBe("idle");
    const rows = await t.run((ctx) => ctx.db.query("queue").collect());
    expect(rows).toHaveLength(0);
  });

  it("does not claim a queuer whose liveness ping has gone stale", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    await t.run(async (ctx) => {
      const row = await ctx.db.query("queue").first();
      if (row) await ctx.db.patch(row._id, { lastPingAt: 1 });
    });
    await t.mutation(api.match.enqueueAndMatch, self("b"));
    const b = await t.query(api.chat.snapshot, auth("b"));
    expect(b.phase).toBe("matching");
    // The stale row is skipped, not deleted — pings can revive it.
    const rows = await t.run((ctx) => ctx.db.query("queue").collect());
    expect(rows).toHaveLength(2);
  });

  it("stillWaiting refreshes a stale queue row so it becomes claimable again", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    await t.run(async (ctx) => {
      const row = await ctx.db.query("queue").first();
      if (row) await ctx.db.patch(row._id, { lastPingAt: 1 });
    });
    await t.mutation(api.match.stillWaiting, auth("a"));
    await t.mutation(api.match.enqueueAndMatch, self("b"));
    const b = await t.query(api.chat.snapshot, auth("b"));
    expect(b.phase).toBe("active");
    expect(b.partner?.alias).toBe("a");
  });

  it("fallbackPair also skips stale queuers on the timeout path", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    await t.run(async (ctx) => {
      const row = await ctx.db.query("queue").first();
      if (row) await ctx.db.patch(row._id, { lastPingAt: 1 });
    });
    // No shared interest, so `b` queues and relies on the fallback timer.
    await t.mutation(api.match.enqueueAndMatch, {
      ...self("b"),
      interests: ["movies"],
    });
    await t.mutation(internal.match.fallbackPair, { sessionId: "b" });
    expect((await t.query(api.chat.snapshot, auth("b"))).phase).toBe(
      "matching",
    );
    // Once `a` pings again, the same fallback pairs them.
    await t.mutation(api.match.stillWaiting, auth("a"));
    await t.mutation(internal.match.fallbackPair, { sessionId: "b" });
    expect((await t.query(api.chat.snapshot, auth("b"))).phase).toBe("active");
  });

  it("claims pre-deploy queue rows (no lastPingAt) while their enqueuedAt is fresh", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("sessions", {
        sessionId: "old",
        sessionSecret: "old-secret",
        alias: "old",
        avatarSeed: "old",
        interests: ["music"],
        lastSeen: Date.now(),
      });
      await ctx.db.insert("queue", {
        sessionId: "old",
        interests: ["music"],
        enqueuedAt: Date.now(),
      });
    });
    await t.mutation(api.match.enqueueAndMatch, self("b"));
    const b = await t.query(api.chat.snapshot, auth("b"));
    expect(b.phase).toBe("active");
    expect(b.partner?.alias).toBe("old");
  });

  it("normalizes identity before storing and queueing", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await t.mutation(api.match.enqueueAndMatch, {
      sessionId: "a",
      sessionSecret: "a-secret",
      alias: "  ",
      avatarSeed: " seed ",
      interests: [" music ", "music", " "],
    });
    const session = await t.run((ctx) =>
      ctx.db
        .query("sessions")
        .withIndex("by_session", (q) => q.eq("sessionId", "a"))
        .unique(),
    );
    expect(session).toMatchObject({
      alias: "Anonymous",
      avatarSeed: "seed",
      interests: ["music"],
    });
  });
});
