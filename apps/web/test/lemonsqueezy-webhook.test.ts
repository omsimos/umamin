import { proPurchaseTable } from "@umamin/db/schema/pro";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { webhooksApp } from "../src/api/webhooks";
import { addMonthsClamped } from "../src/lib/pro";
import type { AppBindings } from "../src/server-lib/context";
import type { Db } from "../src/server-lib/db";
import type { AppEnv } from "../src/server-lib/env";
import { verifyWebhookSignature } from "../src/server-lib/lemonsqueezy";
import { csrfOriginCheck } from "../src/server-lib/middleware";
import { makeTestDb } from "./helpers/db";

// End-to-end webhook coverage against real SQL: the REAL csrfOriginCheck (a
// server-to-server POST carries no Origin — the /api/webhooks/ exemption is
// what keeps Lemon Squeezy from being 403'd at the front door), the real
// route, real migrations, real HMAC signatures.

const SECRET = "test-signing-secret";
const ENV = {
  LEMONSQUEEZY_WEBHOOK_SECRET: SECRET,
  LEMONSQUEEZY_STORE_ID: "10",
  LEMONSQUEEZY_VARIANT_ID: "77",
} as Partial<AppEnv>;

function buildWebhookApp(db: Db) {
  return new Hono<AppBindings>()
    .use("*", csrfOriginCheck())
    .use("*", async (c, next) => {
      c.set("db", () => db);
      await next();
    })
    .route("/api", webhooksApp);
}

const encoder = new TextEncoder();

async function sign(body: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function post(
  app: ReturnType<typeof buildWebhookApp>,
  body: string,
  env: Partial<AppEnv> = ENV,
  headers?: Record<string, string>,
) {
  // Deliberately NO origin header — Lemon Squeezy never sends one.
  return app.request(
    "/api/webhooks/lemonsqueezy",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "x.test",
        ...(headers ?? { "x-signature": await sign(body) }),
      },
      body,
    },
    env as AppEnv,
  );
}

type OrderOverrides = {
  orderId?: string;
  userId?: string | null;
  status?: string;
  variantId?: number;
  storeId?: number;
  createdAt?: string;
};

function orderCreated({
  orderId = "9001",
  userId = "buyer",
  status = "paid",
  variantId = 77,
  storeId = 10,
  createdAt = "2026-08-07T00:00:00.000000Z",
}: OrderOverrides = {}): string {
  return JSON.stringify({
    meta: {
      event_name: "order_created",
      custom_data: userId === null ? {} : { user_id: userId },
    },
    data: {
      type: "orders",
      id: orderId,
      attributes: {
        store_id: storeId,
        identifier: `uuid-${orderId}`,
        status,
        refunded: false,
        total: 12900,
        currency: "PHP",
        test_mode: false,
        created_at: createdAt,
        first_order_item: { variant_id: variantId },
      },
    },
  });
}

function orderRefunded(orderId: string, refunded = true): string {
  return JSON.stringify({
    meta: { event_name: "order_refunded" },
    data: {
      type: "orders",
      id: orderId,
      attributes: { store_id: 10, status: "refunded", refunded },
    },
  });
}

async function proUntil(db: Db, userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ proUntil: userTable.proUntil })
    .from(userTable)
    .where(eq(userTable.id, userId));
  return row?.proUntil ?? null;
}

describe("verifyWebhookSignature", () => {
  const body = '{"meta":{"event_name":"order_created"}}';

  it("accepts the HMAC of the exact raw body", async () => {
    expect(await verifyWebhookSignature(SECRET, body, await sign(body))).toBe(
      true,
    );
  });

  it("rejects a signature over a tampered body", async () => {
    const tampered = body.replace("order_created", "order_refunded");
    expect(
      await verifyWebhookSignature(SECRET, tampered, await sign(body)),
    ).toBe(false);
  });

  it("rejects a signature under the wrong secret", async () => {
    expect(
      await verifyWebhookSignature(SECRET, body, await sign(body, "other")),
    ).toBe(false);
  });

  it("rejects missing or malformed signatures", async () => {
    expect(await verifyWebhookSignature(SECRET, body, undefined)).toBe(false);
    expect(await verifyWebhookSignature(SECRET, body, "")).toBe(false);
    expect(await verifyWebhookSignature(SECRET, body, "zz".repeat(32))).toBe(
      false,
    );
    expect(await verifyWebhookSignature(SECRET, body, "abc123")).toBe(false);
  });
});

