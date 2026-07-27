import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

// Regression: in production the cookie name is `__Host-session`, and
// hono/cookie throws on any __Host- write/delete without Secure. The test
// suite runs with NODE_ENV=test, so this only ever surfaced on a deployed
// Worker (logout 500). The name is fixed at module load, so stub the env and
// re-import the module graph to get the production names.
describe("session cookie in production mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("sets and deletes the __Host- cookie with Secure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { setSessionCookie, deleteSessionCookie } = await import(
      "../src/server-lib/session-cookie"
    );

    const app = new Hono()
      .get("/set", (c) => {
        setSessionCookie(c, "tok", new Date(Date.now() + 1000 * 60));
        return c.body(null, 204);
      })
      .get("/clear", (c) => {
        deleteSessionCookie(c);
        return c.body(null, 204);
      });

    const set = await app.request("/set");
    const setCookies = set.headers.get("set-cookie") ?? "";
    expect(setCookies).toContain("__Host-session=tok");
    expect(setCookies).toContain("Secure");

    const clear = await app.request("/clear");
    expect(clear.status).toBe(204);
    const clearCookies = clear.headers.get("set-cookie") ?? "";
    expect(clearCookies).toContain("__Host-session=;");
    expect(clearCookies).toContain("Secure");
  });
});
