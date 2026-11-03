import { beforeEach, describe, expect, it, vi } from "vitest";

// argon2's precompiled .wasm import only resolves in the workers pool; this
// node-pool suite pulls argon2 in transitively via actionsApp but never calls it.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import {
  activeNoteStreak,
  displayNoteStreak,
  isNoteStreakAtRisk,
  streakDay,
} from "../src/lib/streak";
import type { Db } from "../src/server-lib/db";
import { recordNoteStreak } from "../src/server-lib/note-streak";
import { __clearSessionCache } from "../src/server-lib/session";
import { authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

describe("streakDay", () => {
  it("rolls over at Manila midnight (16:00 UTC), not UTC midnight", () => {
    const before = streakDay(new Date("2026-11-04T15:59:59Z"));
    const after = streakDay(new Date("2026-11-04T16:00:00Z"));
    expect(after).toBe(before + 1);
    // UTC midnight falls mid-day in Manila.
    expect(streakDay(new Date("2026-11-04T23:59:59Z"))).toBe(
      streakDay(new Date("2026-11-05T00:00:01Z")),
    );
  });
});

describe("activeNoteStreak", () => {
  const today = 20_000;

  it("keeps a streak counted today or yesterday", () => {
    expect(
      activeNoteStreak({ noteStreak: 4, noteStreakDay: today }, today),
    ).toBe(4);
    expect(
      activeNoteStreak({ noteStreak: 4, noteStreakDay: today - 1 }, today),
    ).toBe(4);
  });

  it("drops a streak whose last counted day is older than yesterday", () => {
    expect(
      activeNoteStreak({ noteStreak: 9, noteStreakDay: today - 2 }, today),
    ).toBe(0);
    expect(
      activeNoteStreak({ noteStreak: 9, noteStreakDay: null }, today),
    ).toBe(0);
  });

  it("is at risk only when yesterday was the last counted day", () => {
    expect(
      isNoteStreakAtRisk({ noteStreak: 3, noteStreakDay: today - 1 }, today),
    ).toBe(true);
    expect(
      isNoteStreakAtRisk({ noteStreak: 3, noteStreakDay: today }, today),
    ).toBe(false);
    expect(
      isNoteStreakAtRisk({ noteStreak: 3, noteStreakDay: today - 2 }, today),
    ).toBe(false);
  });

  it("hides a 1-day streak from display", () => {
    expect(
      displayNoteStreak({ noteStreak: 1, noteStreakDay: today }, today),
    ).toBe(0);
    expect(
      displayNoteStreak({ noteStreak: 2, noteStreakDay: today }, today),
    ).toBe(2);
  });
});

describe("recordNoteStreak (real libSQL)", () => {
  let db: Db;
  const today = 20_000;

  async function state() {
    const [row] = await db
      .select({
        noteStreak: userTable.noteStreak,
        noteStreakBest: userTable.noteStreakBest,
        noteStreakDay: userTable.noteStreakDay,
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
    expect(await recordNoteStreak(db, "u1", today)).toEqual({
      noteStreak: 1,
      noteStreakDay: today,
    });
    expect(await state()).toEqual({
      noteStreak: 1,
      noteStreakBest: 1,
      noteStreakDay: today,
    });
  });

  it("extends on the next day and tracks the best", async () => {
    await recordNoteStreak(db, "u1", today);
    await recordNoteStreak(db, "u1", today + 1);
    const result = await recordNoteStreak(db, "u1", today + 2);
    expect(result?.noteStreak).toBe(3);
    expect(await state()).toEqual({
      noteStreak: 3,
      noteStreakBest: 3,
      noteStreakDay: today + 2,
    });
  });

  it("writes nothing on a second save the same day", async () => {
    await recordNoteStreak(db, "u1", today);
    await recordNoteStreak(db, "u1", today + 1);
    expect(await recordNoteStreak(db, "u1", today + 1)).toBeNull();
    expect((await state()).noteStreak).toBe(2);
  });

  it("restarts at 1 after a missed day but keeps the best", async () => {
    await recordNoteStreak(db, "u1", today);
    await recordNoteStreak(db, "u1", today + 1);
    await recordNoteStreak(db, "u1", today + 3);
    expect(await state()).toEqual({
      noteStreak: 1,
      noteStreakBest: 2,
      noteStreakDay: today + 3,
    });
  });

  it("leaves user.updated_at alone", async () => {
    const stamp = new Date("2026-01-01T00:00:00Z");
    await db
      .update(userTable)
      .set({ updatedAt: stamp })
      .where(eq(userTable.id, "u1"));
    await recordNoteStreak(db, "u1", today);
    const [row] = await db
      .select({ updatedAt: userTable.updatedAt })
      .from(userTable)
      .where(eq(userTable.id, "u1"));
    expect(row.updatedAt).toEqual(stamp);
  });
});

describe("createNoteAction streaks (real libSQL)", () => {
  let db: Db;

  async function streak() {
    const [row] = await db
      .select({
        noteStreak: userTable.noteStreak,
        noteStreakDay: userTable.noteStreakDay,
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
      noteStreak: 4,
      noteStreakDay: streakDay() - 1,
    });
  });

  it("extends the streak on a shared note and returns it", async () => {
    const app = buildApp(db, authed("u1"));
    const { json } = await callJson<{ streak: unknown }>(
      app,
      "createNoteAction",
      { content: "hello" },
    );

    expect(json.streak).toEqual({ noteStreak: 5, noteStreakDay: streakDay() });
    expect(await streak()).toEqual({
      noteStreak: 5,
      noteStreakDay: streakDay(),
    });
  });

  it("doesn't count an anonymous note", async () => {
    const app = buildApp(db, authed("u1"));
    const { json } = await callJson<{ streak: unknown; success: boolean }>(
      app,
      "createNoteAction",
      { content: "hello", isAnonymous: true },
    );

    expect(json.success).toBe(true);
    expect(json.streak).toBeNull();
    expect(await streak()).toEqual({
      noteStreak: 4,
      noteStreakDay: streakDay() - 1,
    });
  });
});
