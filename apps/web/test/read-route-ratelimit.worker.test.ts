import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { describe, expect, it, vi } from "vitest";
import type { AppBindings } from "../src/server-lib/context";
import { SESSION_COOKIE_NAME } from "../src/server-lib/cookies";
import type { AppEnv } from "../src/server-lib/env";
import { withPrivateRead } from "../src/server-lib/read-route";
import type { ResolvedSession } from "../src/server-lib/session";

// Miniflare doesn't simulate the Rate Limiting binding, so a counting stub
// stands in for each RL_* binding.
function fakeLimiter(limit: number) {
  const counts = new Map<string, number>();
  return {
    limit: vi.fn(async ({ key }: { key: string }) => {
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return { success: n <= limit };
    }),
  };
}

// Cookie value "user-<id>" is a valid session for <id>; anything else is an
// invalid token.
function buildApp() {
  const lookups = vi.fn();
  const app = new Hono<AppBindings>()
    .use("*", async (c, next) => {
      c.set("getSession", async () => {
        lookups();
        const token = getCookie(c, SESSION_COOKIE_NAME);
        const userId = token?.startsWith("user-") ? token.slice(5) : null;
        return (
          userId
            ? { session: { userId }, user: { id: userId }, source: "cookie" }
            : { session: null, user: null, source: null }
        ) as ResolvedSession;
      });
      await next();
    })
    .get(
      "/priv",
      withPrivateRead("priv", async () => ({ ok: true })),
    );
  return { app, lookups };
}

const SHARED_IP = "112.203.196.225";

function envWith(read: number, shared: number) {
  const RL_READ = fakeLimiter(read);
  const RL_READ_SHARED = fakeLimiter(shared);
  return {
    env: { RL_READ, RL_READ_SHARED } as unknown as AppEnv,
    RL_READ,
    RL_READ_SHARED,
  };
}

async function get(
  app: Hono<AppBindings>,
  env: AppEnv,
  cookie?: string,
): Promise<Response> {
  const headers = new Headers({ "cf-connecting-ip": SHARED_IP });
  if (cookie) headers.set("cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  const ctx = createExecutionContext();
  const res = await app.fetch(
    new Request("https://x.test/priv", { headers }),
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return res;
}

describe("withPrivateRead rate limiting", () => {
  it("gives each signed-in user on a shared IP their own budget", async () => {
    const { app } = buildApp();
    const { env } = envWith(1, 600);
    expect((await get(app, env, "user-a")).status).toBe(200);
    expect((await get(app, env, "user-b")).status).toBe(200);
    expect((await get(app, env, "user-a")).status).toBe(429);
  });

  it("still shares one budget across anonymous readers on an IP", async () => {
    const { app, lookups } = buildApp();
    const { env, RL_READ_SHARED } = envWith(1, 600);
    expect((await get(app, env)).status).toBe(200);
    expect((await get(app, env)).status).toBe(429);
    expect(lookups).not.toHaveBeenCalled();
    expect(RL_READ_SHARED.limit).not.toHaveBeenCalled();
  });

  it("limits an invalid token per IP, like an anonymous reader", async () => {
    const { app } = buildApp();
    const { env, RL_READ } = envWith(1, 600);
    expect((await get(app, env, "forged-1")).status).toBe(200);
    expect((await get(app, env, "forged-2")).status).toBe(429);
    expect(RL_READ.limit).toHaveBeenLastCalledWith({
      key: `read:${SHARED_IP}`,
    });
  });

  it("applies the shared IP ceiling before the session lookup", async () => {
    const { app, lookups } = buildApp();
    const { env } = envWith(100, 1);
    expect((await get(app, env, "user-a")).status).toBe(200);
    expect((await get(app, env, "forged")).status).toBe(429);
    expect(lookups).toHaveBeenCalledTimes(1);
  });
});
