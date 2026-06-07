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

// Denormalized onto the post row (not a join table) so feed reads pay zero
// extra row scans; `key` is the R2 object key, dims reserve layout space.
export type PostImage = {
  key: string;
  width: number;
  height: number;
};

export const postTable = sqliteTable(
  "postTable",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    content: text("content").notNull(),
    images: text("images", { mode: "json" }).$type<PostImage[]>(),
    // Quote posts: soft reference, deliberately NO FK. Deleting the quoted
    // post must neither cascade (would delete other people's commentary) nor
    // SET NULL (quotes would silently become plain posts) — the id survives
    // and a missing join renders a "post unavailable" husk.
    quotedPostId: text("quoted_post_id"),
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
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    repostCount: integer("repost_count").notNull().default(0),
    // Denormalized poll-vote total across all options, mirroring likeCount —
    // feeds the Hot engagement score without a per-read aggregate over
    // poll_option.
    pollVoteCount: integer("poll_vote_count").notNull().default(0),
    // Poll attached to this post; null = no poll. The post content is the
    // question. Absolute end timestamp — expiry is a read-time comparison,
    // no sweeper. Lives on the post row so feed reads know a post has a poll
    // without extra scans.
    pollEndsAt: integer("poll_ends_at", { mode: "timestamp" }),
  },
  (t) => [
    index("post_created_at_id_idx").on(t.createdAt, t.id),
    index("post_author_created_at_idx").on(t.authorId, t.createdAt, t.id),
  ],
);

export const pollOptionTable = sqliteTable(
  "poll_option",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    postId: text("post_id")
      .notNull()
      .references(() => postTable.id, { onDelete: "cascade" }),
    // 0..3 display order, fixed at creation (options are never edited).
    idx: integer("idx").notNull(),
    label: text("label").notNull(),
    voteCount: integer("vote_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("poll_option_post_idx_uidx").on(t.postId, t.idx)],
);

export const pollVoteTable = sqliteTable(
  "poll_vote",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    postId: text("post_id")
      .notNull()
      .references(() => postTable.id, { onDelete: "cascade" }),
    optionId: text("option_id")
      .notNull()
      .references(() => pollOptionTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    // One vote per poll (not per option) — votes are single-choice and final.
    uniqueIndex("poll_vote_post_user_uidx").on(t.postId, t.userId),
    // Backs the per-viewer overlay (user_id = ? AND post_id IN (...)) and the
    // user-delete cascade lookup. Without it the overlay scans poll_vote.
    index("poll_vote_user_post_idx").on(t.userId, t.postId),
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
    likeCount: integer("like_count").notNull().default(0),
  },
  (t) => [
    index("post_comment_post_created_idx").on(t.postId, t.createdAt, t.id),
    index("post_comment_author_created_idx").on(t.authorId, t.createdAt, t.id),
  ],
);

export const postLikeTable = sqliteTable(
  "post_like",
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
    uniqueIndex("post_like_post_user_uidx").on(t.postId, t.userId),
    index("post_like_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const postCommentLikeTable = sqliteTable(
  "post_comment_like",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    commentId: text("comment_id")
      .notNull()
      .references(() => postCommentTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("post_comment_like_comment_user_uidx").on(
      t.commentId,
      t.userId,
    ),
    index("post_comment_like_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const postRepostTable = sqliteTable(
  "post_repost",
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
    // Plain reposts only — quotes are real posts (postTable.quotedPostId).
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("post_repost_post_user_uidx").on(t.postId, t.userId),
    index("post_repost_user_created_idx").on(t.userId, t.createdAt),
    index("post_repost_post_created_idx").on(t.postId, t.createdAt),
    // Backs the public feed's repost branch (ORDER BY created_at DESC, id DESC
    // LIMIT). Without it that branch full-scans post_repost on every feed cache
    // miss (Turso bills every row scanned).
    index("post_repost_created_idx").on(t.createdAt, t.id),
  ],
);

export const PostRelations = relations(postTable, ({ one, many }) => ({
  author: one(userTable, {
    fields: [postTable.authorId],
    references: [userTable.id],
  }),
  comments: many(postCommentTable),
  likes: many(postLikeTable),
  reposts: many(postRepostTable),
  pollOptions: many(pollOptionTable),
  pollVotes: many(pollVoteTable),
}));

export const PollOptionRelations = relations(pollOptionTable, ({ one }) => ({
  post: one(postTable, {
    fields: [pollOptionTable.postId],
    references: [postTable.id],
  }),
}));

export const PollVoteRelations = relations(pollVoteTable, ({ one }) => ({
  post: one(postTable, {
    fields: [pollVoteTable.postId],
    references: [postTable.id],
  }),
  option: one(pollOptionTable, {
    fields: [pollVoteTable.optionId],
    references: [pollOptionTable.id],
  }),
  user: one(userTable, {
    fields: [pollVoteTable.userId],
    references: [userTable.id],
  }),
}));

export const PostLikeRelations = relations(postLikeTable, ({ one }) => ({
  postTable: one(postTable, {
    fields: [postLikeTable.postId],
    references: [postTable.id],
  }),
  user: one(userTable, {
    fields: [postLikeTable.userId],
    references: [userTable.id],
  }),
}));

export const PostCommentLikeRelations = relations(
  postCommentLikeTable,
  ({ one }) => ({
    comment: one(postCommentTable, {
      fields: [postCommentLikeTable.commentId],
      references: [postCommentTable.id],
    }),
    user: one(userTable, {
      fields: [postCommentLikeTable.userId],
      references: [userTable.id],
    }),
  }),
);

export const PostRepostRelations = relations(postRepostTable, ({ one }) => ({
  post: one(postTable, {
    fields: [postRepostTable.postId],
    references: [postTable.id],
  }),
  user: one(userTable, {
    fields: [postRepostTable.userId],
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
export type InsertPostLike = typeof postLikeTable.$inferInsert;
export type SelectPostLike = typeof postLikeTable.$inferSelect;
export type InsertPostCommentLike = typeof postCommentLikeTable.$inferInsert;
export type SelectPostCommentLike = typeof postCommentLikeTable.$inferSelect;
export type InsertPostRepost = typeof postRepostTable.$inferInsert;
export type SelectPostRepost = typeof postRepostTable.$inferSelect;
export type InsertPostComment = typeof postCommentTable.$inferInsert;
export type SelectPostComment = typeof postCommentTable.$inferSelect;
export type InsertPollOption = typeof pollOptionTable.$inferInsert;
export type SelectPollOption = typeof pollOptionTable.$inferSelect;
export type InsertPollVote = typeof pollVoteTable.$inferInsert;
export type SelectPollVote = typeof pollVoteTable.$inferSelect;
