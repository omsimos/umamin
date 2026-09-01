import { PostHog } from "posthog-node";
import type { AppEnv } from "./env";
import { formatErrorChain } from "./errors";
import { captureServerException } from "./posthog";

// PostHog feature flags, evaluated in the Worker.
//
// Server-side on purpose. posthog-js is a lazily-imported, PROD-only chunk here
// (see lib/posthog.ts), so a browser evaluation would arrive after first paint —
// which for a gate that HIDES a surface means flashing it first. The Worker
// resolves the flag and the browser reads the answer from our own /api/flags.
// The PostHog flag is set to `evaluation_runtime: server` to match.
//
// `evaluateFlags` rather than the deprecated `isFeatureEnabled`: it scopes the
// /flags request to the keys we ask for, and `isEnabled()` only reads the
// returned snapshot — no `$feature_flag_called` event per evaluation, which this
// error-tracking-only project does not want to pay for.

// Long relative to a page load, short relative to a launch decision: flipping
// the flag in PostHog takes effect within a minute on every warm isolate.
const CACHE_TTL_MS = 60_000;
// An isolate can live for hours and this is keyed per distinct id, so cap it.
const CACHE_MAX_ENTRIES = 500;

// Anonymous visitors share one bucket. They can see the offer but cannot buy
// (the checkout action is auth:"user"), so per-visitor bucketing would only
// make a partial rollout look inconsistent between page loads.
const ANONYMOUS_DISTINCT_ID = "anonymous";

type Entry = { flags: Record<string, boolean>; cachedAt: number };

const cache = new Map<string, Entry>();
// Concurrent resolvers for one distinct id share a single /flags request — the
// same collapsing validateSessionToken does for parallel loaders.
const inflight = new Map<string, Promise<Record<string, boolean>>>();

function prune(now: number): void {
  for (const [id, entry] of cache) {
    if (now - entry.cachedAt >= CACHE_TTL_MS) cache.delete(id);
  }
  if (cache.size < CACHE_MAX_ENTRIES) return;
  const excess = cache.size - CACHE_MAX_ENTRIES + 1;
  let dropped = 0;
  for (const id of cache.keys()) {
    if (dropped >= excess) break;
    cache.delete(id);
    dropped += 1;
  }
}

// Comma-separated flag keys to resolve as enabled regardless of the PostHog
// rollout. This is how "flags gate production only" is expressed: the staging
// wrangler env sets it (and local dev inherits that block), production
// deliberately does not. Without it a 0%-rollout surface would be invisible
// everywhere, and the only way to work on one would be raising the rollout in
// PostHog — which would expose it in production too.
//
// Cast: `wrangler types` pins a var to the literal from ONE environment
// (staging's), while production does not set it at all.
function forcedOn(env: AppEnv): Set<string> {
  const raw = env.FLAGS_FORCE_ON as string | undefined;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean),
  );
}

async function evaluate(
  env: AppEnv,
  distinctId: string,
  keys: readonly string[],
): Promise<Record<string, boolean>> {
  const client = new PostHog(env.POSTHOG_PROJECT_TOKEN as string, {
    host: env.POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });

  const snapshot = await client.evaluateFlags(distinctId, {
    flagKeys: [...keys],
  });

  const resolved: Record<string, boolean> = {};
  for (const key of keys) resolved[key] = snapshot.isEnabled(key);
  return resolved;
}

/**
 * Resolves feature flags for one viewer.
 *
 * **Fails CLOSED.** No token, an unreachable PostHog, or an unknown key all
 * resolve to `false`. Every flag here gates a surface that is off by default, so
 * the safe direction is "stay hidden" — a PostHog outage must never be what
 * reveals an unlaunched product.
 */
export async function resolveFlags(
  env: AppEnv,
  viewerId: string | null,
  keys: readonly string[],
): Promise<Record<string, boolean>> {
  const forced = forcedOn(env);
  const closed = Object.fromEntries(
    keys.map((key) => [key, forced.has(key)]),
  ) as Record<string, boolean>;

  if (!env.POSTHOG_PROJECT_TOKEN) return closed;

  const distinctId = viewerId ?? ANONYMOUS_DISTINCT_ID;
  const cacheKey = `${distinctId}:${[...keys].sort().join(",")}`;
  const now = Date.now();

  const hit = cache.get(cacheKey);
  if (hit && now - hit.cachedAt < CACHE_TTL_MS) {
    return { ...hit.flags, ...pickForced(forced, keys) };
  }

  let pending = inflight.get(cacheKey);
  if (!pending) {
    pending = evaluate(env, distinctId, keys)
      .then((flags) => {
        prune(Date.now());
        cache.set(cacheKey, { flags, cachedAt: Date.now() });
        return flags;
      })
      .finally(() => {
        inflight.delete(cacheKey);
      });
    inflight.set(cacheKey, pending);
  }

  try {
    const flags = await pending;
    return { ...flags, ...pickForced(forced, keys) };
  } catch (err) {
    // Not cached: a transient failure must not pin the surface off for the TTL.
    console.error("flag evaluation failed:", formatErrorChain(err));
    captureServerException(env, undefined, err, {
      distinctId,
      properties: { flags: [...keys].sort().join(",") },
    });
    return closed;
  }
}

function pickForced(
  forced: Set<string>,
  keys: readonly string[],
): Record<string, boolean> {
  const overrides: Record<string, boolean> = {};
  for (const key of keys) if (forced.has(key)) overrides[key] = true;
  return overrides;
}

/** `resolveFlags` for a single flag. */
export async function isFlagEnabled(
  env: AppEnv,
  viewerId: string | null,
  key: string,
): Promise<boolean> {
  return (await resolveFlags(env, viewerId, [key]))[key] ?? false;
}

/** Test-only: drop the in-isolate cache between cases. */
export function __clearFlagCache(): void {
  cache.clear();
  inflight.clear();
}
