import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import {
  ALLOWED_EFFECTS,
  ALLOWED_REACTIONS,
  EFFECT_MIN_LEVEL,
  GRACE_MS,
  MAX_MESSAGE_LEN,
  MESSAGE_CAP,
  REACTION_MIN_LEVEL,
  REPLY_PREVIEW_LEN,
  WHISPER_BURN_MS,
} from "./constants";
import { limitGlobal, limitPerSession } from "./lib/rateLimits";
import { sessionMutation, sessionQuery } from "./lib/sessions";
import { memberPresence } from "./presence";
import {
  computeVibe,
  EMPTY_VIBE_COUNTERS,
  VIBE_MSG_COUNT_CAP,
  VIBE_REACTION_CAP,
  VIBE_WHISPER_CAP,
} from "./vibe";

/** The shared (deliberately NOT viewer-relative) chemistry for a match —
 *  computed from one row, so the two clients can't desync. */
export function matchVibe(match: Doc<"matches">): {
  score: number;
  level: number;
} {
  const tally = match.gameTally ?? { rounds: 0, matched: 0 };
  const guesses = match.guessTally ?? { rounds: 0, correct: 0 };
  return computeVibe({
    ...(match.vibe ?? EMPTY_VIBE_COUNTERS),
    rounds: tally.rounds + guesses.rounds,
    successes: tally.matched + guesses.correct,
    mutualStayConnected: match.stayConnectedA && match.stayConnectedB,
  });
}

const EMPTY = {
  phase: "idle" as const,
  matchId: "",
  self: { alias: "", avatarSeed: "", interests: [] as string[] },
  partner: null,
  stayConnected: { self: false, partner: false },
  game: null,
  gameTally: { rounds: 0, matched: 0 },
  guessTally: { rounds: 0, correct: 0 },
  gameStreak: { current: 0, best: 0 },
  vibe: { score: 0, level: 1 },
  reveal: {
    unlocked: false,
    self: { submitted: false },
    partner: { submitted: false },
  },
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
        v.literal("away"),
        v.literal("left"),
      ),
    }),
  ),
  stayConnected: v.object({ self: v.boolean(), partner: v.boolean() }),
  game: v.union(
    v.null(),
    v.object({
      cardId: v.string(),
      dealtBy: v.union(v.literal("self"), v.literal("partner")),
      mode: v.union(v.literal("match"), v.literal("guess")),
      selfPick: v.union(v.null(), v.literal("A"), v.literal("B")),
      partnerAnswered: v.boolean(),
      // Present ONLY once both sides have answered — the server-side gate.
      partnerPick: v.optional(v.union(v.literal("A"), v.literal("B"))),
    }),
  ),
  gameTally: v.object({ rounds: v.number(), matched: v.number() }),
  guessTally: v.object({ rounds: v.number(), correct: v.number() }),
  gameStreak: v.object({ current: v.number(), best: v.number() }),
  // Shared chemistry — identical for both viewers by construction.
  vibe: v.object({ score: v.number(), level: v.number() }),
  // Stay-connected reveal. The partner's handle is emitted ONLY once both
  // sides have submitted — before that the viewer only learns THAT the
  // partner left something (the tease), never WHAT.
  reveal: v.object({
    unlocked: v.boolean(),
    self: v.object({
      submitted: v.boolean(),
      handle: v.optional(v.string()),
    }),
    partner: v.object({
      submitted: v.boolean(),
      handle: v.optional(v.string()),
    }),
  }),
  endedReason: v.optional(
    v.union(v.literal("self-ended"), v.literal("partner-left")),
  ),
});

const messageValidator = v.object({
  id: v.id("messages"),
  author: v.union(v.literal("self"), v.literal("partner")),
  text: v.string(),
  ts: v.number(),
  reactions: v.array(
    v.object({
      emoji: v.string(),
      by: v.union(v.literal("self"), v.literal("partner")),
    }),
  ),
  replyTo: v.optional(
    v.object({
      id: v.id("messages"),
      author: v.union(v.literal("self"), v.literal("partner")),
      text: v.string(),
    }),
  ),
  whisper: v.optional(
    v.object({
      state: v.union(
        v.literal("hidden"),
        v.literal("revealed"),
        v.literal("burned"),
      ),
      viewedAt: v.optional(v.number()),
    }),
  ),
  effect: v.optional(
    v.union(
      v.literal("confetti"),
      v.literal("hearts"),
      v.literal("sparkles"),
      v.literal("poof"),
      v.literal("golden"),
    ),
  ),
  gameResult: v.optional(
    v.object({
      cardId: v.string(),
      selfPick: v.union(v.literal("A"), v.literal("B")),
      partnerPick: v.union(v.literal("A"), v.literal("B")),
      mode: v.optional(v.union(v.literal("match"), v.literal("guess"))),
      dealtBy: v.optional(v.union(v.literal("self"), v.literal("partner"))),
    }),
  ),
});

