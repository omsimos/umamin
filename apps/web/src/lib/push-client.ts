import {
  getCurrentSubscription,
  isPushSupported as libIsPushSupported,
  serializeSubscription,
  subscribe,
} from "@mmmike/web-push/client";
import { isStandaloneMode } from "@/lib/pwa";

// Thin app wrapper over @mmmike/web-push/client. The lib owns the PushManager
// mechanics — including replacing a subscription bound to a rotated VAPID key,
// which the old hand-rolled version reused blindly (dead sends after a key
// rotation). This module keeps only the app-specific parts: the SSR guard, the
// iOS install gate, and the flat {endpoint,p256dh,auth} shape
// registerPushSubscriptionAction expects.

export type SerializedSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// The lib's check touches navigator/window unconditionally; guard for SSR.
export function isPushSupported(): boolean {
  return typeof window !== "undefined" && libIsPushSupported();
}

// iOS/iPadOS Safari only supports Web Push for installed (Home Screen,
// standalone) PWAs — pushManager.subscribe throws in a plain Safari tab. Gate
// the opt-in behind an install prompt when this is true.
export function isIosWebPushBlocked(): boolean {
  if (typeof navigator === "undefined") return false;
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIos && !isStandaloneMode();
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  // SSR guard only — getCurrentSubscription re-checks push support itself.
  if (typeof window === "undefined") return null;
  return getCurrentSubscription();
}

// Subscribes this device and returns the fields the server needs. Caller must
// have already obtained Notification permission from a user gesture; the lib
// re-checks, so a non-granted state surfaces here as a throw.
export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<SerializedSubscription> {
  const result = await subscribe(vapidPublicKey);
  if (result.status !== "subscribed") {
    throw new Error(
      result.status === "denied"
        ? "Notifications are blocked. Re-enable them in your browser or device settings."
        : "Push notifications are not supported in this browser.",
    );
  }
  // serializeSubscription throws on a missing p256dh/auth key; its message is
  // internal and the caller toasts whatever surfaces here.
  try {
    const { endpoint, keys } = serializeSubscription(result.subscription);
    return { endpoint, ...keys };
  } catch {
    throw new Error("This browser returned an unusable push subscription.");
  }
}

// Unsubscribes this device's PushManager and returns the endpoint so the caller
// can prune the matching server row. Null when there was nothing to
// unsubscribe (including during SSR).
//
// Deliberately NOT the lib's unsubscribe(), which swallows a rejection and
// returns the endpoint anyway: that prunes the server row while the browser
// subscription survives, so the toggle reads "on" for a device the server can
// never reach again. A failure here has to surface to the caller.
export async function unsubscribeFromPush(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const sub = await getCurrentSubscription();
  if (!sub) return null;
  const { endpoint } = sub;
  await sub.unsubscribe();
  return endpoint;
}
