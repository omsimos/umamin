import { notificationTable } from "@umamin/db/schema/notification";
import { userBlockTable, userTable } from "@umamin/db/schema/user";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getNotificationBadgeData,
  getNotificationsPage,
} from "../src/server-lib/data";
import type { Db } from "../src/server-lib/db";
import { makeTestDb } from "./helpers/db";

// Historical rows are hidden on read rather than unwound, so the list and the
// badge must agree — a row the list drops must not keep lighting the bell.
describe("notifications hide blocked actors (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await makeTestDb();
    await db.insert(userTable).values([
      { id: "me", username: "u_me" },
      { id: "them", username: "u_them" },
      { id: "friend", username: "u_friend" },
    ]);
    await db.insert(notificationTable).values([
      { recipientId: "me", type: "like", targetId: "p1", actorId: "them" },
      { recipientId: "me", type: "like", targetId: "p2", actorId: "friend" },
      { recipientId: "me", type: "message", targetId: "m1", actorId: null },
    ]);
  });

  it("returns every row when nobody is blocked", async () => {
    const page = await getNotificationsPage(db, { viewerId: "me" });
    expect(page.notifications).toHaveLength(3);
    expect((await getNotificationBadgeData(db, "me")).unseen).toBe(3);
  });

  it("drops rows from an actor the viewer blocked, keeps the rest", async () => {
    await db
      .insert(userBlockTable)
      .values({ blockerId: "me", blockedId: "them" });

    const page = await getNotificationsPage(db, { viewerId: "me" });
    expect(page.notifications.map((n) => n.targetId).sort()).toEqual([
      "m1",
      "p2",
    ]);
    expect((await getNotificationBadgeData(db, "me")).unseen).toBe(2);
  });

  it("drops rows from an actor who blocked the viewer", async () => {
    await db
      .insert(userBlockTable)
      .values({ blockerId: "them", blockedId: "me" });

    const page = await getNotificationsPage(db, { viewerId: "me" });
    expect(page.notifications.map((n) => n.targetId).sort()).toEqual([
      "m1",
      "p2",
    ]);
    expect((await getNotificationBadgeData(db, "me")).unseen).toBe(2);
  });
});
