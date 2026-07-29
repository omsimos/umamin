import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// See actions-post.test.ts — stub the wasm-backed argon2 module (unused here).
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

import { messageReplyTable, messageTable } from "@umamin/db/schema/message";
import { notificationTable } from "@umamin/db/schema/notification";
import { userBlockTable, userTable } from "@umamin/db/schema/user";
import { aesDecrypt } from "@umamin/encryption";
import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "../src/server-lib/db";
import { __clearSessionCache } from "../src/server-lib/session";
import { ANON, authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

// aesEncrypt reads process.env.AES_256_GCM_KEY (WebCrypto AES-256-GCM). 32 zero
// bytes is a valid key for the round-trip these tests exercise.
beforeAll(() => {
  process.env.AES_256_GCM_KEY = Buffer.from(new Uint8Array(32)).toString(
    "base64",
  );
});

async function seedUser(
  db: Db,
  id: string,
  extra: Record<string, unknown> = {},
) {
  await db.insert(userTable).values({ id, username: `u_${id}`, ...extra });
}

async function countMessages(db: Db, receiverId: string) {
  const rows = await db
    .select({ id: messageTable.id })
    .from(messageTable)
    .where(eq(messageTable.receiverId, receiverId));
  return rows.length;
}

describe("message actions (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
    await seedUser(db, "recv");
    await seedUser(db, "sender");
  });

  it("openMessageAction opens a sealed message once, then no-ops", async () => {
    await db
      .insert(messageTable)
      .values({ id: "m1", question: "q", content: "c", receiverId: "recv" });

    const app = buildApp(db, authed("recv"));
    let { json } = await callJson(app, "openMessageAction", {
      messageId: "m1",
    });
    expect(json).toEqual({ success: true, opened: true });

    ({ json } = await callJson(app, "openMessageAction", { messageId: "m1" }));
    expect(json).toEqual({ success: true, opened: false });
  });

  it("deleteMessageAction removes the viewer's own message", async () => {
    await db
      .insert(messageTable)
      .values({ id: "m2", question: "q", content: "c", receiverId: "recv" });

    const app = buildApp(db, authed("recv"));
    const { json } = await callJson(app, "deleteMessageAction", "m2");
    expect(json).toEqual({ success: true });
    expect(await countMessages(db, "recv")).toBe(0);
  });

  it("sendMessageAction (anonymous) delivers to a normal receiver", async () => {
    const app = buildApp(db, ANON);
    const { json } = await callJson(app, "sendMessageAction", {
      question: "ask me",
      content: "hi there",
      receiverId: "recv",
    });
    expect(json).toEqual({ success: true });
    expect(await countMessages(db, "recv")).toBe(1);
  });

  it("silently drops a message to a quiet-mode receiver (no row written)", async () => {
    await db
      .update(userTable)
      .set({ quietMode: true })
      .where(eq(userTable.id, "recv"));

    const app = buildApp(db, ANON);
    const { json } = await callJson(app, "sendMessageAction", {
      question: "q",
      content: "hi",
      receiverId: "recv",
    });
    expect(json).toEqual({ success: true });
    expect(await countMessages(db, "recv")).toBe(0);
  });

  it("silently drops a message matching the receiver's blocked words", async () => {
    await db
      .update(userTable)
      .set({ blockedWords: ["spam"] })
      .where(eq(userTable.id, "recv"));

    const app = buildApp(db, ANON);
    const { json } = await callJson(app, "sendMessageAction", {
      question: "q",
      content: "this is SPAM",
      receiverId: "recv",
    });
    expect(json).toEqual({ success: true });
    expect(await countMessages(db, "recv")).toBe(0);
  });

  it("refuses a self-addressed message from a logged-in sender", async () => {
    const app = buildApp(db, authed("recv"));
    const { json } = await callJson(app, "sendMessageAction", {
      question: "q",
      content: "hi",
      receiverId: "recv",
    });
    expect(json).toEqual({ error: "You can't send a message to yourself" });
  });
});