describe("POST /api/webhooks/lemonsqueezy (real libSQL)", () => {
  let db: Db;
  let app: ReturnType<typeof buildWebhookApp>;

  beforeEach(async () => {
    db = await makeTestDb();
    app = buildWebhookApp(db);
    await db.insert(userTable).values({ id: "buyer", username: "u_buyer" });
  });

  it("rejects an unsigned request", async () => {
    const res = await post(app, orderCreated(), ENV, {});
    expect(res.status).toBe(401);
    expect(await proUntil(db, "buyer")).toBeNull();
  });

  it("rejects a signed-but-tampered body", async () => {
    const body = orderCreated();
    const res = await post(app, body.replace("buyer", "victim"), ENV, {
      "x-signature": await sign(body),
    });
    expect(res.status).toBe(401);
  });

  it("refuses (500, so Lemon Squeezy retries) when the secret is unset", async () => {
    const res = await post(app, orderCreated(), {
      ...ENV,
      LEMONSQUEEZY_WEBHOOK_SECRET: undefined,
    });
    expect(res.status).toBe(500);
  });

  it("400s a signed body that isn't JSON", async () => {
    const res = await post(app, "not json");
    expect(res.status).toBe(400);
  });

  it("grants 6 months of Pro on a paid order (with the CSRF exemption — no Origin sent)", async () => {
    const res = await post(app, orderCreated());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, result: "granted" });

    expect(await proUntil(db, "buyer")).toEqual(
      addMonthsClamped(new Date("2026-08-07T00:00:00Z"), 6),
    );

    const [purchase] = await db.select().from(proPurchaseTable);
    expect(purchase).toMatchObject({
      userId: "buyer",
      orderId: "9001",
      total: 12900,
      currency: "PHP",
    });
  });

  it("is idempotent under webhook redelivery", async () => {
    await post(app, orderCreated());
    const res = await post(app, orderCreated());
    expect(await res.json()).toMatchObject({ result: "duplicate" });

    const purchases = await db.select().from(proPurchaseTable);
    expect(purchases).toHaveLength(1);
    expect(await proUntil(db, "buyer")).toEqual(
      addMonthsClamped(new Date("2026-08-07T00:00:00Z"), 6),
    );
  });

  it("stacks a second purchase onto the remaining time", async () => {
    await post(app, orderCreated());
    await post(
      app,
      orderCreated({
        orderId: "9002",
        createdAt: "2026-09-01T00:00:00.000000Z",
      }),
    );

    // Chained: 6 months on top of the first purchase's horizon.
    expect(await proUntil(db, "buyer")).toEqual(
      addMonthsClamped(
        addMonthsClamped(new Date("2026-08-07T00:00:00Z"), 6),
        6,
      ),
    );
  });

  it("revokes on a full refund and re-derives from remaining purchases", async () => {
    await post(app, orderCreated());
    await post(
      app,
      orderCreated({
        orderId: "9002",
        createdAt: "2026-09-01T00:00:00.000000Z",
      }),
    );

    const res = await post(app, orderRefunded("9002"));
    expect(await res.json()).toMatchObject({ ok: true, result: "refunded" });
    expect(await proUntil(db, "buyer")).toEqual(
      addMonthsClamped(new Date("2026-08-07T00:00:00Z"), 6),
    );

    // Refunding the only remaining purchase clears the horizon entirely.
    await post(app, orderRefunded("9001"));
    expect(await proUntil(db, "buyer")).toBeNull();
  });

  it("keeps Pro on a partial refund", async () => {
    await post(app, orderCreated());
    const res = await post(app, orderRefunded("9001", false));
    expect(await res.json()).toMatchObject({ skipped: "partial refund" });
    expect(await proUntil(db, "buyer")).not.toBeNull();
  });

  it("acks a refund for an order it never granted", async () => {
    const res = await post(app, orderRefunded("404"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "unknown-order" });
  });

  it("skips unpaid orders without recording anything", async () => {
    const res = await post(app, orderCreated({ status: "pending" }));
    expect(await res.json()).toMatchObject({ skipped: "not paid" });
    expect(await db.select().from(proPurchaseTable)).toHaveLength(0);
  });

  it("skips another product's variant", async () => {
    const res = await post(app, orderCreated({ variantId: 42 }));
    expect(await res.json()).toMatchObject({ skipped: "other product" });
    expect(await proUntil(db, "buyer")).toBeNull();
  });

  it("skips an event for a foreign store", async () => {
    const res = await post(app, orderCreated({ storeId: 99 }));
    expect(await res.json()).toMatchObject({ skipped: "foreign store" });
    expect(await proUntil(db, "buyer")).toBeNull();
  });

  it("acks an unattributed order (no user_id custom data)", async () => {
    const res = await post(app, orderCreated({ userId: null }));
    expect(await res.json()).toMatchObject({ skipped: "unattributed" });
    expect(await db.select().from(proPurchaseTable)).toHaveLength(0);
  });

  it("acks an order for a since-deleted account instead of retrying forever", async () => {
    const res = await post(app, orderCreated({ userId: "ghost" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "user-missing" });
  });

  it("acks events it doesn't handle", async () => {
    const body = JSON.stringify({
      meta: { event_name: "subscription_created" },
      data: { id: "1", attributes: {} },
    });
    const res = await post(app, body);
    expect(await res.json()).toMatchObject({ skipped: "unhandled event" });
  });
});
