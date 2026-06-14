"use server";

import { db } from "@umamin/db";
import { pushSubscriptionTable } from "@umamin/db/schema/push-subscription";
import { userTable } from "@umamin/db/schema/user";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { isAllowedPushEndpoint } from "@/lib/push-endpoint";
import { ALL_PUSH_CATEGORIES } from "@/lib/push-prefs";
import { withAction } from "@/lib/server/with-action";

// Generous bound on devices per account (a real user has 1-5). Caps
// self-inflicted row growth / fan-out bloat, mirroring the codebase's
// cap-everything convention; register can't touch another user's rows.
const PUSH_DEVICE_CAP = 20;

// The endpoint becomes an outbound request target (web-push), so constrain it
// to a public https:// URL here — z.url() alone accepts file:/internal-IP/etc.
const endpointSchema = z
  .string()
  .max(512)
  .refine(isAllowedPushEndpoint, "Invalid push endpoint");

const registerSchema = z.object({
  endpoint: endpointSchema,
  p256dh: z.string().min(1).max(255),
  auth: z.string().min(1).max(255),
});

// Invalidate the caller's own cached records (pushPrefs rides the current-user
// read). updateTag is read-your-writes + Server-Actions-only.
function revalidateSelf(userId: string, username: string) {
  updateTag(`user:${username}`);
  updateTag(`user:${userId}`);
  updateTag(`user:${userId}:accounts`);
}

/**
 * Persists this device's push subscription and turns the master toggle on.
 * The endpoint is a per-device bearer capability; the row is always written
 * with the SESSION's userId (never a client-supplied id). Idempotent: a
 * re-subscribe (same endpoint) updates in place, and a device that moved
 * accounts re-points its userId. Programmatic-call only (never <form action>).
 */
export const registerPushSubscriptionAction = withAction(
  {
    schema: registerSchema,
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `push:${user.id}` },
  },
  async ({ endpoint, p256dh, auth }, { user }) => {
    await db
      .insert(pushSubscriptionTable)
      .values({ userId: user.id, endpoint, p256dh, auth })
      .onConflictDoUpdate({
        target: pushSubscriptionTable.endpoint,
        set: { userId: user.id, p256dh, auth, failureCount: 0 },
      });

    // Keep only the most recent PUSH_DEVICE_CAP devices for this user (bounded,
    // user-indexed; a no-op while under the cap).
    await db
      .delete(pushSubscriptionTable)
      .where(
        and(
          eq(pushSubscriptionTable.userId, user.id),
          notInArray(
            pushSubscriptionTable.id,
            db
              .select({ id: pushSubscriptionTable.id })
              .from(pushSubscriptionTable)
              .where(eq(pushSubscriptionTable.userId, user.id))
              .orderBy(desc(pushSubscriptionTable.createdAt))
              .limit(PUSH_DEVICE_CAP),
          ),
        ),
      );

    // Opting in on a device enables push for the account. v1 is all-or-nothing
    // (ALL or 0); Phase 2's per-category UI will preserve an existing subset.
    await db
      .update(userTable)
      .set({ pushPrefs: ALL_PUSH_CATEGORIES })
      .where(eq(userTable.id, user.id));

    revalidateSelf(user.id, user.username);
    return { pushPrefs: ALL_PUSH_CATEGORIES };
  },
);

const unregisterSchema = z.object({
  endpoint: endpointSchema,
});

/**
 * Removes this device's subscription. The delete is scoped to the caller's own
 * rows (endpoint AND userId) so one user can't prune another's subscription.
 * Clears the master toggle only when no devices remain — so disabling on one
 * device (or self-healing a stale row) doesn't silence the user's other
 * devices. Returns the new pushPrefs, or null when it's unchanged.
 */
export const unregisterPushSubscriptionAction = withAction(
  {
    schema: unregisterSchema,
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `push:${user.id}` },
  },
  async ({ endpoint }, { user }) => {
    await db
      .delete(pushSubscriptionTable)
      .where(
        and(
          eq(pushSubscriptionTable.endpoint, endpoint),
          eq(pushSubscriptionTable.userId, user.id),
        ),
      );

    const [remaining] = await db
      .select({ id: pushSubscriptionTable.id })
      .from(pushSubscriptionTable)
      .where(eq(pushSubscriptionTable.userId, user.id))
      .limit(1);

    if (remaining) {
      return { pushPrefs: null };
    }

    await db
      .update(userTable)
      .set({ pushPrefs: 0 })
      .where(eq(userTable.id, user.id));

    revalidateSelf(user.id, user.username);
    return { pushPrefs: 0 };
  },
);
