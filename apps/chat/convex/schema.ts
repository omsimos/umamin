import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    sessionId: v.string(),
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
  })
    .index("by_session", ["sessionId"])
    .index("by_enqueuedAt", ["enqueuedAt"]),

  matches: defineTable({
    a: v.string(),
    b: v.string(),
    interestsShared: v.array(v.string()),
    stayConnectedA: v.boolean(),
    stayConnectedB: v.boolean(),
    status: v.union(v.literal("active"), v.literal("ended")),
    endedReason: v.optional(
      v.union(v.literal("self-ended"), v.literal("partner-left")),
    ),
    endedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_a", ["a"])
    .index("by_b", ["b"])
    .index("by_status_endedAt", ["status", "endedAt"]),

  messages: defineTable({
    matchId: v.id("matches"),
    author: v.string(),
    text: v.string(),
    reactions: v.array(v.string()),
  }).index("by_match", ["matchId"]),
});
