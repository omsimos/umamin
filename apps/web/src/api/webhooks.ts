import { Hono } from "hono";
import type { AppBindings } from "../server-lib/context";
import {
  type LemonSqueezyOrderEvent,
  verifyWebhookSignature,
} from "../server-lib/lemonsqueezy";
import { recordProPurchase, refundProPurchase } from "../server-lib/pro";
import { ctxDb } from "./actions/_shared";

// Lemon Squeezy order webhook (subscribe to order_created + order_refunded in
// the dashboard). Server-to-server POSTs authenticate by HMAC signature over
// the RAW body — /api/webhooks/* is exempted from the global CSRF origin check
// for exactly that reason (see middleware.ts), so nothing under this app may
// ever read the session or cookies.
//
// Response contract: 200 acks an event (including ones deliberately ignored —
// Lemon Squeezy retries any non-200 up to 3 times with backoff, so only
// transient failures may return 5xx). Unverifiable requests get 401.

// Order webhooks are a few KB; anything bigger is not Lemon Squeezy.
const MAX_BODY_BYTES = 256 * 1024;

export const webhooksApp = new Hono<AppBindings>().post(
  "/webhooks/lemonsqueezy",
  async (c) => {
    const secret = c.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) {
      // Never accept an unverifiable payment event — 500 so a temporarily
      // missing secret becomes a retry, not a dropped grant.
      console.error("[pro] LEMONSQUEEZY_WEBHOOK_SECRET missing");
      return c.json({ error: "not configured" }, 500);
    }

    const rawBody = await c.req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return c.json({ error: "payload too large" }, 413);
    }
    const signature = c.req.header("x-signature");
    if (!(await verifyWebhookSignature(secret, rawBody, signature))) {
      return c.json({ error: "invalid signature" }, 401);
    }

    let event: LemonSqueezyOrderEvent;
    try {
      event = JSON.parse(rawBody) as LemonSqueezyOrderEvent;
    } catch {
      return c.json({ error: "invalid payload" }, 400);
    }

    const eventName = event.meta?.event_name;
    const orderId = event.data?.id;
    const order = event.data?.attributes;
    if (
      (eventName !== "order_created" && eventName !== "order_refunded") ||
      !orderId ||
      !order
    ) {
      return c.json({ ok: true, skipped: "unhandled event" });
    }

    // A correctly signed event for a different store means the signing secret
    // is being reused across stores — log loudly, grant nothing.
    const storeId = c.env.LEMONSQUEEZY_STORE_ID;
    if (storeId && String(order.store_id) !== String(storeId)) {
      console.error(
        `[pro] webhook for foreign store ${order.store_id}, expected ${storeId}`,
      );
      return c.json({ ok: true, skipped: "foreign store" });
    }

    if (eventName === "order_created") {
      // Only the Pro variant grants Pro — the store may sell other products
      // through the same webhook someday.
      const variantId = c.env.LEMONSQUEEZY_VARIANT_ID;
      const orderVariantId = order.first_order_item?.variant_id;
      if (variantId && String(orderVariantId) !== String(variantId)) {
        return c.json({ ok: true, skipped: "other product" });
      }

      // "pending"/"failed" orders never grant; card payments arrive as "paid".
      if (order.status !== "paid") {
        console.log(`[pro] order ${orderId} status=${order.status}, skipped`);
        return c.json({ ok: true, skipped: "not paid" });
      }

      const userId = event.meta?.custom_data?.user_id;
      if (typeof userId !== "string" || !userId) {
        // A purchase made outside the in-app checkout (e.g. a direct store
        // link) has no attribution — surface it for manual support handling.
        console.error(`[pro] order ${orderId} has no user_id custom data`);
        return c.json({ ok: true, skipped: "unattributed" });
      }

      const purchasedAt = order.created_at ? new Date(order.created_at) : null;
      const result = await recordProPurchase(ctxDb(c), {
        userId,
        orderId,
        identifier: order.identifier ?? null,
        variantId: orderVariantId ?? null,
        total: order.total ?? null,
        currency: order.currency ?? null,
        testMode: order.test_mode ?? false,
        purchasedAt:
          purchasedAt && !Number.isNaN(purchasedAt.getTime())
            ? purchasedAt
            : new Date(),
      });
      console.log(`[pro] order ${orderId}: ${result}`);
      return c.json({ ok: true, result });
    }

    // order_refunded fires for partial refunds too; only a FULL refund
    // (refunded: true) revokes the grant.
    if (order.refunded !== true) {
      return c.json({ ok: true, skipped: "partial refund" });
    }
    const result = await refundProPurchase(ctxDb(c), orderId);
    console.log(`[pro] refund ${orderId}: ${result}`);
    return c.json({ ok: true, result });
  },
);
