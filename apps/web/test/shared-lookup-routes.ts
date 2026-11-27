// Test-only routes for shared-lookups.worker.test.ts. Each pair starts a
// lookup in one request and joins the same key from a second request, so the
// test can end the first request while its I/O is still pending. A timer
// stands in for the Turso, KV or PostHog round trip: workerd ties both to the
// request that started them and drops them when that request ends.
import { Hono } from "hono";
import { FLAG_CONTENT_MODERATION } from "../src/lib/flags";
import type { Db } from "../src/server-lib/db";
import type { AppEnv } from "../src/server-lib/env";
import { __clearFlagCache, isFlagEnabled } from "../src/server-lib/flags";
import {
  __clearDenylistCache,
  isIpDenied,
} from "../src/server-lib/ip-denylist";
import {
  __clearSessionCache,
  validateSessionToken,
} from "../src/server-lib/session";

const DELAY_MS = 200;
const later = <T>(value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), DELAY_MS));

const slowKv = {
  get: () => later(null),
  list: () => later({ keys: [], list_complete: true }),
} as unknown as KVNamespace;

// Resolves the session lookup's select chain to no row after the delay.
const slowDb = {
  select: () => ({
    from: () => ({
      leftJoin: () => ({ where: () => ({ limit: () => later([]) }) }),
    }),
  }),
} as unknown as Db;

const lookups: Record<string, (env: AppEnv) => Promise<unknown>> = {
  denylist: () => isIpDenied(slowKv, "203.0.113.9"),
  session: () => validateSessionToken(slowDb, "shared-token"),
  flags: (env) =>
    isFlagEnabled(
      {
        ...env,
        KV: slowKv,
        POSTHOG_PROJECT_TOKEN: "phc_test" as AppEnv["POSTHOG_PROJECT_TOKEN"],
      },
      null,
      FLAG_CONTENT_MODERATION,
    ),
};

export const sharedLookupRoutes = new Hono<{ Bindings: AppEnv }>()
  .post("/reset", (c) => {
    __clearDenylistCache();
    __clearSessionCache();
    __clearFlagCache();
    return c.body(null, 204);
  })
  .get("/:name/start", (c) => {
    const lookup = lookups[c.req.param("name")];
    if (!lookup) return c.notFound();
    // Not awaited and not handed to waitUntil: the response ends the request
    // while the lookup is still in flight, like a client that disconnected.
    lookup(c.env).catch(() => {});
    return c.body(null, 204);
  })
  .get("/:name/join", async (c) => {
    const lookup = lookups[c.req.param("name")];
    if (!lookup) return c.notFound();
    return c.json({ result: await lookup(c.env) });
  });