/** Placeholder for quoted whispers — a reply preview must not outlive the burn. */
const WHISPER_PREVIEW = "🔥 Whisper";
/** Placeholder for quoted game rows (they carry no text). */
const GAME_PREVIEW = "⚡ Game round";

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
    // Real presence: while the match is active, a partner who joined and lost
    // their heartbeat reads as "away" — app-switched or screen-locked;
    // reconcile only ends the match once the absence outlasts AWAY_GRACE_MS.
    // A partner who has NEVER joined a not-yet-latched match is still
    // connecting (mounting presence right after the pair) and reads as
    // "online" — reconcile's start grace bounds how long that can last.
    // "left" is reserved for an ended match. Typing is carried as a debounced
    // boolean on the match row (set via `setTyping`) and overlays "online".
    const partnerPresence = ended
      ? { online: false, joined: true }
      : await memberPresence(ctx, match._id, partnerId);
    const connecting = !partnerPresence.joined && !match.bothEverPresent;
    const partnerTyping = iAmA ? match.typingB : match.typingA;
    const status: "online" | "typing" | "away" | "left" = ended
      ? "left"
      : !(partnerPresence.online || connecting)
        ? "away"
        : partnerTyping
          ? "typing"
          : "online";

    const g = match.game;
    const myPick = g ? (iAmA ? g.answerA : g.answerB) : undefined;
    const theirPick = g ? (iAmA ? g.answerB : g.answerA) : undefined;

    // The reveal stays in the snapshot through the ended grace window — the
    // ended view is exactly where a mutually-revealed handle gets copied
    // before deleteMatch erases it forever.
    const myReveal = iAmA ? match.revealA : match.revealB;
    const theirReveal = iAmA ? match.revealB : match.revealA;
    const bothRevealed = Boolean(match.revealA && match.revealB);

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
      // Anti-leak: the partner's pick is emitted only once BOTH have answered
      // — before that the viewer only learns that the partner has picked.
      game: g
        ? {
            cardId: g.cardId,
            dealtBy:
              g.dealtBy === ctx.sessionId
                ? ("self" as const)
                : ("partner" as const),
            mode: g.mode ?? ("match" as const),
            selfPick: myPick ?? null,
            partnerAnswered: Boolean(theirPick),
            ...(myPick && theirPick ? { partnerPick: theirPick } : {}),
          }
        : null,
      gameTally: match.gameTally ?? { rounds: 0, matched: 0 },
      guessTally: match.guessTally ?? { rounds: 0, correct: 0 },
      gameStreak: match.gameStreak ?? { current: 0, best: 0 },
      vibe: matchVibe(match),
      reveal: {
        unlocked: match.stayConnectedA && match.stayConnectedB,
        // Own echo (reload-safe); the partner's handle only after BOTH are in.
        self: {
          submitted: Boolean(myReveal),
          ...(myReveal ? { handle: myReveal } : {}),
        },
        partner: {
          submitted: Boolean(theirReveal),
          ...(bothRevealed && theirReveal ? { handle: theirReveal } : {}),
        },
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
    const match = await ctx.db.get(matchId);
    if (!match) return [];
    const iAmA = match.a === ctx.sessionId;
    // Newest MESSAGE_CAP (order desc + take), returned oldest->newest for the
    // UI. Taking asc would freeze the window at the first 100 and hide newer
    // messages once a conversation passes the cap.
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
      .order("desc")
      .take(MESSAGE_CAP);
    rows.reverse();
    return Promise.all(
      rows.map(async (m) => {
        // Quoted replies resolve by reference at read time, so the preview
        // stays available even after the target rolls out of the cap window.
        const target = m.replyToId ? await ctx.db.get(m.replyToId) : null;
        const isAuthor = m.author === ctx.sessionId;
        const whisperState =
          m.kind !== "whisper"
            ? null
            : m.burned
              ? ("burned" as const)
              : m.whisperViewedAt
                ? ("revealed" as const)
                : ("hidden" as const);
        // Anti-leak: a hidden whisper's plaintext never reaches the recipient's
        // payload — blur alone would be theater. The author keeps their own
        // text until the burn redacts it for both sides.
        const text =
          whisperState === null
            ? m.text
            : whisperState === "burned"
              ? ""
              : isAuthor || whisperState === "revealed"
                ? m.text
                : "";
        return {
          id: m._id,
          author: isAuthor ? ("self" as const) : ("partner" as const),
          text,
          ts: m._creationTime,
          // Side-keyed reactions resolved to the viewer's perspective; sessionIds
          // never leave the server. A-then-B order keeps the array deterministic.
          reactions: [
            ...(m.reactionA
              ? [
                  {
                    emoji: m.reactionA,
                    by: iAmA ? ("self" as const) : ("partner" as const),
                  },
                ]
              : []),
            ...(m.reactionB
              ? [
                  {
                    emoji: m.reactionB,
                    by: iAmA ? ("partner" as const) : ("self" as const),
                  },
                ]
              : []),
          ],
          ...(target
            ? {
                replyTo: {
                  id: target._id,
                  author:
                    target.author === ctx.sessionId
                      ? ("self" as const)
                      : ("partner" as const),
                  text:
                    target.kind === "whisper"
                      ? WHISPER_PREVIEW
                      : target.kind === "game"
                        ? GAME_PREVIEW
                        : target.text.slice(0, REPLY_PREVIEW_LEN),
                },
              }
            : {}),
          ...(whisperState
            ? {
                whisper: {
                  state: whisperState,
                  ...(whisperState === "revealed" && m.whisperViewedAt
                    ? { viewedAt: m.whisperViewedAt }
                    : {}),
                },
              }
            : {}),
          ...(m.effect ? { effect: m.effect } : {}),
          ...(m.kind === "game" && m.game
            ? {
                gameResult: {
                  cardId: m.game.cardId,
                  selfPick: iAmA ? m.game.pickA : m.game.pickB,
                  partnerPick: iAmA ? m.game.pickB : m.game.pickA,
                  ...(m.game.mode === "guess" ? { mode: m.game.mode } : {}),
                  ...(m.game.dealtBy
                    ? {
                        dealtBy:
                          m.game.dealtBy === ctx.sessionId
                            ? ("self" as const)
                            : ("partner" as const),
                      }
                    : {}),
                },
              }
            : {}),
        };
      }),
    );
  },
});

