import { notificationTable } from "@umamin/db/schema/notification";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/server-lib/db";
import type { AppEnv } from "../src/server-lib/env";
import { countUnseen, notify } from "../src/server-lib/notifications";
import { makeTestDb } from "./helpers/db";

// notify runs against real libSQL (node pool). VAPID is unset in the env, so the
// deferred Web Push fan-out no-ops (vapidFromEnv → null); we only assert the
// aggregated-upsert behaviour, which is the ported invariant.
const env = {} as AppEnv;

async function seedUsers(db: Db) {
  await db.insert(userTable).values({ id: "u1", username: "actor" });
  await db.insert(userTable).values({ id: "u2", username: "recipient" });
}

async function rows(db: Db, recipientId: string) {
  return db
    .select()
    .from(notificationTable)
    .where(eq(notificationTable.recipientId, recipientId));
}

describe("notify", () => {
  let db: Db;

  beforeEach(async () => {
    db = await makeTestDb();
    await seedUsers(db);
  });

  it("skips self-notifications entirely", async () => {
    await notify(
      { db, env },
      { recipientId: "u1", type: "like", actorId: "u1" },
    );
    expect(await rows(db, "u1")).toHaveLength(0);
  });

  it("inserts a row, then aggregates a repeat (bumps count)", async () => {
    await notify(
      { db, env },
      {
        recipientId: "u2",
        type: "like",
        targetId: "p1",
        actorId: "u1",
        preview: "hello world",
      },
    );
    let all = await rows(db, "u2");
    expect(all).toHaveLength(1);
    expect(all[0].count).toBe(1);
    expect(all[0].preview).toBe("hello world");

    await notify(
      { db, env },
      { recipientId: "u2", type: "like", targetId: "p1", actorId: "u1" },
    );
    all = await rows(db, "u2");
    expect(all).toHaveLength(1);
    expect(all[0].count).toBe(2);
  });

  it("trims previews to 80 chars and nulls empty ones", async () => {
    await notify(
      { db, env },
      {
        recipientId: "u2",
        type: "like",
        targetId: "p1",
        actorId: "u1",
        preview: "x".repeat(200),
      },
    );
    await notify(
      { db, env },
      {
        recipientId: "u2",
        type: "like",
        targetId: "p2",
        actorId: "u1",
        preview: "",
      },
    );
    const all = await rows(db, "u2");
    const byTarget = new Map(all.map((r) => [r.targetId, r]));
    expect(byTarget.get("p1")?.preview).toBe("x".repeat(80));
    expect(byTarget.get("p2")?.preview).toBeNull();
  });

  it("swallows write failures so the parent action never fails", async () => {
    // A recipient FK violation (unknown user) makes the insert throw; notify
    // must resolve regardless (the error is logged and swallowed).
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await expect(
      notify(
        { db, env },
        { recipientId: "ghost", type: "follow", actorId: "u1" },
      ),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("countUnseen", () => {
  const at = (seconds: number) => new Date(seconds * 1000);

  it("counts only rows newer than the watermark", () => {
    const list = [
      { updatedAt: at(300) },
      { updatedAt: at(200) },
      { updatedAt: at(100) },
    ];
    expect(countUnseen(list, at(150))).toBe(2);
    expect(countUnseen(list, at(300))).toBe(0);
  });

  it("excludes rows exactly at the watermark (second precision)", () => {
    expect(countUnseen([{ updatedAt: at(200) }], at(200))).toBe(0);
  });

  it("counts everything when the watermark was never set", () => {
    const list = [{ updatedAt: at(300) }, { updatedAt: at(100) }];
    expect(countUnseen(list, null)).toBe(2);
    expect(countUnseen([], null)).toBe(0);
  });
});
