import { beforeEach, describe, expect, it, vi } from "vitest";

// argon2's precompiled .wasm import only resolves in the workers pool; this
// node-pool suite pulls argon2 in transitively via actionsApp but never calls it.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

// Keeps the real endpoint allowlist; only the network send is faked.
vi.mock("../src/server-lib/push", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/server-lib/push")>();
  return { ...actual, sendPush: vi.fn() };
});

import { pushSubscriptionTable } from "@umamin/db/schema/push-subscription";
import { userTable } from "@umamin/db/schema/user";
import { eq, sql } from "drizzle-orm";
import { ALL_PUSH_CATEGORIES, PUSH_CATEGORY } from "../src/lib/push-prefs";
import {
  restorableStreak,
  restoresLeft,
  toStreakDay,
  toStreakMonth,
} from "../src/lib/streak";
import { getPublicUserProfileData } from "../src/server-lib/data";
import type { Db } from "../src/server-lib/db";
import type { AppEnv } from "../src/server-lib/env";
import { sendPush } from "../src/server-lib/push";
import { __clearSessionCache } from "../src/server-lib/session";
import { recordStreak, restoreStreak } from "../src/server-lib/streak";
import {
  sendStreakPushes,
  streakPushKindForHour,
  streakPushQuery,
} from "../src/server-lib/streak-push";
import { authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

const HOUR_MS = 60 * 60 * 1000;
// Noon in Manila on 2026-11-16.
const NOW = Date.UTC(2026, 10, 16, 4);
const TODAY = toStreakDay(NOW);
const MONTH = toStreakMonth(NOW);

describe("toStreakMonth", () => {
  it("rolls over at Manila midnight on the last day of the month", () => {
    // 2026-11-30 16:00 UTC is midnight on 2026-12-01 in Manila.
    const before = toStreakMonth(Date.UTC(2026, 10, 30, 15, 59, 59));
    const after = toStreakMonth(Date.UTC(2026, 10, 30, 16));
    expect(after).toBe(before + 1);
  });
});

describe("restorableStreak", () => {
  it("offers yesterday's streak before anything is saved today", () => {
    expect(restorableStreak({ streak: 40, streakDay: TODAY - 2 }, TODAY)).toBe(
      40,
    );
  });

  it("offers the reset streak after today's save", () => {
    expect(
      restorableStreak(
        { streak: 1, streakDay: TODAY, streakBroken: 40 },
        TODAY,
      ),
    ).toBe(40);
  });

  it("offers nothing after two missed days or for a 1-day streak", () => {
    expect(restorableStreak({ streak: 40, streakDay: TODAY - 3 }, TODAY)).toBe(
      0,
    );
    expect(restorableStreak({ streak: 1, streakDay: TODAY - 2 }, TODAY)).toBe(
      0,
    );
  });

  it("offers nothing for a live streak", () => {
    expect(restorableStreak({ streak: 40, streakDay: TODAY - 1 }, TODAY)).toBe(
      0,
    );
    expect(
      restorableStreak(
        { streak: 40, streakDay: TODAY, streakBroken: 0 },
        TODAY,
      ),
    ).toBe(0);
  });
});

describe("restoresLeft", () => {
  it("counts down within a month and resets in the next", () => {
    const used = { streakRestoresUsed: 2, streakRestoreMonth: MONTH };
    expect(restoresLeft(used, MONTH)).toBe(1);
    expect(restoresLeft(used, MONTH + 1)).toBe(3);
    expect(restoresLeft({}, MONTH)).toBe(3);
  });
});

describe("restoreStreak (real libSQL)", () => {
  let db: Db;

  async function row() {
    const [r] = await db
      .select({
        streak: userTable.streak,
        streakBest: userTable.streakBest,
        streakDay: userTable.streakDay,
        streakBroken: userTable.streakBroken,
        streakRestoresUsed: userTable.streakRestoresUsed,
        streakRestoreMonth: userTable.streakRestoreMonth,
      })
      .from(userTable)
      .where(eq(userTable.id, "u1"));
    return r;
  }

  async function seed(values: Partial<typeof userTable.$inferInsert>) {
    await db
      .insert(userTable)
      .values({ id: "u1", username: "u_u1", streakBest: 40, ...values });
  }

  beforeEach(async () => {
    db = await makeTestDb();
  });

  it("covers yesterday and today when nothing was saved today", async () => {
    await seed({ streak: 40, streakDay: TODAY - 2 });

    expect(await restoreStreak(db, "u1", NOW)).toEqual({
      streak: 40,
      streakDay: TODAY,
      streakBroken: 0,
      streakRestoresUsed: 1,
      streakRestoreMonth: MONTH,
    });
    // A save later today was already covered; tomorrow's extends it.
    expect(await recordStreak(db, "u1", TODAY)).toBeNull();
    expect((await recordStreak(db, "u1", TODAY + 1))?.streak).toBe(41);
  });

  it("brings back the count a save already reset today", async () => {
    await seed({ streak: 40, streakDay: TODAY - 2 });
    expect(await recordStreak(db, "u1", TODAY)).toEqual({
      streak: 1,
      streakDay: TODAY,
      streakBroken: 40,
    });

    await restoreStreak(db, "u1", NOW);
    expect(await row()).toMatchObject({
      streak: 40,
      streakBest: 40,
      streakDay: TODAY,
      streakBroken: 0,
    });
    expect((await recordStreak(db, "u1", TODAY + 1))?.streak).toBe(41);
  });

  it("refuses after two missed days", async () => {
    await seed({ streak: 40, streakDay: TODAY - 3 });
    expect(await restoreStreak(db, "u1", NOW)).toBeNull();
    expect((await row())?.streakRestoresUsed).toBe(0);
  });

  it("refuses a 1-day streak", async () => {
    await seed({ streak: 1, streakDay: TODAY - 2 });
    expect(await restoreStreak(db, "u1", NOW)).toBeNull();
  });

  it("refuses the fourth restore in a month", async () => {
    await seed({
      streak: 40,
      streakDay: TODAY - 2,
      streakRestoresUsed: 3,
      streakRestoreMonth: MONTH,
    });
    expect(await restoreStreak(db, "u1", NOW)).toBeNull();
  });

  it("starts a new month's count at 1", async () => {
    await seed({
      streak: 40,
      streakDay: TODAY - 2,
      streakRestoresUsed: 3,
      streakRestoreMonth: MONTH - 1,
    });
    expect((await restoreStreak(db, "u1", NOW))?.streakRestoresUsed).toBe(1);
  });

  it("spends one restore on a double tap", async () => {
    await seed({ streak: 40, streakDay: TODAY - 2 });
    const results = await Promise.all([
      restoreStreak(db, "u1", NOW),
      restoreStreak(db, "u1", NOW),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await row())?.streakRestoresUsed).toBe(1);
  });

  it("is never part of a public profile", async () => {
    await seed({ streak: 40, streakDay: TODAY - 2, streakBroken: 7 });
    const profile = await getPublicUserProfileData(db, "u_u1");
    expect(profile).not.toHaveProperty("streakBroken");
    expect(profile).not.toHaveProperty("streakRestoresUsed");
    expect(profile).not.toHaveProperty("streakRestoreMonth");
  });
});

describe("restoreStreakAction (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
  });

  it("restores a streak that ended yesterday", async () => {
    await db.insert(userTable).values({
      id: "u1",
      username: "u_u1",
      streak: 12,
      streakDay: toStreakDay() - 2,
    });
    const { json } = await callJson<{ streakRestore: { streak: number } }>(
      buildApp(db, authed("u1")),
      "restoreStreakAction",
    );
    expect(json.streakRestore.streak).toBe(12);
  });

  it("says so when there's nothing to restore", async () => {
    await db.insert(userTable).values({
      id: "u1",
      username: "u_u1",
      streak: 12,
      streakDay: toStreakDay() - 1,
    });
    const { json } = await callJson(
      buildApp(db, authed("u1")),
      "restoreStreakAction",
    );
    expect(json).toEqual({ error: "This streak can't be restored anymore." });
  });
});