describe("thread replies (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
    await seedUser(db, "recv");
    await seedUser(db, "sender");
    await db.insert(messageTable).values({
      id: "m1",
      question: "q",
      content: "c",
      receiverId: "recv",
      senderId: "sender",
    });
  });

  // Same ordering as the read path: createdAt is second-granularity, so the
  // insertion-ordered rowid breaks same-second ties.
  async function threadRows(messageId: string) {
    return db
      .select()
      .from(messageReplyTable)
      .where(eq(messageReplyTable.messageId, messageId))
      .orderBy(asc(messageReplyTable.createdAt), sql`rowid`);
  }

  async function messageRow(id: string) {
    const rows = await db
      .select()
      .from(messageTable)
      .where(eq(messageTable.id, id));
    return rows[0];
  }

  it("receiver's first reply lands on the legacy column, not the thread table", async () => {
    const app = buildApp(db, authed("recv"));
    const { json } = await callJson<{ reply?: string }>(
      app,
      "createReplyAction",
      { messageId: "m1", content: "first reply" },
    );
    expect(json.reply).toBe("first reply");

    const msg = await messageRow("m1");
    expect(await aesDecrypt(msg.reply ?? "")).toBe("first reply");
    expect(msg.lastReplyAt).not.toBeNull();
    expect(msg.receiverReadAt).not.toBeNull();
    expect(await threadRows("m1")).toHaveLength(0);
  });

  it("sender cannot continue before the receiver replies", async () => {
    const app = buildApp(db, authed("sender"));
    const { json } = await callJson(app, "createReplyAction", {
      messageId: "m1",
      content: "hello again",
    });
    expect(json).toEqual({ error: "You can reply once they respond" });
    expect(await threadRows("m1")).toHaveLength(0);
  });

  it("after the first reply the exchange lands in message_reply, encrypted, with correct roles", async () => {
    await callJson(buildApp(db, authed("recv")), "createReplyAction", {
      messageId: "m1",
      content: "opening reply",
    });

    const senderApp = buildApp(db, authed("sender"));
    const { json } = await callJson<{
      entry?: { id: string; content: string; fromSender: boolean };
    }>(senderApp, "createReplyAction", {
      messageId: "m1",
      content: "sender follow-up",
    });
    expect(json.entry?.fromSender).toBe(true);

    await callJson(buildApp(db, authed("recv")), "createReplyAction", {
      messageId: "m1",
      content: "receiver follow-up",
    });

    const rows = await threadRows("m1");
    expect(rows.map((r) => r.fromSender)).toEqual([true, false]);
    // Encrypted at rest — the plaintext must not appear in the row.
    expect(rows[0].content).not.toContain("sender follow-up");
    expect(await aesDecrypt(rows[0].content)).toBe("sender follow-up");
  });

  it("a sender follow-up notifies the receiver as 'thread' with no actor", async () => {
    await callJson(buildApp(db, authed("recv")), "createReplyAction", {
      messageId: "m1",
      content: "opening reply",
    });
    await callJson(buildApp(db, authed("sender")), "createReplyAction", {
      messageId: "m1",
      content: "follow-up",
    });

    const rows = await db
      .select()
      .from(notificationTable)
      .where(eq(notificationTable.recipientId, "recv"));
    const thread = rows.find((r) => r.type === "thread");
    expect(thread?.targetId).toBe("m1");
    expect(thread?.actorId).toBeNull();
  });

  it("a non-participant reads the thread as not found", async () => {
    await seedUser(db, "stranger");
    const app = buildApp(db, authed("stranger"));
    const { json } = await callJson(app, "createReplyAction", {
      messageId: "m1",
      content: "let me in",
    });
    expect(json).toEqual({ error: "Message not found" });
  });

  it("a block in either direction reads as not found", async () => {
    await callJson(buildApp(db, authed("recv")), "createReplyAction", {
      messageId: "m1",
      content: "opening reply",
    });
    await db
      .insert(userBlockTable)
      .values({ blockerId: "recv", blockedId: "sender" });

    const { json } = await callJson(
      buildApp(db, authed("sender")),
      "createReplyAction",
      { messageId: "m1", content: "follow-up" },
    );
    expect(json).toEqual({ error: "Message not found" });
    expect(await threadRows("m1")).toHaveLength(0);
  });

  it("silently drops a sender follow-up matching the receiver's blocked words", async () => {
    await callJson(buildApp(db, authed("recv")), "createReplyAction", {
      messageId: "m1",
      content: "opening reply",
    });
    await db
      .update(userTable)
      .set({ blockedWords: ["spam"] })
      .where(eq(userTable.id, "recv"));

    const { json } = await callJson(
      buildApp(db, authed("sender")),
      "createReplyAction",
      { messageId: "m1", content: "pure SPAM" },
    );
    expect(json).toEqual({ success: true });
    expect(await threadRows("m1")).toHaveLength(0);
  });

  it("markThreadReadAction moves only the caller's watermark", async () => {
    await callJson(buildApp(db, authed("sender")), "markThreadReadAction", {
      messageId: "m1",
    });

    const msg = await messageRow("m1");
    expect(msg.senderReadAt).not.toBeNull();
    expect(msg.receiverReadAt).toBeNull();
  });
});
