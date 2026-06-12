import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    sessionId: v.string(),
    sessionSecret: v.optional(v.string()),
    alias: v.string(),
    avatarSeed: v.string(),
    interests: v.array(v.string()),
    currentMatchId: v.optional(v.id("matches")),
    lastSeen: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_lastSeen", ["lastSeen"]),

  queue: defineTable({
    sessionId: v.string(),
    interests: v.array(v.string()),
    enqueuedAt: v.number(),
    // Refreshed by the radar's stillWaiting ping; pairing only claims rows
    // pinged within QUEUE_FRESH_MS so closed/backgrounded tabs aren't matchable.
    // Optional only for rows that predate the field (they read as stale).
    lastPingAt: v.optional(v.number()),
    // The queuer's shareable code: a ?join= visitor claims this row directly.
    // Opaque, bounded by MAX_INVITE_CODE_LEN; optional for pre-field rows.
    inviteCode: v.optional(v.string()),
  })
    .index("by_session", ["sessionId"])
    .index("by_enqueuedAt", ["enqueuedAt"])
    .index("by_inviteCode", ["inviteCode"]),

  matches: defineTable({
    a: v.string(),
    b: v.string(),
    interestsShared: v.array(v.string()),
    stayConnectedA: v.boolean(),
    stayConnectedB: v.boolean(),
    typingA: v.optional(v.boolean()),
    typingB: v.optional(v.boolean()),
    // Latches true once a reconcile observes both peers live; gates the
    // start-grace that prevents a false "partner-left" teardown of a fresh match.
    bothEverPresent: v.optional(v.boolean()),
    // One active game round at a time, replaced atomically by a deal (or
    // cleared by dismiss). dealtBy is a sessionId — resolved viewer-relative
    // in snapshot, never emitted. answerA/answerB are side-keyed like
    // typingA/typingB; "revealed" is derived (both present), never stored.
    game: v.optional(
      v.object({
        cardId: v.string(),
        dealtBy: v.string(),
        answerA: v.optional(v.union(v.literal("A"), v.literal("B"))),
        answerB: v.optional(v.union(v.literal("A"), v.literal("B"))),
        dealtAt: v.number(),
      }),
    ),
    // Survives round replacement; bumped exactly once per completed round.
    gameTally: v.optional(
      v.object({ rounds: v.number(), matched: v.number() }),
    ),
    status: v.union(v.literal("active"), v.literal("ended")),
    endedReason: v.optional(
      v.union(v.literal("self-ended"), v.literal("partner-left")),
    ),
    endedAt: v.optional(v.number()),
    createdAt: v.number(),
    // Match lookups are by id (session.currentMatchId) or by status for the
    // cleanup sweep; participants are only read off an already-fetched match.
  })
    .index("by_status_endedAt", ["status", "endedAt"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  messages: defineTable({
    matchId: v.id("matches"),
    author: v.string(),
    text: v.string(),
    // Superseded by reactionA/reactionB; kept optional (and unwritten) so rows
    // written before the per-user reactions deploy still validate. Messages are
    // ephemeral, so this can be dropped once no pre-deploy rows remain.
    reactions: v.optional(v.array(v.string())),
    // One reaction per participant, keyed by match side (like typingA/typingB)
    // — structurally enforces a single reaction per user per message.
    reactionA: v.optional(v.string()),
    reactionB: v.optional(v.string()),
    // Quoted reply. A reference, not a text copy: the preview is resolved at
    // read time, and rows only ever vanish with the whole match.
    replyToId: v.optional(v.id("messages")),
    // Absent kind = normal message. "whisper" = burn-on-read: the recipient's
    // reveal writes whisperViewedAt; the scheduled burn redacts text and sets
    // burned — the plaintext genuinely leaves the database. "game" = a
    // completed game round recorded in the conversation (text stays "").
    kind: v.optional(v.union(v.literal("whisper"), v.literal("game"))),
    whisperViewedAt: v.optional(v.number()),
    burned: v.optional(v.boolean()),
    // kind === "game" payload: side-keyed picks (like the match row's
    // answerA/answerB), resolved viewer-relative at read time. Only written
    // once BOTH sides have answered, so the row can't leak an early pick.
    game: v.optional(
      v.object({
        cardId: v.string(),
        pickA: v.union(v.literal("A"), v.literal("B")),
        pickB: v.union(v.literal("A"), v.literal("B")),
      }),
    ),
    // One-shot fullscreen effect, allowlist-validated in send.
    effect: v.optional(v.union(v.literal("confetti"), v.literal("hearts"))),
  }).index("by_match", ["matchId"]),
});
