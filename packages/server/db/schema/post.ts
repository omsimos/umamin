import { nanoid } from "nanoid";
import { sql, relations } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./user";
import { comment } from "./comment";

export const post = sqliteTable("post", {
  id: text("id").primaryKey().default(nanoid()),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: text("author_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const postsRelations = relations(post, ({ one, many }) => ({
  author: one(user, {
    fields: [post.authorId],
    references: [user.id],
  }),
  comments: many(comment),
}));

export type InsertPost = typeof post.$inferInsert;
export type SelectPost = typeof post.$inferSelect;
