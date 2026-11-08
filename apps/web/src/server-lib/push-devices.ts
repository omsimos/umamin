import { pushSubscriptionTable } from "@umamin/db/schema/push-subscription";
import { userTable } from "@umamin/db/schema/user";
import { and, ne, type SQL, sql } from "drizzle-orm";
import type { Db } from "./db";

// user.pushPrefs stays non-zero only while the user has at least one
// push_subscription row. "On with zero devices" is not a state we keep: there
// is nowhere to deliver, and the settings toggle reads pushPrefs to tell
// whether the server will push to this account at all. Every write that can
// remove a user's last device (unregister, a 404/410 prune, a device moving to
// another account) puts this update in the same db.batch, so the device check
// and the write see the same rows and a concurrent register can't land between
// them and be left with prefs 0.
export function clearPushPrefsWithoutDevices(
  db: Pick<Db, "update">,
  // Picks the user row(s) to check. May correlate on userTable.id.
  which: SQL,
  // A device that is about to leave the user in this same batch and so must
  // not count as remaining.
  leavingEndpoint?: string,
) {
  const otherDevice = leavingEndpoint
    ? sql`AND ${pushSubscriptionTable.endpoint} <> ${leavingEndpoint}`
    : sql``;
  return db
    .update(userTable)
    .set({ pushPrefs: 0 })
    .where(
      and(
        which,
        ne(userTable.pushPrefs, 0),
        sql`NOT EXISTS (SELECT 1 FROM ${pushSubscriptionTable} WHERE ${pushSubscriptionTable.userId} = ${userTable.id} ${otherDevice})`,
      ),
    );
}
