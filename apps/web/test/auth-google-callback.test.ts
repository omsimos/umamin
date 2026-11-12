import { beforeEach, describe, expect, it, vi } from "vitest";

// The callback resolves its db through getDb(env) rather than the c.set("db")
// seam the action tests use, so the module is stubbed to hand back the same
// in-memory libSQL instance. Google's token exchange and the denylist /
// rate-limit gates are stubbed to their pass-through outcome; what's under test
// is the upsert, which runs its true SQL against real migrations.
const state = {
  db: null as Db | null,
  claims: {} as Record<string, unknown>,
  limiterKeys: [] as string[],
  denied: false,
  limited: false,
  exchangeFails: false,
};

vi.mock("../src/server-lib/db", () => ({
  getDb: () => state.db,
}));

vi.mock("@umamin/auth/google", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@umamin/auth/google")>()),
  exchangeAuthorizationCode: async () => {
    if (state.exchangeFails) throw new Error("invalid_grant");
    return { idToken: "stub.id.token" };
  },
  decodeIdTokenClaims: () => state.claims,
}));

vi.mock("../src/server-lib/ip-denylist", () => ({
  isIpDenied: async () => state.denied,
}));

vi.mock("../src/server-lib/ratelimit", () => ({
  checkRateLimit: async (_env: unknown, _name: string, key: string) => {
    state.limiterKeys.push(key);
    return !state.limited;
  },
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

type CallbackOpts = {
  headers?: Record<string, string>;
  // Replaces the default "?code=c&state=st".
  query?: string;
  // Leaves out a cookie the gate needs.
  without?: "state" | "verifier";
};

// Matching state + a code verifier are all the CSRF/PKCE gate needs; `intent`
// is what decides whether the callback may provision an account.
function callback(
  intent: "register" | "login",
  session?: string,
  opts: CallbackOpts = {},
) {
  const app = new Hono<AppBindings>().route("/auth/google", googleAuthApp);
  const cookies = [
    ...(opts.without === "state"
      ? []
      : [`${GOOGLE_OAUTH_STATE_COOKIE_NAME}=st`]),
    ...(opts.without === "verifier"
      ? []
      : [`${GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME}=cv`]),
    `${GOOGLE_OAUTH_INTENT_COOKIE_NAME}=${intent}`,
    ...(session ? [`${SESSION_COOKIE_NAME}=${session}`] : []),
  ].join("; ");

  return app.request(
    `/auth/google/callback${opts.query ?? "?code=c&state=st"}`,
    { headers: { cookie: cookies, ...opts.headers } },
    { TURSO_CONNECTION_URL: "", TURSO_AUTH_TOKEN: "" } as unknown as AppEnv,
    FAKE_CTX,
  );
}

function mintedSession(res: Response): boolean {
  return res.headers
    .getSetCookie()
    .some(
      (value) =>
        value.startsWith(`${SESSION_COOKIE_NAME}=`) &&
        !value.startsWith(`${SESSION_COOKIE_NAME}=;`),
    );
}

async function expectNothingCreated(db: Db, res: Response) {
  expect(await db.select().from(userTable)).toHaveLength(0);
  expect(await db.select().from(accountTable)).toHaveLength(0);
  expect(mintedSession(res)).toBe(false);
}

describe("google oauth callback (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
    state.db = db;
    state.limiterKeys = [];
    state.denied = false;
    state.limited = false;
    state.exchangeFails = false;
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

  it("keys the callback limit on the IPv6 /64", async () => {
    await callback("register", undefined, {
      headers: { "cf-connecting-ip": "2001:db8:1:2::1" },
    });
    state.claims = { ...state.claims, sub: "google-sub-2" };
    await callback("register", undefined, {
      headers: { "cf-connecting-ip": "2001:db8:1:2:ffff::9" },
    });

    expect(state.limiterKeys).toHaveLength(2);
    expect(state.limiterKeys[0]).toBe(state.limiterKeys[1]);
    for (const key of state.limiterKeys) {
      expect(key.startsWith("oauth:google:")).toBe(true);
    }
  });

  describe("security gates", () => {
    it("refuses a state that does not match the cookie", async () => {
      const res = await callback("register", undefined, {
        query: "?code=c&state=other",
      });
      await expectNothingCreated(db, res);
    });

    it("refuses a callback without the PKCE verifier cookie", async () => {
      const res = await callback("register", undefined, {
        without: "verifier",
      });
      await expectNothingCreated(db, res);
    });

    it("refuses a callback without a code", async () => {
      const res = await callback("register", undefined, { query: "?state=st" });
      await expectNothingCreated(db, res);
    });

    it("a login intent never creates an account", async () => {
      const res = await callback("login");
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/login?error=no_account");
      await expectNothingCreated(db, res);
    });

    it("refuses to link a Google identity that belongs to another account", async () => {
      await db.insert(userTable).values([
        { id: "owner", username: "owner" },
        { id: "other", username: "other" },
      ]);
      await db.insert(accountTable).values({
        providerId: "google",
        providerUserId: "google-sub-1",
        userId: "owner",
        email: "o@example.com",
        picture: "",
      });
      const token = generateSessionToken();
      await createSession(db, token, "other");

      const res = await callback("login", token);
      expect(res.headers.get("location")).toBe(
        "/settings?error=already_linked",
      );

      const [account] = await db
        .select()
        .from(accountTable)
        .where(eq(accountTable.providerUserId, "google-sub-1"));
      expect(account.userId).toBe("owner");
    });

    it("a banned linked account is sent to /banned without a session", async () => {
      await db
        .insert(userTable)
        .values({ id: "banned", username: "banned", bannedAt: new Date() });
      await db.insert(accountTable).values({
        providerId: "google",
        providerUserId: "google-sub-1",
        userId: "banned",
        email: "b@example.com",
        picture: "",
      });

      const res = await callback("login");
      expect(res.headers.get("location")).toBe("/banned");
      expect(mintedSession(res)).toBe(false);
    });

    it("a linked account signs in", async () => {
      await db.insert(userTable).values({ id: "linked", username: "linked" });
      await db.insert(accountTable).values({
        providerId: "google",
        providerUserId: "google-sub-1",
        userId: "linked",
        email: "l@example.com",
        picture: "",
      });

      const res = await callback("login");
      expect(res.headers.get("location")).toBe("/inbox");
      expect(mintedSession(res)).toBe(true);
    });

    it("a denied IP gets nothing", async () => {
      state.denied = true;
      const res = await callback("register");
      await expectNothingCreated(db, res);
    });

    it("a rate-limited client gets nothing", async () => {
      state.limited = true;
      const res = await callback("register");
      await expectNothingCreated(db, res);
    });

    it("a rejected authorization code creates nothing", async () => {
      state.exchangeFails = true;
      const res = await callback("register");
      await expectNothingCreated(db, res);
    });
  });
});
