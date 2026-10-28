import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

vi.mock("../src/server-lib/posthog", () => ({
  captureRequestException: vi.fn(),
  captureServerException: vi.fn(),
}));

import { dmReportTable, dmThreadTable } from "@umamin/db/schema/dm";
import {
  userBlockTable,
  userFollowTable,
  userTable,
} from "@umamin/db/schema/user";
import { aesDecrypt, aesEncrypt } from "@umamin/encryption";
import { eq } from "drizzle-orm";
import { DM_THREADS_PAGE_SIZE } from "../src/lib/dm/constants";
import { dmPair } from "../src/lib/dm/pair";
import type { Db } from "../src/server-lib/db";
import { resolveDmPeer } from "../src/server-lib/dm/access";
import { revokeDmSockets } from "../src/server-lib/dm/lifecycle";
import { tursoDmStore } from "../src/server-lib/dm/store";
import {
  getDmThreadsPage,
  getDmUnreadCount,
  getOpenDmReports,
  resolveDmReport,
} from "../src/server-lib/dm/threads";
import type { AppEnv } from "../src/server-lib/env";
import { authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

beforeAll(() => {
  process.env.AES_256_GCM_KEY = Buffer.from(new Uint8Array(32)).toString(
    "base64",
  );
});

async function users(db: Db, ...ids: string[]) {
  await db
    .insert(userTable)
    .values(ids.map((id) => ({ id, username: `u_${id}` })));
}

async function follow(db: Db, a: string, b: string) {
  await db.insert(userFollowTable).values({ followerId: a, followingId: b });
}

async function mutual(db: Db, a: string, b: string) {
  await follow(db, a, b);
  await follow(db, b, a);
}

/** A thread whose last message came from `sender`, read by neither side
 *  unless `read` says so. */
async function thread(
  db: Db,
  a: string,
  b: string,
  opts: {
    sender: string;
    lastSeq?: number;
    at?: number;
    preview?: string;
    readBy?: Record<string, number>;
    hiddenBy?: Record<string, number>;
  },
) {
  const pair = dmPair(a, b);
  const lastSeq = opts.lastSeq ?? 1;
  await db.insert(dmThreadTable).values({
    id: pair.threadId,
    userLowId: pair.lowId,
    userHighId: pair.highId,
    lastMessageAt: new Date(opts.at ?? 1_000),
    lastSeq,
    lastSenderId: opts.sender,
    lastPreview: opts.preview ? await aesEncrypt(opts.preview) : null,
    lowReadSeq: opts.readBy?.[pair.lowId] ?? 0,
    highReadSeq: opts.readBy?.[pair.highId] ?? 0,
    lowHiddenSeq: opts.hiddenBy?.[pair.lowId] ?? 0,
    highHiddenSeq: opts.hiddenBy?.[pair.highId] ?? 0,
  });
}

describe("resolveDmPeer", () => {
  let db: Db;
  beforeEach(async () => {
    db = await makeTestDb();
    await users(db, "me", "pal", "fan");
  });

  it("allows messaging only on a mutual follow", async () => {
    await mutual(db, "me", "pal");
    await follow(db, "fan", "me");
    expect((await resolveDmPeer(db, "me", "u_pal"))?.canMessage).toBe(true);
    expect((await resolveDmPeer(db, "me", "u_fan"))?.canMessage).toBe(false);
  });

  it("reports a block either way and never allows messaging across it", async () => {
    await mutual(db, "me", "pal");
    await db
      .insert(userBlockTable)
      .values({ blockerId: "pal", blockedId: "me" });
    const access = await resolveDmPeer(db, "me", "u_pal");
    expect(access).toMatchObject({ blocked: true, canMessage: false });
  });

  it("finds an existing conversation after an unfollow", async () => {
    await follow(db, "me", "pal");
    await thread(db, "me", "pal", { sender: "pal" });
    expect(await resolveDmPeer(db, "me", "u_pal")).toMatchObject({
      canMessage: false,
      hasThread: true,
    });
  });

  it("hides banned users and yourself", async () => {
    await mutual(db, "me", "pal");
    await db
      .update(userTable)
      .set({ bannedAt: new Date() })
      .where(eq(userTable.id, "pal"));
    expect(await resolveDmPeer(db, "me", "u_pal")).toBeNull();
    expect(await resolveDmPeer(db, "me", "u_me")).toBeNull();
  });
});

describe("tursoDmStore", () => {
  let db: Db;
  const env = {} as AppEnv;
  beforeEach(async () => {
    db = await makeTestDb();
    await users(db, "me", "pal");
  });

  it("refuses canMessage once either account is banned", async () => {
    await mutual(db, "me", "pal");
    const store = tursoDmStore(env, () => db);
    const pair = dmPair("me", "pal");
    expect(await store.canMessage(pair)).toBe(true);
    await db
      .update(userTable)
      .set({ bannedAt: new Date() })
      .where(eq(userTable.id, "me"));
    expect(await store.canMessage(pair)).toBe(false);
  });

  it("tells a block in either direction from an unfollow", async () => {
    const store = tursoDmStore(env, () => db);
    const pair = dmPair("me", "pal");
    expect(await store.isBlocked(pair)).toBe(false);
    await db
      .insert(userBlockTable)
      .values({ blockerId: pair.highId, blockedId: pair.lowId });
    expect(await store.isBlocked(pair)).toBe(true);
  });

  it("upserts the thread row with an encrypted preview", async () => {
    const store = tursoDmStore(env, () => db);
    const pair = dmPair("me", "pal");
    const snap = {
      lastSeq: 1,
      lastAt: 5_000,
      lastSender: 0 as const,
      preview: "first",
      readSeq: [0, 0] as [number, number],
      hiddenSeq: [0, 0] as [number, number],
    };
    await store.writeThread(pair, snap);
    await store.writeThread(pair, { ...snap, lastSeq: 2, preview: "second" });
    const rows = await db.select().from(dmThreadTable);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lastSeq).toBe(2);
    expect(rows[0]?.lastSenderId).toBe(pair.lowId);
    expect(rows[0]?.lastPreview).not.toContain("second");
    expect(await aesDecrypt(rows[0]?.lastPreview ?? "")).toBe("second");
  });

  it("stores one report per reporter and message", async () => {
    const store = tursoDmStore(env, () => db);
    const input = {
      reporterId: "me",
      reportedId: "pal",
      threadId: dmPair("me", "pal").threadId,
      messageSeq: 3,
      reason: "harassment" as const,
      entries: [{ seq: 3, fromReporter: false, text: "mean", createdAt: 1 }],
    };
    expect(await store.insertReport(input)).toBe(true);
    expect(await store.insertReport(input)).toBe(false);
    const [row] = await db.select().from(dmReportTable);
    expect(row?.snapshot).not.toContain("mean");
  });
});

