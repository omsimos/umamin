import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import type { SelectUser } from "@umamin/db/schema/user";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import * as z from "zod";
import { action } from "../src/server-lib/action";
import type { AppBindings } from "../src/server-lib/context";
import type { AppEnv } from "../src/server-lib/env";
import type { ResolvedSession } from "../src/server-lib/session";

const AUTHED: ResolvedSession = {
  session: { id: "s1", userId: "u1", expiresAt: Date.now() + 1e9 },
  // Only the fields the tests read matter here.
  user: { id: "u1", username: "alice" } as unknown as SelectUser,
  source: "cookie",
};
const ANON: ResolvedSession = { session: null, user: null, source: null };

function fakeLimiter(limit: number): RateLimit {
  let n = 0;
  return {
    limit: vi.fn(async () => ({ success: ++n <= limit })),
  } as unknown as RateLimit;
}

function buildApp(getSession: () => Promise<ResolvedSession>) {
  return new Hono<AppBindings>()
    .use("*", async (c, next) => {
      c.set("getSession", getSession);
      await next();
    })
    .post(
      "/echo",
      action(
        { schema: z.object({ name: z.string().min(1) }), auth: "session" },
        async (input) => ({ hello: input.name }),
      ),
    )
    .post(
      "/user-only",
      action({ auth: "user", authError: "nope" }, async (_i, { user }) => ({
        me: user.username,
      })),
    )
    .post(
      "/open",
      action(
        {
          auth: "none",
          rateLimit: { name: "message", key: () => "anon" },
        },
        async () => ({ ok: true }),
      ),
    )
    .post(
      "/dupe",
      action(
        {
          onError: (e) =>
            e instanceof Error && e.message === "dupe"
              ? { error: "Username already exists" }
              : undefined,
          errorMessage: "boom",
        },
        async () => {
          throw new Error("dupe");
        },
      ),
    );
}

const SAME_ORIGIN = { origin: "https://x.test", host: "x.test" };

async function call(
  app: Hono<AppBindings>,
  path: string,
  init: RequestInit,
  env: Partial<Record<keyof Env, RateLimit>> = {},
) {
  const ctx = createExecutionContext();
  const res = await app.fetch(
    new Request(`https://x.test${path}`, init),
    env as unknown as AppEnv,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return res;
}

function postJson(body: unknown, extraHeaders: Record<string, string> = {}) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...SAME_ORIGIN,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  } satisfies RequestInit;
}

describe("action() factory (Hono)", () => {
  it("happy path: parses body, runs handler, returns the result envelope", async () => {
    const res = await call(
      buildApp(async () => AUTHED),
      "/echo",
      postJson({ name: "bob" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hello: "bob" });
  });

  it("schema failure → 400 { error }", async () => {
    const res = await call(
      buildApp(async () => AUTHED),
      "/echo",
      postJson({ name: "" }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid input" });
  });

  it("auth failure → 401 with the configured authError", async () => {
    const res = await call(
      buildApp(async () => ANON),
      "/user-only",
      postJson({}),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "nope" });
  });

  it("rate-limit denial → 429 (auth:none limits before session lookup)", async () => {
    const getSession = vi.fn(async () => ANON);
    const res = await call(buildApp(getSession), "/open", postJson({}), {
      RL_MESSAGE: fakeLimiter(0),
    });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: "Too many requests. Please try again in a minute.",
    });
    // Session lookup must NOT have run before the anonymous rate limit denied.
    expect(getSession).not.toHaveBeenCalled();
  });

  it("onError maps a known error; unknown falls back to errorMessage", async () => {
    const res = await call(
      buildApp(async () => AUTHED),
      "/dupe",
      postJson({}),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Username already exists" });
  });

  it("rejects a cross-origin cookie mutation (CSRF) with 403", async () => {
    const res = await call(
      buildApp(async () => AUTHED),
      "/echo",
      postJson({ name: "bob" }, { origin: "https://evil.test" }),
    );
    expect(res.status).toBe(403);
  });

  it("bearer-authed request bypasses the CSRF origin check", async () => {
    // No Origin header at all + a bearer token → must NOT 403.
    const res = await call(
      buildApp(async () => AUTHED),
      "/echo",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "x.test",
          authorization: "Bearer sometoken",
        },
        body: JSON.stringify({ name: "carol" }),
      },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hello: "carol" });
  });
});
