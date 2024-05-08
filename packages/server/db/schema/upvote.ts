import { nanoid } from "nanoid";
import { sql, relations } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./user";
import { post } from "./post";

export const upvote = sqliteTable("upvote", {
  id: text("id").primaryKey().default(nanoid()),
  userId: text("user_id")
    .references(() => user.id)
    .notNull(),
  postId: text("post_id").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const upvotesRelations = relations(upvote, ({ one }) => ({
  user: one(user, {
    fields: [upvote.userId],
    references: [user.id],
  }),
  post: one(post, {
    fields: [upvote.postId],
    references: [post.id],
  }),
}));

export type InsertUpvote = typeof upvote.$inferInsert;
export type SelectUpvote = typeof upvote.$inferSelect;
