import { nanoid } from "nanoid";
import { sql, relations } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { post } from "./post";
import { upvote } from "./upvote";

export const comment = sqliteTable("post", {
  id: text("id").primaryKey().default(nanoid()),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: text("author_id"),
  postId: text("post_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const commentsRelations = relations(comment, ({ one, many }) => ({
  post: one(post, {
    fields: [comment.postId],
    references: [post.id],
  }),
  upvotes: many(upvote),
}));

export type InsertComment = typeof comment.$inferInsert;
export type SelectComment = typeof comment.$inferSelect;
