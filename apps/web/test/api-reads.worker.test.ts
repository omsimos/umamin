import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { readsApp } from "../src/api/routes";
import type { AppEnv } from "../src/server-lib/env";

// Workers pool (workerd/miniflare): exercises the REAL `caches.default` Cache API
// and confirms every ported path is routed. In-memory libSQL can't run under
// workerd, so db-backed handlers fault and the read scaffolds catch → non-404;
// the deterministic assertions ride the db-free surfaces (chat head with chat
// disabled, anonymous auth rejections). Real-db shape coverage is in the
// node-pool suite (api-reads.test.ts).

const appEnv = env as unknown as AppEnv;

function makeApp() {
  return new Hono().route("/", readsApp);
}

async function call(path: string, init: RequestInit = {}) {
  const ctx = createExecutionContext();
  const res = await makeApp().fetch(
    new Request(`https://x.test${path}`, init),
    appEnv,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return res;
}

describe("group chat head (public, Cache API)", () => {
  it("returns the { tail, rxn } shape with cache headers", async () => {
    const res = await call("/groups/ABCD/chat/head?id=g1");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=8");
    // Chat is disabled → both markers null (Redis head keys are gone).
    expect(await res.json()).toEqual({ tail: null, rxn: null });
  });

  it("is stored in caches.default (second poll is served from the edge cache)", async () => {
    const url = "https://x.test/groups/ABCD/chat/head?id=cachehit";
    const ctx = createExecutionContext();
    await makeApp().fetch(new Request(url), appEnv, ctx);
    await waitOnExecutionContext(ctx);

    const cache = (caches as unknown as { default: Cache }).default;
    const cached = await cache.match(new Request(url, { method: "GET" }));
    expect(cached).not.toBeUndefined();
    expect(await cached?.json()).toEqual({ tail: null, rxn: null });
  });
});

// Parity safety net: the full set of ported paths must be ROUTED (not a Hono
// 404). db-backed handlers 500 here (no libSQL under workerd) — still not 404 —
// so this asserts the URL surface, exactly what the frontend + parity diff pin.
const EXPECTED_PATHS = [
  "/posts",
  "/posts/abc",
  "/posts/abc/comments",
  "/notes",
  "/notes/current",
  "/me",
  "/messages",
  "/blocked-users",
  "/notifications",
  "/notifications/badge",
  "/user/alice/followers",
  "/user/alice/following",
  "/user/alice/viewer",
  "/groups",
  "/groups/unread",
  "/groups/ABCD",
  "/groups/ABCD/viewer",
  "/groups/ABCD/members",
  "/groups/ABCD/requests",
  "/groups/ABCD/chat",
  "/groups/ABCD/chat/head?id=g1",
  "/groups/ABCD/chat/reactions",
  "/groups/ABCD/chat/reactions/m1",
  "/public/posts",
  "/public/posts/abc",
  "/public/posts/abc/comments",
  "/public/notes",
  "/public/user/alice",
  "/public/user/alice/posts",
];

describe("route inventory (parity net)", () => {
  it("covers all 29 ported GET routes", () => {
    expect(EXPECTED_PATHS).toHaveLength(29);
  });

  it.each(EXPECTED_PATHS)("%s is routed (not 404)", async (path) => {
    const res = await call(path);
    expect(res.status).not.toBe(404);
  });
});
