import { sql, relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { message } from "./message";

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    note: text("note"),
    bio: text("bio"),
    imageUrl: text("image_url"),
    quietMode: integer("quiet_mode", { mode: "boolean" })
      .notNull()
      .default(false),
    question: text("question")
      .notNull()
      .default("Send me an anonymous message!"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at").$onUpdate(() => sql`(current_timestamp)`),
  },
  (t) => ({
    noteUpdatedAtIdx: index("note_updated_at_idx").on(t.note, t.updatedAt),
    noteUpdatedAtIdIdx: index("note_updated_at_id_idx").on(
      t.note,
      t.updatedAt,
      t.id,
    ),
  }),
);

export const session = sqliteTable("session", {
  id: text("id").notNull().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  expiresAt: integer("expires_at").notNull(),
});

export const account = sqliteTable("oauth_account", {
  providerUserId: text("provider_user_id").primaryKey(),
  email: text("email").notNull(),
  picture: text("picture").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  receivedMessages: many(message, { relationName: "receiver" }),
  sentMessages: many(message, { relationName: "sender" }),
  accounts: many(account),
}));

export type InsertUser = typeof user.$inferInsert;
export type SelectUser = typeof user.$inferSelect;
