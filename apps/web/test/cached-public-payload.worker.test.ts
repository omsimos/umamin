import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "../src/server-lib/env";
import {
  getCachedPublicPayload,
  withPrivateRead,
} from "../src/server-lib/read-route";

// caches.default is real in the workers pool. env is minimal ({}) → the read
// rate limiter fails open (missing binding), which is fine here.
//
// These pin the guards that make a PRIVATE handler safe to serve off the PUBLIC
// route's shared cache entry: the producer runs once per key, the viewer
// overlay never reaches the entry, and a missing entity is never stored (a
// cached `null` would turn the public route's 404 into a 200).
const ENV = {} as AppEnv;

let produced = 0;

const cacheStore = (caches as unknown as { default: Cache }).default;

function cachedAt(pathname: string, search = "") {
  return cacheStore.match(
    new Request(`https://x.test${pathname}${search}`, { method: "GET" }),
  );
}

const app = new Hono<{ Bindings: AppEnv }>()
  .get(
    "/feed",
    withPrivateRead("feed", async (c) => {
      const key = c.req.query("key") ?? "";
      const cursor = c.req.query("cursor") ?? null;
      const payload = await getCachedPublicPayload<{ n: number; key: string }>(
        c,
        "/public/feed",
        { key, cursor },
        180,
        60,
        async () => {
          produced += 1;
          return { n: produced, key };
        },
      );
      // Stand-in for the per-viewer overlay a real private handler applies.
      return { ...payload, viewer: "me" };
    }),
  )
  .get(
    "/missing",
    withPrivateRead("missing", async (c) => {
      const key = c.req.query("key") ?? "";
      const payload = await getCachedPublicPayload<{ n: number } | null>(
        c,
        "/public/missing",
        { key },
        180,
        60,
        async () => {
          produced += 1;
          return null;
        },
      );
      return { payload };
    }),
  );

// Same routes reachable under the /api mount prefix, which is what a real
// network request carries and what an in-process SSR loader dispatch strips.
const apiApp = new Hono().route("/api", app);

async function fetchPrivate(path: string, mounted = app as unknown as Hono) {
  const ctx = createExecutionContext();
  const res = await mounted.fetch(
    new Request(`https://x.test${path}`),
    ENV,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return res;
}

describe("getCachedPublicPayload (workers Cache API)", () => {
  it("shares one entry: the producer runs once per key", async () => {
    const key = crypto.randomUUID();
    const first = await (await fetchPrivate(`/feed?key=${key}`)).json<{
      n: number;
    }>();
    const before = produced;
    const second = await (await fetchPrivate(`/feed?key=${key}`)).json<{
      n: number;
    }>();

    expect(second.n).toBe(first.n);
    expect(produced).toBe(before); // second read never reached the producer
  });

  it("caches the PUBLIC payload only — the viewer overlay never enters the entry", async () => {
    const key = crypto.randomUUID();
    const res = await fetchPrivate(`/feed?key=${key}`);

    // The response the viewer gets carries the overlay and the private envelope.
    expect(await res.json()).toEqual({
      n: expect.any(Number),
      key,
      viewer: "me",
    });
    expect(res.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(res.headers.get("vary")).toBe("Cookie");

    const cached = await cachedAt("/public/feed", `?key=${key}`);
    expect(cached).toBeDefined();
    const body = await cached?.json<Record<string, unknown>>();
    expect(body).not.toHaveProperty("viewer");
    expect(body).toEqual({ n: expect.any(Number), key });
    expect(cached?.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=180, stale-while-revalidate=180",
    );
    expect(cached?.headers.has("set-cookie")).toBe(false);
  });

  it("canonicalizes the key: a null/empty declared param and undeclared params collapse onto one entry", async () => {
    const key = crypto.randomUUID();
    const first = await (await fetchPrivate(`/feed?key=${key}`)).json<{
      n: number;
    }>();
    const before = produced;

    // cursor present but empty → dropped from the key, same entry.
    const withEmptyCursor = await (
      await fetchPrivate(`/feed?key=${key}&cursor=`)
    ).json<{ n: number }>();
    // an undeclared param must not mint a fresh entry (and a fresh Turso read).
    const withJunk = await (
      await fetchPrivate(`/feed?key=${key}&utm_source=x`)
    ).json<{ n: number }>();

    expect(withEmptyCursor.n).toBe(first.n);
    expect(withJunk.n).toBe(first.n);
    expect(produced).toBe(before);
  });

  it("separates distinct declared values", async () => {
    const key = crypto.randomUUID();
    const a = await (await fetchPrivate(`/feed?key=${key}`)).json<{
      n: number;
    }>();
    const b = await (await fetchPrivate(`/feed?key=${key}&cursor=page2`)).json<{
      n: number;
    }>();

    expect(b.n).toBeGreaterThan(a.n);
    expect(
      await cachedAt("/public/feed", `?cursor=page2&key=${key}`),
    ).toBeDefined();
  });

  it("mirrors the caller's /api mount prefix so both dispatch modes key alike", async () => {
    const key = crypto.randomUUID();
    await fetchPrivate(`/api/feed?key=${key}`, apiApp);

    expect(await cachedAt("/api/public/feed", `?key=${key}`)).toBeDefined();
    // The prefix-less form is a DIFFERENT entry — it must not have been filled.
    expect(await cachedAt("/public/feed", `?key=${key}`)).toBeUndefined();
  });

  // A cached `null` under the public key would answer the public route's 404
  // with a 200 body of `null`.
  it("never stores a null payload (the public route's 404 stays uncached)", async () => {
    const key = crypto.randomUUID();
    const before = produced;
    expect(await (await fetchPrivate(`/missing?key=${key}`)).json()).toEqual({
      payload: null,
    });

    expect(await cachedAt("/public/missing", `?key=${key}`)).toBeUndefined();

    await fetchPrivate(`/missing?key=${key}`);
    expect(produced).toBe(before + 2); // recomputed — nothing was stored
  });

  it("degrades to an uncached read when the Cache API throws", async () => {
    const real = (globalThis as { caches: unknown }).caches;
    let installed = false;
    try {
      Object.defineProperty(globalThis, "caches", {
        configurable: true,
        value: {
          default: {
            match: () => Promise.reject(new Error("cache down")),
            put: () => Promise.reject(new Error("cache down")),
          },
        },
      });
      installed = true;
    } catch {
      // Not stubbable in this pool — the guard would go uncovered.
    }
    expect(installed).toBe(true);

    try {
      const key = crypto.randomUUID();
      const res = await fetchPrivate(`/feed?key=${key}`);
      expect(res.status).toBe(200); // a Cache API failure is not a 500
      expect(await res.json()).toEqual({
        n: expect.any(Number),
        key,
        viewer: "me",
      });
    } finally {
      Object.defineProperty(globalThis, "caches", {
        configurable: true,
        value: real,
      });
    }
  });
});
