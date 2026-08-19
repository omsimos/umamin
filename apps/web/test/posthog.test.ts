import { beforeEach, describe, expect, it, vi } from "vitest";

const captureExceptionImmediate = vi.fn(() => Promise.resolve());
const construct = vi.fn();

// Mocked so the suite never opens a socket, and so the exact arguments the
// wrapper forwards can be asserted.
vi.mock("posthog-node", () => ({
  PostHog: class {
    captureExceptionImmediate = captureExceptionImmediate;
    constructor(token: string, options: unknown) {
      construct(token, options);
    }
  },
}));

const { captureRequestException, captureServerException } = await import(
  "@/server-lib/posthog"
);

// A production-ish env. Capture is gated on NODE_ENV because `pnpm dev:web` runs
// with CLOUDFLARE_ENV=staging and therefore inherits staging's POSTHOG_* vars —
// local crashes must not reach the project.
const PROD_ENV = {
  NODE_ENV: "production",
  POSTHOG_PROJECT_TOKEN: "phc_test",
  POSTHOG_HOST: "https://eu.i.posthog.com",
  POSTHOG_ENV: "production",
  // biome-ignore lint/suspicious/noExplicitAny: partial env stub
} as any;

function requestContext(env: unknown, waitUntil = vi.fn()) {
  return {
    env,
    req: { url: "https://www.umamin.link/api/feed?cursor=abc", method: "GET" },
    executionCtx: { waitUntil },
    // biome-ignore lint/suspicious/noExplicitAny: partial Hono context stub
  } as any;
}

beforeEach(() => {
  captureExceptionImmediate.mockClear();
  construct.mockClear();
});

describe("captureServerException", () => {
  it("sends nothing when the project token is absent", () => {
    captureServerException(
      // biome-ignore lint/suspicious/noExplicitAny: partial env stub
      { NODE_ENV: "production" } as any,
      vi.fn(),
      new Error("boom"),
    );
    expect(construct).not.toHaveBeenCalled();
  });

  it("sends nothing outside production even with a token configured", () => {
    captureServerException(
      { ...PROD_ENV, NODE_ENV: "development" },
      vi.fn(),
      new Error("boom"),
    );
    expect(construct).not.toHaveBeenCalled();
  });

  // An isolate can be torn down before a batch timer fires, so the client must
  // never queue.
  it("builds an unbatched client on the configured host", () => {
    captureServerException(PROD_ENV, vi.fn(), new Error("boom"));
    expect(construct).toHaveBeenCalledWith("phc_test", {
      host: "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  });

  it("tags the event with the deploy environment and the actor", () => {
    const waitUntil = vi.fn();
    const error = new Error("boom");
    captureServerException(PROD_ENV, waitUntil, error, {
      distinctId: "user_1",
      properties: { cron: "0 3 * * *" },
    });

    expect(captureExceptionImmediate).toHaveBeenCalledWith(error, "user_1", {
      environment: "production",
      cron: "0 3 * * *",
    });
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  // Every call site is inside a `catch`. A rejecting report would turn a handled
  // 500 into an unhandled rejection inside waitUntil.
  it("resolves the waitUntil promise even when the send fails", async () => {
    captureExceptionImmediate.mockReturnValueOnce(
      Promise.reject(new Error("ingest down")),
    );
    const waitUntil = vi.fn();
    captureServerException(PROD_ENV, waitUntil, new Error("boom"));
    await expect(waitUntil.mock.calls[0]?.[0]).resolves.toBeUndefined();
  });

  it("does not throw when the client constructor blows up", () => {
    construct.mockImplementationOnce(() => {
      throw new Error("bad token");
    });
    expect(() =>
      captureServerException(PROD_ENV, vi.fn(), new Error("boom")),
    ).not.toThrow();
  });

  it("still attempts the send when there is no ExecutionContext", () => {
    expect(() =>
      captureServerException(PROD_ENV, undefined, new Error("boom")),
    ).not.toThrow();
    expect(captureExceptionImmediate).toHaveBeenCalledTimes(1);
  });
});

describe("captureRequestException", () => {
  // The query string carries cursors and lookup ids; only the route shape is
  // useful for grouping an issue.
  it("reports the path without its query string", () => {
    captureRequestException(requestContext(PROD_ENV), new Error("boom"));
    expect(captureExceptionImmediate).toHaveBeenCalledWith(
      expect.any(Error),
      undefined,
      expect.objectContaining({
        $current_url: "https://www.umamin.link/api/feed",
        method: "GET",
      }),
    );
  });

  // Hono's `c.executionCtx` getter throws when the adapter has none, which is
  // the case under this runner and in any non-worker embedding.
  it("does not throw when executionCtx is unavailable", () => {
    const c = {
      env: PROD_ENV,
      req: { url: "https://www.umamin.link/feed", method: "GET" },
      get executionCtx(): never {
        throw new Error("no execution context");
      },
      // biome-ignore lint/suspicious/noExplicitAny: partial Hono context stub
    } as any;
    expect(() => captureRequestException(c, new Error("boom"))).not.toThrow();
    expect(captureExceptionImmediate).toHaveBeenCalledTimes(1);
  });

  it("stays silent for an unconfigured environment", () => {
    const waitUntil = vi.fn();
    captureRequestException(requestContext({}, waitUntil), new Error("x"));
    expect(construct).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });
});
