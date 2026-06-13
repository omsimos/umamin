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

// One row per (user, device). `endpoint` is the push-service URL that identifies
// a device's push channel — the dedupe/delete key AND a bearer capability
// (whoever holds it receives that user's pushes). It carries no PII and is
// pruned on a 404/410 from the push service. Content is NEVER stored or pushed:
// payloads are generic, type-derived strings (see lib/server/push.ts).
export const pushSubscriptionTable = sqliteTable(
  "push_subscription",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    // RFC 8291 subscription keys (PushSubscription.keys.p256dh / .auth).
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    // Bumped on transient (5xx/timeout) sends; a cleanup cron prunes rows past a
    // threshold — belt-and-suspenders alongside the inline 404/410 delete.
    failureCount: integer("failure_count").notNull().default(0),
    // Set after a successful send; supports a per-(user) send cooldown without
    // Redis (Phase 2). Swept/compared, so partial-indexed below.
    lastNotifiedAt: integer("last_notified_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    // Globally unique: a re-subscribe is an idempotent onConflictDoUpdate target,
    // and a device that moved accounts updates its userId in place (no churn).
    uniqueIndex("push_subscription_endpoint_uidx").on(t.endpoint),
    // The send fan-out reads WHERE user_id = ? (bounded — a user has 1-3
    // devices); also backs the account-delete FK cascade sweep.
    index("push_subscription_user_idx").on(t.userId),
    // Partial index for the swept cooldown/cleanup column so the sweep seeks the
    // handful of recently-notified rows instead of scanning the whole table
    // (Turso bills per row scanned).
    index("push_subscription_last_notified_idx")
      .on(t.lastNotifiedAt)
      .where(sql`${t.lastNotifiedAt} IS NOT NULL`),
  ],
);

export type SelectPushSubscription = typeof pushSubscriptionTable.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptionTable.$inferInsert;
