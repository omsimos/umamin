import { notificationTable } from "@umamin/db/schema/notification";
import { userMuteTable, userTable } from "@umamin/db/schema/user";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../src/server-lib/db";
import type { AppEnv } from "../src/server-lib/env";
import { notify } from "../src/server-lib/notifications";
import { captureServerException } from "../src/server-lib/posthog";
import { makeTestDb } from "./helpers/db";

const { sendPushForNotification } = vi.hoisted(() => ({
  sendPushForNotification: vi.fn(),
}));
vi.mock("../src/server-lib/notification-push", () => ({
  sendPushForNotification,
}));
vi.mock("../src/server-lib/posthog", () => ({
  captureServerException: vi.fn(),
}));

const env = {} as AppEnv;

async function row(db: Db) {
  const all = await db
    .select()
    .from(notificationTable)
    .where(eq(notificationTable.recipientId, "u2"));
  expect(all).toHaveLength(1);
  return all[0];
}

describe("notify throttling", () => {
  let db: Db;

  const like = (actorId: string) =>
    notify(
      { db, env },
      { recipientId: "u2", type: "like", targetId: "p1", actorId },
    );

  beforeEach(async () => {
    sendPushForNotification.mockReset();
    sendPushForNotification.mockResolvedValue(undefined);
    db = await makeTestDb();
    await db.insert(userTable).values({ id: "u1", username: "one" });
    await db.insert(userTable).values({ id: "u2", username: "two" });
    await db.insert(userTable).values({ id: "u3", username: "three" });
  });

  it("a like toggled again by the same person neither bumps nor pushes", async () => {
    await like("u1");
    await like("u1");
    expect((await row(db)).count).toBe(1);
    expect(sendPushForNotification).toHaveBeenCalledTimes(1);
  });

  it("a different person's like still bumps and pushes", async () => {
    await like("u1");
    await like("u3");
    expect((await row(db)).count).toBe(2);
    expect(sendPushForNotification).toHaveBeenCalledTimes(2);
  });

  it("the same person's like resurfaces after the window", async () => {
    await like("u1");
    await db
      .update(notificationTable)
      .set({ updatedAt: sql`unixepoch() - 301` });
    const before = (await row(db)).updatedAt.getTime();

    await like("u1");
    const after = await row(db);
    expect(sendPushForNotification).toHaveBeenCalledTimes(2);
    expect(after.updatedAt.getTime()).toBeGreaterThan(before);
    expect(after.count).toBe(1);
  });

  it("a follow toggle is throttled the same way", async () => {
    const follow = () =>
      notify({ db, env }, { recipientId: "u2", type: "follow", actorId: "u1" });
    await follow();
    await follow();
    expect(sendPushForNotification).toHaveBeenCalledTimes(1);
  });

  it("no push when the insert was suppressed", async () => {
    await db.insert(userMuteTable).values({ muterId: "u2", mutedId: "u1" });
    await like("u1");
    const all = await db.select().from(notificationTable);
    expect(all).toHaveLength(0);
    expect(sendPushForNotification).not.toHaveBeenCalled();
  });

  it("a second comment from the same person still pushes", async () => {
    const comment = () =>
      notify(
        { db, env },
        { recipientId: "u2", type: "comment", targetId: "p1", actorId: "u1" },
      );
    await comment();
    await comment();
    expect(sendPushForNotification).toHaveBeenCalledTimes(2);
  });

  describe("on the request path", () => {
    const deferred: Promise<unknown>[] = [];
    const defer = (promise: Promise<unknown>) => {
      deferred.push(promise);
    };
    const likeLater = () =>
      notify(
        { db, env, defer },
        { recipientId: "u2", type: "like", targetId: "p1", actorId: "u1" },
      );

    beforeEach(() => {
      deferred.length = 0;
      vi.mocked(captureServerException).mockReset();
    });

    it("gives the push the request's defer for its own reports", async () => {
      await likeLater();
      expect(sendPushForNotification).toHaveBeenCalledWith(
        db,
        env,
        expect.objectContaining({ recipientId: "u2" }),
        defer,
      );
    });

    it("reports a failed push through the request's defer", async () => {
      const failure = new Error("push read failed");
      sendPushForNotification.mockRejectedValueOnce(failure);
      await likeLater();
      await Promise.all(deferred);
      expect(captureServerException).toHaveBeenCalledWith(
        env,
        defer,
        failure,
        expect.anything(),
      );
    });
  });
});
