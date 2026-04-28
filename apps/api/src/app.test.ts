import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { app as honoApp } from "./app";

type TestApp = typeof honoApp;

let app: TestApp;

async function responseJson<T>(response: Response) {
  return (await response.json()) as T;
}

beforeAll(async () => {
  process.env.TURSO_CONNECTION_URL ??= `file:${join(
    process.cwd(),
    "../../packages/db/local.db",
  )}`;
  process.env.AES_256_GCM_KEY ??=
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  process.env.WEB_ORIGIN ??= "http://localhost:3000";

  ({ app } = await import("./app"));
});

describe("Hono API app", () => {
  it("serves the Railway healthcheck", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({ ok: true });
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("returns the stable JSON envelope for missing routes", async () => {
    const response = await app.request("/missing");

    expect(response.status).toBe(404);
    expect(await responseJson(response)).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Not found",
      },
    });
  });

  it("returns a friendly 400 envelope for malformed JSON", async () => {
    const response = await app.request("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad",
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(await responseJson(response)).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid JSON body",
      },
    });
  });

  it("protects authenticated routes without touching route handlers", async () => {
    const response = await app.request("/api/me");

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(await responseJson(response)).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Unauthorized",
      },
    });
  });

  it("allows credentialed local web CORS preflight", async () => {
    const response = await app.request("/api/notes", {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "POST",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
  });

  it("rejects unsafe requests from untrusted origins before business logic", async () => {
    const response = await app.request("/api/notes", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ content: "hello", isAnonymous: false }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(await responseJson(response)).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Origin not allowed",
      },
    });
  });
});
