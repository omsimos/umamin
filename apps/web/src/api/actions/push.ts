import { pushSubscriptionTable } from "@umamin/db/schema/push-subscription";
import { userTable } from "@umamin/db/schema/user";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { ALL_PUSH_CATEGORIES } from "../../lib/push-prefs";
import { action } from "../../server-lib/action";
import { isAllowedPushEndpoint } from "../../server-lib/push";
import { ctxDb } from "./_shared";

const PUSH_DEVICE_CAP = 20;

const endpointSchema = z
  .string()
  .max(512)
  .refine(isAllowedPushEndpoint, "Invalid push endpoint");

const registerSchema = z.object({
  endpoint: endpointSchema,
  p256dh: z.string().min(1).max(255),
  auth: z.string().min(1).max(255),
});

export const registerPushSubscriptionHandler = action(
  {
    schema: registerSchema,
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `push:${user.id}` },
  },
  async ({ endpoint, p256dh, auth }, { user, c }) => {
    const db = ctxDb(c);
    await db
      .insert(pushSubscriptionTable)
      .values({ userId: user.id, endpoint, p256dh, auth })
      .onConflictDoUpdate({
        target: pushSubscriptionTable.endpoint,
        set: { userId: user.id, p256dh, auth, failureCount: 0 },
      });

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

    await db
      .update(userTable)
      .set({ pushPrefs: ALL_PUSH_CATEGORIES })
      .where(eq(userTable.id, user.id));

    return { pushPrefs: ALL_PUSH_CATEGORIES };
  },
);

const unregisterSchema = z.object({ endpoint: endpointSchema });

export const unregisterPushSubscriptionHandler = action(
  {
    schema: unregisterSchema,
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `push:${user.id}` },
  },
  async ({ endpoint }, { user, c }) => {
    const db = ctxDb(c);
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

    return { pushPrefs: 0 };
  },
);
