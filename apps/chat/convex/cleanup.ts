import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { GRACE_MS, MAX_QUEUE_WAIT_MS, SESSION_TTL_MS } from "./constants";
import { presence } from "./presence";

export const deleteMatch = internalMutation({
  args: { matchId: v.id("matches") },
  handler: async (ctx, { matchId }) => {
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .collect();
    for (const m of msgs) await ctx.db.delete(m._id);
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

// The message-delete loop above runs whether or not the match doc still
// exists, so an orphaned-message sweep is covered by the grace delete itself.

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
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_match", (q) => q.eq("matchId", m._id))
        .collect();
      for (const msg of msgs) await ctx.db.delete(msg._id);
      // Detach any sessions still pointing here before deleting the match;
      // otherwise sweepDeadSessions can never reclaim them (it skips rows with
      // a currentMatchId, which would now dangle at a deleted match).
      for (const sessionId of [m.a, m.b]) {
        const s = await ctx.db
          .query("sessions")
          .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
          .unique();
        if (s?.currentMatchId === m._id)
          await ctx.db.patch(s._id, { currentMatchId: undefined });
      }
      await ctx.db.delete(m._id);
      // Tear down the presence room alongside the match (see deleteMatch).
      await presence.removeRoom(ctx, m._id);
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
