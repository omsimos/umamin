import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./user";

export const post = sqliteTable("message", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  authorId: text("author_id"),
  createdAt: integer("created_at", { mode: "number" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at").$onUpdate(() => sql`(unixepoch())`),
  upvoteCount: integer("upvote_count").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
});

export const messageRelations = relations(post, ({ one }) => ({
  author: one(user, {
    fields: [post.authorId],
    references: [user.id],
    relationName: "receiver",
  }),
}));

export type InsertMessage = typeof post.$inferInsert;
export type SelectMessage = typeof post.$inferSelect;
