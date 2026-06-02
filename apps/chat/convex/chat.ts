import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { GRACE_MS, MESSAGE_CAP } from "./constants";
import { limitPerSession } from "./lib/rateLimits";
import { sessionMutation, sessionQuery } from "./lib/sessions";

const EMPTY = {
  phase: "idle" as const,
  matchId: "",
  self: { alias: "", avatarSeed: "", interests: [] as string[] },
  partner: null,
  messages: [],
  stayConnected: { self: false, partner: false },
};

export const snapshot = sessionQuery({
  args: {},
  handler: async (ctx) => {
    const session = ctx.session;
    if (!session) return EMPTY;
    const self = {
      alias: session.alias,
      avatarSeed: session.avatarSeed,
      interests: session.interests,
    };

    if (!session.currentMatchId) {
      // matching if queued, else idle.
      const queued = await ctx.db
        .query("queue")
        .withIndex("by_session", (q) => q.eq("sessionId", ctx.sessionId))
        .unique();
      return {
        ...EMPTY,
        self,
        phase: queued ? ("matching" as const) : ("idle" as const),
      };
    }

    const match = await ctx.db.get(session.currentMatchId);
    if (!match) return { ...EMPTY, self };

    const iAmA = match.a === ctx.sessionId;
    const partnerId = iAmA ? match.b : match.a;
    const partnerSession = await ctx.db
      .query("sessions")
      .withIndex("by_session", (q) => q.eq("sessionId", partnerId))
      .unique();

    const ended = match.status === "ended";
    // Task 8 refines this to a presence read (+ "typing").
    const partnerOnline = !ended;
    const status =
      ended || !partnerOnline ? ("left" as const) : ("online" as const);

    const rows = await ctx.db
      .query("messages")
      .withIndex("by_match", (q) => q.eq("matchId", match._id))
      .order("asc")
      .take(MESSAGE_CAP);
    const messages = rows.map((m) => ({
      id: m._id,
      author:
        m.author === ctx.sessionId ? ("self" as const) : ("partner" as const),
      text: m.text,
      ts: m._creationTime,
      reactions: m.reactions,
    }));

    return {
      phase: ended ? ("ended" as const) : ("active" as const),
      matchId: match._id,
      self,
      partner: partnerSession
        ? {
            alias: partnerSession.alias,
            avatarSeed: partnerSession.avatarSeed,
            sharedInterests: match.interestsShared,
            status,
          }
        : null,
      messages,
      stayConnected: {
        self: iAmA ? match.stayConnectedA : match.stayConnectedB,
        partner: iAmA ? match.stayConnectedB : match.stayConnectedA,
      },
      ...(ended
        ? { endedReason: match.endedReason ?? ("partner-left" as const) }
        : {}),
    };
  },
});

async function activeMatchFor(
  ctx: MutationCtx,
  session: Doc<"sessions"> | null,
): Promise<Doc<"matches"> | null> {
  if (!session?.currentMatchId) return null;
  const m = await ctx.db.get(session.currentMatchId);
  return m && m.status === "active" ? m : null;
}

export const send = sessionMutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const match = await activeMatchFor(ctx, ctx.session);
    if (!match) return;
    await limitPerSession(ctx, "sendMessage", ctx.sessionId);
    await ctx.db.insert("messages", {
      matchId: match._id,
      author: ctx.sessionId,
      text: trimmed,
      reactions: [],
    });
  },
});

export const react = sessionMutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, { messageId, emoji }) => {
    const match = await activeMatchFor(ctx, ctx.session);
    if (!match) return;
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.matchId !== match._id) return;
    await limitPerSession(ctx, "react", ctx.sessionId);
    const reactions = msg.reactions.includes(emoji)
      ? msg.reactions.filter((e) => e !== emoji)
      : [...msg.reactions, emoji];
    await ctx.db.patch(messageId, { reactions });
  },
});

export const signalStayConnected = sessionMutation({
  args: {},
  handler: async (ctx) => {
    const match = await activeMatchFor(ctx, ctx.session);
    if (!match) return;
    await ctx.db.patch(
      match._id,
      match.a === ctx.sessionId
        ? { stayConnectedA: true }
        : { stayConnectedB: true },
    );
  },
});

export const leave = sessionMutation({
  args: {
    reason: v.optional(
      v.union(v.literal("self-ended"), v.literal("partner-left")),
    ),
  },
  handler: async (ctx, { reason }) => {
    const s = ctx.session;
    if (!s?.currentMatchId) return;
    const match = await ctx.db.get(s.currentMatchId);
    if (match && match.status === "active") {
      await ctx.db.patch(match._id, {
        status: "ended",
        endedReason: reason ?? "partner-left",
        endedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(GRACE_MS, internal.cleanup.deleteMatch, {
        matchId: match._id,
      });
    }
    await ctx.db.patch(s._id, { currentMatchId: undefined });
  },
});