export async function activeMatchFor(
  ctx: MutationCtx,
  session: Doc<"sessions"> | null,
): Promise<Doc<"matches"> | null> {
  if (!session?.currentMatchId) return null;
  const m = await ctx.db.get(session.currentMatchId);
  return m && m.status === "active" ? m : null;
}

export const send = sessionMutation({
  args: {
    text: v.string(),
    replyToId: v.optional(v.id("messages")),
    whisper: v.optional(v.boolean()),
    effect: v.optional(v.string()),
  },
  handler: async (ctx, { text, replyToId, whisper, effect }) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Server-side cap: `send` is a public mutation callable directly, so the
    // composer's maxLength is UX only — this is the actual guard.
    if (trimmed.length > MAX_MESSAGE_LEN) {
      throw new ConvexError("Message is too long.");
    }
    if (effect && !(ALLOWED_EFFECTS as readonly string[]).includes(effect)) {
      throw new ConvexError("Unsupported effect.");
    }
    const match = await activeMatchFor(ctx, ctx.session);
    if (!match) return;
    // Unlock gate: the composer's dimmed tiles are UX only — this is the guard.
    if (effect) {
      const minLevel =
        (EFFECT_MIN_LEVEL as Record<string, number>)[effect] ?? 1;
      if (minLevel > matchVibe(match).level) {
        throw new ConvexError("Effect locked.");
      }
    }
    // A reply target outside this match (cross-match probe, or a stale id from
    // a previous match) drops the reference rather than the message.
    const target = replyToId ? await ctx.db.get(replyToId) : null;
    const validReplyTo =
      target && target.matchId === match._id ? target._id : undefined;
    await limitGlobal(ctx, "globalSendMessage");
    await limitPerSession(ctx, "sendMessage", ctx.sessionId);
    await ctx.db.insert("messages", {
      matchId: match._id,
      author: ctx.sessionId,
      text: trimmed,
      ...(validReplyTo ? { replyToId: validReplyTo } : {}),
      // Whisper and effect are mutually exclusive — a burned bubble must not
      // carry a spectacle, and the composer can't produce both anyway.
      ...(whisper ? { kind: "whisper" as const } : {}),
      ...(effect && !whisper
        ? { effect: effect as (typeof ALLOWED_EFFECTS)[number] }
        : {}),
    });
    // Vibe bookkeeping: saturates at the cap, after which sends stop patching
    // the match row entirely.
    const counters = match.vibe ?? EMPTY_VIBE_COUNTERS;
    const side =
      match.a === ctx.sessionId ? ("msgsA" as const) : ("msgsB" as const);
    if (counters[side] < VIBE_MSG_COUNT_CAP) {
      await ctx.db.patch(match._id, {
        vibe: { ...counters, [side]: counters[side] + 1 },
      });
    }
  },
});

