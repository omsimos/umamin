import { register as registerPresence } from "@convex-dev/presence/test";
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

async function matched() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  registerPresence(t);
  await t.mutation(api.match.enqueueAndMatch, self("a"));
  await t.mutation(api.match.enqueueAndMatch, self("b"));
  const a = await t.query(api.chat.snapshot, { sessionId: "a" });
  return { t, matchId: a.matchId as string };
}

// A heartbeat in the match room marks the user present for reconcile/snapshot.
async function beat(
  t: Awaited<ReturnType<typeof matched>>["t"],
  matchId: string,
  userId: string,
) {
  await t.mutation(api.presence.heartbeat, {
    roomId: matchId,
    userId,
    sessionId: `${userId}-tab`,
    interval: 10000,
  });
}

describe("presence", () => {
  it("partner shows online once both have a heartbeat in the room", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a");
    await beat(t, matchId, "b");
    const a = await t.query(api.chat.snapshot, { sessionId: "a" });
    expect(a.partner?.status).toBe("online");
  });

  it("partner shows left when they have no heartbeat in the room", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a"); // only `a` is present
    const a = await t.query(api.chat.snapshot, { sessionId: "a" });
    expect(a.partner?.status).toBe("left");
  });

  it("reconcile keeps the match active while both are present", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a");
    await beat(t, matchId, "b");
    await t.mutation(internal.presence.reconcile, {
      matchId: matchId as never,
    });
    const a = await t.query(api.chat.snapshot, { sessionId: "a" });
    expect(a.phase).toBe("active");
  });

  it("reconcile ends the match (partner-left) when a participant is absent", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a"); // `b` never heartbeats — abandoned
    await t.mutation(internal.presence.reconcile, {
      matchId: matchId as never,
    });
    const a = await t.query(api.chat.snapshot, { sessionId: "a" });
    expect(a.phase).toBe("ended");
    expect(a.endedReason).toBe("partner-left");
    expect(a.partner?.status).toBe("left");
  });
});
