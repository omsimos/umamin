import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import {
  GRACE_MS,
  MAX_QUEUE_WAIT_MS,
  MESSAGE_DELETE_PAGE,
  SESSION_TTL_MS,
} from "./constants";
import { presence } from "./presence";

export const deleteMatch = internalMutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, { matchId }) => {
    // Delete messages a page at a time so a long match can't exceed a single
    // mutation's write limit; re-arm until a short (final) page, then tear the
    // match + presence room down. Idempotent — re-runs on an already-gone match
    // delete nothing and no-op removeRoom.
    const page = await ctx.db
      .query("messages")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .take(MESSAGE_DELETE_PAGE);
    for (const m of page) await ctx.db.delete(m._id);
    if (page.length === MESSAGE_DELETE_PAGE) {
      await ctx.scheduler.runAfter(0, internal.cleanup.deleteMatch, {
        matchId,
      });
      return;
    }
    const match = await ctx.db.get(matchId);
    if (match) {
      // Detach any sessions still pointing here (defensive).
      for (const sessionId of [match.a, match.b]) {
        const s = await ctx.db
          .query("sessions")
          .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
          .unique();
        if (s?.currentMatchId === matchId)
          await ctx.db.patch(s._id, { currentMatchId: undefined });
      }
      await ctx.db.delete(matchId);
    }
    // Tear down the presence room (room/roomTokens/sessionTokens) keyed on this
    // match so the component's tables don't accumulate orphaned rows per match.
    await presence.removeRoom(ctx, matchId);
  },
});

export const sweepEndedMatches = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - GRACE_MS;
    const stale = await ctx.db
      .query("matches")
      .withIndex("by_status_endedAt", (q) =>
        q.eq("status", "ended").lt("endedAt", cutoff),
      )
      .take(100);
    for (const m of stale) {
      // Detach the sessions now so sweepDeadSessions can reclaim them on its
      // next pass, then delegate the paged message + match + room teardown to
      // deleteMatch in its own transaction — so one oversized or failing match
      // can't block the rest of the batch, and a dropped teardown is retried on
      // the next sweep (the match stays "ended" until deleteMatch removes it).
      for (const sessionId of [m.a, m.b]) {
        const s = await ctx.db
          .query("sessions")
          .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
          .unique();
        if (s?.currentMatchId === m._id)
          await ctx.db.patch(s._id, { currentMatchId: undefined });
      }
      await ctx.scheduler.runAfter(0, internal.cleanup.deleteMatch, {
        matchId: m._id,
      });
    }
  },
});

export const sweepStaleQueue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - MAX_QUEUE_WAIT_MS;
    const stale = await ctx.db
      .query("queue")
      .withIndex("by_enqueuedAt", (q) => q.lt("enqueuedAt", cutoff))
      .take(100);
    for (const q of stale) await ctx.db.delete(q._id);
  },
});

export const sweepDeadSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - SESSION_TTL_MS;
    const dead = await ctx.db
      .query("sessions")
      .withIndex("by_lastSeen", (q) => q.lt("lastSeen", cutoff))
      .take(100);
    for (const s of dead) {
      // Sessions still attached to a match are reclaimed once that match is
      // detached (deleteMatch / sweepEndedMatches clear currentMatchId first).
      if (!s.currentMatchId) await ctx.db.delete(s._id);
    }
  },
});
