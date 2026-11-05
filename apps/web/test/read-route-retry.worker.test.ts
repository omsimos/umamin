import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { LibsqlError } from "@libsql/client/web";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captureRequestException = vi.hoisted(() => vi.fn());
vi.mock("../src/server-lib/posthog", () => ({ captureRequestException }));

import type { AppEnv } from "../src/server-lib/env";
import { withPrivateRead, withPublicRead } from "../src/server-lib/read-route";

// Rate limiters fail open without their bindings.
const ENV = {} as AppEnv;

const gateway502 = () =>
  new LibsqlError("Server returned HTTP status 502", "SERVER_ERROR");

type Handler = () => Promise<object>;

function appFor(handler: Handler) {
  return new Hono<{ Bindings: AppEnv }>()
    .get("/priv", withPrivateRead("priv", handler))
    .get("/pub", withPublicRead("pub", 180, handler));
}

async function get(app: Hono<{ Bindings: AppEnv }>, path: string) {
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://x.test${path}`), ENV, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

// A unique query string per case keeps the public route off earlier cache
// entries.
const pubPath = () => `/pub?case=${crypto.randomUUID()}`;

describe.each([
  ["private", () => "/priv"],
  ["public", pubPath],
])("%s read retry", (_kind, path) => {
  beforeEach(() => {
    captureRequestException.mockClear();
  });

  it("answers 200 when the retry succeeds after one gateway error", async () => {
    const handler = vi
      .fn<Handler>()
      .mockRejectedValueOnce(gateway502())
      .mockResolvedValueOnce({ ok: true });

    const res = await get(appFor(handler), path());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(2);
    expect(captureRequestException).not.toHaveBeenCalled();
  });

  it("answers 500 and reports once when the retry fails too", async () => {
    const final = gateway502();
    const handler = vi
      .fn<Handler>()
      .mockRejectedValueOnce(gateway502())
      .mockRejectedValueOnce(final);

    const res = await get(appFor(handler), path());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: expect.any(String) });
    expect(handler).toHaveBeenCalledTimes(2);
    expect(captureRequestException).toHaveBeenCalledTimes(1);
    const [, reported, context] = captureRequestException.mock.calls[0];
    expect(reported).toBe(final);
    expect(context.properties.attempts).toBe(2);
  });

  it("does not retry a non-transient error", async () => {
    const handler = vi
      .fn<Handler>()
      .mockRejectedValue(new Error("no such column: foo"));

    const res = await get(appFor(handler), path());

    expect(res.status).toBe(500);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(captureRequestException).toHaveBeenCalledTimes(1);
    expect(captureRequestException.mock.calls[0][2].properties.attempts).toBe(
      1,
    );
  });
});
