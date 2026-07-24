// Push-notification category bitmask, stored on user.pushPrefs (0 = off).
// Shared by the server (send gate + register/toggle actions) and the client
// (settings toggle), so this module stays free of server-only / web-push
// imports. Each NotificationType maps to exactly one category in
// lib/server/push.ts. v1 ships a single master toggle that flips ALL categories
// at once; Phase 2 exposes them independently with no migration (the bits and
// column already exist).
export const PUSH_CATEGORY = {
  // Activity on your own content: likes, comments, replies, poll votes.
  social: 1 << 0,
  // New followers.
  follow: 1 << 1,
  // Anonymous messages received.
  message: 1 << 2,
  // Group activity: joins, invites, requests, accepts, mentions.
  group: 1 << 3,
} as const;

// The master toggle enables every current category. Phase 2 will let a user
// keep a subset; until then it's all-or-nothing.
export const ALL_PUSH_CATEGORIES =
  PUSH_CATEGORY.social |
  PUSH_CATEGORY.follow |
  PUSH_CATEGORY.message |
  PUSH_CATEGORY.group;
