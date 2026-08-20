import { userTable } from "@umamin/db/schema/user";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readsApp } from "../src/api/routes";
import { __setReadDb } from "../src/api/routes/_shared";
import type { Db } from "../src/server-lib/db";
import type { AppEnv } from "../src/server-lib/env";
import { __clearFlagCache } from "../src/server-lib/flags";
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
    __clearFlagCache();
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

  // /api/flags is PRIVATE for a reason: flags are evaluated against the viewer's
  // distinct id, so a shared-cache response would hand one viewer's rollout
  // bucket to every other viewer.
  describe("feature flags read", () => {
    it("is never cached and does not vary the answer by cache", async () => {
      const res = await fetchApp("/flags");
      expect(res.headers.get("cache-control")).toBe(
        "private, no-store, max-age=0",
      );
      expect(res.headers.get("vary")).toBe("Cookie");
    });

    // Fails closed: with no PostHog token configured the Pro offer stays hidden
    // rather than defaulting to visible.
    it("resolves the Pro offer to hidden when PostHog is unconfigured", async () => {
      const res = await fetchApp("/flags");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ pro: false });
    });

    it("reflects a forced-on flag for a signed-in viewer", async () => {
      await db.insert(userTable).values({ id: "f1", username: "flag_user" });
      const token = generateSessionToken();
      await createSession(db, token, "f1");

      const res = await fetchApp(
        "/flags",
        { headers: { cookie: `session=${token}` } },
        { FLAGS_FORCE_ON: "umamin-pro" },
      );
      expect(await res.json()).toEqual({ pro: true });
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

  describe("message thread read", () => {
    beforeEach(async () => {
      process.env.AES_256_GCM_KEY = Buffer.from(new Uint8Array(32)).toString(
        "base64",
      );
      await db.insert(userTable).values([
        { id: "recv", username: "recv_user" },
        { id: "sender", username: "sender_user" },
        { id: "stranger", username: "stranger_user" },
      ]);
      const { aesEncrypt } = await import("@umamin/encryption");
      const { messageTable, messageReplyTable } = await import(
        "@umamin/db/schema/message"
      );
      await db.insert(messageTable).values({
        id: "m1",
        question: "ask me",
        content: await aesEncrypt("hello"),
        reply: await aesEncrypt("first reply"),
        receiverId: "recv",
        senderId: "sender",
      });
      await db.insert(messageReplyTable).values({
        id: "r1",
        messageId: "m1",
        fromSender: true,
        content: await aesEncrypt("follow-up"),
      });
    });

    async function asUser(userId: string) {
      const token = generateSessionToken();
      await createSession(db, token, userId);
      return fetchApp("/messages/m1/thread", {
        headers: { cookie: `session=${token}` },
      });
    }

    it("receiver gets the decrypted thread with the sender de-anonymized fields stripped", async () => {
      const res = await asUser("recv");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        message: { senderId: string | null; senderReadAt: unknown };
        replies: { content: string; fromSender: boolean }[];
        viewerRole: string;
        threadable: boolean;
      };
      expect(body.viewerRole).toBe("receiver");
      expect(body.threadable).toBe(true);
      expect(body.message.senderId).toBeNull();
      expect(body.message.senderReadAt).toBeNull();
      expect(body.replies).toEqual([
        expect.objectContaining({ content: "follow-up", fromSender: true }),
      ]);
    });

    it("sender gets the thread with the receiver-private fields stripped", async () => {
      const res = await asUser("sender");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        message: { openedAt: unknown; receiverReadAt: unknown; reply: string };
        viewerRole: string;
      };
      expect(body.viewerRole).toBe("sender");
      expect(body.message.openedAt).toBeNull();
      expect(body.message.receiverReadAt).toBeNull();
      expect(body.message.reply).toBe("first reply");
    });

    it("a non-participant gets 404, not a stripped payload", async () => {
      const res = await asUser("stranger");
      expect(res.status).toBe(404);
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
