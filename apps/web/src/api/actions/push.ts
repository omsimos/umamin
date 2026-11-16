import { urlBase64ToUint8Array } from "@mmmike/web-push/vapid";
import { pushSubscriptionTable } from "@umamin/db/schema/push-subscription";
import { userTable } from "@umamin/db/schema/user";
import { and, desc, eq, ne, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { ALL_PUSH_CATEGORIES, PUSH_CATEGORY } from "../../lib/push-prefs";
import { action } from "../../server-lib/action";
import { pushEndpointSchema } from "../../server-lib/push";
import { clearPushPrefsWithoutDevices } from "../../server-lib/push-devices";
import { ctxDb } from "./_shared";

const PUSH_DEVICE_CAP = 20;

function decodesTo(value: string, ok: (bytes: Uint8Array) => boolean) {
  try {
    return ok(urlBase64ToUint8Array(value));
  } catch {
    return false;
  }
}

const registerSchema = z.object({
  endpoint: pushEndpointSchema,
  // The same checks the push library makes before it sends: an uncompressed
  // P-256 point and a secret of at least 16 bytes.
  p256dh: z
    .string()
    .max(255)
    .refine(
      (v) => decodesTo(v, (b) => b.length === 65 && b[0] === 0x04),
      "Invalid push key",
    ),
  auth: z
    .string()
    .max(255)
    .refine((v) => decodesTo(v, (b) => b.length >= 16), "Invalid push key"),
});

export const registerPushSubscriptionHandler = action(
  {
    schema: registerSchema,
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `push:${user.id}` },
  },
  async ({ endpoint, p256dh, auth }, { user, c }) => {
    const db = ctxDb(c);
    const [, , , prefsRows] = await db.batch([
      // A browser shared between accounts moves its row to whoever registers
      // last, and that may have been the previous account's only device. This
      // runs before the upsert, while the row still names the previous owner.
      clearPushPrefsWithoutDevices(
        db,
        sql`${userTable.id} = (SELECT ${pushSubscriptionTable.userId} FROM ${pushSubscriptionTable} WHERE ${pushSubscriptionTable.endpoint} = ${endpoint}) AND ${ne(userTable.id, user.id)}`,
        endpoint,
      ),
      db
        .insert(pushSubscriptionTable)
        .values({ userId: user.id, endpoint, p256dh, auth })
        .onConflictDoUpdate({
          target: pushSubscriptionTable.endpoint,
          set: { userId: user.id, p256dh, auth, failureCount: 0 },
        }),
      db
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
        ),
      // Turning push on from off enables every category. A user who already
      // has push on keeps their prefs, so a second device doesn't undo a
      // streak reminder opt-out.
      db
        .update(userTable)
        .set({
          pushPrefs: sql`CASE WHEN ${userTable.pushPrefs} = 0 THEN ${ALL_PUSH_CATEGORIES} ELSE ${userTable.pushPrefs} END`,
        })
        .where(eq(userTable.id, user.id))
        .returning({ pushPrefs: userTable.pushPrefs }),
    ]);

    return { pushPrefs: prefsRows[0]?.pushPrefs ?? ALL_PUSH_CATEGORIES };
  },
);

const unregisterSchema = z.object({ endpoint: pushEndpointSchema });

export const unregisterPushSubscriptionHandler = action(
  {
    schema: unregisterSchema,
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `push:${user.id}` },
  },
  async ({ endpoint }, { user, c }) => {
    const db = ctxDb(c);
    const [, , prefsRows] = await db.batch([
      db
        .delete(pushSubscriptionTable)
        .where(
          and(
            eq(pushSubscriptionTable.endpoint, endpoint),
            eq(pushSubscriptionTable.userId, user.id),
          ),
        ),
      clearPushPrefsWithoutDevices(db, eq(userTable.id, user.id)),
      db
        .select({ pushPrefs: userTable.pushPrefs })
        .from(userTable)
        .where(eq(userTable.id, user.id))
        .limit(1),
    ]);

    return { pushPrefs: prefsRows[0]?.pushPrefs ?? 0 };
  },
);

// Flips streak reminders alone. Only while push is on: a user with no device
// has prefs 0, and turning push on later enables every category.
export const toggleStreakPushHandler = action(
  {
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `push:${user.id}` },
  },
  async (_input, { user, c }) => {
    const [row] = await ctxDb(c)
      .update(userTable)
      .set({
        // SQLite has no XOR operator.
        pushPrefs: sql`CASE WHEN ${userTable.pushPrefs} & ${PUSH_CATEGORY.streak}
          THEN ${userTable.pushPrefs} & ~${PUSH_CATEGORY.streak}
          ELSE ${userTable.pushPrefs} | ${PUSH_CATEGORY.streak} END`,
      })
      .where(and(eq(userTable.id, user.id), ne(userTable.pushPrefs, 0)))
      .returning({ pushPrefs: userTable.pushPrefs });

    if (!row) return { error: "Turn on push notifications first." };
    return { pushPrefs: row.pushPrefs };
  },
);
