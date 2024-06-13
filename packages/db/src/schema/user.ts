import { sql, relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { message } from "./message";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash"),
  bio: text("bio"),
  imageUrl: text("image_url"),
  quietMode: integer("quiet_mode", { mode: "boolean" })
    .notNull()
    .default(false),
  question: text("question").notNull().default("Send me an anonymous message!"),
  createdAt: integer("created_at", { mode: "number" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").$onUpdate(() => sql`(unixepoch())`),
});

export const session = sqliteTable("session", {
  id: text("id").notNull().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
});

export const account = sqliteTable("oauth_account", {
  providerUserId: text("provider_user_id").primaryKey(),
  email: text("email").notNull(),
  picture: text("picture").notNull(),
  userId: text("user_id").notNull(),
  providerId: text("provider_id").notNull(),
  createdAt: integer("created_at", { mode: "number" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").$onUpdate(() => sql`(unixepoch())`),
});

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  sentMessages: many(message, { relationName: "sender" }),
  receivedMessages: many(message, { relationName: "receiver" }),
  accounts: many(account),
}));

export type InsertUser = typeof user.$inferInsert;
export type SelectUser = typeof user.$inferSelect;

export type SelectAccount = typeof account.$inferSelect;
