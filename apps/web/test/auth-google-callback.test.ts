import { beforeEach, describe, expect, it, vi } from "vitest";

// The callback resolves its db through getDb(env) rather than the c.set("db")
// seam the action tests use, so the module is stubbed to hand back the same
// in-memory libSQL instance. arctic's token exchange and the denylist /
// rate-limit gates are stubbed to their pass-through outcome; what's under test
// is the upsert, which runs its true SQL against real migrations.
const state = {
  db: null as Db | null,
  claims: {} as Record<string, unknown>,
};

vi.mock("../src/server-lib/db", () => ({
  getDb: () => state.db,
}));

vi.mock("../src/server-lib/oauth", () => ({
  buildGoogle: () => ({
    validateAuthorizationCode: async () => ({ idToken: () => "stub.id.token" }),
  }),
}));

vi.mock("arctic", () => ({
  decodeIdToken: () => state.claims,
  OAuth2RequestError: class extends Error {},
  generateState: () => "s",
  generateCodeVerifier: () => "v",
}));

vi.mock("../src/server-lib/ip-denylist", () => ({
  isIpDenied: async () => false,
}));

vi.mock("../src/server-lib/ratelimit", () => ({
  checkRateLimit: async () => true,
}));

import { accountTable, userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { googleAuthApp } from "../src/api/auth/google";
import type { AppBindings } from "../src/server-lib/context";
import {
  GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
  GOOGLE_OAUTH_INTENT_COOKIE_NAME,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "../src/server-lib/cookies";
import type { Db } from "../src/server-lib/db";
import type { AppEnv } from "../src/server-lib/env";
import {
  __clearSessionCache,
  createSession,
  generateSessionToken,
} from "../src/server-lib/session";
import { makeTestDb } from "./helpers/db";

const GOOGLE_PHOTO = "https://lh3.googleusercontent.com/a/abc123";

const FAKE_CTX = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

// Matching state + a code verifier are all the CSRF/PKCE gate needs; `intent`
// is what decides whether the callback may provision an account.
function callback(intent: "register" | "login", session?: string) {
  const app = new Hono<AppBindings>().route("/auth/google", googleAuthApp);
  const cookies = [
    `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=st`,
    `${GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME}=cv`,
    `${GOOGLE_OAUTH_INTENT_COOKIE_NAME}=${intent}`,
    ...(session ? [`${SESSION_COOKIE_NAME}=${session}`] : []),
  ].join("; ");

  return app.request(
    "/auth/google/callback?code=c&state=st",
    { headers: { cookie: cookies } },
    { TURSO_CONNECTION_URL: "", TURSO_AUTH_TOKEN: "" } as unknown as AppEnv,
    FAKE_CTX,
  );
}

describe("google oauth callback (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
    state.db = db;
    state.claims = {
      sub: "google-sub-1",
      email: "alice@example.com",
      picture: GOOGLE_PHOTO,
    };
  });

  it("provisions a Google signup with no profile photo", async () => {
    const res = await callback("register");
    expect(res.status).toBe(302);

    const [created] = await db.select().from(userTable);
    // The default profile picture is the account's own blobatar. Adopting the
    // Google photo would publish a real face for an anonymous-messaging
    // account nobody opted into.
    expect(created.imageUrl).toBeNull();
    expect(created.username).toMatch(/^user_/);
  });

  it("still records the Google photo on the linked account row", async () => {
    await callback("register");

    const [account] = await db.select().from(accountTable);
    // Kept for the "Google Account" card in Settings — it identifies which
    // account is linked, and is never read as a profile picture.
    expect(account.picture).toBe(GOOGLE_PHOTO);
    expect(account.email).toBe("alice@example.com");
  });

  it("leaves an existing photo alone when linking Google to an account", async () => {
    const uploaded = "https://cdn.test/avatars/alice.webp";
    await db.insert(userTable).values({
      id: "user_1",
      username: "alice",
      imageUrl: uploaded,
    });
    const token = generateSessionToken();
    await createSession(db, token, "user_1");

    const res = await callback("login", token);
    expect(res.status).toBe(302);

    const [after] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, "user_1"));
    expect(after.imageUrl).toBe(uploaded);
  });

  it("does not adopt the Google photo for a linking user who has none", async () => {
    await db
      .insert(userTable)
      .values({ id: "user_2", username: "bob", imageUrl: null });
    const token = generateSessionToken();
    await createSession(db, token, "user_2");

    await callback("login", token);

    const [after] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, "user_2"));
    expect(after.imageUrl).toBeNull();
  });
});
