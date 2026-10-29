import { notificationTable } from "@umamin/db/schema/notification";
import {
  userBlockTable,
  userMuteTable,
  userTable,
} from "@umamin/db/schema/user";
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
  await db.insert(userTable).values({ id: "u3", username: "other" });
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

  it("inserts a row, then aggregates a repeat from a different actor (bumps count)", async () => {
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

    // A repeat by the same actor no longer counts; a second person does.
    await notify(
      { db, env },
      { recipientId: "u2", type: "like", targetId: "p1", actorId: "u3" },
    );
    all = await rows(db, "u2");
    expect(all).toHaveLength(1);
    expect(all[0].count).toBe(2);
    expect(all[0].actorId).toBe("u3");
  });

  it("counts a person once however many times they comment", async () => {
    await notify(
      { db, env },
      {
        recipientId: "u2",
        type: "comment",
        targetId: "p1",
        actorId: "u1",
        preview: "first",
      },
    );
    await db
      .update(notificationTable)
      .set({ updatedAt: new Date(0) })
      .where(eq(notificationTable.recipientId, "u2"));
    await notify(
      { db, env },
      {
        recipientId: "u2",
        type: "comment",
        targetId: "p1",
        actorId: "u1",
        preview: "second",
      },
    );
    const all = await rows(db, "u2");
    expect(all).toHaveLength(1);
    expect(all[0].count).toBe(1);
    expect(all[0].preview).toBe("second");
    // Resurfaced: the row moved forward from the epoch we pinned it to.
    expect(all[0].updatedAt.getTime()).toBeGreaterThan(0);
  });

  it("keeps counting anonymous messages", async () => {
    await notify({ db, env }, { recipientId: "u2", type: "message" });
    await notify({ db, env }, { recipientId: "u2", type: "message" });
    const all = await rows(db, "u2");
    expect(all).toHaveLength(1);
    expect(all[0].count).toBe(2);
    expect(all[0].actorId).toBeNull();
  });

  it("drops a muted actor's notification even when the caller already checked blocks", async () => {
    await db.insert(userMuteTable).values({ muterId: "u2", mutedId: "u1" });
    await notify(
      { db, env },
      {
        recipientId: "u2",
        type: "like",
        targetId: "p1",
        actorId: "u1",
        blockChecked: true,
      },
    );
    expect(await rows(db, "u2")).toHaveLength(0);
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

  it("drops the notification when the recipient has blocked the actor", async () => {
    await db
      .insert(userBlockTable)
      .values({ blockerId: "u2", blockedId: "u1" });
    await notify(
      { db, env },
      { recipientId: "u2", type: "like", targetId: "p1", actorId: "u1" },
    );
    expect(await rows(db, "u2")).toHaveLength(0);
  });

  it("drops the notification when the actor has blocked the recipient", async () => {
    await db
      .insert(userBlockTable)
      .values({ blockerId: "u1", blockedId: "u2" });
    await notify(
      { db, env },
      {
        recipientId: "u2",
        type: "comment",
        targetId: "p1",
        actorId: "u1",
        preview: "hi",
      },
    );
    expect(await rows(db, "u2")).toHaveLength(0);
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
