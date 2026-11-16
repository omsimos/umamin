import { pushSubscriptionTable } from "@umamin/db/schema/push-subscription";
import { userTable } from "@umamin/db/schema/user";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { PUSH_CATEGORY } from "../lib/push-prefs";
import {
  STREAK_RESTORES_PER_MONTH,
  toStreakDay,
  toStreakMonth,
} from "../lib/streak";
import type { Db } from "./db";
import type { AppEnv } from "./env";
import { deliverPush, type PushDevice } from "./notification-push";

// Daily streak pushes, run by the "0 1,12 * * *" cron (09:00 and 20:00
// Manila). "ending" goes to streaks that end at midnight unless the user saves
// today; "restore" goes the morning after one missed day, while the user
// still has a restore this month.
export type StreakPushKind = "ending" | "restore";

// Each device is one subrequest. Stay well under the Worker's per-invocation
// limit; anyone past the cap misses one reminder, and the log says so.
const MAX_DEVICES_PER_RUN = 900;
const SEND_CONCURRENCY = 25;

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

/** Users due a streak push today, one row per device. */
export function streakPushQuery(
  db: Db,
  kind: StreakPushKind,
  today: number,
  month: number,
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
        sql`(${userTable.pushPrefs} & ${PUSH_CATEGORY.streak}) <> 0`,
        isNull(userTable.bannedAt),
        kind === "restore"
          ? or(
              sql`${userTable.streakRestoreMonth} IS NOT ${month}`,
              sql`${userTable.streakRestoresUsed} < ${STREAK_RESTORES_PER_MONTH}`,
            )
          : undefined,
      ),
    )
    .limit(MAX_DEVICES_PER_RUN + 1);
}

export async function sendStreakPushes(
  db: Db,
  env: AppEnv,
  kind: StreakPushKind,
  now = Date.now(),
): Promise<{ users: number; devices: number; capped: boolean }> {
  const today = toStreakDay(now);
  const month = toStreakMonth(now);

  const rows = await streakPushQuery(db, kind, today, month);

  const capped = rows.length > MAX_DEVICES_PER_RUN;
  const byUser = new Map<string, { streak: number; subs: PushDevice[] }>();
  for (const row of rows.slice(0, MAX_DEVICES_PER_RUN)) {
    const entry = byUser.get(row.userId) ?? { streak: row.streak, subs: [] };
    entry.subs.push({
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
    });
    byUser.set(row.userId, entry);
  }

  const users = [...byUser.entries()];
  for (let i = 0; i < users.length; i += SEND_CONCURRENCY) {
    await Promise.all(
      users.slice(i, i + SEND_CONCURRENCY).map(([userId, { streak, subs }]) =>
        deliverPush(
          db,
          env,
          userId,
          subs,
          {
            title: streakPushTitle(kind, streak),
            url: "/notes",
            // One per user per day per kind on the device.
            tag: `streak-${kind}:${today}`,
          },
          `streak-${kind}`,
        ).catch((err) => {
          console.error(`[cron] streak push failed for one user`, err);
        }),
      ),
    );
  }

  return {
    users: byUser.size,
    devices: Math.min(rows.length, MAX_DEVICES_PER_RUN),
    capped,
  };
}
