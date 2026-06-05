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
  })
    .index("by_session", ["sessionId"])
    .index("by_enqueuedAt", ["enqueuedAt"]),

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
  }).index("by_match", ["matchId"]),
});
