import { beforeEach, describe, expect, it, vi } from "vitest";

const checkReadRateLimit = vi.fn();
vi.mock("@/lib/ratelimit", () => ({
  checkReadRateLimit: () => checkReadRateLimit(),
  RATE_LIMIT_ERROR: "Too many requests",
}));

import type { NextRequest } from "next/server";
import { privateJson } from "@/lib/private-json";
import { INTERNAL_SERVER_ERROR } from "./errors";
import { withPrivateRead, withPublicRead } from "./read-route";

const req = {} as NextRequest;
const ctx = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  checkReadRateLimit.mockResolvedValue(true);
});

describe("withPrivateRead", () => {
  it("wraps handler data in the private JSON envelope", async () => {
    const route = withPrivateRead("fetching posts", async () => ({
      items: [1],
    }));

    const res = await route(req, ctx);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [1] });
    expect(res.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(res.headers.get("Vary")).toBe("Cookie");
  });

  it("returns 429 without calling the handler when rate limited", async () => {
    checkReadRateLimit.mockResolvedValue(false);
    const handler = vi.fn();
    const route = withPrivateRead("fetching posts", handler);

    const res = await route(req, ctx);

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Too many requests" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes a handler-built Response (e.g. 401) through unchanged", async () => {
    const route = withPrivateRead("fetching posts", async () =>
      privateJson({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await route(req, ctx);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 with the labeled log on a thrown error", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const route = withPrivateRead("fetching posts", async () => {
      throw new Error("db down");
    });

    const res = await route(req, ctx);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: INTERNAL_SERVER_ERROR });
    expect(consoleError).toHaveBeenCalledWith(
      "Error fetching posts:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});

describe("withPublicRead", () => {
  it("applies the CDN max-age to success responses", async () => {
    const route = withPublicRead("fetching public posts", 120, async () => ({
      items: [],
    }));

    const res = await route(req, ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=0, s-maxage=120, stale-while-revalidate=120",
    );
  });

  it("never CDN-caches 429/500 responses (maxAge 0)", async () => {
    checkReadRateLimit.mockResolvedValue(false);
    const limited = await withPublicRead("x", 120, async () => ({}))(req, ctx);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Cache-Control")).toContain("s-maxage=0");

    checkReadRateLimit.mockResolvedValue(true);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const failed = await withPublicRead("x", 120, async () => {
      throw new Error("boom");
    })(req, ctx);
    expect(failed.status).toBe(500);
    expect(failed.headers.get("Cache-Control")).toContain("s-maxage=0");
    consoleError.mockRestore();
  });
});
