import { callAction } from "@/lib/api";
import { ExpectedError } from "@/lib/expected-error";
import {
  getExistingSubscription,
  isPushSupported,
  unsubscribeFromPush,
} from "@/lib/push-client";
import { writePushOwner } from "@/lib/push-owner";

const PUSH_STEP_TIMEOUT_MS = 3000;

// Push is best effort and time-boxed, so it can never block a sign-out.
function bestEffort<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    work().catch(() => fallback),
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), PUSH_STEP_TIMEOUT_MS);
    }),
  ]);
}

// A push subscription belongs to the browser, not the session. Without this,
// the next person on a shared device keeps getting the signed-out account's
// notifications.
//
// The one sign-out sequence, shared by Settings and the account drawer. The
// logout action removes this browser's push row in the same batch that ends
// the session, and the browser unsubscribes only once that succeeded. A
// failed logout leaves the user signed in with push still working.
// callAction never rejects, so a failed logout is thrown here for the caller's
// onError.
export async function signOut(): Promise<{ redirect: string }> {
  const sub = isPushSupported()
    ? await bestEffort(getExistingSubscription, null)
    : null;
  const res = await callAction<{ redirect: string }>(
    "logout",
    sub ? { pushEndpoint: sub.endpoint } : undefined,
  );
  if ("error" in res) throw new ExpectedError(res.error);
  if (sub) {
    await bestEffort(async () => {
      writePushOwner("");
      await unsubscribeFromPush();
    }, undefined);
  }
  return res;
}
