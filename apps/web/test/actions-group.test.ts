import { beforeEach, describe, expect, it, vi } from "vitest";

// See actions-post.test.ts — stub the wasm-backed argon2 module (unused here).
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

import {
  groupMemberTable,
  groupPendingTable,
  groupTable,
} from "@umamin/db/schema/group";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import type { Db } from "../src/server-lib/db";
import { __clearSessionCache } from "../src/server-lib/session";
import { authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

// Umamin+ (group creation) requires an account older than a year.
const PLUS = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
const NEW = new Date();

const validGroup = {
  name: "The Bros",
  description: "",
  tag: "bros",
  icon: "swords",
  accent: null,
};

async function seedUser(db: Db, id: string) {
  await db.insert(userTable).values({ id, username: `u_${id}` });
}

describe("group actions (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
    await seedUser(db, "owner");
    await seedUser(db, "joiner");
  });

  it("creates a group for a Plus user, inserting owner membership + equip", async () => {
    const app = buildApp(db, authed("owner", { createdAt: PLUS }));
    const { json } = await callJson<{
      success: boolean;
      group: { tag: string };
    }>(app, "createGroupAction", validGroup);

    expect(json.success).toBe(true);
    expect(json.group.tag).toBe("BROS");

    const [group] = await db.select().from(groupTable);
    expect(group.creatorId).toBe("owner");

    const [me] = await db
      .select({ equippedGroupId: userTable.equippedGroupId })
      .from(userTable)
      .where(eq(userTable.id, "owner"));
    expect(me.equippedGroupId).toBe(group.id);
  });

  it("rejects group creation for a non-Plus account", async () => {
    const app = buildApp(db, authed("owner", { createdAt: NEW }));
    const { json } = await callJson<{ error: string }>(
      app,
      "createGroupAction",
      validGroup,
    );
    expect(json.error).toMatch(/Umamin\+/);
  });

  it("treats a reserved tag as taken", async () => {
    const app = buildApp(db, authed("owner", { createdAt: PLUS }));
    const { json } = await callJson<{ error: string }>(
      app,
      "createGroupAction",
      { ...validGroup, tag: "MODS" },
    );
    expect(json).toEqual({ error: "That tag is taken." });
  });

  it("rejects a second owned group (one-per-user cap)", async () => {
    const app = buildApp(db, authed("owner", { createdAt: PLUS }));
    await callJson(app, "createGroupAction", validGroup);
    const { json } = await callJson<{ error: string }>(
      app,
      "createGroupAction",
      { ...validGroup, tag: "arcs" },
    );
    expect(json).toEqual({ error: "You already own a group." });
  });

  it("requestToJoinGroupAction records a pending request", async () => {
    const ownerApp = buildApp(db, authed("owner", { createdAt: PLUS }));
    const { json: created } = await callJson<{ group: { id: string } }>(
      ownerApp,
      "createGroupAction",
      validGroup,
    );
    const groupId = created.group.id;

    const joinerApp = buildApp(db, authed("joiner", { createdAt: NEW }));
    const { json } = await callJson(joinerApp, "requestToJoinGroupAction", {
      groupId,
    });
    expect(json).toEqual({ success: true, requested: true });

    const pending = await db
      .select()
      .from(groupPendingTable)
      .where(eq(groupPendingTable.groupId, groupId));
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe("request");
  });

  it("owner cannot leave their own group", async () => {
    const ownerApp = buildApp(db, authed("owner", { createdAt: PLUS }));
    const { json: created } = await callJson<{ group: { id: string } }>(
      ownerApp,
      "createGroupAction",
      validGroup,
    );

    const { json } = await callJson<{ error: string }>(
      ownerApp,
      "leaveGroupAction",
      { groupId: created.group.id },
    );
    expect(json.error).toMatch(/owners can't leave/i);
  });

  it("owner approves a request, adding the requester as a member", async () => {
    const ownerApp = buildApp(db, authed("owner", { createdAt: PLUS }));
    const { json: created } = await callJson<{ group: { id: string } }>(
      ownerApp,
      "createGroupAction",
      validGroup,
    );
    const groupId = created.group.id;

    const joinerApp = buildApp(db, authed("joiner", { createdAt: NEW }));
    await callJson(joinerApp, "requestToJoinGroupAction", { groupId });

    const { json } = await callJson(ownerApp, "respondToJoinRequestAction", {
      groupId,
      userId: "joiner",
      accept: true,
    });
    expect(json).toEqual({ success: true, approved: true });

    const members = await db
      .select()
      .from(groupMemberTable)
      .where(eq(groupMemberTable.groupId, groupId));
    expect(members.map((m) => m.userId).sort()).toEqual(["joiner", "owner"]);
  });
});
