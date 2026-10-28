import { beforeEach, describe, expect, it, vi } from "vitest";

// argon2's precompiled .wasm import only resolves in the workers pool; this
// node-pool suite pulls argon2 in transitively via actionsApp but never calls
// it — except the password-change cases below, which need real verify/hash
// semantics, so this mock is deterministic (hash(pw) embeds base64(pw);
// verify checks the suffix) rather than a stub that always fails. Copied from
// test/actions-auth.test.ts.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async (pw: string) =>
    `$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$${Buffer.from(pw).toString("base64")}`,
  verify: async (phc: string, pw: string) =>
    phc.endsWith(Buffer.from(pw).toString("base64")),
}));

const { captureRequestException, captureServerException } = vi.hoisted(() => ({
  captureRequestException: vi.fn(),
  captureServerException: vi.fn(),
}));

vi.mock("../src/server-lib/posthog", () => ({
  captureRequestException,
  captureServerException,
}));

import { dmThreadTable } from "@umamin/db/schema/dm";
import { sessionTable, userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { dmPair } from "../src/lib/dm/pair";
import { hash } from "../src/server-lib/argon2";
import type { Db } from "../src/server-lib/db";
import { RATE_LIMIT_ERROR } from "../src/server-lib/ratelimit";
import {
  __clearSessionCache,
  createSession,
  sessionIdFromToken,
} from "../src/server-lib/session";
import { ANON, authed, buildApp, call, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

const SETTINGS = { question: "ask me", bio: "", displayName: "" };
const OLD_PASSWORD = "old-password-123";

async function username(db: Db, id: string) {
  const [row] = await db
    .select({ username: userTable.username })
    .from(userTable)
    .where(eq(userTable.id, id));
  return row.username;
}

describe("user actions (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    captureRequestException.mockClear();
    db = await makeTestDb();
    await db.insert(userTable).values({
      id: "user1",
      username: "u_user1",
      passwordHash: await hash(OLD_PASSWORD),
    });
  });

  it("getUserProfileAction is rate-limited per IP", async () => {
    const app = buildApp(db, ANON);
    const refuse = { limit: async () => ({ success: false }) };
    const { json } = await callJson(
      app,
      "getUserProfileAction",
      { username: "u_user1" },
      { RL_READ: refuse } as never,
    );
    expect(json).toEqual({ error: RATE_LIMIT_ERROR });
  });

  it("refuses to rename onto a moderator roster name", async () => {
    const app = buildApp(db, authed("user1"));
    const { json } = await callJson(
      app,
      "generalSettingsAction",
      { ...SETTINGS, username: "modname" },
      { MODERATOR_USERS: "modname" },
    );
    expect(json).toEqual({ error: "Username already exists" });
    expect(await username(db, "user1")).toBe("u_user1");
  });

  it("still allows an ordinary rename", async () => {
    const app = buildApp(db, authed("user1"));
    const { json } = await callJson(
      app,
      "generalSettingsAction",
      { ...SETTINGS, username: "fresh_name" },
      { MODERATOR_USERS: "modname" },
    );
    expect(json).toMatchObject({ success: true });
    expect(await username(db, "user1")).toBe("fresh_name");
  });

  // A listed moderator saving other settings must not be locked out of their
  // own name by the reservation.
  it("lets a moderator keep their own roster name", async () => {
    const app = buildApp(db, authed("user1"));
    const { json } = await callJson(
      app,
      "generalSettingsAction",
      { ...SETTINGS, username: "u_user1" },
      { MODERATOR_USERS: "u_user1" },
    );
    expect(json).toMatchObject({ success: true });
    expect(await username(db, "user1")).toBe("u_user1");
  });

  it("toggles quiet mode from the stored value, not the cached session row", async () => {
    // The stub session says quietMode:false forever — like a stale micro-cache.
    const app = buildApp(db, authed("user1", { quietMode: false }));
    expect((await callJson(app, "toggleQuietModeAction")).json).toEqual({
      quietMode: true,
    });
    expect((await callJson(app, "toggleQuietModeAction")).json).toEqual({
      quietMode: false,
    });
    const [row] = await db
      .select({ quietMode: userTable.quietMode })
      .from(userTable)
      .where(eq(userTable.id, "user1"));
    expect(row.quietMode).toBe(false);
  });

  it("verifies the current password against the live row", async () => {
    // Session row carries a hash for a different password than the DB has.
    const app = buildApp(
      db,
      authed("user1", { passwordHash: await hash("stale-password-000") }),
    );
    const { json } = await callJson(app, "updatePasswordAction", {
      currentPassword: OLD_PASSWORD,
      newPassword: "new-password-456",
      confirmPassword: "new-password-456",
    });
    expect(json).toEqual({ success: true });
  });

  it("changing the password revokes every other session and mints exactly one", async () => {
    await createSession(db, "device-a-token", "user1");
    await createSession(db, "device-b-token", "user1");
    const app = buildApp(
      db,
      authed("user1", { passwordHash: await hash(OLD_PASSWORD) }),
    );
    const res = await call(app, "updatePasswordAction", {
      currentPassword: OLD_PASSWORD,
      newPassword: "new-password-456",
      confirmPassword: "new-password-456",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/session=/);
    const sessions = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, "user1"));
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).not.toBe(sessionIdFromToken("device-a-token"));
    const [row] = await db
      .select({ passwordHash: userTable.passwordHash })
      .from(userTable)
      .where(eq(userTable.id, "user1"));
    expect(row.passwordHash).not.toContain(
      Buffer.from(OLD_PASSWORD).toString("base64"),
    );
  });

  it("changing the password closes the user's open DM sockets", async () => {
    await db.insert(userTable).values({ id: "user2", username: "u_user2" });
    const pair = dmPair("user1", "user2");
    await db.insert(dmThreadTable).values({
      id: pair.threadId,
      userLowId: pair.lowId,
      userHighId: pair.highId,
      lastMessageAt: new Date(1_000),
      lastSeq: 1,
      lastSenderId: "user2",
      lastPreview: null,
    });
    const revoked: [string, string][] = [];
    const DM_ROOM = {
      idFromName: (name: string) => name,
      get: (name: string) => ({
        revoke: async (userId: string) => {
          revoked.push([name, userId]);
        },
      }),
    };
    const app = buildApp(
      db,
      authed("user1", { passwordHash: await hash(OLD_PASSWORD) }),
    );
    const res = await call(
      app,
      "updatePasswordAction",
      {
        currentPassword: OLD_PASSWORD,
        newPassword: "new-password-456",
        confirmPassword: "new-password-456",
      },
      { DM_ROOM } as never,
    );
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(revoked).toHaveLength(1));
    expect(revoked[0]).toEqual([`dm:v1:${pair.threadId}`, "user1"]);
  });
});
