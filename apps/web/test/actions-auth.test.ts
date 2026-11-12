import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { captureRequestException, captureServerException } = vi.hoisted(() => ({
  captureRequestException: vi.fn(),
  captureServerException: vi.fn(),
}));

vi.mock("../src/server-lib/posthog", () => ({
  captureRequestException,
  captureServerException,
}));

import { pushSubscriptionTable } from "@umamin/db/schema/push-subscription";
import { sessionTable, userTable } from "@umamin/db/schema/user";
import { hash } from "../src/server-lib/argon2";
import { SESSION_COOKIE_NAME } from "../src/server-lib/cookies";
import type { Db } from "../src/server-lib/db";
import { accountSuspendedMessage } from "../src/server-lib/errors";
import { RATE_LIMIT_ERROR } from "../src/server-lib/ratelimit";
import {
  __clearSessionCache,
  createSession,
  generateSessionToken,
} from "../src/server-lib/session";
import { ANON, buildApp, call, callJson } from "./helpers/actions";
import { makeTestDb } from "./helpers/db";

const INCORRECT = "Incorrect username or password";

function sessionToken(res: Response): string | null {
  const raw = res.headers.get("set-cookie") ?? "";
  return /(?:^|,\s*)session=([^;]+)/.exec(raw)?.[1] ?? null;
}

function clearsSessionCookie(res: Response): boolean {
  return res.headers
    .getSetCookie()
    .some((value) => value.startsWith(`${SESSION_COOKIE_NAME}=;`));
}

function recordingLimiter() {
  const keys: string[] = [];
  return {
    keys,
    binding: {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        return { success: true };
      },
    },
  };
}

function countingLimiter(max: number) {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  return {
    keys,
    binding: {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        const n = (counts.get(key) ?? 0) + 1;
        counts.set(key, n);
        return { success: n <= max };
      },
    },
  };
}

const ip = (addr: string) => ({ "cf-connecting-ip": addr });

