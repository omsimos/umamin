import { callAction } from "@/lib/api";
import { ExpectedError } from "@/lib/expected-error";
import {
  getExistingSubscription,
  isPushSupported,
  unsubscribeFromPush,
} from "@/lib/push-client";
import { writePushOwner } from "@/lib/push-owner";

const PUSH_RELEASE_TIMEOUT_MS = 3000;

async function releasePush(): Promise<void> {
  if (!isPushSupported()) return;
  const sub = await getExistingSubscription();
  if (!sub) return;
  // Server row first, while the session still exists. Its result is ignored:
  // once the browser unsubscribes, the next send gets a 410 and the server
  // prunes the row itself.
  await callAction("unregisterPushSubscriptionAction", {
    endpoint: sub.endpoint,
  });
  writePushOwner("");
  await unsubscribeFromPush();
}

// A push subscription belongs to the browser, not the session. Without this,
// the next person on a shared device keeps getting the signed-out account's
// notifications. Best effort and time-boxed, so it can never block a sign-out.
async function releasePushForSignOut(): Promise<void> {
  await Promise.race([
    releasePush().catch(() => undefined),
    new Promise<void>((resolve) => {
      setTimeout(resolve, PUSH_RELEASE_TIMEOUT_MS);
    }),
  ]);
}

// The one sign-out sequence, shared by Settings and the account drawer.
// callAction never rejects, so a failed logout is thrown here for the caller's
// onError.
export async function signOut(): Promise<{ redirect: string }> {
  await releasePushForSignOut();
  const res = await callAction<{ redirect: string }>("logout");
  if ("error" in res) throw new ExpectedError(res.error);
  return res;
}
