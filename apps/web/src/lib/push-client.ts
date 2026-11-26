import {
  getCurrentSubscription,
  isPushSupported as libIsPushSupported,
  serializeSubscription,
  subscribe,
} from "@mmmike/web-push/client";
import { ExpectedError } from "@/lib/expected-error";
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

// The lib waits on navigator.serviceWorker.ready, which never settles when no
// worker was registered (a failed or skipped register()), so a caller would
// hang on "loading". getRegistration() resolves undefined right away instead.
async function getPushRegistration(): Promise<
  ServiceWorkerRegistration | undefined
> {
  if (!isPushSupported()) return undefined;
  return navigator.serviceWorker.getRegistration();
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const registration = await getPushRegistration();
  if (!registration) return null;
  return getCurrentSubscription({ registration });
}

// Subscribes this device and returns the fields the server needs. Caller must
// have already obtained Notification permission from a user gesture; the lib
// re-checks, so a non-granted state surfaces here as a throw.
export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<SerializedSubscription> {
  const registration = await getPushRegistration();
  const result = registration
    ? await subscribe(vapidPublicKey, { registration })
    : ({ status: "unsupported" } as const);
  if (result.status !== "subscribed") {
    throw new ExpectedError(
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
// returns the endpoint anyway: a caller that prunes the server row on that
// endpoint would leave a live browser subscription it believes is gone. A
// failure here has to surface to the caller.
export async function unsubscribeFromPush(): Promise<string | null> {
  const sub = await getExistingSubscription();
  if (!sub) return null;
  const { endpoint } = sub;
  await sub.unsubscribe();
  return endpoint;
}
