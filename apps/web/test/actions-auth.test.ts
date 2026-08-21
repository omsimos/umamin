import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real argon2id driver (server-lib/argon2) imports a precompiled .wasm
// module that only resolves in the vitest workers pool — but these flow tests
// need real libSQL (:memory:), which only runs in the node pool. So the DRIVER
// is stubbed with a deterministic hash/verify to exercise the login/signup
// ORCHESTRATION (enumeration ordering, ban-after-password, wrong password,
// signup→login→logout lifecycle). argon2 correctness itself is covered by
// argon2.worker.test.ts.
vi.mock("../src/server-lib/argon2", () => ({
  hash: async (pw: string) =>
    `$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$${Buffer.from(pw).toString("base64")}`,
  verify: async (phc: string, pw: string) =>
    phc.endsWith(Buffer.from(pw).toString("base64")),
}));

import { userTable } from "@umamin/db/schema/user";
import * as argon2 from "../src/server-lib/argon2";
import { hash } from "../src/server-lib/argon2";
import type { Db } from "../src/server-lib/db";
import {
  accountSuspendedMessage,
  VERIFICATION_FAILED_ERROR,
} from "../src/server-lib/errors";
import { __clearSessionCache } from "../src/server-lib/session";
import { ANON, buildApp, call, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

const INCORRECT = "Incorrect username or password";

function sessionToken(res: Response): string | null {
  const raw = res.headers.get("set-cookie") ?? "";
  return /(?:^|,\s*)session=([^;]+)/.exec(raw)?.[1] ?? null;
}

describe("auth flows (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    db = await makeTestDb();
  });

  it("signup → login → logout lifecycle", async () => {
    const app = buildApp(db, ANON);

    // signup
    const signupRes = await call(app, "signup", {
      username: "alice1",
      password: "password123",
      confirmPassword: "password123",
    });
    expect(await signupRes.json()).toEqual({ redirect: "/inbox" });
    const [created] = await db
      .select({ username: userTable.username })
      .from(userTable);
    expect(created.username).toBe("alice1");

    // login with the correct password
    const loginRes = await call(app, "login", {
      username: "alice1",
      password: "password123",
    });
    expect(await loginRes.json()).toEqual({ redirect: "/inbox" });
    const token = sessionToken(loginRes);
    expect(token).toBeTruthy();

    // logout with the minted session cookie
    const logoutRes = await call(
      app,
      "logout",
      {},
      {},
      { cookie: `session=${token}` },
    );
    expect(await logoutRes.json()).toEqual({ redirect: "/login" });
  });

  // Turnstile is configured-means-on: these suites normally run with no secret
  // (hence no token anywhere above), so the gate is exercised by setting one.
  describe("turnstile gate", () => {
    const TURNSTILE = { TURNSTILE_SECRET: "test-secret" };

    function siteverify(body: unknown) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, json: async () => body })),
      );
    }

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it.each([
      "login",
      "signup",
    ] as const)("%s rejects a missing token before spending any Argon2", async (name) => {
      const app = buildApp(db, ANON);
      const hashSpy = vi.spyOn(argon2, "hash");

      const { json } = await callJson(
        app,
        name,
        {
          username: "carol1",
          password: "password123",
          confirmPassword: "password123",
        },
        TURNSTILE,
      );

      expect(json).toEqual({ error: VERIFICATION_FAILED_ERROR });
      // The whole point of the placement: no hash, and for signup no row.
      expect(hashSpy).not.toHaveBeenCalled();
      expect(await db.select().from(userTable)).toHaveLength(0);
    });

    it("signup accepts a token siteverify approves", async () => {
      siteverify({
        success: true,
        action: "signup",
        hostname: "x.test",
      });

      const { json } = await callJson(
        buildApp(db, ANON),
        "signup",
        {
          username: "dave12",
          password: "password123",
          confirmPassword: "password123",
          turnstileToken: "tok",
        },
        TURNSTILE,
      );

      expect(json).toEqual({ redirect: "/inbox" });
    });

    it("login rejects a token minted for signup", async () => {
      await db.insert(userTable).values({
        id: "erin1",
        username: "erin1",
        passwordHash: await hash("password123"),
      });
      siteverify({ success: true, action: "signup", hostname: "x.test" });

      const { json } = await callJson(
        buildApp(db, ANON),
        "login",
        {
          username: "erin1",
          password: "password123",
          turnstileToken: "tok",
        },
        TURNSTILE,
      );

      // Correct credentials, wrong action — must not mint a session.
      expect(json).toEqual({ error: VERIFICATION_FAILED_ERROR });
    });
  });

  it("rejects a wrong password with the generic message", async () => {
    const app = buildApp(db, ANON);
    await call(app, "signup", {
      username: "bob123",
      password: "password123",
      confirmPassword: "password123",
    });

    const { json } = await callJson(app, "login", {
      username: "bob123",
      password: "wrongpassword",
    });
    expect(json).toEqual({ error: INCORRECT });
  });

  it("returns the same message for an unknown username (no enumeration)", async () => {
    const app = buildApp(db, ANON);
    const { json } = await callJson(app, "login", {
      username: "ghost1",
      password: "password123",
    });
    expect(json).toEqual({ error: INCORRECT });
  });

  it("reveals suspension only AFTER a correct password", async () => {
    const app = buildApp(db, ANON);

    await db.insert(userTable).values({
      id: "banned1",
      username: "banned1",
      passwordHash: await hash("password123"),
      bannedAt: new Date(),
      banReason: "spam",
    });

    // wrong password on a banned account still reads as generic (no leak)
    const wrong = await callJson(app, "login", {
      username: "banned1",
      password: "nope-nope-nope",
    });
    expect(wrong.json).toEqual({ error: INCORRECT });

    // correct password reveals the suspension
    const right = await callJson(app, "login", {
      username: "banned1",
      password: "password123",
    });
    expect(right.json).toEqual({ error: accountSuspendedMessage("spam") });
  });

  it("logout without a session is unauthorized", async () => {
    const app = buildApp(db, ANON);
    const res = await call(app, "logout", {});
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects a duplicate username on signup", async () => {
    const app = buildApp(db, ANON);
    await call(app, "signup", {
      username: "dupe12",
      password: "password123",
      confirmPassword: "password123",
    });
    const { json } = await callJson(app, "signup", {
      username: "dupe12",
      password: "password123",
      confirmPassword: "password123",
    });
    expect(json).toEqual({ error: "Username already exists" });
  });
});
