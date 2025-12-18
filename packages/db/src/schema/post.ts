import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

import { userTable } from "./user";

export const postTable = sqliteTable(
  "postTable",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    content: text("content").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
    upvoteCount: integer("upvote_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
  },
  (t) => [
    index("post_created_at_id_idx").on(t.createdAt, t.id),
    index("post_author_created_at_idx").on(t.authorId, t.createdAt, t.id),
  ],
);

export const postUpvoteTable = sqliteTable(
  "post_upvote",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    postId: text("post_id")
      .notNull()
      .references(() => postTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("post_upvote_post_user_uidx").on(t.postId, t.userId),
    index("post_upvote_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const postCommentTable = sqliteTable(
  "post_comment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    postId: text("post_id")
      .notNull()
      .references(() => postTable.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
    upvoteCount: integer("upvote_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
  },
  (t) => [
    index("post_comment_post_created_idx").on(t.postId, t.createdAt, t.id),
    index("post_comment_author_created_idx").on(t.authorId, t.createdAt, t.id),
  ],
);

export const PostRelations = relations(postTable, ({ one, many }) => ({
  author: one(userTable, {
    fields: [postTable.authorId],
    references: [userTable.id],
  }),
  comments: many(postCommentTable),
  upvotes: many(postUpvoteTable),
}));

export const PostUpvoteRelations = relations(postUpvoteTable, ({ one }) => ({
  postTable: one(postTable, {
    fields: [postUpvoteTable.postId],
    references: [postTable.id],
  }),
  user: one(userTable, {
    fields: [postUpvoteTable.userId],
    references: [userTable.id],
  }),
}));

export const PostCommentRelations = relations(postCommentTable, ({ one }) => ({
  postTable: one(postTable, {
    fields: [postCommentTable.postId],
    references: [postTable.id],
  }),
  author: one(userTable, {
    fields: [postCommentTable.authorId],
    references: [userTable.id],
  }),
}));

export type InsertPost = typeof postTable.$inferInsert;
export type SelectPost = typeof postTable.$inferSelect;
export type InsertPostUpvote = typeof postUpvoteTable.$inferInsert;
export type SelectPostUpvote = typeof postUpvoteTable.$inferSelect;
export type InsertPostComment = typeof postCommentTable.$inferInsert;
export type SelectPostComment = typeof postCommentTable.$inferSelect;
