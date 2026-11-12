import { beforeEach, describe, expect, it, vi } from "vitest";

// See actions-post.test.ts: stub the wasm-backed argon2 module (unused here).
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

vi.mock("../src/server-lib/posthog", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/server-lib/posthog")>();
  return { ...actual, captureServerException: vi.fn() };
});

import { InvalidSubscriptionError } from "@mmmike/web-push/send";
import { pushSubscriptionTable } from "@umamin/db/schema/push-subscription";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { ALL_PUSH_CATEGORIES } from "../src/lib/push-prefs";
import type { Db } from "../src/server-lib/db";
import type { AppEnv } from "../src/server-lib/env";
import { sendPushForNotification } from "../src/server-lib/notification-push";
import { captureServerException } from "../src/server-lib/posthog";
import { sendPush } from "../src/server-lib/push";
import { __clearSessionCache } from "../src/server-lib/session";
import { authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

const PHONE = "https://fcm.googleapis.com/fcm/send/phone";
const LAPTOP = "https://fcm.googleapis.com/fcm/send/laptop";

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

const keys = {
  p256dh: b64url(Uint8Array.from({ length: 65 }, (_, i) => (i === 0 ? 4 : 1))),
  auth: b64url(new Uint8Array(16).fill(2)),
};

async function prefsOf(db: Db, id: string) {
  const [row] = await db
    .select({ pushPrefs: userTable.pushPrefs })
    .from(userTable)
    .where(eq(userTable.id, id));
  return row?.pushPrefs;
}

async function devicesOf(db: Db, id: string) {
  const rows = await db
    .select({ endpoint: pushSubscriptionTable.endpoint })
    .from(pushSubscriptionTable)
    .where(eq(pushSubscriptionTable.userId, id));
  return rows.map((r) => r.endpoint).sort();
}

function register(db: Db, userId: string, endpoint: string) {
  return callJson<{ pushPrefs: number } | { error: string }>(
    buildApp(db, authed(userId)),
    "registerPushSubscriptionAction",
    { endpoint, ...keys },
  );
}

function unregister(db: Db, userId: string, endpoint: string) {
  return callJson<{ pushPrefs: number | null } | { error: string }>(
    buildApp(db, authed(userId)),
    "unregisterPushSubscriptionAction",
    { endpoint },
  );
}

describe("push prefs stay in step with the user's devices (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    vi.mocked(sendPush).mockReset();
    vi.mocked(captureServerException).mockReset();
    db = await makeTestDb();
    await db.insert(userTable).values([
      { id: "alice", username: "u_alice" },
      { id: "bob", username: "u_bob" },
    ]);
  });

  it("turns every category on when a device registers", async () => {
    const { json } = await register(db, "alice", PHONE);
    expect(json).toEqual({ pushPrefs: ALL_PUSH_CATEGORIES });
    expect(await prefsOf(db, "alice")).toBe(ALL_PUSH_CATEGORIES);
    expect(await devicesOf(db, "alice")).toEqual([PHONE]);
  });

  it("keeps prefs on while another device remains, and clears them with the last one", async () => {
    await register(db, "alice", PHONE);
    await register(db, "alice", LAPTOP);

    const first = await unregister(db, "alice", PHONE);
    expect(first.json).toEqual({ pushPrefs: ALL_PUSH_CATEGORIES });
    expect(await prefsOf(db, "alice")).toBe(ALL_PUSH_CATEGORIES);

    const last = await unregister(db, "alice", LAPTOP);
    expect(last.json).toEqual({ pushPrefs: 0 });
    expect(await prefsOf(db, "alice")).toBe(0);
  });

  it("clears the previous account's prefs when its only device moves to another account", async () => {
    await register(db, "bob", PHONE);
    expect(await prefsOf(db, "bob")).toBe(ALL_PUSH_CATEGORIES);

    await register(db, "alice", PHONE);

    expect(await devicesOf(db, "bob")).toEqual([]);
    expect(await prefsOf(db, "bob")).toBe(0);
    expect(await prefsOf(db, "alice")).toBe(ALL_PUSH_CATEGORIES);
  });

  it("leaves the previous account on when it still has another device", async () => {
    await register(db, "bob", PHONE);
    await register(db, "bob", LAPTOP);

    await register(db, "alice", PHONE);

    expect(await devicesOf(db, "bob")).toEqual([LAPTOP]);
    expect(await prefsOf(db, "bob")).toBe(ALL_PUSH_CATEGORIES);
  });

  it("does not clear prefs when a user re-registers the same device", async () => {
    await register(db, "alice", PHONE);
    await register(db, "alice", PHONE);
    expect(await prefsOf(db, "alice")).toBe(ALL_PUSH_CATEGORIES);
  });

  it("clears prefs when a 404/410 prunes the user's last device", async () => {
    await register(db, "alice", PHONE);
    vi.mocked(sendPush).mockResolvedValue({ ok: false, expired: true });

    await sendPushForNotification(
      db,
      {
        VAPID_PUBLIC_KEY: "public",
        VAPID_PRIVATE_KEY: "private",
      } as unknown as AppEnv,
      { recipientId: "alice", type: "follow" },
    );

    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(await devicesOf(db, "alice")).toEqual([]);
    expect(await prefsOf(db, "alice")).toBe(0);
  });

  it("keeps prefs when a prune leaves another live device", async () => {
    await register(db, "alice", PHONE);
    await register(db, "alice", LAPTOP);
    vi.mocked(sendPush).mockImplementation(async (sub) =>
      sub.endpoint === PHONE ? { ok: false, expired: true } : { ok: true },
    );

    await sendPushForNotification(
      db,
      {
        VAPID_PUBLIC_KEY: "public",
        VAPID_PRIVATE_KEY: "private",
      } as unknown as AppEnv,
      { recipientId: "alice", type: "follow" },
    );

    expect(await devicesOf(db, "alice")).toEqual([LAPTOP]);
    expect(await prefsOf(db, "alice")).toBe(ALL_PUSH_CATEGORIES);
  });

  it("refuses a p256dh key that is not a 65-byte uncompressed point", async () => {
    const { json } = await callJson<{ pushPrefs: number } | { error: string }>(
      buildApp(db, authed("alice")),
      "registerPushSubscriptionAction",
      { endpoint: PHONE, p256dh: "p256dh-key", auth: keys.auth },
    );
    expect(json).toHaveProperty("error");
    expect(await devicesOf(db, "alice")).toEqual([]);
  });

  it("refuses an auth secret shorter than 16 bytes", async () => {
    const { json } = await callJson<{ pushPrefs: number } | { error: string }>(
      buildApp(db, authed("alice")),
      "registerPushSubscriptionAction",
      {
        endpoint: PHONE,
        p256dh: keys.p256dh,
        auth: b64url(new Uint8Array(15).fill(2)),
      },
    );
    expect(json).toHaveProperty("error");
    expect(await devicesOf(db, "alice")).toEqual([]);
  });

  it("prunes a device whose stored keys the push library rejects", async () => {
    await db.insert(pushSubscriptionTable).values({
      userId: "alice",
      endpoint: PHONE,
      p256dh: "p256dh-key",
      auth: "auth-key",
    });
    await db
      .update(userTable)
      .set({ pushPrefs: ALL_PUSH_CATEGORIES })
      .where(eq(userTable.id, "alice"));
    vi.mocked(sendPush).mockRejectedValue(
      new InvalidSubscriptionError("bad key"),
    );

    await sendPushForNotification(
      db,
      {
        VAPID_PUBLIC_KEY: "public",
        VAPID_PRIVATE_KEY: "private",
      } as unknown as AppEnv,
      { recipientId: "alice", type: "follow" },
    );

    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(await devicesOf(db, "alice")).toEqual([]);
    expect(await prefsOf(db, "alice")).toBe(0);
    expect(captureServerException).not.toHaveBeenCalled();
  });
});
