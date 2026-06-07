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

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "message"
  | "reply"
  | "vote";

// One row per (recipient, type, target), aggregated via upsert — a viral post
// produces a single "like" notification row, not one per liker. Keeps rows
// written AND scanned bounded (Turso bills per row scanned).
export const notificationTable = sqliteTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    type: text("type").$type<NotificationType>().notNull(),
    // Soft ref (postId for like/comment, messageId for reply). NOT NULL with ''
    // sentinel for follow/message: SQLite unique indexes treat NULLs as
    // distinct, which would break the aggregation upsert.
    targetId: text("target_id").notNull().default(""),
    // Latest actor; null means anonymous (always null for 'message' to keep
    // sender anonymity). SET NULL so a deleted account leaves aggregates alive.
    actorId: text("actor_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    count: integer("count").notNull().default(1),
    // Plaintext snippet only (post/comment content) — never message or reply
    // content, which is AES-encrypted at rest.
    preview: text("preview"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    // No $onUpdate: it doesn't fire inside an upsert's DO UPDATE — the notify
    // helper sets this explicitly on both branches.
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    // Aggregation upsert target.
    uniqueIndex("notification_recipient_type_target_uidx").on(
      t.recipientId,
      t.type,
      t.targetId,
    ),
    // Backs the badge count (updatedAt > lastSeen LIMIT) and the list's
    // (updatedAt, id) DESC cursor pagination.
    index("notification_recipient_updated_id_idx").on(
      t.recipientId,
      t.updatedAt,
      t.id,
    ),
  ],
);

export const notificationRelations = relations(
  notificationTable,
  ({ one }) => ({
    recipient: one(userTable, {
      fields: [notificationTable.recipientId],
      references: [userTable.id],
    }),
    actor: one(userTable, {
      fields: [notificationTable.actorId],
      references: [userTable.id],
    }),
  }),
);

export type InsertNotification = typeof notificationTable.$inferInsert;
export type SelectNotification = typeof notificationTable.$inferSelect;
