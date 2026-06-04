import { Presence } from "@convex-dev/presence";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  mutation,
  type QueryCtx,
} from "./_generated/server";
import {
  AWAY_GRACE_MS,
  GRACE_MS,
  MATCH_START_GRACE_MS,
  PRESENCE_HEARTBEAT_MS,
  RECONCILE_MS,
  SECOND,
} from "./constants";
import { limitGlobal } from "./lib/rateLimits";
import { sessionMutation } from "./lib/sessions";

// Room = matchId, user = sessionId. The component tracks online/offline via
// heartbeats with graceful disconnect on real departure (unmount/pagehide); we
// read it back server-side to power partner status and abandonment teardown.
export const presence = new Presence(components.presence);

/** The interval drives the component's offline timeout (2.5x), so an
 *  arbitrary client value could keep a departed session online for hours. */
export function clampHeartbeatInterval(interval: number): number {
  return Math.min(Math.max(interval, SECOND), PRESENCE_HEARTBEAT_MS);
}

export const heartbeat = sessionMutation({
  args: {
    roomId: v.string(),
    // Per-tab presence session id (the component's "sessionId"); distinct from
    // the authenticated chat sessionId, which becomes the room's userId.
    presenceId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, { roomId, presenceId, interval }) => {
    await limitGlobal(ctx, "globalPresenceHeartbeat");
    // Only a match participant may heartbeat into its room: presence keeps the
    // match alive, so an unauthenticated spoof could hold a departed partner
    // "online". Gone/foreign rooms no-op (teardown races, not errors).
    const matchId = ctx.db.normalizeId("matches", roomId);
    if (!matchId) return null;
    const match = await ctx.db.get(matchId);
    if (!match || (match.a !== ctx.sessionId && match.b !== ctx.sessionId)) {
      return null;
    }
    return await presence.heartbeat(
      ctx,
      roomId,
      ctx.sessionId,
      presenceId,
      clampHeartbeatInterval(interval),
    );
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    // Called over http from sendBeacon on pagehide — no auth context here; the
    // token itself is the capability (issued by heartbeat to this client only).
    return await presence.disconnect(ctx, sessionToken);
  },
});

/** A member's presence in the match room: `online` is the live-heartbeat flag
 *  (drops within ~2.5x the heartbeat interval for a stale tab); `joined`
 *  distinguishes "never connected yet" from "was here and left", which is what
 *  separates a connecting partner from an away one. Fails open (online) so a
 *  transient component error never degrades a live match. */
export async function memberPresence(
  ctx: QueryCtx | MutationCtx,
  matchId: string,
  sessionId: string,
): Promise<{ online: boolean; joined: boolean }> {
  try {
    const members = await presence.listRoom(ctx, matchId, false);
    const m = members.find((x) => x.userId === sessionId);
    return { online: Boolean(m?.online), joined: Boolean(m) };
  } catch {
    return { online: true, joined: true };
  }
}

export interface MatchLiveness {
  aOnline: boolean;
  bOnline: boolean;
  /** Both sides have held a heartbeat in the room at some point (not
   *  necessarily simultaneously) — the latch condition for the away grace. */
  bothJoined: boolean;
  /** Longest continuous absence across the two sides; 0 when both online. */
  maxAbsentMs: number;
}

/** Presence-room liveness for a match's participants. A side that joined and
 *  left is absent since the component marked its disconnect; a side that never
 *  joined is absent since the match was created. Returns null when the
 *  component read fails — callers must treat that as "all live" so a transient
 *  presence error never tears down a real conversation. */
export async function matchLiveness(
  ctx: QueryCtx | MutationCtx,
  match: Doc<"matches">,
): Promise<MatchLiveness | null> {
  let members: { userId: string; online: boolean; lastDisconnected: number }[];
  try {
    members = await presence.listRoom(ctx, match._id, false);
  } catch {
    return null;
  }
  const now = Date.now();
  const aMember = members.find((m) => m.userId === match.a);
  const bMember = members.find((m) => m.userId === match.b);
  // Online comes from the component's flag, never from absence math — a side
  // disconnected within the same millisecond must read offline-with-0ms-absence
  // (the away grace's job), not online.
  const absentFor = (m: (typeof members)[number] | undefined) => {
    if (m?.online) return 0;
    return now - (m?.lastDisconnected ?? match.createdAt);
  };
  return {
    aOnline: Boolean(aMember?.online),
    bOnline: Boolean(bMember?.online),
    bothJoined: Boolean(aMember && bMember),
    maxAbsentMs: Math.max(absentFor(aMember), absentFor(bMember)),
  };
}

/** Periodic abandonment check, with two layered graces so a live conversation
 *  is never torn down over a transient gap:
 *
 *  Start grace: a brand-new match is NOT ended before both clients have had a
 *  realistic chance to mount presence and heartbeat. Once both peers have held
 *  a heartbeat in the room (not necessarily simultaneously) we latch
 *  `bothEverPresent`; a partner who NEVER connects is cut at the start-grace
 *  boundary (they aren't coming back).
 *
 *  Away grace: after the latch, a side must be continuously absent past
 *  AWAY_GRACE_MS before teardown — app switches, screen locks, and network
 *  blips disconnect presence without the person actually leaving. While inside
 *  the grace the survivor's snapshot shows the partner as "away". */
export const reconcile = internalMutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, { matchId }) => {
    const match = await ctx.db.get(matchId);
    if (match?.status !== "active") return; // already ended/gone

    const rearm = () =>
      ctx.scheduler.runAfter(RECONCILE_MS, internal.presence.reconcile, {
        matchId,
      });

    const liveness = await matchLiveness(ctx, match);
    if (!liveness) {
      await rearm(); // presence read failed — fail open, re-check next tick
      return;
    }

    // Latch on "both have joined at some point", not "both online at this
    // tick": a peer who connects then blips out between ticks must still earn
    // the away grace, or they'd be cut at the start-grace boundary.
    const latched = match.bothEverPresent || liveness.bothJoined;
    if (latched && !match.bothEverPresent) {
      await ctx.db.patch(matchId, { bothEverPresent: true });
    }

    if (liveness.aOnline && liveness.bOnline) {
      await rearm();
      return;
    }

    if (!latched) {
      if (Date.now() - match.createdAt < MATCH_START_GRACE_MS) {
        await rearm();
        return;
      }
      // Past the start grace with a side that never connected: dead on arrival.
    } else if (liveness.maxAbsentMs <= AWAY_GRACE_MS) {
      await rearm();
      return;
    }

    // Mark ended (partner-left) but keep both sessions attached so the
    // survivor's snapshot shows the overlay within a reconcile cadence; the
    // grace-delete (deleteMatch) detaches + hard-deletes after GRACE_MS,
    // mirroring `chat.leave`.
    await ctx.db.patch(matchId, {
      status: "ended",
      endedReason: "partner-left",
      endedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(GRACE_MS, internal.cleanup.deleteMatch, {
      matchId,
    });
  },
});
