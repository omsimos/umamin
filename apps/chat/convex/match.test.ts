import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// import.meta.glob lets convex-test find all function modules.
const modules = import.meta.glob("./**/*.ts");

function self(id: string) {
  return { sessionId: id, alias: id, avatarSeed: id, interests: ["music"] };
}

describe("matchmaking", () => {
  it("queues the first user (no partner yet)", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    const snap = await t.query(api.chat.snapshot, { sessionId: "a" });
    expect(snap.phase).toBe("matching");
  });

  it("pairs two users who share an interest into one match", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    await t.mutation(api.match.enqueueAndMatch, self("b"));
    const a = await t.query(api.chat.snapshot, { sessionId: "a" });
    const b = await t.query(api.chat.snapshot, { sessionId: "b" });
    expect(a.phase).toBe("active");
    expect(b.phase).toBe("active");
    expect(a.matchId).toBe(b.matchId);
    expect(a.partner?.alias).toBe("b");
  });

  it("does not double-match a third user to an already-claimed partner", async () => {
    const t = convexTest(schema, modules);
    registerRateLimiter(t);
    await t.mutation(api.match.enqueueAndMatch, self("a"));
    await t.mutation(api.match.enqueueAndMatch, self("b")); // a<->b
    await t.mutation(api.match.enqueueAndMatch, self("c")); // c waits
    const c = await t.query(api.chat.snapshot, { sessionId: "c" });
    expect(c.phase).toBe("matching");
  });
});
