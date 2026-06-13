import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";
import { messageTable } from "./message";

export const userTable = sqliteTable(
  "user",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    displayName: text("display_name"),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash"),
    bio: text("bio"),
    imageUrl: text("image_url"),
    bannerImageUrl: text("banner_image_url"),
    quietMode: integer("quiet_mode", { mode: "boolean" })
      .notNull()
      .default(false),
    question: text("question")
      .notNull()
      .default("Send me an anonymous message!"),
    // Owner-private message filter; must never ride a public payload — kept out
    // of publicUserColumns and stripped from PublicUser (see apps/www toPublicUser).
    blockedWords: text("blocked_words", { mode: "json" }).$type<string[]>(),
    // Pinned profile post: soft reference, no FK — an FK to postTable would
    // create a circular schema import (post.ts already references userTable).
    // deletePostAction clears it; a dangling id just renders no pin.
    pinnedPostId: text("pinned_post_id"),
    // Equipped group badge: soft reference, no FK (group.ts already references
    // userTable). Cleared in the same transaction as leave/kick/group-delete;
    // a dangling id just renders no badge.
    equippedGroupId: text("equipped_group_id"),
    followerCount: integer("follower_count").notNull().default(0),
    followingCount: integer("following_count").notNull().default(0),
    // "Aura": denormalized engagement score, incremented in-transaction with the
    // event that earns it (others liking/commenting/reposting/following you).
    // Cosmetic in v1 (no tiers/unlocks). Maintained like the counters above — a
    // cheap PK point-update, never a COUNT scan (Turso bills per row scanned).
    points: integer("points").notNull().default(0),
    // Watermark for the notification badge: unread = notification rows with
    // updatedAt past this. Mark-all-seen is one user-row write instead of
    // flipping a read flag on N notification rows.
    lastSeenNotificationsAt: integer("last_seen_notifications_at", {
      mode: "timestamp",
    }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
      () => new Date(),
    ),
  },
  // Group delete + account delete null this soft ref for every wearer; a
  // partial index keeps that sweep on the handful of badge-wearers instead of
  // scanning the whole user table (Turso bills per row scanned).
  (t) => [
    index("user_equipped_group_idx")
      .on(t.equippedGroupId)
      .where(sql`${t.equippedGroupId} IS NOT NULL`),
  ],
);

export const sessionTable = sqliteTable(
  "session",
  {
    id: text("id").notNull().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
  },
  // Backs DELETE ... WHERE user_id = ? (password-change session revocation) and
  // the user-delete FK cascade lookup.
  (t) => [index("session_user_idx").on(t.userId)],
);

export const sessionRelations = relations(sessionTable, ({ one }) => ({
  user: one(userTable, {
    fields: [sessionTable.userId],
    references: [userTable.id],
  }),
}));

export const accountTable = sqliteTable(
  "oauth_account",
  {
    providerUserId: text("provider_user_id").primaryKey(),
    email: text("email").notNull(),
    picture: text("picture").notNull(),
    userId: text("user_id").notNull(),
    providerId: text("provider_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
      () => new Date(),
    ),
  },
  (t) => [
    // getCurrentUserData / account deletion look up accounts by userId.
    // (The OAuth sign-in lookup by (providerId, providerUserId) is already a
    // point query served by the providerUserId PRIMARY KEY autoindex, so a
    // separate composite index is redundant.)
    index("oauth_account_user_idx").on(t.userId),
  ],
);

export const accountRelations = relations(accountTable, ({ one }) => ({
  user: one(userTable, {
    fields: [accountTable.userId],
    references: [userTable.id],
  }),
}));

export const userFollowTable = sqliteTable(
  "user_follow",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    followerId: text("follower_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("user_follow_follower_following_uidx").on(
      t.followerId,
      t.followingId,
    ),
    index("user_follow_follower_created_idx").on(t.followerId, t.createdAt),
    index("user_follow_following_created_idx").on(t.followingId, t.createdAt),
  ],
);

export const userBlockTable = sqliteTable(
  "user_block",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blockerId: text("blocker_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("user_block_blocker_blocked_uidx").on(t.blockerId, t.blockedId),
    index("user_block_blocker_created_idx").on(t.blockerId, t.createdAt),
    index("user_block_blocked_created_idx").on(t.blockedId, t.createdAt),
  ],
);

export const userRelations = relations(userTable, ({ many }) => ({
  sentMessages: many(messageTable, { relationName: "sender" }),
  receivedMessages: many(messageTable, { relationName: "receiver" }),
  accounts: many(accountTable),
  followers: many(userFollowTable, { relationName: "followers" }),
  following: many(userFollowTable, { relationName: "following" }),
  blocked: many(userBlockTable, { relationName: "blocked" }),
  blockers: many(userBlockTable, { relationName: "blockers" }),
}));

export const userFollowRelations = relations(userFollowTable, ({ one }) => ({
  follower: one(userTable, {
    fields: [userFollowTable.followerId],
    references: [userTable.id],
    relationName: "following",
  }),
  following: one(userTable, {
    fields: [userFollowTable.followingId],
    references: [userTable.id],
    relationName: "followers",
  }),
}));

export const userBlockRelations = relations(userBlockTable, ({ one }) => ({
  blocker: one(userTable, {
    fields: [userBlockTable.blockerId],
    references: [userTable.id],
    relationName: "blocked",
  }),
  blocked: one(userTable, {
    fields: [userBlockTable.blockedId],
    references: [userTable.id],
    relationName: "blockers",
  }),
}));

export type SelectUser = typeof userTable.$inferSelect;
export type SelectSession = typeof sessionTable.$inferSelect;
export type SelectAccount = typeof accountTable.$inferSelect;
export type SelectUserFollow = typeof userFollowTable.$inferSelect;
export type SelectUserBlock = typeof userBlockTable.$inferSelect;

export type InsertUser = typeof userTable.$inferInsert;
export type InsertSession = typeof sessionTable.$inferInsert;
export type InsertUserFollow = typeof userFollowTable.$inferInsert;
export type InsertUserBlock = typeof userBlockTable.$inferInsert;
