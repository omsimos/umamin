import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
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