describe("streak push cron (real libSQL)", () => {
  let db: Db;
  const env = {
    VAPID_PUBLIC_KEY: "public",
    VAPID_PRIVATE_KEY: "private",
  } as unknown as AppEnv;
  const keys = { p256dh: "k", auth: "a" };

  async function user(
    id: string,
    values: Partial<typeof userTable.$inferInsert>,
  ) {
    await db.insert(userTable).values({
      id,
      username: `u_${id}`,
      pushPrefs: ALL_PUSH_CATEGORIES,
      ...values,
    });
    await db.insert(pushSubscriptionTable).values({
      userId: id,
      endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
      ...keys,
    });
  }

  function sentTo() {
    return vi
      .mocked(sendPush)
      .mock.calls.map(([sub, payload]) => ({
        endpoint: sub.endpoint.split("/").pop(),
        title: (payload as { title: string }).title,
      }))
      .sort((a, b) => (a.endpoint ?? "").localeCompare(b.endpoint ?? ""));
  }

  beforeEach(async () => {
    vi.mocked(sendPush).mockReset();
    vi.mocked(sendPush).mockResolvedValue({ ok: true } as never);
    db = await makeTestDb();
    await user("ending", { streak: 5, streakDay: TODAY - 1 });
    await user("optedout", {
      streak: 5,
      streakDay: TODAY - 1,
      pushPrefs: ALL_PUSH_CATEGORIES & ~PUSH_CATEGORY.streak,
    });
    await user("banned", {
      streak: 5,
      streakDay: TODAY - 1,
      bannedAt: new Date(),
    });
    await user("short", { streak: 1, streakDay: TODAY - 1 });
    await user("restorable", { streak: 9, streakDay: TODAY - 2 });
    await user("usedup", {
      streak: 9,
      streakDay: TODAY - 2,
      streakRestoresUsed: 3,
      streakRestoreMonth: MONTH,
    });
  });

  it("picks the reminder by the Manila hour", () => {
    expect(streakPushKindForHour(12)).toBe("ending");
    expect(streakPushKindForHour(1)).toBe("restore");
    expect(streakPushKindForHour(3)).toBeNull();
  });

  it("warns streaks that end at midnight", async () => {
    const at8pm = NOW + 8 * HOUR_MS;
    await sendStreakPushes(db, env, "ending", at8pm);
    expect(sentTo()).toEqual([
      { endpoint: "ending", title: "Your 5-day streak ends at midnight" },
    ]);
  });

  it("offers a restore to users who still have one", async () => {
    await sendStreakPushes(db, env, "restore", NOW);
    expect(sentTo()).toEqual([
      {
        endpoint: "restorable",
        title: "Your 9-day streak ended. Restore it today",
      },
    ]);
  });
});

// Turso bills per row scanned, and these crons run twice a day. Pin the plan
// so a predicate edit that stops matching user_streak_day_idx fails here.
describe("streak push query plan", () => {
  it.each(["ending", "restore"] as const)(
    "the %s query seeks user_streak_day_idx",
    async (kind) => {
      const db = await makeTestDb();
      const { sql: text, params } = streakPushQuery(
        db,
        kind,
        TODAY,
        MONTH,
      ).toSQL();
      const rows = await db.all<{ detail: string }>(
        sql.join([
          sql.raw("EXPLAIN QUERY PLAN "),
          sql.raw(
            text.replace(/\?/g, () => {
              const value = params.shift();
              return typeof value === "string" ? `'${value}'` : String(value);
            }),
          ),
        ]),
      );
      const detail = rows.map((r) => r.detail).join(" | ");
      expect(detail).toContain("user_streak_day_idx");
      expect(detail).not.toMatch(/SCAN "?user"?(?!_)/);
    },
  );
});
