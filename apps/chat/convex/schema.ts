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
    // mode "guess": the dealer's answer is the truth, the partner's is a
    // prediction of it — storage is identical, only the tally semantics
    // change. Absent mode (pre-field rows) reads as "match".
    game: v.optional(
      v.object({
        cardId: v.string(),
        dealtBy: v.string(),
        mode: v.optional(v.union(v.literal("match"), v.literal("guess"))),
        answerA: v.optional(v.union(v.literal("A"), v.literal("B"))),
        answerB: v.optional(v.union(v.literal("A"), v.literal("B"))),
        dealtAt: v.number(),
      }),
    ),
    // Survives round replacement; bumped exactly once per completed round.
    gameTally: v.optional(
      v.object({ rounds: v.number(), matched: v.number() }),
    ),
    // Guess rounds tally separately — "guessed right" and "matched" mean
    // different things and feed different UI lines.
    guessTally: v.optional(
      v.object({ rounds: v.number(), correct: v.number() }),
    ),
    // Consecutive successful rounds across BOTH modes; best is the high-water
    // mark. Replaced/dismissed rounds never touch it (they never complete).
    gameStreak: v.optional(v.object({ current: v.number(), best: v.number() })),
    // Saturating event counters (see vibe.ts caps) — the shared vibe
    // score/level is DERIVED from these in snapshot, never stored. Once a
    // counter saturates the mutation stops patching, bounding write churn.
    vibe: v.optional(
      v.object({
        msgsA: v.number(),
        msgsB: v.number(),
        reactions: v.number(),
        whispers: v.number(),
      }),
    ),
    // Stay-connected reveal handles, side-keyed like stayConnectedA/B. The
    // ONE deliberate PII exception: bounded (MAX_REVEAL_HANDLE_LEN), never
    // logged, revealed to the partner only when BOTH are present, and gone
    // forever when deleteMatch removes the row.
    revealA: v.optional(v.string()),
    revealB: v.optional(v.string()),
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
    // dealtBy (a sessionId, never emitted raw) is needed because a guess
    // result is asymmetric — who predicted whom changes the copy.
    game: v.optional(
      v.object({
        cardId: v.string(),
        pickA: v.union(v.literal("A"), v.literal("B")),
        pickB: v.union(v.literal("A"), v.literal("B")),
        mode: v.optional(v.union(v.literal("match"), v.literal("guess"))),
        dealtBy: v.optional(v.string()),
      }),
    ),
    // One-shot fullscreen effect, allowlist-validated in send.
    effect: v.optional(
      v.union(
        v.literal("confetti"),
        v.literal("hearts"),
        v.literal("sparkles"),
        v.literal("poof"),
        v.literal("golden"),
      ),
    ),
  }).index("by_match", ["matchId"]),
});
