import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

import { userTable } from "./user";

export const messageTable = sqliteTable(
  "message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    question: text("question").notNull(),
    content: text("content").notNull(),
    reply: text("reply"),
    receiverId: text("receiver_id").notNull(),
    senderId: text("sender_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
      () => new Date(),
    ),
    // NULL = still sealed in the receiver's inbox. Receiver-only state — the
    // sent-messages payload strips it server-side.
    openedAt: integer("opened_at", { mode: "timestamp" }),
    // Denormalized thread signal: bumped on every message_reply insert so
    // lists can show activity without touching the reply table.
    lastReplyAt: integer("last_reply_at", { mode: "timestamp" }),
    // Per-side read watermarks (group_message_read pattern) — written on
    // thread open only, never per fetch. Each is private to its own side.
    senderReadAt: integer("sender_read_at", { mode: "timestamp" }),
    receiverReadAt: integer("receiver_read_at", { mode: "timestamp" }),
  },
  (t) => [
    index("receiver_id_created_at_id_idx").on(t.receiverId, t.createdAt, t.id),
    index("sender_id_created_at_id_idx").on(t.senderId, t.createdAt, t.id),
  ],
);

// One row per thread entry. The legacy message.reply column stays the
// receiver's FIRST reply (dual-written) so a www rollback keeps rendering;
// everything after it lives here.
export const messageReplyTable = sqliteTable(
  "message_reply",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    messageId: text("message_id")
      .notNull()
      .references(() => messageTable.id, { onDelete: "cascade" }),
    // Role, not an authorId — the sender's identity lives only on the parent
    // row, so a reply row can never leak who the anonymous sender is.
    fromSender: integer("from_sender", { mode: "boolean" }).notNull(),
    // AES-encrypted at rest, same as message.content.
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    // Keyset pagination per thread; id tiebreaker for same-second inserts.
    index("message_reply_message_created_id_idx").on(
      t.messageId,
      t.createdAt,
      t.id,
    ),
  ],
);

export const messageRelations = relations(messageTable, ({ one }) => ({
  receiver: one(userTable, {
    fields: [messageTable.receiverId],
    references: [userTable.id],
    relationName: "receiver",
  }),
  sender: one(userTable, {
    fields: [messageTable.senderId],
    references: [userTable.id],
    relationName: "sender",
  }),
}));

export const messageReplyRelations = relations(
  messageReplyTable,
  ({ one }) => ({
    message: one(messageTable, {
      fields: [messageReplyTable.messageId],
      references: [messageTable.id],
    }),
  }),
);

export type InsertMessage = typeof messageTable.$inferInsert;
export type SelectMessage = typeof messageTable.$inferSelect;
export type InsertMessageReply = typeof messageReplyTable.$inferInsert;
export type SelectMessageReply = typeof messageReplyTable.$inferSelect;
