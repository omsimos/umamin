import { nanoid } from "nanoid";
import { sql, relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey().default(nanoid()),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  note: text("note"),
  bio: text("bio"),
  quietMode: integer("quiet_mode", { mode: "boolean" })
    .notNull()
    .default(false),
  question: text("question").default("Send me an anonymous message!").notNull(),
  googleId: text("google_id").notNull(),
  imageUrl: text("image_url").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const usersRelations = relations(user, ({ many }) => ({
  messages: many(message),
  comments: many(message),
  posts: many(post),
}));

export const session = sqliteTable("session", {
  id: text("id").notNull().primaryKey(),
  userId: text("user_id")
    .references(() => user.id)
    .notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const message = sqliteTable("message", {
  id: text("id").primaryKey().default(nanoid()),
  question: text("question").notNull(),
  content: text("content").notNull(),
  userId: text("user_id")
    .references(() => user.id, {
      onDelete: "cascade",
    })
    .notNull(),
  senderId: text("sender_id").references(() => user.id, {
    onDelete: "cascade",
  }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const messagesRelations = relations(message, ({ one }) => ({
  user: one(user, {
    fields: [message.userId],
    references: [user.id],
  }),
  sender: one(user, {
    fields: [message.senderId],
    references: [user.id],
  }),
}));

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

export type InsertUser = typeof user.$inferInsert;
export type SelectUser = typeof user.$inferSelect;

export type InsertMessage = typeof message.$inferInsert;
export type SelectMessage = typeof message.$inferSelect;

export type InsertComment = typeof comment.$inferInsert;
export type SelectComment = typeof comment.$inferSelect;

export type InsertUpvote = typeof upvote.$inferInsert;
export type SelectUpvote = typeof upvote.$inferSelect;

export type InsertPost = typeof post.$inferInsert;
export type SelectPost = typeof post.$inferSelect;