describe("Chats list and unread count", () => {
  let db: Db;
  beforeEach(async () => {
    db = await makeTestDb();
    await users(db, "me", "amy", "bob", "cat", "dan");
  });

  it("lists newest first with decrypted previews and unread flags", async () => {
    await thread(db, "me", "amy", { sender: "amy", at: 2_000, preview: "hey" });
    await thread(db, "me", "bob", {
      sender: "me",
      at: 3_000,
      preview: "sup",
    });
    const page = await getDmThreadsPage(db, "me", null);
    expect(
      page.data.map((t) => [t.peer.username, t.preview, t.unread]),
    ).toEqual([
      ["u_bob", "sup", false],
      ["u_amy", "hey", true],
    ]);
    expect(page.data[0]?.lastFromMe).toBe(true);
  });

  it("drops hidden and blocked conversations", async () => {
    await thread(db, "me", "amy", { sender: "amy", hiddenBy: { me: 1 } });
    await thread(db, "me", "bob", { sender: "bob" });
    await db
      .insert(userBlockTable)
      .values({ blockerId: "me", blockedId: "bob" });
    expect((await getDmThreadsPage(db, "me", null)).data).toEqual([]);
    expect(await getDmUnreadCount(db, "me")).toBe(0);
  });

  it("shows a hidden conversation again once a newer message arrives", async () => {
    await thread(db, "me", "amy", {
      sender: "amy",
      lastSeq: 2,
      hiddenBy: { me: 1 },
    });
    expect((await getDmThreadsPage(db, "me", null)).data).toHaveLength(1);
  });

  it("counts only conversations whose newest message from the other side is unread", async () => {
    await thread(db, "me", "amy", { sender: "amy" });
    await thread(db, "me", "bob", { sender: "bob", readBy: { me: 1 } });
    await thread(db, "me", "cat", { sender: "me" });
    await thread(db, "dan", "me", {
      sender: "dan",
      lastSeq: 4,
      readBy: { me: 2 },
    });
    expect(await getDmUnreadCount(db, "me")).toBe(2);
    // The other side's own view is independent.
    expect(await getDmUnreadCount(db, "amy")).toBe(0);
  });

  it("pages with a cursor without repeating or skipping", async () => {
    const ids = Array.from(
      { length: DM_THREADS_PAGE_SIZE + 3 },
      (_, i) => `p${i}`,
    );
    await users(db, ...ids);
    for (const [i, id] of ids.entries()) {
      // Two pairs share each timestamp to exercise the id tiebreak.
      await thread(db, "me", id, {
        sender: id,
        at: 10_000 + Math.floor(i / 2),
      });
    }
    const first = await getDmThreadsPage(db, "me", null);
    expect(first.data).toHaveLength(DM_THREADS_PAGE_SIZE);
    expect(first.nextCursor).not.toBeNull();
    const second = await getDmThreadsPage(db, "me", first.nextCursor);
    const seen = [...first.data, ...second.data].map((t) => t.peer.id);
    expect(new Set(seen).size).toBe(ids.length);
    expect(second.nextCursor).toBeNull();
  });
});

