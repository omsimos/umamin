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

export const userTable = sqliteTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  displayName: text("display_name"),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash"),
  bio: text("bio"),
  imageUrl: text("image_url"),
  quietMode: integer("quiet_mode", { mode: "boolean" })
    .notNull()
    .default(false),
  question: text("question").notNull().default("Send me an anonymous message!"),
  followerCount: integer("follower_count").notNull().default(0),
  followingCount: integer("following_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
    () => new Date(),
  ),
});

export const sessionTable = sqliteTable("session", {
  id: text("id").notNull().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
});

export const sessionRelations = relations(sessionTable, ({ one }) => ({
  user: one(userTable, {
    fields: [sessionTable.userId],
    references: [userTable.id],
  }),
}));

export const accountTable = sqliteTable("oauth_account", {
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
});

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

export const userRelations = relations(userTable, ({ many }) => ({
  sentMessages: many(messageTable, { relationName: "sender" }),
  receivedMessages: many(messageTable, { relationName: "receiver" }),
  accounts: many(accountTable),
  followers: many(userFollowTable, { relationName: "followers" }),
  following: many(userFollowTable, { relationName: "following" }),
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

export type SelectUser = typeof userTable.$inferSelect;
export type SelectSession = typeof sessionTable.$inferSelect;
export type SelectAccount = typeof accountTable.$inferSelect;
export type SelectUserFollow = typeof userFollowTable.$inferSelect;

export type InsertUser = typeof userTable.$inferInsert;
export type InsertSession = typeof sessionTable.$inferInsert;
export type InsertUserFollow = typeof userFollowTable.$inferInsert;
