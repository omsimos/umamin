import { env } from "cloudflare:test";
import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppEnv } from "../src/server-lib/env";
import { __clearDenylistCache, denyIp } from "../src/server-lib/ip-denylist";
import {
  cookieRenewal,
  csrfOriginCheck,
  ipDenylist,
  securityHeadersMiddleware,
} from "../src/server-lib/middleware";

const kv = (env as { KV: KVNamespace }).KV;
const OK = "ok";

type App = Hono<{ Bindings: AppEnv }>;

function appWith(mw: MiddlewareHandler): App {
  return new Hono<{ Bindings: AppEnv }>()
    .use("*", mw)
    .all("*", (c) => c.text(OK));
}

async function fetch(app: App, path: string, init?: RequestInit) {
  return app.fetch(
    new Request(`https://x.test${path}`, init),
    env as unknown as AppEnv,
  );
}

describe("middleware", () => {
  describe("ipDenylist", () => {
    beforeEach(async () => {
      __clearDenylistCache();
      await kv.delete("ip:denylist");
    });

    it("403s a denied IP (via CF-Connecting-IP)", async () => {
      await denyIp(kv, "198.51.100.7");
      __clearDenylistCache();
      const res = await fetch(appWith(ipDenylist()), "/feed", {
        headers: { "cf-connecting-ip": "198.51.100.7" },
      });
      expect(res.status).toBe(403);
    });

    it("passes a non-denied IP", async () => {
      const res = await fetch(appWith(ipDenylist()), "/feed", {
        headers: { "cf-connecting-ip": "198.51.100.8" },
      });
      expect(await res.text()).toBe(OK);
    });

    it("skips static asset paths", async () => {
      await denyIp(kv, "198.51.100.7");
      __clearDenylistCache();
      const res = await fetch(appWith(ipDenylist()), "/icon.png", {
        headers: { "cf-connecting-ip": "198.51.100.7" },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("csrfOriginCheck", () => {
    const app = appWith(csrfOriginCheck());

    it("403s a cookie-authed cross-origin mutation", async () => {
      const res = await fetch(app, "/x", {
        method: "POST",
        headers: {
          cookie: "session=tok",
          origin: "https://evil.test",
          host: "x.test",
        },
      });
      expect(res.status).toBe(403);
    });

    it("allows a same-origin cookie mutation", async () => {
      const res = await fetch(app, "/x", {
        method: "POST",
        headers: {
          cookie: "session=tok",
          origin: "https://x.test",
          host: "x.test",
        },
      });
      expect(await res.text()).toBe(OK);
    });

    it("allows a bearer mutation with no Origin (mobile)", async () => {
      const res = await fetch(app, "/x", {
        method: "POST",
        headers: {
          cookie: "session=tok",
          authorization: "Bearer t",
          host: "x.test",
        },
      });
      expect(await res.text()).toBe(OK);
    });

    it("ignores GET and anonymous (no session cookie) requests", async () => {
      expect((await fetch(app, "/x")).status).toBe(200);
      const anon = await fetch(app, "/x", {
        method: "POST",
        headers: { origin: "https://evil.test", host: "x.test" },
      });
      expect(anon.status).toBe(200);
    });
  });

  describe("securityHeadersMiddleware", () => {
    it("attaches the ported CSP + security headers", async () => {
      const res = await fetch(appWith(securityHeadersMiddleware()), "/feed");
      const csp = res.headers.get("content-security-policy-report-only") ?? "";
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("https://w.soundcloud.com");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("referrer-policy")).toBe(
        "strict-origin-when-cross-origin",
      );
    });
  });

  describe("cookieRenewal", () => {
    const app = appWith(cookieRenewal());

    it("re-slides the session cookie on a GET page route when no marker exists", async () => {
      const res = await fetch(app, "/feed", {
        headers: { cookie: "session=tok" },
      });
      const setCookie = res.headers.get("set-cookie") ?? "";
      expect(setCookie).toContain("session=tok");
      expect(setCookie).toContain("session_r=");
    });

    it("skips /api/* routes", async () => {
      const res = await fetch(app, "/api/whatever", {
        headers: { cookie: "session=tok" },
      });
      expect(res.headers.get("set-cookie")).toBeNull();
    });

    it("does not renew again within the interval (recent marker)", async () => {
      const res = await fetch(app, "/feed", {
        headers: { cookie: `session=tok; session_r=${Date.now()}` },
      });
      expect(res.headers.get("set-cookie")).toBeNull();
    });

    it("does nothing without a session cookie", async () => {
      const res = await fetch(app, "/feed");
      expect(res.headers.get("set-cookie")).toBeNull();
    });
  });
});
