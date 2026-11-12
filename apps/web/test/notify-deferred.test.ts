import { beforeEach, describe, expect, it, vi } from "vitest";

// argon2's precompiled .wasm import only resolves in the workers pool; these
// node-pool suites pull argon2 in transitively via actionsApp but never call it.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

// Real notify() by default; a test swaps in a pending or failing one.
const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock("../src/server-lib/notifications", async (importActual) => {
  const actual =
    await importActual<typeof import("../src/server-lib/notifications")>();
  notify.mockImplementation(actual.notify);
  return { ...actual, notify };
});

import { notificationTable } from "@umamin/db/schema/notification";
import { postTable } from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import type { Db } from "../src/server-lib/db";
import type { AppEnv } from "../src/server-lib/env";
import { __clearSessionCache } from "../src/server-lib/session";
import { authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

function likeRequest(db: Db) {
  const deferred: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (p: Promise<unknown>) => {
      deferred.push(p);
    },
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  const response = Promise.resolve(
    buildApp(db, authed("liker")).request(
      "/actions/addLikeAction",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://x.test",
          host: "x.test",
        },
        body: JSON.stringify({ postId: "p1" }),
      },
      {} as AppEnv,
      ctx,
    ),
  );
  return { response, deferred };
}

// Fails on the timer when the action waits for the notification before it
// answers.
async function answeredWithin<T>(promise: Promise<T>, ms = 1000) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("action waited for the notification")),
        ms,
      ),
    ),
  ]);
}

describe("action notifications are deferred past the response", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
    await db.insert(userTable).values([
      { id: "author", username: "u_author" },
      { id: "liker", username: "u_liker" },
    ]);
    await db
      .insert(postTable)
      .values({ id: "p1", content: "hello", authorId: "author" });
  });

  it("answers a like while the notification write is still pending", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    notify.mockImplementationOnce(() => pending);

    const { response, deferred } = likeRequest(db);
    const res = await answeredWithin(response);

    expect(await res.json()).toEqual({ success: true });
    expect(settled).toBe(false);
    expect(deferred).toHaveLength(1);

    finish();
    await expect(deferred[0]).resolves.toBeUndefined();
    expect(settled).toBe(true);
  });

  it("still writes the notification row for the post's author", async () => {
    const { json } = await callJson(
      buildApp(db, authed("liker")),
      "addLikeAction",
      { postId: "p1" },
    );

    expect(json).toEqual({ success: true });
    const rows = await db
      .select({ type: notificationTable.type })
      .from(notificationTable)
      .where(eq(notificationTable.recipientId, "author"));
    expect(rows).toEqual([{ type: "like" }]);
  });

  it("answers success when the notification fails", async () => {
    notify.mockImplementationOnce(() =>
      Promise.reject(new Error("notification write failed")),
    );

    const { response, deferred } = likeRequest(db);
    const settledAll = response.then(() => Promise.allSettled(deferred));
    const res = await answeredWithin(response);

    expect(await res.json()).toEqual({ success: true });
    const results = await settledAll;
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("rejected");
  });
});
