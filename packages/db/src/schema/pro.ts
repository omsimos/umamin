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

// One row per Lemon Squeezy order that bought Umamin Pro (a one-time 6-month
// purchase, not a subscription). The UNIQUE orderId is the webhook idempotency
// key — Lemon Squeezy redelivers on non-200 responses — and user.proUntil is
// always RE-DERIVED from this table's paid, non-refunded rows, so a duplicate
// or out-of-order delivery converges to the same entitlement.
export const proPurchaseTable = sqliteTable(
  "pro_purchase",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    // Lemon Squeezy order id (JSON:API `data.id`).
    orderId: text("order_id").notNull(),
    // Lemon Squeezy order UUID (`identifier`) — receipt lookup for support.
    identifier: text("identifier"),
    variantId: integer("variant_id"),
    // Total in the order currency's smallest unit, straight from the webhook
    // payload. Audit only — never used for entitlement math.
    total: integer("total"),
    currency: text("currency"),
    testMode: integer("test_mode", { mode: "boolean" })
      .notNull()
      .default(false),
    refundedAt: integer("refunded_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("pro_purchase_order_uidx").on(t.orderId),
    // Backs the per-user recompute on grant/refund and the account-delete
    // cascade lookup (Turso bills per row scanned).
    index("pro_purchase_user_idx").on(t.userId),
  ],
);

export const proPurchaseRelations = relations(proPurchaseTable, ({ one }) => ({
  user: one(userTable, {
    fields: [proPurchaseTable.userId],
    references: [userTable.id],
  }),
}));

export type SelectProPurchase = typeof proPurchaseTable.$inferSelect;
export type InsertProPurchase = typeof proPurchaseTable.$inferInsert;
