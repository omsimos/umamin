import { proPurchaseTable } from "@umamin/db/schema/pro";
import { userTable } from "@umamin/db/schema/user";
import { and, eq, isNull } from "drizzle-orm";
import { computeProUntil } from "../lib/pro";
import type { Db } from "./db";

// Grant/revoke for Umamin Pro. ONLY the Lemon Squeezy webhook calls these —
// user.proUntil is never written anywhere else, and it is always RE-DERIVED
// from the pro_purchase rows (computeProUntil) rather than incremented, so a
// redelivered webhook, a duplicate order event, or a refund all converge on
// the same entitlement.

type ProTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type ProGrant = {
  userId: string;
  orderId: string;
  identifier?: string | null;
  variantId?: number | null;
  total?: number | null;
  currency?: string | null;
  testMode?: boolean;
  purchasedAt: Date;
};

export type ProGrantResult = "granted" | "duplicate" | "user-missing";

/**
 * Records a paid order and extends the buyer's Pro horizon. Idempotent: the
 * UNIQUE orderId turns a webhook redelivery into a no-op insert, and the
 * recompute lands on the same date either way. "user-missing" covers an
 * account deleted between checkout and webhook — the caller acks it so Lemon
 * Squeezy stops retrying an order that can never be granted.
 */
export async function recordProPurchase(
  db: Db,
  grant: ProGrant,
): Promise<ProGrantResult> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.id, grant.userId))
      .limit(1);
    if (!user) return "user-missing";

    const inserted = await tx
      .insert(proPurchaseTable)
      .values({
        userId: grant.userId,
        orderId: grant.orderId,
        identifier: grant.identifier ?? null,
        variantId: grant.variantId ?? null,
        total: grant.total ?? null,
        currency: grant.currency ?? null,
        testMode: grant.testMode ?? false,
        createdAt: grant.purchasedAt,
      })
      .onConflictDoNothing()
      .returning({ id: proPurchaseTable.id });

    await recomputeProUntil(tx, grant.userId);
    return inserted.length > 0 ? "granted" : "duplicate";
  });
}

export type ProRefundResult = "refunded" | "already-refunded" | "unknown-order";

/**
 * Marks an order refunded and re-derives the buyer's Pro horizon from the
 * remaining purchases (which may still be a future date if other purchases
 * stand). "unknown-order" covers orders for other products or a store
 * misrouting — acked, never retried.
 */
export async function refundProPurchase(
  db: Db,
  orderId: string,
  refundedAt: Date = new Date(),
): Promise<ProRefundResult> {
  return db.transaction(async (tx) => {
    const [purchase] = await tx
      .select({
        userId: proPurchaseTable.userId,
        refundedAt: proPurchaseTable.refundedAt,
      })
      .from(proPurchaseTable)
      .where(eq(proPurchaseTable.orderId, orderId))
      .limit(1);
    if (!purchase) return "unknown-order";
    if (purchase.refundedAt) return "already-refunded";

    await tx
      .update(proPurchaseTable)
      .set({ refundedAt })
      .where(eq(proPurchaseTable.orderId, orderId));

    await recomputeProUntil(tx, purchase.userId);
    return "refunded";
  });
}

async function recomputeProUntil(tx: ProTx, userId: string): Promise<void> {
  const purchases = await tx
    .select({
      createdAt: proPurchaseTable.createdAt,
      refundedAt: proPurchaseTable.refundedAt,
    })
    .from(proPurchaseTable)
    .where(
      and(
        eq(proPurchaseTable.userId, userId),
        isNull(proPurchaseTable.refundedAt),
      ),
    );

  await tx
    .update(userTable)
    .set({ proUntil: computeProUntil(purchases) })
    .where(eq(userTable.id, userId));
}
