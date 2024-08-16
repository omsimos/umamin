import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./user";
import { post } from "./post";

export const upvote = sqliteTable("upvote", {
  postId: text("post_id")
    .notNull()
    .references(() => post.id),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  createdAt: integer("created_at", { mode: "number" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const upvoteRelations = relations(upvote, ({ one }) => ({
  post: one(post, {
    fields: [upvote.postId],
    references: [post.id],
  }),
  user: one(user, {
    fields: [upvote.userId],
    references: [user.id],
  }),
}));
