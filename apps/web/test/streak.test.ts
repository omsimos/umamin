import { beforeEach, describe, expect, it, vi } from "vitest";

// argon2's precompiled .wasm import only resolves in the workers pool; this
// node-pool suite pulls argon2 in transitively via actionsApp but never calls it.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

import { noteTable } from "@umamin/db/schema/note";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import {
  activeStreak,
  displayStreak,
  isStreakAtRisk,
  toStreakDay,
} from "../src/lib/streak";
import { getNotesPage, getPublicUserProfileData } from "../src/server-lib/data";
import type { Db } from "../src/server-lib/db";
import { __clearSessionCache } from "../src/server-lib/session";
import { recordStreak } from "../src/server-lib/streak";
import { authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

describe("streakDay", () => {
  it("rolls over at Manila midnight (16:00 UTC), not UTC midnight", () => {
    const before = toStreakDay(new Date("2026-11-04T15:59:59Z"));
    const after = toStreakDay(new Date("2026-11-04T16:00:00Z"));
    expect(after).toBe(before + 1);
    // UTC midnight falls mid-day in Manila.
    expect(toStreakDay(new Date("2026-11-04T23:59:59Z"))).toBe(
      toStreakDay(new Date("2026-11-05T00:00:01Z")),
    );
  });
});

describe("activeStreak", () => {
  const today = 20_000;

  it("keeps a streak counted today or yesterday", () => {
    expect(activeStreak({ streak: 4, streakDay: today }, today)).toBe(4);
    expect(activeStreak({ streak: 4, streakDay: today - 1 }, today)).toBe(4);
  });

  it("drops a streak whose last counted day is older than yesterday", () => {
    expect(activeStreak({ streak: 9, streakDay: today - 2 }, today)).toBe(0);
    expect(activeStreak({ streak: 9, streakDay: null }, today)).toBe(0);
  });

  it("is at risk only when yesterday was the last counted day", () => {
    expect(isStreakAtRisk({ streak: 3, streakDay: today - 1 }, today)).toBe(
      true,
    );
    expect(isStreakAtRisk({ streak: 3, streakDay: today }, today)).toBe(false);
    expect(isStreakAtRisk({ streak: 3, streakDay: today - 2 }, today)).toBe(
      false,
    );
  });

  it("hides a 1-day streak from display", () => {
    expect(displayStreak({ streak: 1, streakDay: today }, today)).toBe(0);
    expect(displayStreak({ streak: 2, streakDay: today }, today)).toBe(2);
  });
});

describe("recordStreak (real libSQL)", () => {
  let db: Db;
  const today = 20_000;

  async function state() {
    const [row] = await db
      .select({
        streak: userTable.streak,
        streakBest: userTable.streakBest,
        streakDay: userTable.streakDay,
      })
      .from(userTable)
      .where(eq(userTable.id, "u1"));
    return row;
  }

  beforeEach(async () => {
    db = await makeTestDb();
    await db.insert(userTable).values({ id: "u1", username: "u_u1" });
  });

  it("starts a first streak at 1", async () => {
    expect(await recordStreak(db, "u1", today)).toEqual({
      streak: 1,
      streakDay: today,
    });
    expect(await state()).toEqual({
      streak: 1,
      streakBest: 1,
      streakDay: today,
    });
  });

  it("extends on the next day and tracks the best", async () => {
    await recordStreak(db, "u1", today);
    await recordStreak(db, "u1", today + 1);
    const result = await recordStreak(db, "u1", today + 2);
    expect(result?.streak).toBe(3);
    expect(await state()).toEqual({
      streak: 3,
      streakBest: 3,
      streakDay: today + 2,
    });
  });

  it("writes nothing on a second save the same day", async () => {
    await recordStreak(db, "u1", today);
    await recordStreak(db, "u1", today + 1);
    expect(await recordStreak(db, "u1", today + 1)).toBeNull();
    expect((await state()).streak).toBe(2);
  });

  it("restarts at 1 after a missed day but keeps the best", async () => {
    await recordStreak(db, "u1", today);
    await recordStreak(db, "u1", today + 1);
    await recordStreak(db, "u1", today + 3);
    expect(await state()).toEqual({
      streak: 1,
      streakBest: 2,
      streakDay: today + 3,
    });
  });

  it("leaves user.updated_at alone", async () => {
    const stamp = new Date("2026-01-01T00:00:00Z");
    await db
      .update(userTable)
      .set({ updatedAt: stamp })
      .where(eq(userTable.id, "u1"));
    await recordStreak(db, "u1", today);
    const [row] = await db
      .select({ updatedAt: userTable.updatedAt })
      .from(userTable)
      .where(eq(userTable.id, "u1"));
    expect(row.updatedAt).toEqual(stamp);
  });
});

describe("save actions count toward streaks (real libSQL)", () => {
  let db: Db;

  async function streak() {
    const [row] = await db
      .select({
        streak: userTable.streak,
        streakDay: userTable.streakDay,
      })
      .from(userTable)
      .where(eq(userTable.id, "u1"));
    return row;
  }

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
    await db.insert(userTable).values({
      id: "u1",
      username: "u_u1",
      streak: 4,
      streakDay: toStreakDay() - 1,
    });
  });

  it("extends the streak on a shared note and returns it", async () => {
    const app = buildApp(db, authed("u1"));
    const { json } = await callJson<{ streakUpdate: unknown }>(
      app,
      "createNoteAction",
      { content: "hello" },
    );

    expect(json.streakUpdate).toEqual({ streak: 5, streakDay: toStreakDay() });
    expect(await streak()).toEqual({
      streak: 5,
      streakDay: toStreakDay(),
    });
  });

  it("extends the streak on a post and returns it", async () => {
    const app = buildApp(db, authed("u1"));
    const { json } = await callJson<{
      success: boolean;
      streakUpdate: unknown;
    }>(app, "createPostAction", { content: "QA post" });

    expect(json.success).toBe(true);
    expect(json.streakUpdate).toEqual({ streak: 5, streakDay: toStreakDay() });
    expect(await streak()).toEqual({ streak: 5, streakDay: toStreakDay() });
  });

  it("counts a post and a note on the same day once", async () => {
    const app = buildApp(db, authed("u1"));
    await callJson(app, "createPostAction", { content: "QA post" });
    const { json } = await callJson<{ streakUpdate: unknown }>(
      app,
      "createNoteAction",
      { content: "hello" },
    );

    expect(json.streakUpdate).toBeNull();
    expect((await streak()).streak).toBe(5);
  });

  it("doesn't count an anonymous note", async () => {
    const app = buildApp(db, authed("u1"));
    const { json } = await callJson<{
      streakUpdate: unknown;
      success: boolean;
    }>(app, "createNoteAction", { content: "hello", isAnonymous: true });

    expect(json.success).toBe(true);
    expect(json.streakUpdate).toBeNull();
    expect(await streak()).toEqual({
      streak: 4,
      streakDay: toStreakDay() - 1,
    });
  });
});

