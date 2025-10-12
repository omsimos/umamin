import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
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

export const userRelations = relations(userTable, ({ many }) => ({
  sentMessages: many(messageTable, { relationName: "sender" }),
  receivedMessages: many(messageTable, { relationName: "receiver" }),
  accounts: many(accountTable),
}));

export type SelectUser = typeof userTable.$inferSelect;
export type SelectSession = typeof sessionTable.$inferSelect;
export type SelectAccount = typeof accountTable.$inferSelect;

export type InsertSession = typeof sessionTable.$inferInsert;
export type InsertUser = typeof userTable.$inferInsert;
