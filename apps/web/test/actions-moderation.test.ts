import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// argon2's precompiled .wasm import only resolves in the workers pool; this
// node-pool suite pulls argon2 in transitively via actionsApp but never calls it.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async () => "",
  verify: async () => false,
}));

vi.mock("../src/server-lib/posthog", () => ({
  captureRequestException: vi.fn(),
  captureServerException: vi.fn(),
}));

import { sessionTable, userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { dmPair } from "../src/lib/dm/pair";
import type { Db } from "../src/server-lib/db";
import { tursoDmStore } from "../src/server-lib/dm/store";
import { getOpenDmReports } from "../src/server-lib/dm/threads";
import type { AppEnv } from "../src/server-lib/env";
import { NOT_FOUND_ERROR } from "../src/server-lib/errors";
import { __clearSessionCache, createSession } from "../src/server-lib/session";
import { authed, buildApp, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

const ENV = { MODERATOR_USERS: "u_mod,u_mod2" };
const NOT_FOUND = { error: "User not found" };

beforeAll(() => {
  process.env.AES_256_GCM_KEY = Buffer.from(new Uint8Array(32)).toString(
    "base64",
  );
});

describe("moderator-only actions (real libSQL)", () => {
  let db: Db;

  async function ban(id: string) {
    const [row] = await db
      .select({ bannedAt: userTable.bannedAt, bannedBy: userTable.bannedBy })
      .from(userTable)
      .where(eq(userTable.id, id));
    return row;
  }

  async function sessionCount(userId: string) {
    const rows = await db
      .select({ id: sessionTable.id })
      .from(sessionTable)
      .where(eq(sessionTable.userId, userId));
    return rows.length;
  }

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
    await db.insert(userTable).values(
      ["mod", "mod2", "bob", "eve"].map((id) => ({
        id,
        username: `u_${id}`,
      })),
    );
    await createSession(db, "bob-a", "bob");
    await createSession(db, "bob-b", "bob");
  });

  it("a non-moderator can't ban anyone", async () => {
    const app = buildApp(db, authed("eve"));
    const { json } = await callJson(
      app,
      "banUserAction",
      { username: "u_bob" },
      ENV,
    );

    expect(json).toEqual(NOT_FOUND);
    expect((await ban("bob"))?.bannedAt).toBeNull();
    expect(await sessionCount("bob")).toBe(2);
  });

  it("a non-moderator gets the same answer for a missing user", async () => {
    const app = buildApp(db, authed("eve"));
    const { json } = await callJson(
      app,
      "banUserAction",
      { username: "u_nobody" },
      ENV,
    );

    expect(json).toEqual(NOT_FOUND);
  });

  it("a moderator bans, records who, and logs the target out", async () => {
    const app = buildApp(db, authed("mod"));
    const { json } = await callJson(
      app,
      "banUserAction",
      { username: "u_bob", reason: "spam" },
      ENV,
    );

    expect(json).toEqual({ success: true });
    const row = await ban("bob");
    expect(row?.bannedAt).not.toBeNull();
    expect(row?.bannedBy).toBe("mod");
    expect(await sessionCount("bob")).toBe(0);
  });

  it("a moderator can't ban themselves", async () => {
    const app = buildApp(db, authed("mod"));
    const { json } = await callJson(
      app,
      "banUserAction",
      { username: "u_mod" },
      ENV,
    );

    expect(json).toEqual({ error: "You can't ban yourself." });
    expect((await ban("mod"))?.bannedAt).toBeNull();
  });

  it("a moderator can't ban another moderator", async () => {
    const app = buildApp(db, authed("mod"));
    const { json } = await callJson(
      app,
      "banUserAction",
      { username: "u_mod2" },
      ENV,
    );

    expect(json).toEqual({ error: "You can't ban another moderator." });
    expect((await ban("mod2"))?.bannedAt).toBeNull();
  });

  it("only a moderator can unban", async () => {
    await db
      .update(userTable)
      .set({ bannedAt: new Date(), banReason: "spam", bannedBy: "mod" })
      .where(eq(userTable.id, "bob"));

    const asEve = await callJson(
      buildApp(db, authed("eve")),
      "unbanUserAction",
      { username: "u_bob" },
      ENV,
    );
    expect(asEve.json).toEqual(NOT_FOUND);
    expect((await ban("bob"))?.bannedAt).not.toBeNull();

    const asMod = await callJson(
      buildApp(db, authed("mod")),
      "unbanUserAction",
      { username: "u_bob" },
      ENV,
    );
    expect(asMod.json).toEqual({ success: true });
    expect(await ban("bob")).toEqual({ bannedAt: null, bannedBy: null });
  });

  describe("IP denylist", () => {
    const kv = {
      put: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
      get: vi.fn(async () => null),
      list: vi.fn(async () => ({ keys: [], list_complete: true })),
    };
    const env = { ...ENV, KV: kv } as unknown as Partial<AppEnv>;

    beforeEach(() => {
      kv.put.mockClear();
      kv.delete.mockClear();
    });

    it("a non-moderator can't deny or allow an IP", async () => {
      const app = buildApp(db, authed("eve"));

      const denied = await callJson(
        app,
        "denyIpAction",
        { ip: "203.0.113.7" },
        env,
      );
      const allowed = await callJson(
        app,
        "allowIpAction",
        { ip: "203.0.113.7" },
        env,
      );

      expect(denied.json).toEqual(NOT_FOUND);
      expect(allowed.json).toEqual(NOT_FOUND);
      expect(kv.put).not.toHaveBeenCalled();
      expect(kv.delete).not.toHaveBeenCalled();
    });

    it("a moderator can deny an IP", async () => {
      const app = buildApp(db, authed("mod"));
      const { json } = await callJson(
        app,
        "denyIpAction",
        { ip: "203.0.113.7" },
        env,
      );

      expect(json).toEqual({ success: true });
      expect(kv.put).toHaveBeenCalledTimes(1);
    });

    it("a moderator can't deny their own IP", async () => {
      const app = buildApp(db, authed("mod"));
      const { json } = await callJson(
        app,
        "denyIpAction",
        { ip: "198.51.100.9" },
        env,
        { "cf-connecting-ip": "198.51.100.9" },
      );

      expect(json).toEqual({ error: "You can't block your own IP address." });
      expect(kv.put).not.toHaveBeenCalled();
    });
  });

  it("only a moderator can resolve a DM report", async () => {
    await tursoDmStore({} as AppEnv, () => db).insertReport({
      reporterId: "bob",
      reportedId: "eve",
      threadId: dmPair("bob", "eve").threadId,
      messageSeq: 1,
      reason: "spam",
      entries: [{ seq: 1, fromReporter: false, text: "buy now", createdAt: 1 }],
    });
    const [report] = await getOpenDmReports(db);
    const id = report?.id ?? "";
    expect(id).not.toBe("");

    const asEve = await callJson(
      buildApp(db, authed("eve")),
      "resolveDmReportAction",
      { id, resolution: "dismissed" },
      ENV,
    );
    expect(asEve.json).toEqual({ error: NOT_FOUND_ERROR });
    expect(await getOpenDmReports(db)).toHaveLength(1);

    const asMod = await callJson(
      buildApp(db, authed("mod")),
      "resolveDmReportAction",
      { id, resolution: "dismissed" },
      ENV,
    );
    expect(asMod.json).toEqual({ success: true });
    expect(await getOpenDmReports(db)).toHaveLength(0);
  });
});