describe("public reads hide the day of a hidden streak (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await makeTestDb();
    await db.insert(userTable).values([
      {
        id: "solo",
        username: "u_solo",
        streak: 1,
        streakDay: toStreakDay(),
      },
      {
        id: "long",
        username: "u_long",
        streak: 5,
        streakDay: toStreakDay(),
      },
      {
        id: "lapsed",
        username: "u_lapsed",
        streak: 9,
        streakDay: toStreakDay() - 2,
      },
    ]);
    await db.insert(noteTable).values([
      { userId: "solo", content: "one", isAnonymous: false },
      { userId: "long", content: "five", isAnonymous: false },
    ]);
  });

  it("on the profile", async () => {
    expect(await getPublicUserProfileData(db, "u_solo")).toMatchObject({
      streak: 0,
      streakDay: null,
    });
    expect(await getPublicUserProfileData(db, "u_lapsed")).toMatchObject({
      streak: 0,
      streakDay: null,
    });
    expect(await getPublicUserProfileData(db, "u_long")).toMatchObject({
      streak: 5,
      streakDay: toStreakDay(),
    });
  });

  it("on notes feed authors", async () => {
    const page = await getNotesPage(db, {});
    const byUser = Object.fromEntries(
      page.data.map((n) => [n.user?.username, n.user]),
    );
    expect(byUser.u_solo).toMatchObject({ streak: 0, streakDay: null });
    expect(byUser.u_long).toMatchObject({
      streak: 5,
      streakDay: toStreakDay(),
    });
  });
});
