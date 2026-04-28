import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { ApiError, errorJson, privateNoStore, publicCache } from "./http";

describe("HTTP response helpers", () => {
  it("sets CDN-friendly cache headers for public reads", async () => {
    const app = new Hono();
    app.get("/public", (c) => {
      publicCache(c, 120);
      return c.json({ ok: true });
    });

    const response = await app.request("/public");

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=120, stale-while-revalidate=120",
    );
  });

  it("sets private no-store headers for authenticated responses", async () => {
    const app = new Hono();
    app.get("/private", (c) => {
      privateNoStore(c);
      return c.json({ ok: true });
    });

    const response = await app.request("/private");

    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("vary")).toBe("Cookie");
  });

  it("serializes API errors with stable code and message fields", async () => {
    const app = new Hono();
    app.get("/error", (c) =>
      errorJson(c, new ApiError(409, "BAD_REQUEST", "Conflict")),
    );

    const response = await app.request("/error");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Conflict",
      },
    });
  });
});
