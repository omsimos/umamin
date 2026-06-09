import { relations, sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

import { groupTable } from "./group";
import { userTable } from "./user";

export const groupMessageTable = sqliteTable(
  "group_message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    groupId: text("group_id")
      .notNull()
      .references(() => groupTable.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    // AES-encrypted at rest, same as direct messages.
    content: text("content").notNull(),
    // Self-ref for replies. SET NULL (not cascade) so deleting the parent
    // leaves the reply as a normal message instead of vanishing it.
    replyToMessageId: text("reply_to_message_id").references(
      (): AnySQLiteColumn => groupMessageTable.id,
      { onDelete: "set null" },
    ),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    // The one load-bearing index: every history page and live-tail delta seeks
    // (groupId, createdAt, id) — keyset, never a full-room SCAN (Turso bills
    // every row scanned). The id tiebreaker resolves same-second collisions.
    index("group_message_group_created_id_idx").on(
      t.groupId,
      t.createdAt,
      t.id,
    ),
    // Only used by the account-delete FK cascade sweep.
    index("group_message_sender_idx").on(t.senderId),
  ],
);

// Per-(user, group) read watermark — denormalized so an unread badge never
// COUNT(*)s the room. Written sparingly (on room open / leave), never per poll.
export const groupMessageReadTable = sqliteTable(
  "group_message_read",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    groupId: text("group_id")
      .notNull()
      .references(() => groupTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    lastReadMessageId: text("last_read_message_id"),
    lastReadAt: integer("last_read_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("group_message_read_group_user_uidx").on(t.groupId, t.userId),
    // Account-delete FK cascade sweep.
    index("group_message_read_user_idx").on(t.userId),
  ],
);

// One reaction per (message, user) — a new emoji replaces the previous, the
// same emoji toggles off (Messenger/Instagram semantics). Mirrors
// note_reaction: the unique index leads with messageId for the per-page
// aggregate, the second backs the per-viewer overlay (userId = ? AND messageId
// IN (...)).
export const groupMessageReactionTable = sqliteTable(
  "group_message_reaction",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    messageId: text("message_id")
      .notNull()
      .references(() => groupMessageTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("group_message_reaction_message_user_uidx").on(
      t.messageId,
      t.userId,
    ),
    index("group_message_reaction_user_message_idx").on(t.userId, t.messageId),
  ],
);

export const groupMessageRelations = relations(
  groupMessageTable,
  ({ one }) => ({
    group: one(groupTable, {
      fields: [groupMessageTable.groupId],
      references: [groupTable.id],
    }),
    sender: one(userTable, {
      fields: [groupMessageTable.senderId],
      references: [userTable.id],
    }),
  }),
);

export type SelectGroupMessage = typeof groupMessageTable.$inferSelect;
export type InsertGroupMessage = typeof groupMessageTable.$inferInsert;
export type SelectGroupMessageRead = typeof groupMessageReadTable.$inferSelect;
export type InsertGroupMessageRead = typeof groupMessageReadTable.$inferInsert;
export type SelectGroupMessageReaction =
  typeof groupMessageReactionTable.$inferSelect;
export type InsertGroupMessageReaction =
  typeof groupMessageReactionTable.$inferInsert;
