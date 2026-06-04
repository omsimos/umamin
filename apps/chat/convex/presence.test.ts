import { register as registerPresence } from "@convex-dev/presence/test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { AWAY_GRACE_MS, PRESENCE_HEARTBEAT_MS, SECOND } from "./constants";
import { clampHeartbeatInterval, presence } from "./presence";
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
    ...auth(userId),
    roomId: matchId,
    presenceId: `${userId}-tab`,
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("presence", () => {
  it("partner shows online once both have a heartbeat in the room", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a");
    await beat(t, matchId, "b");
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.partner?.status).toBe("online");
  });

  it("partner shows online (connecting) while they have never joined a fresh match", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a"); // `b` is still mounting presence
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.partner?.status).toBe("online");
    expect(a.phase).toBe("active");
  });

  it("partner shows away once they joined and lost their heartbeat", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a");
    const bBeat = await beat(t, matchId, "b");
    await t.mutation(api.presence.disconnect, {
      sessionToken: bBeat?.sessionToken as string,
    });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.partner?.status).toBe("away");
    expect(a.phase).toBe("active");
  });

  it("clamps the client-supplied heartbeat interval (abuse guard)", () => {
    expect(clampHeartbeatInterval(10_000_000)).toBe(PRESENCE_HEARTBEAT_MS);
    expect(clampHeartbeatInterval(0)).toBe(SECOND);
    expect(clampHeartbeatInterval(10_000)).toBe(10_000);
  });

  it("ignores a heartbeat into a match the session is not part of", async () => {
    const { t, matchId } = await matched();
    const result = await t.mutation(api.presence.heartbeat, {
      ...auth("c"),
      roomId: matchId,
      presenceId: "c-tab",
      interval: 10000,
    });
    expect(result).toBeNull();
    const room = await t.run((ctx) => presence.listRoom(ctx, matchId, false));
    expect(room.find((m) => m.userId === "c")).toBeUndefined();
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

  it("keeps the match active through a brief disconnect (away grace)", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a");
    const bBeat = await beat(t, matchId, "b");
    // First reconcile sees both live and latches bothEverPresent.
    await t.mutation(internal.presence.reconcile, {
      matchId: matchId as never,
    });
    // `b` disconnects (app switch / screen lock)…
    await t.mutation(api.presence.disconnect, {
      sessionToken: bBeat?.sessionToken as string,
    });
    // …and reconcile observes a real mid-grace absence. The forced clock makes
    // the absence unambiguously non-zero, so this pins the grace branch itself:
    // without it the absent side would be torn down here.
    const base = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(base + AWAY_GRACE_MS / 2);
    await t.mutation(internal.presence.reconcile, {
      matchId: matchId as never,
    });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.phase).toBe("active");
    expect(a.partner?.status).toBe("away");
  });

  it("ends the match (partner-left) once a disconnect outlasts the away grace", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a");
    const bBeat = await beat(t, matchId, "b");
    await t.mutation(internal.presence.reconcile, {
      matchId: matchId as never,
    });
    await t.mutation(api.presence.disconnect, {
      sessionToken: bBeat?.sessionToken as string,
    });
    // Reconcile observes the absence only after the grace has fully elapsed.
    const base = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(base + AWAY_GRACE_MS + 1000);
    await t.mutation(internal.presence.reconcile, {
      matchId: matchId as never,
    });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.phase).toBe("ended");
    expect(a.endedReason).toBe("partner-left");
  });

  it("grants the away grace to a peer who joined but was never online at the same tick", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a");
    const bBeat = await beat(t, matchId, "b");
    // `b` drops before any reconcile observed both online simultaneously…
    await t.mutation(api.presence.disconnect, {
      sessionToken: bBeat?.sessionToken as string,
    });
    await ageMatchPastStartGrace(t);
    // …yet reconcile latches on "both joined" and applies the away grace
    // instead of cutting them at the start-grace boundary.
    await t.mutation(internal.presence.reconcile, {
      matchId: matchId as never,
    });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.phase).toBe("active");
    expect(a.partner?.status).toBe("away");
  });

  it("a returning partner clears the away grace instead of accruing it", async () => {
    const { t, matchId } = await matched();
    await beat(t, matchId, "a");
    const bBeat = await beat(t, matchId, "b");
    await t.mutation(internal.presence.reconcile, {
      matchId: matchId as never,
    });
    await t.mutation(api.presence.disconnect, {
      sessionToken: bBeat?.sessionToken as string,
    });
    // `b` comes back before the grace runs out…
    await beat(t, matchId, "b");
    // …so even a reconcile far in the future sees them live, not abandoned.
    const base = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(base + AWAY_GRACE_MS + 1000);
    await t.mutation(internal.presence.reconcile, {
      matchId: matchId as never,
    });
    const a = await t.query(api.chat.snapshot, auth("a"));
    expect(a.phase).toBe("active");
  });
});
