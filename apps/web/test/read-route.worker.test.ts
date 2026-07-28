import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../src/server-lib/env";
import { withPrivateRead, withPublicRead } from "../src/server-lib/read-route";

// caches.default is real in the workers pool. env is minimal ({}) → the read
// rate limiter fails open (missing binding), which is fine here.
const ENV = {} as AppEnv;

let publicHits = 0;
let privateHits = 0;

const app = new Hono<{ Bindings: AppEnv }>()
  .get(
    "/pub",
    withPublicRead("pub", 180, async () => {
      publicHits += 1;
      return { n: publicHits };
    }),
  )
  .get(
    "/pub-cookie",
    withPublicRead("pub-cookie", 180, async () => {
      publicHits += 1;
      // A full Response carrying Set-Cookie must NEVER be cached.
      return new Response(JSON.stringify({ n: publicHits }), {
        headers: { "Set-Cookie": "x=1", "Content-Type": "application/json" },
      });
    }),
  )
  .get(
    "/priv",
    withPrivateRead("priv", async () => {
      privateHits += 1;
      return { n: privateHits };
    }),
  )
  .get(
    "/priv-401",
    withPrivateRead("priv-401", async () =>
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    ),
  )
  .get(
    "/pub-404",
    withPublicRead("pub-404", 180, async () =>
      Response.json({ error: "Not found" }, { status: 404 }),
    ),
  );

async function fetch(path: string) {
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://x.test${path}`), ENV, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe("read-route (workers Cache API)", () => {
  it("public: caches on the full-URL key (miss then hit)", async () => {
    const url = `/pub?case=hit-${crypto.randomUUID()}`;
    const first = await fetch(url);
    const firstBody = await first.json<{ n: number }>();
    const second = await fetch(url);
    const secondBody = await second.json<{ n: number }>();
    expect(secondBody.n).toBe(firstBody.n); // served from cache, handler not re-run
  });

  it("public: emits public s-maxage cache-control", async () => {
    const res = await fetch(`/pub?case=cc-${crypto.randomUUID()}`);
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=180, stale-while-revalidate=180",
    );
  });

  it("public: NEVER caches a response carrying Set-Cookie (R5 leak guard)", async () => {
    const url = `/pub-cookie?case=${crypto.randomUUID()}`;
    const a = await fetch(url);
    const an = (await a.json<{ n: number }>()).n;
    const b = await fetch(url);
    const bn = (await b.json<{ n: number }>()).n;
    expect(bn).toBeGreaterThan(an); // recomputed each time — not cached
  });

  it("private: no-store + Vary: Cookie, never cached", async () => {
    const url = `/priv?case=${crypto.randomUUID()}`;
    const res = await fetch(url);
    expect(res.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(res.headers.get("vary")).toBe("Cookie");

    const a = (await res.json<{ n: number }>()).n;
    const b = (await (await fetch(url)).json<{ n: number }>()).n;
    expect(b).toBeGreaterThan(a); // recomputed — private reads never hit cache
  });

  // apps/www returned every early exit through privateJson/publicJson. A bare
  // `Response.json(...)` from a handler used to escape with NO Cache-Control,
  // leaving a 401 heuristically cacheable by browsers and shared caches.
  it("private: stamps the no-store envelope on a handler-built 401", async () => {
    const res = await fetch(`/priv-401?case=${crypto.randomUUID()}`);
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(res.headers.get("vary")).toBe("Cookie");
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("public: pins a handler-built 404 uncacheable and never stores it", async () => {
    const url = `/pub-404?case=${crypto.randomUUID()}`;
    const res = await fetch(url);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=0, stale-while-revalidate=0",
    );
    // Still a 404 on the second call — a non-200 must not enter the cache.
    expect((await fetch(url)).status).toBe(404);
  });

  it("private: rate-limit and error envelopes are shaped correctly", async () => {
    const failing = new Hono<{ Bindings: AppEnv }>().get(
      "/boom",
      withPrivateRead("boom", async () => {
        throw new Error("nope");
      }),
    );
    const ctx = createExecutionContext();
    const res = await failing.fetch(
      new Request("https://x.test/boom"),
      ENV,
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});