describe("DM reports for moderators", () => {
  it("lists open reports decrypted and resolves each once", async () => {
    const db = await makeTestDb();
    await users(db, "me", "pal");
    const store = tursoDmStore({} as AppEnv, () => db);
    await store.insertReport({
      reporterId: "me",
      reportedId: "pal",
      threadId: dmPair("me", "pal").threadId,
      messageSeq: 1,
      reason: "spam",
      entries: [{ seq: 1, fromReporter: false, text: "buy now", createdAt: 1 }],
    });
    const [open] = await getOpenDmReports(db);
    expect(open).toMatchObject({
      reason: "spam",
      reporter: { username: "u_me" },
      reported: { username: "u_pal" },
    });
    expect(open?.snapshot[0]?.text).toBe("buy now");
    expect(await resolveDmReport(db, open?.id ?? "", "mod", "dismissed")).toBe(
      true,
    );
    expect(await resolveDmReport(db, open?.id ?? "", "mod", "actioned")).toBe(
      false,
    );
    expect(await getOpenDmReports(db)).toEqual([]);
  });
});

describe("block and unfollow close the DM room", () => {
  let db: Db;
  const severed: [string, string][] = [];
  const revoked: [string, string][] = [];
  const env = {
    DM_ROOM: {
      idFromName: (name: string) => name,
      get: (name: string) => ({
        sever: async (kind: string) => {
          severed.push([name, kind]);
        },
        revoke: async (userId: string) => {
          revoked.push([name, userId]);
        },
      }),
    },
  } as unknown as Partial<AppEnv>;

  beforeEach(async () => {
    severed.length = 0;
    revoked.length = 0;
    db = await makeTestDb();
    await users(db, "me", "pal");
    await mutual(db, "me", "pal");
  });

  it("severs as read-only on unfollow", async () => {
    const app = buildApp(db, authed("me"));
    await callJson(app, "unfollowUserAction", { userId: "pal" }, env);
    await vi.waitFor(() => expect(severed).toHaveLength(1));
    expect(severed[0]).toEqual([
      `dm:v1:${dmPair("me", "pal").threadId}`,
      "unfollow",
    ]);
  });

  it("closes the room on block", async () => {
    const app = buildApp(db, authed("me"));
    await callJson(app, "blockUserAction", { userId: "pal" }, env);
    await vi.waitFor(() => expect(severed.map((s) => s[1])).toEqual(["block"]));
  });

  it("revokes the user's side of every thread they are in", async () => {
    await users(db, "other");
    await thread(db, "me", "pal", { sender: "pal" });
    await thread(db, "pal", "other", { sender: "pal" });
    await revokeDmSockets(db, env as AppEnv, "me");
    expect(revoked).toEqual([[`dm:v1:${dmPair("me", "pal").threadId}`, "me"]]);
  });

  it("does nothing when the unfollow changed nothing", async () => {
    const app = buildApp(db, authed("me"));
    await callJson(app, "unfollowUserAction", { userId: "pal" }, env);
    await vi.waitFor(() => expect(severed).toHaveLength(1));
    await callJson(app, "unfollowUserAction", { userId: "pal" }, env);
    await new Promise((r) => setTimeout(r, 20));
    expect(severed).toHaveLength(1);
  });
});
