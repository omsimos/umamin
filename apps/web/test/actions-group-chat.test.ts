import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Group chat ships OFF behind a kill switch (server-lib/group GROUP_CHAT_ENABLED
// = false); force it on so these tests exercise the send/react/delete logic that
// must still work when the flag is flipped back on. Everything else is real.
vi.mock("../src/server-lib/group", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/server-lib/group")>()),
  GROUP_CHAT_ENABLED: true,
}));

// argon2's precompiled .wasm import only resolves in the workers pool; this
// node-pool suite pulls argon2 in transitively via actionsApp but never calls it.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

import { groupTable as groupsTable } from "@umamin/db/schema/group";
import { groupMessageTable } from "@umamin/db/schema/group-message";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import type { Db } from "../src/server-lib/db";
import { __clearSessionCache } from "../src/server-lib/session";
import { authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

const PLUS = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);

beforeAll(() => {
  process.env.AES_256_GCM_KEY = Buffer.from(new Uint8Array(32)).toString(
    "base64",
  );
});

async function seedUser(db: Db, id: string) {
  await db.insert(userTable).values({ id, username: `u_${id}` });
}

async function createGroup(db: Db) {
  const app = buildApp(db, authed("owner", { createdAt: PLUS }));
  const { json } = await callJson<{ group: { id: string } }>(
    app,
    "createGroupAction",
    {
      name: "Crew",
      description: "",
      tag: "crew",
      icon: "swords",
      accent: null,
    },
  );
  return json.group.id;
}

describe("group chat actions (real libSQL)", () => {
  let db: Db;
  let groupId: string;

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
    await seedUser(db, "owner");
    await seedUser(db, "stranger");
    groupId = await createGroup(db);
  });

  it("a member sends an encrypted message and bumps lastMessageAt", async () => {
    const app = buildApp(db, authed("owner", { createdAt: PLUS }));
    const { json } = await callJson<{ success: boolean; id: string }>(
      app,
      "sendGroupMessageAction",
      { groupId, content: "  hello team  " },
    );

    expect(json.success).toBe(true);
    const [msg] = await db
      .select()
      .from(groupMessageTable)
      .where(eq(groupMessageTable.id, json.id));
    expect(msg.senderId).toBe("owner");
    // Stored encrypted, never plaintext.
    expect(msg.content).not.toContain("hello team");

    const [group] = await db
      .select({ lastMessageAt: groupsTable.lastMessageAt })
      .from(groupsTable)
      .where(eq(groupsTable.id, groupId));
    expect(group.lastMessageAt).not.toBeNull();
  });

  it("rejects a non-member send", async () => {
    const app = buildApp(db, authed("stranger", { createdAt: PLUS }));
    const { json } = await callJson(app, "sendGroupMessageAction", {
      groupId,
      content: "let me in",
    });
    expect(json).toEqual({ error: "Unauthorized" });
  });

  it("reaction toggles on then off for the same emoji", async () => {
    const app = buildApp(db, authed("owner", { createdAt: PLUS }));
    const { json: sent } = await callJson<{ id: string }>(
      app,
      "sendGroupMessageAction",
      { groupId, content: "react to me" },
    );

    let { json } = await callJson(app, "reactToGroupMessageAction", {
      groupId,
      messageId: sent.id,
      emoji: "👍",
    });
    expect(json).toEqual({ success: true, viewerReaction: "👍" });

    ({ json } = await callJson(app, "reactToGroupMessageAction", {
      groupId,
      messageId: sent.id,
      emoji: "👍",
    }));
    expect(json).toEqual({ success: true, viewerReaction: null });
  });

  it("rejects an emoji outside the allowed set", async () => {
    const app = buildApp(db, authed("owner", { createdAt: PLUS }));
    const { json: sent } = await callJson<{ id: string }>(
      app,
      "sendGroupMessageAction",
      { groupId, content: "hi" },
    );
    const { json } = await callJson(app, "reactToGroupMessageAction", {
      groupId,
      messageId: sent.id,
      emoji: "💩",
    });
    expect(json).toEqual({ error: "Invalid reaction" });
  });

  it("author deletes their own message", async () => {
    const app = buildApp(db, authed("owner", { createdAt: PLUS }));
    const { json: sent } = await callJson<{ id: string }>(
      app,
      "sendGroupMessageAction",
      { groupId, content: "bye" },
    );

    const { json } = await callJson(app, "deleteGroupMessageAction", {
      groupId,
      messageId: sent.id,
    });
    expect(json).toEqual({ success: true });

    const rows = await db
      .select()
      .from(groupMessageTable)
      .where(eq(groupMessageTable.id, sent.id));
    expect(rows).toHaveLength(0);
  });
});
