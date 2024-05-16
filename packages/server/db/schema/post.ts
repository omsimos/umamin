import { sql, relations } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./user";
import { comment } from "./comment";
import { upvote } from "./upvote";

export const post = sqliteTable("post", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: text("author_id").references(() => user.id).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const postsRelations = relations(post, ({ one, many }) => ({
  author: one(user, {
    fields: [post.authorId],
    references: [user.id],
  }),
  upvotes: many(upvote),
  comments: many(comment),
}));

export type InsertPost = typeof post.$inferInsert;
export type SelectPost = typeof post.$inferSelect;
