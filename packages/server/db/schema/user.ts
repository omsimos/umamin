import { sql, relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { post } from "./post";
import { message } from "./message";

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    email: text("email").notNull().unique(),
    note: text("note"),
    bio: text("bio"),
    quietMode: integer("quiet_mode", { mode: "boolean" })
      .notNull()
      .default(false),
    question: text("question")
      .default("Send me an anonymous message!")
      .notNull(),
    googleId: text("google_id").notNull(),
    imageUrl: text("image_url").notNull(),
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
    .references(() => user.id)
    .notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const usersRelations = relations(user, ({ many }) => ({
  messages: many(message),
  comments: many(message),
  posts: many(post),
}));

export type InsertUser = typeof user.$inferInsert;
export type SelectUser = typeof user.$inferSelect;
