import { sessionTable, userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/server-lib/db";
import {
  __clearSessionCache,
  createSession,
  generateSessionToken,
  invalidateSession,
  invalidateUserSessions,
  resolveSession,
  sessionIdFromToken,
  validateSessionToken,
} from "../src/server-lib/session";
import { makeTestDb } from "./helpers/db";

// Real in-memory libSQL (see helpers/db.ts) — session SQL is exercised for real.

const TTL_MS = 1000 * 60 * 60 * 24 * 30;

async function seedUser(
  db: Db,
  id: string,
  extra: Record<string, unknown> = {},
) {
  await db.insert(userTable).values({ id, username: `u_${id}`, ...extra });
}

describe("session core (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
  });

  it("creates a session and validates the token (read-your-writes)", async () => {
    await seedUser(db, "user1");
    const token = generateSessionToken();
    const session = await createSession(db, token, "user1");
    expect(session.id).toBe(sessionIdFromToken(token));

    const result = await validateSessionToken(db, token);
    expect(result.session?.userId).toBe("user1");
    expect(result.user?.username).toBe("u_user1");
  });

  it("returns null for an unknown token", async () => {
    const result = await validateSessionToken(db, generateSessionToken());
    expect(result).toEqual({ session: null, user: null });
  });

  it("deletes and rejects an expired session", async () => {
    await seedUser(db, "user2");
    const token = generateSessionToken();
    const id = sessionIdFromToken(token);
    await db.insert(sessionTable).values({
      id,
      userId: "user2",
      expiresAt: Date.now() - 1000,
    });

    const result = await validateSessionToken(db, token);
    expect(result).toEqual({ session: null, user: null });

    const rows = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.id, id));
    expect(rows).toHaveLength(0);
  });

  it("rejects a banned account (full lockout)", async () => {
    await seedUser(db, "user3", { bannedAt: new Date() });
    const token = generateSessionToken();
    await createSession(db, token, "user3");
    __clearSessionCache();

    const result = await validateSessionToken(db, token);
    expect(result).toEqual({ session: null, user: null });
  });

  it("slides expiry forward inside the 15-day renewal window", async () => {
    await seedUser(db, "user4");
    const token = generateSessionToken();
    const id = sessionIdFromToken(token);
    // Expires in 10 days → inside the 15-day threshold → should renew to ~30d.
    const soon = Date.now() + 1000 * 60 * 60 * 24 * 10;
    await db
      .insert(sessionTable)
      .values({ id, userId: "user4", expiresAt: soon });

    await validateSessionToken(db, token);

    const [row] = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.id, id));
    expect(row.expiresAt).toBeGreaterThan(soon);
    expect(row.expiresAt).toBeGreaterThan(Date.now() + TTL_MS - 5000);
  });

  it("invalidateSession removes the row", async () => {
    await seedUser(db, "user5");
    const token = generateSessionToken();
    const session = await createSession(db, token, "user5");
    await invalidateSession(db, session.id);
    expect(await validateSessionToken(db, token)).toEqual({
      session: null,
      user: null,
    });
  });

  it("invalidateUserSessions revokes every session (force logout)", async () => {
    await seedUser(db, "user6");
    const t1 = generateSessionToken();
    const t2 = generateSessionToken();
    await createSession(db, t1, "user6");
    await createSession(db, t2, "user6");

    await invalidateUserSessions(db, "user6");
    expect((await validateSessionToken(db, t1)).session).toBeNull();
    expect((await validateSessionToken(db, t2)).session).toBeNull();
  });

  describe("resolveSession (dual auth)", () => {
    function appFor(db: Db) {
      return new Hono().get("/whoami", async (c) => {
        const r = await resolveSession(c, db);
        return c.json({ source: r.source, userId: r.session?.userId ?? null });
      });
    }

    it("reads the session cookie and marks source=cookie", async () => {
      await seedUser(db, "user7");
      const token = generateSessionToken();
      await createSession(db, token, "user7");

      const res = await appFor(db).request("/whoami", {
        headers: { cookie: `session=${token}` },
      });
      expect(await res.json()).toEqual({ source: "cookie", userId: "user7" });
    });

    it("reads a bearer token and marks source=bearer", async () => {
      await seedUser(db, "user8");
      const token = generateSessionToken();
      await createSession(db, token, "user8");

      const res = await appFor(db).request("/whoami", {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(await res.json()).toEqual({ source: "bearer", userId: "user8" });
    });

    it("returns no session when neither credential is present", async () => {
      const res = await appFor(db).request("/whoami");
      expect(await res.json()).toEqual({ source: null, userId: null });
    });
  });
});
