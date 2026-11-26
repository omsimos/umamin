import { pushSubscriptionTable } from "@umamin/db/schema/push-subscription";
import { userTable } from "@umamin/db/schema/user";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { toStreakDay, toStreakMonth } from "../lib/streak";
import type { Db } from "./db";
import {
  deliverPush,
  type PushDevice,
  type PushFailureReport,
  type Vapid,
} from "./notification-push";
import { hasRestoreLeft } from "./streak";

// Daily streak pushes, run by the "0 1,12 * * *" cron (09:00 and 20:00
// Manila). "ending" goes to streaks that end at midnight unless the user saves
// today; "restore" goes the morning after one missed day, while the user
// still has a restore this month.
export type StreakPushKind = "ending" | "restore";

// Paid Workers get 10,000 subrequests per invocation. A device costs at most
// two: the send, and a prune batch when the endpoint is dead. Failure reports
// are batched into one per run, so 4,000 devices stay under the limit with
// room to spare.
export const MAX_DEVICES_PER_RUN = 4000;
// Workers keep six outgoing connections open at a time and queue the rest.
// A queued send's 5 s timeout already runs while it waits, so a wider pool
// would only turn queueing into timeouts. Six users, each with a device or
// two, keeps the connections busy without that.
const SEND_CONCURRENCY = 6;
// A cron invocation gets 15 minutes of wall time. A run killed at the limit
// never logs or reports, so stop starting sends well before it.
export const SEND_DEADLINE_MS = 10 * 60 * 1000;

export function streakPushKindForHour(utcHour: number): StreakPushKind | null {
  if (utcHour === 12) return "ending";
  if (utcHour === 1) return "restore";
  return null;
}

export function streakPushTitle(kind: StreakPushKind, streak: number) {
  return kind === "ending"
    ? `Your ${streak}-day streak ends at midnight`
    : `Your ${streak}-day streak ended. Restore it today`;
}

/**
 * Users due a streak push today, one row per device, grouped by user. User
 * ids are random, so starting the order at a random pivot and wrapping
 * around means a capped run skips different users each day instead of the
 * same ones every time.
 */
export function streakPushQuery(
  db: Db,
  kind: StreakPushKind,
  today: number,
  month: number,
  pivot: string,
  limit: number,
) {
  return db
    .select({
      userId: userTable.id,
      streak: userTable.streak,
      endpoint: pushSubscriptionTable.endpoint,
      p256dh: pushSubscriptionTable.p256dh,
      auth: pushSubscriptionTable.auth,
    })
    .from(userTable)
    .innerJoin(
      pushSubscriptionTable,
      eq(pushSubscriptionTable.userId, userTable.id),
    )
    .where(
      and(
        eq(userTable.streakDay, kind === "ending" ? today - 1 : today - 2),
        // The WHERE of user_streak_day_idx, repeated so SQLite uses it.
        sql`${userTable.streak} >= 2 AND ${userTable.pushPrefs} <> 0`,
        eq(userTable.streakPushOff, false),
        isNull(userTable.bannedAt),
        kind === "restore" ? hasRestoreLeft(month) : undefined,
      ),
    )
    .orderBy(sql`${userTable.id} < ${pivot}`, asc(userTable.id))
    .limit(limit);
}

export type StreakPushResult = {
  users: number;
  devices: number;
  capped: boolean;
  // Stopped at the deadline; users and devices count only what was sent.
  deadlineHit: boolean;
  failures: number;
  firstFailure: unknown;
};

export async function sendStreakPushes(
  db: Db,
  vapid: Vapid,
  kind: StreakPushKind,
  now = Date.now(),
  pivot = nanoid(),
  maxDevices = MAX_DEVICES_PER_RUN,
  deadlineMs = SEND_DEADLINE_MS,
): Promise<StreakPushResult> {
  const deadline = Date.now() + deadlineMs;
  const today = toStreakDay(now);
  const month = toStreakMonth(now);

  const rows = await streakPushQuery(
    db,
    kind,
    today,
    month,
    pivot,
    maxDevices + 1,
  );

  // Cut at a whole user so nobody gets the push on only some devices: past
  // the cap, drop every row of the last user that made it in.
  const capped = rows.length > maxDevices;
  let kept = rows.slice(0, maxDevices);
  if (capped) {
    const boundary = rows[maxDevices]?.userId;
    kept = kept.filter((row) => row.userId !== boundary);
  }

  const byUser = new Map<string, { streak: number; subs: PushDevice[] }>();
  for (const row of kept) {
    const entry = byUser.get(row.userId) ?? { streak: row.streak, subs: [] };
    entry.subs.push({
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
    });
    byUser.set(row.userId, entry);
  }

  let failures = 0;
  let firstFailure: unknown = null;
  const report: PushFailureReport = (err) => {
    failures += 1;
    firstFailure ??= err;
  };

  const users = [...byUser.entries()];
  let next = 0;
  let sentUsers = 0;
  let sentDevices = 0;
  let deadlineHit = false;
  // A pool rather than fixed batches, so one slow send holds only its worker.
  await Promise.all(
    Array.from(
      { length: Math.min(SEND_CONCURRENCY, users.length) },
      async () => {
        while (next < users.length) {
          if (Date.now() >= deadline) {
            deadlineHit = true;
            return;
          }
          const [userId, { streak, subs }] = users[next++];
          sentUsers += 1;
          sentDevices += subs.length;
          await deliverPush(
            db,
            userId,
            subs,
            {
              title: streakPushTitle(kind, streak),
              url: "/notes",
              // One per user per day per kind on the device.
              tag: `streak-${kind}:${today}`,
            },
            vapid,
            report,
          ).catch((err: unknown) => report(err, "send failed"));
        }
      },
    ),
  );

  return {
    users: sentUsers,
    devices: sentDevices,
    capped,
    deadlineHit,
    failures,
    firstFailure,
  };
}
