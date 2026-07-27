import { isStandaloneMode } from "@/lib/pwa";

export type SerializedSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// iOS/iPadOS Safari only supports Web Push for installed (Home Screen,
// standalone) PWAs — pushManager.subscribe throws in a plain Safari tab. Gate
// the opt-in behind an install prompt when this is true.
export function isIosWebPushBlocked(): boolean {
  if (typeof navigator === "undefined") return false;
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIos && !isStandaloneMode();
}

// VAPID applicationServerKey must be a Uint8Array of the URL-safe-base64 public
// key. Pinned to an ArrayBuffer backing so it satisfies BufferSource (a
// SharedArrayBuffer-backed view is not assignable under the current DOM lib).
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function serialize(sub: PushSubscription): SerializedSubscription {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  };
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// Subscribes this device (reusing an existing subscription if present) and
// returns the fields the server needs. Caller must have already obtained
// Notification permission from a user gesture.
export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<SerializedSubscription> {
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));
  return serialize(sub);
}

// Unsubscribes this device's PushManager and returns the endpoint so the caller
// can prune the matching server row. Null when there was nothing to unsubscribe.
export async function unsubscribeFromPush(): Promise<string | null> {
  const sub = await getExistingSubscription();
  if (!sub) return null;
  const { endpoint } = sub;
  await sub.unsubscribe();
  return endpoint;
}
