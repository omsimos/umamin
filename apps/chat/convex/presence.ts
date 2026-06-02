import { Presence } from "@convex-dev/presence";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import {
  internalMutation,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { GRACE_MS, RECONCILE_MS } from "./constants";

// Room = matchId, user = sessionId. The component tracks online/offline via
// heartbeats with graceful tab-close disconnect; we read it back server-side to
// power partner status and abandonment teardown.
export const presence = new Presence(components.presence);

export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    return await presence.heartbeat(ctx, roomId, userId, sessionId, interval);
  },
});

export const list = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => {
    // Avoid per-user reads so all subscriptions share one cache.
    return await presence.list(ctx, roomToken);
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    // Called over http from sendBeacon on tab close — no auth context here.
    return await presence.disconnect(ctx, sessionToken);
  },
});

/** Carries the per-user typing flag through the presence room's `data` channel
 *  so the partner's live `list` subscription renders the indicator. */
export const setTyping = mutation({
  args: { roomId: v.string(), userId: v.string(), typing: v.boolean() },
  handler: async (ctx, { roomId, userId, typing }) => {
    await presence.updateRoomUser(ctx, roomId, userId, { typing });
  },
});

/** True when `sessionId` currently holds a live heartbeat in the match room.
 *  Reads the component's room presence (online-only) so a stale/closed tab
 *  drops out within ~2.5x the heartbeat interval. Defaults to online if the
 *  read fails so a transient presence error never tears down a live match. */
export async function isPresent(
  ctx: QueryCtx | MutationCtx,
  matchId: string,
  sessionId: string,
): Promise<boolean> {
  try {
    const members = await presence.listRoom(ctx, matchId, true);
    return members.some((m) => m.userId === sessionId && m.online);
  } catch {
    return true;
  }
}

/** Periodic abandonment check: if a participant's heartbeat has gone stale, end
 *  the match (partner-left) so the survivor's snapshot shows the overlay within
 *  seconds, and schedule the hard-delete. Re-arms while both are present. */
export const reconcile = internalMutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, { matchId }) => {
    const match = await ctx.db.get(matchId);
    if (!match || match.status !== "active") return; // already ended/gone

    const aLive = await isPresent(ctx, matchId, match.a);
    const bLive = await isPresent(ctx, matchId, match.b);
    if (!aLive || !bLive) {
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
      return;
    }

    await ctx.scheduler.runAfter(RECONCILE_MS, internal.presence.reconcile, {
      matchId,
    });
  },
});
