import { register as registerPresence } from "@convex-dev/presence/test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const self = (id: string) => ({
  sessionId: id,
  sessionSecret: `${id}-secret`,
  alias: id,
  avatarSeed: id,
  interests: ["music"],
});
const auth = (id: string) => ({ sessionId: id, sessionSecret: `${id}-secret` });

async function matched() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  registerPresence(t);
  await t.mutation(api.match.enqueueAndMatch, self("a"));
  await t.mutation(api.match.enqueueAndMatch, self("b"));
  const a = await t.query(api.chat.snapshot, auth("a"));
  return { t, matchId: a.matchId as string };
}

// A heartbeat in the match room marks the user present for reconcile/snapshot.
async function beat(
  t: Awaited<ReturnType<typeof matched>>["t"],
  matchId: string,
  userId: string,
) {
  return await t.mutation(api.presence.heartbeat, {
    roomId: matchId,
    userId,
    sessionId: `${userId}-tab`,
    interval: 10000,
  });
}

// Push the match's createdAt into the past so it's no longer within the
// start-grace window that protects freshly-paired matches from teardown.
async function ageMatchPastStartGrace(
  t: Awaited<ReturnType<typeof matched>>["t"],
) {
  await t.run(async (ctx) => {
    const m = await ctx.db.query("matches").first();
    if (m) await ctx.db.patch(m._id, { createdAt: 1 });
  });
}

describe("presence", () => {
  it("partner shows online once both have a heartbeat in the room", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a");
    await beat(t, matchId, "b");
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.partner?.status).toBe("online");
  });

  it("partner shows left when they have no heartbeat in the room", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a");
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.partner?.status).toBe("left");
  });

  it("reconcile keeps the match active while both are present", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a");
    await beat(t, matchId, "b");
    await t.mutation(internal.presence.reconcile, {
      matchId: matchId as never,
    });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.phase).toBe("active");
  });

  it("does not end a fresh match before a slow partner has established presence", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a"); // `b` hasn't connected yet; match is brand new
    await t.mutation(internal.presence.reconcile, {
      matchId: matchId as never,
    });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.phase).toBe("active");
  });

  it("reconcile ends the match (partner-left) once a never-present partner exceeds the start grace", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a");
    await ageMatchPastStartGrace(t);
    await t.mutation(internal.presence.reconcile, {
      matchId: matchId as never,
    });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.phase).toBe("ended");
    expect(a.endedReason).toBe("partner-left");
    expect(a.partner?.status).toBe("left");
  });

  it("ends the match if a partner leaves after both were present, even within the start grace", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a");
    const bBeat = await beat(t, matchId, "b");
    // First reconcile sees both live and latches bothEverPresent.
    await t.mutation(internal.presence.reconcile, {
      matchId: matchId as never,
    });
    expect((await t.query(api.chat.snapshot, auth("a"))).phase).toBe("active");
    // `b` disconnects (tab close) while the match is still young.
    await t.mutation(api.presence.disconnect, {
      sessionToken: bBeat.sessionToken,
    });
    await t.mutation(internal.presence.reconcile, {
      matchId: matchId as never,
    });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.phase).toBe("ended");
    expect(a.endedReason).toBe("partner-left");
  });
});