describe("auth flows (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    captureRequestException.mockClear();
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

  it("logout with a session that no longer exists still clears the cookie", async () => {
    const app = buildApp(db, ANON);
    const res = await call(
      app,
      "logout",
      {},
      {},
      { cookie: "session=revoked-token" },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ redirect: "/login" });
    expect(clearsSessionCookie(res)).toBe(true);
  });

  it("logout with no cookie at all still answers with the redirect", async () => {
    const app = buildApp(db, ANON);
    const res = await call(app, "logout", {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ redirect: "/login" });
  });

  it("logout deletes the session, and a second logout is harmless", async () => {
    const app = buildApp(db, ANON);
    await call(app, "signup", {
      username: "carol1",
      password: "password123",
      confirmPassword: "password123",
    });
    const loginRes = await call(app, "login", {
      username: "carol1",
      password: "password123",
    });
    const token = sessionToken(loginRes);
    expect(token).toBeTruthy();
    // Signup minted a session of its own, so the login's is one of two.
    expect(await db.select().from(sessionTable)).toHaveLength(2);

    const first = await call(
      app,
      "logout",
      {},
      {},
      { cookie: `session=${token}` },
    );
    expect(await first.json()).toEqual({ redirect: "/login" });
    expect(await db.select().from(sessionTable)).toHaveLength(1);

    const second = await call(
      app,
      "logout",
      {},
      {},
      { cookie: `session=${token}` },
    );
    expect(await second.json()).toEqual({ redirect: "/login" });
    expect(await db.select().from(sessionTable)).toHaveLength(1);
  });

  it("logout removes this browser's push row, and only that one", async () => {
    await db.insert(userTable).values([
      { id: "u1", username: "u_one", pushPrefs: 1 },
      { id: "u2", username: "u_two", pushPrefs: 1 },
    ]);
    const token = generateSessionToken();
    await createSession(db, token, "u1");
    const endpoint = (device: string) =>
      `https://fcm.googleapis.com/fcm/send/${device}`;
    await db.insert(pushSubscriptionTable).values([
      { userId: "u1", endpoint: endpoint("this"), p256dh: "k", auth: "a" },
      { userId: "u2", endpoint: endpoint("other"), p256dh: "k", auth: "a" },
    ]);

    const res = await call(
      buildApp(db, ANON),
      "logout",
      { pushEndpoint: endpoint("this") },
      {},
      { cookie: `session=${token}` },
    );

    expect(await res.json()).toEqual({ redirect: "/login" });
    const left = await db
      .select({ userId: pushSubscriptionTable.userId })
      .from(pushSubscriptionTable);
    expect(left).toEqual([{ userId: "u2" }]);
    const prefs = await db
      .select({ id: userTable.id, pushPrefs: userTable.pushPrefs })
      .from(userTable)
      .orderBy(userTable.id);
    expect(prefs).toEqual([
      { id: "u1", pushPrefs: 0 },
      { id: "u2", pushPrefs: 1 },
    ]);
    expect(await db.select().from(sessionTable)).toHaveLength(0);
  });

  it("logout ignores a push endpoint it doesn't accept", async () => {
    await db.insert(userTable).values({ id: "u1", username: "u_one" });
    const token = generateSessionToken();
    await createSession(db, token, "u1");

    const res = await call(
      buildApp(db, ANON),
      "logout",
      { pushEndpoint: "http://evil.test/x" },
      {},
      { cookie: `session=${token}` },
    );

    expect(await res.json()).toEqual({ redirect: "/login" });
    expect(await db.select().from(sessionTable)).toHaveLength(0);
  });

  it("logout still refuses a cross-site request", async () => {
    const app = buildApp(db, ANON);
    const res = await call(
      app,
      "logout",
      {},
      {},
      { origin: "https://evil.test", cookie: "session=anything" },
    );
    expect(res.status).toBe(403);
    expect(clearsSessionCookie(res)).toBe(false);
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
    // A taken username is an expected outcome, not something to triage.
    expect(captureRequestException).not.toHaveBeenCalled();
  });

  it("refuses to sign up with a username on the moderator roster", async () => {
    const app = buildApp(db, ANON);
    const { json } = await callJson(
      app,
      "signup",
      {
        username: "modname",
        password: "password123",
        confirmPassword: "password123",
      },
      { MODERATOR_USERS: "modname" },
    );
    expect(json).toEqual({ error: "Username already exists" });
    expect(await db.select().from(userTable)).toHaveLength(0);
  });

  it("rate-limits a reserved-name probe like any other signup", async () => {
    const app = buildApp(db, ANON);
    const refuse = { limit: async () => ({ success: false }) };
    const { json } = await callJson(
      app,
      "signup",
      {
        username: "modname",
        password: "password123",
        confirmPassword: "password123",
      },
      { MODERATOR_USERS: "modname", RL_AUTH: refuse } as never,
    );
    expect(json).toEqual({ error: RATE_LIMIT_ERROR });
  });

  // Signup is mounted outside action(), so its catch is the only chokepoint an
  // unmapped failure (a Turso outage mid-signup) can reach.
  it("reports an unmapped signup failure while keeping the generic error", async () => {
    const failing = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === "insert") {
          return () => {
            throw new Error("turso unreachable");
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as Db;

    const { json } = await callJson(buildApp(failing, ANON), "signup", {
      username: "carol1",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(json).toEqual({ error: "An unexpected error occurred" });
    expect(captureRequestException).toHaveBeenCalledTimes(1);
    expect(captureRequestException.mock.calls[0][1]).toBeInstanceOf(Error);
  });

  describe("limiter keys", () => {
    const loginBody = { username: "alice1", password: "password123" };

    it("login shares one budget across an IPv6 /64", async () => {
      const app = buildApp(db, ANON);
      const auth = recordingLimiter();
      const env = { RL_AUTH: auth.binding } as never;
      await call(app, "login", loginBody, env, ip("2001:db8:1:2::1"));
      await call(app, "login", loginBody, env, ip("2001:db8:1:2:ffff::9"));
      await call(app, "login", loginBody, env, ip("2001:db8:1:3::1"));

      expect(auth.keys).toHaveLength(3);
      expect(auth.keys[0]).toBe(auth.keys[1]);
      expect(auth.keys[2]).not.toBe(auth.keys[0]);
      for (const key of auth.keys) expect(key.startsWith("login:")).toBe(true);
    });

    it("login keeps an IPv4 address whole", async () => {
      const app = buildApp(db, ANON);
      const auth = recordingLimiter();
      await call(
        app,
        "login",
        loginBody,
        { RL_AUTH: auth.binding } as never,
        ip("203.0.113.9"),
      );
      expect(auth.keys).toEqual(["login:203.0.113.9"]);
    });

    it("signup shares one budget across an IPv6 /64", async () => {
      const app = buildApp(db, ANON);
      const auth = recordingLimiter();
      const env = { RL_AUTH: auth.binding } as never;
      for (const [username, addr] of [
        ["signer1", "2001:db8:1:2::1"],
        ["signer2", "2001:db8:1:2:ffff::9"],
      ]) {
        await call(
          app,
          "signup",
          { username, password: "password123", confirmPassword: "password123" },
          env,
          ip(addr),
        );
      }

      expect(auth.keys).toHaveLength(2);
      expect(auth.keys[0]).toBe(auth.keys[1]);
      for (const key of auth.keys) expect(key.startsWith("signup:")).toBe(true);
    });

    it("login is limited per username, whatever the network", async () => {
      const app = buildApp(db, ANON);
      await call(app, "signup", {
        username: "alice1",
        password: "password123",
        confirmPassword: "password123",
      });
      const account = countingLimiter(2);
      const env = { RL_LOGIN_ACCOUNT: account.binding } as never;
      const wrong = { username: "alice1", password: "wrongpassword" };

      const results = [];
      for (const addr of ["203.0.113.1", "198.51.100.2", "192.0.2.3"]) {
        results.push((await callJson(app, "login", wrong, env, ip(addr))).json);
      }
      expect(results).toEqual([
        { error: INCORRECT },
        { error: INCORRECT },
        { error: RATE_LIMIT_ERROR },
      ]);

      const other = await callJson(
        app,
        "login",
        { username: "bobby1", password: "wrongpassword" },
        env,
        ip("203.0.113.1"),
      );
      expect(other.json).toEqual({ error: INCORRECT });
      expect(account.keys[0]).toBe("login:u:alice1");
    });

    it("login normalizes the username before keying the account limit", async () => {
      const app = buildApp(db, ANON);
      const account = recordingLimiter();
      const env = { RL_LOGIN_ACCOUNT: account.binding } as never;
      for (const username of ["  ALICE1 ", "alice1"]) {
        await call(app, "login", { username, password: "password123" }, env);
      }
      expect(account.keys).toEqual(["login:u:alice1", "login:u:alice1"]);
    });

    it("a login refused by the IP limit does not spend the account budget", async () => {
      const app = buildApp(db, ANON);
      const account = recordingLimiter();
      const { json } = await callJson(app, "login", loginBody, {
        RL_AUTH: { limit: async () => ({ success: false }) },
        RL_LOGIN_ACCOUNT: account.binding,
      } as never);
      expect(json).toEqual({ error: RATE_LIMIT_ERROR });
      expect(account.keys).toHaveLength(0);
    });
  });
});
