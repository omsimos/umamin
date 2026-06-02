import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { GRACE_MS, MAX_MESSAGE_LEN, MESSAGE_CAP } from "./constants";
import { limitPerSession } from "./lib/rateLimits";
import { sessionMutation, sessionQuery } from "./lib/sessions";
import { isPresent } from "./presence";

const EMPTY = {
  phase: "idle" as const,
  matchId: "",
  self: { alias: "", avatarSeed: "", interests: [] as string[] },
  partner: null,
  stayConnected: { self: false, partner: false },
};

const snapshotMetaValidator = v.object({
  phase: v.union(
    v.literal("idle"),
    v.literal("matching"),
    v.literal("active"),
    v.literal("ended"),
  ),
  matchId: v.string(),
  self: v.object({
    alias: v.string(),
    avatarSeed: v.string(),
    interests: v.array(v.string()),
  }),
  partner: v.union(
    v.null(),
    v.object({
      alias: v.string(),
      avatarSeed: v.string(),
      sharedInterests: v.array(v.string()),
      status: v.union(
        v.literal("online"),
        v.literal("typing"),
        v.literal("left"),
      ),
    }),
  ),
  stayConnected: v.object({ self: v.boolean(), partner: v.boolean() }),
  endedReason: v.optional(
    v.union(v.literal("self-ended"), v.literal("partner-left")),
  ),
});

const messageValidator = v.object({
  id: v.id("messages"),
  author: v.union(v.literal("self"), v.literal("partner")),
  text: v.string(),
  ts: v.number(),
  reactions: v.array(v.string()),
});

// Match meta WITHOUT the message list: partner status / typing / stay-connected
// changes invalidate this query (small reads) but never re-read the messages.
export const snapshot = sessionQuery({
  args: {},
  returns: snapshotMetaValidator,
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
    // Real presence: a partner with no live heartbeat in the match room reads as
    // left. Typing is carried as a debounced boolean on the match row (set via
    // `setTyping`) and overlays "online" while the partner is composing.
    const partnerOnline =
      !ended && (await isPresent(ctx, match._id, partnerId));
    const partnerTyping = iAmA ? match.typingB : match.typingA;
    const status: "online" | "typing" | "left" = !partnerOnline
      ? "left"
      : partnerTyping
        ? "typing"
        : "online";

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

// Message list for the current match, kept separate from `snapshot` so it only
// re-reads on send/react — never on typing, presence, or stay-connected churn.
export const messages = sessionQuery({
  args: {},
  returns: v.array(messageValidator),
  handler: async (ctx) => {
    const matchId = ctx.session?.currentMatchId;
    if (!matchId) return [];
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .order("asc")
      .take(MESSAGE_CAP);
    return rows.map((m) => ({
      id: m._id,
      author:
        m.author === ctx.sessionId ? ("self" as const) : ("partner" as const),
      text: m.text,
      ts: m._creationTime,
      reactions: m.reactions,
    }));
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
    // Server-side cap: `send` is a public mutation callable directly, so the
    // composer's maxLength is UX only — this is the actual guard.
    if (trimmed.length > MAX_MESSAGE_LEN) {
      throw new ConvexError("Message is too long.");
    }
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

export const setTyping = sessionMutation({
  args: { typing: v.boolean() },
  handler: async (ctx, { typing }) => {
    const match = await activeMatchFor(ctx, ctx.session);
    if (!match) return;
    // Not rate-limited: it's debounced client-side and best-effort; throttling
    // could drop the trailing `false` and leave the indicator stuck on.
    await ctx.db.patch(
      match._id,
      match.a === ctx.sessionId ? { typingA: typing } : { typingB: typing },
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
      // Hard-delete is deferred GRACE_MS (not inline) so the survivor's snapshot
      // keeps a window to render the partner-left overlay before the match and
      // its messages are swept; mirrors presence.reconcile.
      await ctx.scheduler.runAfter(GRACE_MS, internal.cleanup.deleteMatch, {
        matchId: match._id,
      });
    }
    await ctx.db.patch(s._id, { currentMatchId: undefined });
  },
});
