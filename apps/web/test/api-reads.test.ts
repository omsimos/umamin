import { userTable } from "@umamin/db/schema/user";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readsApp } from "../src/api/routes";
import { __setReadDb } from "../src/api/routes/_shared";
import type { Db } from "../src/server-lib/db";
import type { AppEnv } from "../src/server-lib/env";
import {
  __clearSessionCache,
  createSession,
  generateSessionToken,
} from "../src/server-lib/session";
import { makeTestDb } from "./helpers/db";

// Node/jsdom pool: exercises the read routes against a REAL in-memory libSQL db
// (via the getDb seam), the same pattern the session suite uses. `caches.default`
// (a workerd global) is stubbed here so public reads can be covered too — the
// real Cache API behaviour lives in the worker-pool suite.

class MemCache {
  store = new Map<string, Response>();
  async match(req: Request): Promise<Response | undefined> {
    const hit = this.store.get(req.url);
    return hit ? hit.clone() : undefined;
  }
  async put(req: Request, res: Response): Promise<void> {
    this.store.set(req.url, res.clone());
  }
}

let memCache: MemCache;

const ctx = {
  waitUntil: (p: Promise<unknown>) => {
    void p;
  },
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

function fetchApp(
  path: string,
  init: RequestInit = {},
  env: Partial<AppEnv> = {},
) {
  const app = new Hono().route("/", readsApp);
  return app.fetch(
    new Request(`https://x.test${path}`, init),
    env as unknown as AppEnv,
    ctx,
  );
}

describe("read routes (real libSQL + stubbed Cache API)", () => {
  let db: Db;

  beforeEach(async () => {
    __clearSessionCache();
    memCache = new MemCache();
    (globalThis as { caches?: unknown }).caches = { default: memCache };
    db = await makeTestDb();
    __setReadDb(() => db);
  });

  afterEach(() => {
    __setReadDb(null);
  });

  describe("private read (auth required)", () => {
    it("anonymous → 401 Unauthorized", async () => {
      const res = await fetchApp("/me");
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("authenticated → 200 with the current-user shape", async () => {
      await db.insert(userTable).values({ id: "u1", username: "alice_xyz" });
      const token = generateSessionToken();
      await createSession(db, token, "u1");

      const res = await fetchApp("/me", {
        headers: { cookie: `session=${token}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { user?: { username?: string } };
      expect(body.user?.username).toBe("alice_xyz");
    });
  });

  describe("public read (Cache API)", () => {
    it("serves cache headers and the second call is served from cache", async () => {
      const first = await fetchApp("/public/notes");
      expect(first.status).toBe(200);
      expect(first.headers.get("cache-control")).toContain("s-maxage=180");
      const firstBody = await first.json();
      expect(firstBody).toHaveProperty("data");

      // The response is now in the (stubbed) Cache API.
      expect(memCache.store.size).toBe(1);

      // Break the db: a second hit that reached the handler would 500. It stays
      // 200 → proof it was served from cache, not recomputed.
      __setReadDb(() => {
        throw new Error("db must not be touched on a cache hit");
      });
      const second = await fetchApp("/public/notes");
      expect(second.status).toBe(200);
      expect(await second.json()).toEqual(firstBody);
    });
  });

  describe("404 / param validation on a dynamic route", () => {
    it("unknown public post id → 404 Not found", async () => {
      const res = await fetchApp("/public/posts/does-not-exist");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Not found" });
    });

    it("unknown public user → 404 Not found", async () => {
      const res = await fetchApp("/public/user/nobody");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Not found" });
    });
  });
});

// Hono percent-decodes route params where Next handed them raw, so the `%40`
// strip apps/www shipped no longer sees a literal "%40" — a shared @-prefixed
// profile URL would 404 without the `@` case.
describe("formatUsername", () => {
  it("strips both the encoded and decoded @ prefix", async () => {
    const { formatUsername } = await import("../src/api/routes/_shared");
    expect(formatUsername("%40josh")).toBe("josh");
    expect(formatUsername("@josh")).toBe("josh");
    expect(formatUsername("josh")).toBe("josh");
  });
});
