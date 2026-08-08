import type { AppEnv } from "./env";

// Server-only Lemon Squeezy transport: hosted-checkout creation + webhook
// signature verification + the payload shapes the webhook route reads.
// Entitlement math stays in lib/pro.ts (pure); DB writes in server-lib/pro.ts.
//
// All four LEMONSQUEEZY_* secrets are optional at runtime: checkout creation
// no-ops to null when unconfigured (the action surfaces a friendly error, the
// local-dev posture every other integration here follows), while the webhook
// route REFUSES without its secret — accepting an unverifiable payment event
// would be worse than making Lemon Squeezy retry.

const CHECKOUT_ENDPOINT = "https://api.lemonsqueezy.com/v1/checkouts";
// Checkouts are minted per click, so a leaked/shared link expires on its own.
const CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Creates a single-use hosted checkout for the Pro variant, carrying the
 * buyer's user id as custom data (the webhook's only attribution channel —
 * Lemon Squeezy requires custom values to be strings). Returns the checkout
 * URL, or null when unconfigured or the API call fails.
 */
export async function createProCheckout(
  env: AppEnv,
  userId: string,
): Promise<string | null> {
  const apiKey = env.LEMONSQUEEZY_API_KEY;
  const storeId = env.LEMONSQUEEZY_STORE_ID;
  const variantId = env.LEMONSQUEEZY_VARIANT_ID;
  if (!apiKey || !storeId || !variantId) {
    console.error("[pro] Lemon Squeezy checkout is not configured");
    return null;
  }

  let res: Response;
  try {
    res = await fetch(CHECKOUT_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            product_options: {
              enabled_variants: [Number(variantId)],
              redirect_url: `${env.APP_URL}/tiers?pro=success`,
            },
            checkout_data: { custom: { user_id: userId } },
            expires_at: new Date(Date.now() + CHECKOUT_TTL_MS).toISOString(),
          },
          relationships: {
            store: { data: { type: "stores", id: String(storeId) } },
            variant: { data: { type: "variants", id: String(variantId) } },
          },
        },
      }),
    });
  } catch (err) {
    console.error("[pro] checkout create request failed", err);
    return null;
  }

  if (!res.ok) {
    console.error(
      `[pro] checkout create failed: ${res.status}`,
      await res.text().catch(() => ""),
    );
    return null;
  }

  const body = (await res.json().catch(() => null)) as {
    data?: { attributes?: { url?: unknown } };
  } | null;
  const url = body?.data?.attributes?.url;
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

const SIGNATURE_HEX = /^[0-9a-f]{64}$/i;

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Verifies the `X-Signature` header: hex HMAC-SHA256 of the RAW request body
 * under the dashboard-configured signing secret. crypto.subtle.verify does the
 * comparison, so it's constant-time by construction.
 */
export async function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHex: string | undefined,
): Promise<boolean> {
  if (!signatureHex || !SIGNATURE_HEX.test(signatureHex)) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    hexToBytes(signatureHex),
    encoder.encode(rawBody),
  );
}

// The slice of an order webhook (order_created / order_refunded) the route
// reads. Every field is optional — the payload is external input and the route
// must degrade to "ignore + log", never throw.
export type LemonSqueezyOrderEvent = {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    type?: string;
    id?: string;
    attributes?: {
      store_id?: number;
      identifier?: string;
      status?: string;
      refunded?: boolean;
      total?: number;
      currency?: string;
      test_mode?: boolean;
      created_at?: string;
      first_order_item?: { variant_id?: number };
    };
  };
};