export const viewWhisper = sessionMutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const match = await activeMatchFor(ctx, ctx.session);
    if (!match) return;
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.matchId !== match._id) return;
    // Only the recipient can start the burn; idempotent so a double-tap or
    // reload can't restart the countdown.
    if (msg.author === ctx.sessionId) return;
    if (msg.kind !== "whisper" || msg.burned || msg.whisperViewedAt) return;
    await ctx.db.patch(messageId, { whisperViewedAt: Date.now() });
    await ctx.scheduler.runAfter(WHISPER_BURN_MS, internal.chat.burnWhisper, {
      messageId,
    });
    // A whisper reveal is genuinely two-sided (one sent, one tapped) — worth
    // more vibe than a plain message. Saturates like the other counters.
    const counters = match.vibe ?? EMPTY_VIBE_COUNTERS;
    if (counters.whispers < VIBE_WHISPER_CAP) {
      await ctx.db.patch(match._id, {
        vibe: { ...counters, whispers: counters.whispers + 1 },
      });
    }
  },
});

export const burnWhisper = internalMutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    // The row may already be gone (match swept) — no-op.
    const msg = await ctx.db.get(messageId);
    if (msg?.kind !== "whisper" || msg.burned) return;
    await ctx.db.patch(messageId, { burned: true, text: "" });
  },
});

export const react = sessionMutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, { messageId, emoji }) => {
    if (!ALLOWED_REACTIONS.includes(emoji)) {
      throw new ConvexError("Unsupported reaction.");
    }
    const match = await activeMatchFor(ctx, ctx.session);
    if (!match) return;
    const msg = await ctx.db.get(messageId);
    if (!msg || msg.matchId !== match._id) return;
    // One reaction per participant (own messages included): repeating the
    // current emoji clears it, a different one replaces it.
    const field = match.a === ctx.sessionId ? "reactionA" : "reactionB";
    const next = msg[field] === emoji ? undefined : emoji;
    // Unlock gate on SET only — clearing a reaction is always allowed.
    if (next && (REACTION_MIN_LEVEL[emoji] ?? 1) > matchVibe(match).level) {
      throw new ConvexError("Reaction locked.");
    }
    await limitGlobal(ctx, "globalReact");
    await limitPerSession(ctx, "react", ctx.sessionId);
    await ctx.db.patch(
      messageId,
      field === "reactionA" ? { reactionA: next } : { reactionB: next },
    );
    // Set events on the PARTNER's messages feed the vibe (shared chemistry —
    // self-reacts don't count); toggling off never decrements.
    const counters = match.vibe ?? EMPTY_VIBE_COUNTERS;
    if (
      next &&
      msg.author !== ctx.sessionId &&
      counters.reactions < VIBE_REACTION_CAP
    ) {
      await ctx.db.patch(match._id, {
        vibe: { ...counters, reactions: counters.reactions + 1 },
      });
    }
  },
});

export const signalStayConnected = sessionMutation({
  args: {},
  handler: async (ctx) => {
    const match = await activeMatchFor(ctx, ctx.session);
    if (!match) return;
    // One-way latch: a repeat tap is a no-op, not a rewrite — skipping the
    // patch also skips a pointless snapshot invalidation for both clients.
    const field =
      match.a === ctx.sessionId
        ? ("stayConnectedA" as const)
        : ("stayConnectedB" as const);
    if (match[field]) return;
    await ctx.db.patch(match._id, { [field]: true });
  },
});

export const setTyping = sessionMutation({
  args: { typing: v.boolean() },
  handler: async (ctx, { typing }) => {
    const match = await activeMatchFor(ctx, ctx.session);
    if (!match) return;
    const field = match.a === ctx.sessionId ? "typingA" : "typingB";
    if (Boolean(match[field]) === typing) return;
    if (typing) {
      await limitGlobal(ctx, "globalTyping");
      await limitPerSession(ctx, "typing", ctx.sessionId);
    }
    // The trailing false is allowed through so the indicator cannot get stuck;
    // repeated identical false writes are skipped above.
    await ctx.db.patch(
      match._id,
      field === "typingA" ? { typingA: typing } : { typingB: typing },
    );
  },
});

export const leave = sessionMutation({
  args: {},
  handler: async (ctx) => {
    // Cancelling from the matching radar must dequeue, or the row stays
    // claimable and strangers get paired with someone who already left.
    const queued = await ctx.db
      .query("queue")
      .withIndex("by_session", (q) => q.eq("sessionId", ctx.sessionId))
      .unique();
    if (queued) await ctx.db.delete(queued._id);

    const s = ctx.session;
    if (!s?.currentMatchId) return;
    const match = await ctx.db.get(s.currentMatchId);
    if (match && match.status === "active") {
      // The survivor is the only reader of endedReason (the leaver detaches
      // below and bounces to the lobby), so from their view the partner left —
      // matching the presence.reconcile teardown path.
      await ctx.db.patch(match._id, {
        status: "ended",
        endedReason: "partner-left",
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
