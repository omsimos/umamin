import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// See actions-post.test.ts — stub the wasm-backed argon2 module (unused here).
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

import { messageTable } from "@umamin/db/schema/message";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
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
