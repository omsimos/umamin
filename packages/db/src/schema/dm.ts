import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

import { userTable } from "./user";

// One row per direct-message conversation. Messages live in the conversation's
// Durable Object, not here: this row is the index the Chats list and unread
// badge read, written by that DO (debounced) rather than once per message.
// "low" and "high" are the two user ids in sorted order, so a pair has exactly
// one row and the id is derivable from either side.
export const dmThreadTable = sqliteTable(
  "dm_thread",
  {
    // `${lowId}:${highId}`
    id: text("id").primaryKey(),
    userLowId: text("user_low_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    userHighId: text("user_high_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    // Message seqs from the DO. Unread is `last_seq > my read seq` with the
    // other side as sender, which is exact where timestamps would tie.
    lastSeq: integer("last_seq").notNull().default(0),
    lastSenderId: text("last_sender_id"),
    // AES-encrypted and truncated; null when the last message was unsent.
    lastPreview: text("last_preview"),
    lowReadSeq: integer("low_read_seq").notNull().default(0),
    highReadSeq: integer("high_read_seq").notNull().default(0),
    // "Delete chat" hides everything up to this seq for that side only.
    lowHiddenSeq: integer("low_hidden_seq").notNull().default(0),
    highHiddenSeq: integer("high_hidden_seq").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    // The Chats list is two of these seeks (one per side), each LIMITed.
    index("dm_thread_low_last_idx").on(t.userLowId, t.lastMessageAt),
    index("dm_thread_high_last_idx").on(t.userHighId, t.lastMessageAt),
  ],
);

// Conversations whose Durable Object storage must be wiped because a
// participant deleted their account. The dm_thread row cascades away with the
// user, so the ids are copied here first and a cron drains the queue.
export const dmPurgeTable = sqliteTable("dm_purge", {
  threadId: text("thread_id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type DmReportReason =
  | "harassment"
  | "sexual"
  | "minor_safety"
  | "spam"
  | "other";

export type DmReportResolution = "dismissed" | "actioned";

// A reported direct message. The snapshot (the message plus a few before it)
// is built by the conversation's DO, never sent by the client, and is the only
// DM content a moderator ever sees.
export const dmReportTable = sqliteTable(
  "dm_report",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    // SET NULL so deleting an account can't erase a report about it.
    reportedId: text("reported_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    threadId: text("thread_id").notNull(),
    messageSeq: integer("message_seq").notNull(),
    reason: text("reason").$type<DmReportReason>().notNull(),
    // AES-encrypted JSON of DmReportSnapshot.
    snapshot: text("snapshot").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    resolvedById: text("resolved_by_id"),
    resolution: text("resolution").$type<DmReportResolution>(),
  },
  (t) => [
    uniqueIndex("dm_report_reporter_message_uidx").on(
      t.reporterId,
      t.threadId,
      t.messageSeq,
    ),
    // The moderator queue: open reports, oldest first.
    index("dm_report_open_idx")
      .on(t.createdAt)
      .where(sql`${t.resolvedAt} IS NULL`),
    // Account-delete FK sweeps.
    index("dm_report_reported_idx").on(t.reportedId),
  ],
);

export type SelectDmThread = typeof dmThreadTable.$inferSelect;
export type InsertDmThread = typeof dmThreadTable.$inferInsert;
export type SelectDmReport = typeof dmReportTable.$inferSelect;
