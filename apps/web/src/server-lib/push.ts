import {
  type PushSubscriptionData,
  type SendPushOptions,
  sendPushNotification,
  type VapidConfig,
} from "@mmmike/web-push/send";

// Web Push send primitive for the Worker runtime (plan R3). @node-rs/argon2's
// sibling `web-push` uses Node crypto and won't run on Workers; @mmmike/web-push
// is pure WebCrypto, emits RFC 8291 aes128gcm + `Authorization: vapid t=…, k=…`
// (byte-identical wire format to prod's `web-push` npm default), and takes VAPID
// keys as URL-safe base64 — the SAME format already stored in VAPID_* envs, so
// the prod keypair and every existing subscription port with zero conversion.

// Endpoint allowlist ported verbatim from apps/www/lib/push-endpoint.ts. The send
// path re-validates (defense-in-depth): a stored endpoint is used as an outbound
// target, so an allowlist is the SSRF backstop even though registration validates.
const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com", // Chrome / Edge / all Chromium browsers (FCM)
];

const ALLOWED_PUSH_HOST_SUFFIXES = [
  ".push.services.mozilla.com", // Firefox (Mozilla autopush)
  ".push.apple.com", // Safari / iOS / macOS (web.push.apple.com)
  ".notify.windows.com", // legacy Windows / EdgeHTML (WNS)
];

export function isAllowedPushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.port !== "") return false;

  const host = url.hostname.toLowerCase();
  return (
    ALLOWED_PUSH_HOSTS.includes(host) ||
    ALLOWED_PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

// The subscription row shape stored in push_subscription (endpoint + keys),
// matching apps/www's DB projection.
export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// Exact prod payload shape (service worker reads title/url/tag). Kept distinct
// from the lib's PushPayload (which allows a `body` we never send, and makes
// url/tag optional) so the serialized JSON stays byte-for-byte what apps/www
// sends today. Assignable to PushPayload since 1.1.0 made `body` optional.
export type PushNotificationPayload = {
  title: string;
  url: string;
  tag: string;
};

// `expired` mirrors web-push's 404/410 semantics → caller prunes the dead sub.
export type SendPushResult = { ok: true } | { ok: false; expired: boolean };

/**
 * Send one Web Push notification. Mirrors the semantics of apps/www's
 * webpush.sendNotification wrapper: validates the endpoint, sends with a TTL,
 * and reports 404/410 as `expired` so the caller can prune the subscription.
 * Other push-service errors throw (best-effort caller catches, as today).
 */
export async function sendPush(
  subscription: PushSubscriptionRow,
  payload: PushNotificationPayload,
  vapid: VapidConfig,
  // No TTL default here: callers own retention, and omitting opts.ttl falls
  // back to the lib's 24h (the notification fan-out passes 1h explicitly).
  opts: SendPushOptions = {},
): Promise<SendPushResult> {
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    throw new Error("Push endpoint not allowed");
  }

  const sub: PushSubscriptionData = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };

  const delivered = await sendPushNotification(sub, payload, vapid, opts);

  // sendPushNotification returns false only on 404/410 (dead subscription).
  return delivered ? { ok: true } : { ok: false, expired: true };
}
