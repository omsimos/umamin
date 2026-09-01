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

import { userTable } from "@umamin/db/schema/user";
import { hash } from "../src/server-lib/argon2";
import type { Db } from "../src/server-lib/db";
import { accountSuspendedMessage } from "../src/server-lib/errors";
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
    // A taken username is an expected outcome, not something to triage.
    expect(captureRequestException).not.toHaveBeenCalled();
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
});
