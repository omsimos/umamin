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
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at").$onUpdate(() => sql`(unixepoch())`),
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
  createdAt: integer("created_at", { mode: "number" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const accountRelations = relations(account, ({ one }) => ({
  profile: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  receiver: many(message, { relationName: "receiver" }),
  sender: many(message, { relationName: "sender" }),
  profile: many(account),
}));

export type InsertUser = typeof user.$inferInsert;
export type SelectUser = typeof user.$inferSelect;
