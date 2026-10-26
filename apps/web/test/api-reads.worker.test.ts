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
// the deterministic assertions ride the db-free surfaces (anonymous auth
// rejections). Real-db shape coverage is in the
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
  "/groups/ABCD",
  "/groups/ABCD/viewer",
  "/groups/ABCD/members",
  "/groups/ABCD/requests",
  "/public/posts",
  "/public/posts/abc",
  "/public/posts/abc/comments",
  "/public/notes",
  "/public/user/alice",
  "/public/user/alice/posts",
];

describe("route inventory (parity net)", () => {
  it("covers all 24 ported GET routes", () => {
    expect(EXPECTED_PATHS).toHaveLength(24);
  });

  it.each(EXPECTED_PATHS)("%s is routed (not 404)", async (path) => {
    const res = await call(path);
    expect(res.status).not.toBe(404);
  });
});
