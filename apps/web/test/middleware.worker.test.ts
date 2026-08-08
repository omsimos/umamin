import { env } from "cloudflare:test";
import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppEnv } from "../src/server-lib/env";
import { ACCESS_BLOCKED_ERROR } from "../src/server-lib/errors";
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
      // Entries live one-per-key now; the legacy array key is still read.
      await kv.delete("ip:denylist");
      const { keys } = await kv.list({ prefix: "ip:denylist:" });
      await Promise.all(keys.map((key) => kv.delete(key.name)));
    });

    it("403s a denied IP (via CF-Connecting-IP)", async () => {
      await denyIp(kv, "198.51.100.7");
      __clearDenylistCache();
      const res = await fetch(appWith(ipDenylist()), "/feed", {
        headers: { "cf-connecting-ip": "198.51.100.7" },
      });
      expect(res.status).toBe(403);
    });

    // Two blocks in a row used to be a get→mutate→put on one JSON array, so the
    // second write could clobber the first and silently unblock it.
    it("keeps every entry when IPs are denied back to back", async () => {
      await denyIp(kv, "198.51.100.1");
      await denyIp(kv, "198.51.100.2");
      await denyIp(kv, "198.51.100.3");
      __clearDenylistCache();

      for (const ip of ["198.51.100.1", "198.51.100.2", "198.51.100.3"]) {
        const res = await fetch(appWith(ipDenylist()), "/feed", {
          headers: { "cf-connecting-ip": ip },
        });
        expect(res.status, `${ip} should still be denied`).toBe(403);
      }
    });

    it("answers /api in the JSON envelope so the block message survives", async () => {
      await denyIp(kv, "198.51.100.9");
      __clearDenylistCache();
      const res = await fetch(appWith(ipDenylist()), "/api/me", {
        headers: { "cf-connecting-ip": "198.51.100.9" },
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: ACCESS_BLOCKED_ERROR });
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

    it("ignores GET requests", async () => {
      expect((await fetch(app, "/x")).status).toBe(200);
    });

    // Mirrors apps/www proxy.ts: EVERY non-GET must pass Origin-vs-Host, even
    // anonymous ones — so a future anonymous page POST can't slip in unguarded.
    it("rejects an anonymous cross-origin mutation", async () => {
      const anon = await fetch(app, "/x", {
        method: "POST",
        headers: { origin: "https://evil.test", host: "x.test" },
      });
      expect(anon.status).toBe(403);
    });

    it("allows an anonymous same-origin mutation", async () => {
      const anon = await fetch(app, "/x", {
        method: "POST",
        headers: { origin: "https://x.test", host: "x.test" },
      });
      expect(await anon.text()).toBe(OK);
    });

    // Payment webhooks (api/webhooks.ts) are server-to-server POSTs that never
    // carry an Origin; they authenticate by HMAC signature instead. Without
    // this exemption every Lemon Squeezy delivery would 403 at the front door.
    it("exempts /api/webhooks/* so signature-authed POSTs get through", async () => {
      const res = await fetch(app, "/api/webhooks/lemonsqueezy", {
        method: "POST",
        headers: { host: "x.test" },
      });
      expect(await res.text()).toBe(OK);
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

    // Only the production environment sets SEO_INDEXABLE=true; every other
    // deployment (staging on next.umamin.link, local) must opt out of indexing.
    it("noindexes any environment that isn't flagged indexable", async () => {
      const res = await fetch(appWith(securityHeadersMiddleware()), "/feed");
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    });

    // Next served every dynamic page as `private, no-store, max-age=0`; a
    // Worker sends no Cache-Control at all, which leaves authenticated HTML
    // (and any appended Set-Cookie) heuristically cacheable.
    it("pins SSR HTML to no-store", async () => {
      const html = new Hono<{ Bindings: AppEnv }>()
        .use("*", securityHeadersMiddleware())
        .get("*", (c) => c.html("<p>hi</p>"));
      const res = await fetch(html, "/feed");
      expect(res.headers.get("cache-control")).toBe(
        "private, no-store, max-age=0",
      );
    });

    it("leaves an API route's own cache envelope alone", async () => {
      const api = new Hono<{ Bindings: AppEnv }>()
        .use("*", securityHeadersMiddleware())
        .get("*", (c) => {
          c.header("Cache-Control", "public, max-age=0, s-maxage=180");
          return c.json({ ok: true });
        });
      const res = await fetch(api, "/api/public/notes");
      expect(res.headers.get("cache-control")).toBe(
        "public, max-age=0, s-maxage=180",
      );
    });

    it("omits X-Robots-Tag when SEO_INDEXABLE is true", async () => {
      const app = appWith(securityHeadersMiddleware());
      const res = await app.fetch(new Request("https://x.test/feed"), {
        ...(env as object),
        SEO_INDEXABLE: "true",
      } as unknown as AppEnv);
      expect(res.headers.get("x-robots-tag")).toBeNull();
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

    // The Google OAuth callback is a GET that mints a session. Appending a
    // renewal for the request's OLD token would win (last Set-Cookie for a name
    // wins) and silently undo the fresh login.
    it("skips renewal when the route already minted a session cookie", async () => {
      const minting = new Hono<{ Bindings: AppEnv }>()
        .use("*", cookieRenewal())
        .get("/auth/google/callback", (c) => {
          c.header("set-cookie", "session=fresh; Path=/; HttpOnly", {
            append: true,
          });
          return c.redirect("/inbox", 302);
        });

      const res = await fetch(minting, "/auth/google/callback", {
        headers: { cookie: "session=stale" },
      });

      const cookies = res.headers.getSetCookie();
      expect(cookies).toHaveLength(1);
      expect(cookies[0]).toContain("session=fresh");
    });
  });
});
