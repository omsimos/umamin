import { Hono } from "hono";
import { actionsApp } from "../../src/api/actions";
import type { AppBindings } from "../../src/server-lib/context";
import type { Db } from "../../src/server-lib/db";
import type { AppEnv } from "../../src/server-lib/env";
import type { ResolvedSession } from "../../src/server-lib/session";

// Integration harness: mounts the REAL actionsApp behind a middleware that
// injects the in-memory-libSQL `db` (the context.ts seam) and a stub
// `getSession` — the same seams the Phase 1 tests use — so every action runs its
// true SQL against real migrations via `app.request(...)`.

export const ANON: ResolvedSession = {
  session: null,
  user: null,
  source: null,
};

export function authed(
  userId: string,
  user: Record<string, unknown> = {},
): ResolvedSession {
  return {
    session: { id: `sess-${userId}`, userId, expiresAt: Date.now() + 1e9 },
    // Cast: only the fields each action reads matter for these tests.
    user: { id: userId, username: `u_${userId}`, ...user } as never,
    source: "cookie",
  };
}

export function buildApp(db: Db, session: ResolvedSession) {
  return new Hono<AppBindings>()
    .use("*", async (c, next) => {
      c.set("db", () => db);
      c.set("getSession", async () => session);
      await next();
    })
    .route("/", actionsApp);
}

const SAME_ORIGIN = { origin: "https://x.test", host: "x.test" };
const FAKE_CTX = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

export function call(
  app: Hono<AppBindings>,
  name: string,
  body?: unknown,
  env: Partial<AppEnv> = {},
  extraHeaders: Record<string, string> = {},
) {
  return app.request(
    `/actions/${name}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...SAME_ORIGIN,
        ...extraHeaders,
      },
      body: JSON.stringify(body ?? {}),
    },
    env as unknown as AppEnv,
    FAKE_CTX,
  );
}

export async function callJson<T = unknown>(
  app: Hono<AppBindings>,
  name: string,
  body?: unknown,
  env: Partial<AppEnv> = {},
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; json: T }> {
  const res = await call(app, name, body, env, extraHeaders);
  return { status: res.status, json: (await res.json()) as T };
}
