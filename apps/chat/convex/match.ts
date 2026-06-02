import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import {
  FALLBACK_MS,
  GRACE_MS,
  MAX_ALIAS_LEN,
  MAX_AVATAR_SEED_LEN,
  MAX_INTERESTS,
  RECONCILE_MS,
} from "./constants";
import { limitPerSession } from "./lib/rateLimits";
import { sessionMutation } from "./lib/sessions";

async function getSession(ctx: MutationCtx, sessionId: string) {
  return ctx.db
    .query("sessions")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .unique();
}

async function pair(
  ctx: MutationCtx,
  aSessionId: string,
  bRow: Doc<"queue">,
  shared: string[],
): Promise<Id<"matches">> {
  await ctx.db.delete(bRow._id);
  const now = Date.now();
  const matchId = await ctx.db.insert("matches", {
    a: aSessionId,
    b: bRow.sessionId,
    interestsShared: shared,
    stayConnectedA: false,
    stayConnectedB: false,
    typingA: false,
    typingB: false,
    bothEverPresent: false,
    status: "active" as const,
    createdAt: now,
  });
  for (const sid of [aSessionId, bRow.sessionId]) {
    const s = await getSession(ctx, sid);
    if (s) await ctx.db.patch(s._id, { currentMatchId: matchId });
  }
  await ctx.scheduler.runAfter(RECONCILE_MS, internal.presence.reconcile, {
    matchId,
  });
  return matchId;
}

export const enqueueAndMatch = sessionMutation({
  args: {
    alias: v.string(),
    avatarSeed: v.string(),
    interests: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // The lobby bounds these, but this mutation is publicly callable.
    if (
      args.alias.length > MAX_ALIAS_LEN ||
      args.avatarSeed.length > MAX_AVATAR_SEED_LEN ||
      args.interests.length > MAX_INTERESTS
    ) {
      throw new ConvexError("Invalid identity.");
    }
    await limitPerSession(ctx, "findMatch", ctx.sessionId);
    const now = Date.now();

    // End any still-active match before re-queueing so the partner gets a clean
    // partner-left and the old match becomes GC-eligible, rather than being
    // silently abandoned (orphaned active matches have no cron backstop).
    if (ctx.session?.currentMatchId) {
      const prev = await ctx.db.get(ctx.session.currentMatchId);
      if (prev && prev.status === "active") {
        await ctx.db.patch(prev._id, {
          status: "ended",
          endedReason: "partner-left",
          endedAt: now,
        });
        await ctx.scheduler.runAfter(GRACE_MS, internal.cleanup.deleteMatch, {
          matchId: prev._id,
        });
      }
    }

    // Upsert session, detached from any prior match.
    if (ctx.session) {
      await ctx.db.patch(ctx.session._id, {
        alias: args.alias,
        avatarSeed: args.avatarSeed,
        interests: args.interests,
        lastSeen: now,
        currentMatchId: undefined,
      });
    } else {
      await ctx.db.insert("sessions", {
        sessionId: ctx.sessionId,
        alias: args.alias,
        avatarSeed: args.avatarSeed,
        interests: args.interests,
        lastSeen: now,
      });
    }

    // Drop any stale queue row for this session.
    const mine = await ctx.db
      .query("queue")
      .withIndex("by_session", (q) => q.eq("sessionId", ctx.sessionId))
      .unique();
    if (mine) await ctx.db.delete(mine._id);

    // Interest-preferred claim over the oldest waiting (bounded — no full scan).
    const waiting = await ctx.db
      .query("queue")
      .withIndex("by_enqueuedAt")
      .order("asc")
      .take(50);
    const others = waiting.filter((q) => q.sessionId !== ctx.sessionId);
    const overlap = (q: { interests: string[] }) =>
      q.interests.filter((i) => args.interests.includes(i));
    const partner = others.find((q) => overlap(q).length > 0);
    if (partner) {
      await pair(ctx, ctx.sessionId, partner, overlap(partner));
      return;
    }

    // None sharing interests: enqueue + schedule a fallback to pair with anyone.
    await ctx.db.insert("queue", {
      sessionId: ctx.sessionId,
      interests: args.interests,
      enqueuedAt: now,
    });
    await ctx.scheduler.runAfter(FALLBACK_MS, internal.match.fallbackPair, {
      sessionId: ctx.sessionId,
    });
  },
});

export const fallbackPair = internalMutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const mine = await ctx.db
      .query("queue")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (!mine) return; // already matched or gone
    const waiting = await ctx.db
      .query("queue")
      .withIndex("by_enqueuedAt")
      .order("asc")
      .take(50);
    const partner = waiting.find((q) => q.sessionId !== sessionId);
    if (!partner) return; // still nobody — keep waiting
    await ctx.db.delete(mine._id);
    const shared = mine.interests.filter((i) => partner.interests.includes(i));
    await pair(ctx, sessionId, partner, shared);
  },
});
