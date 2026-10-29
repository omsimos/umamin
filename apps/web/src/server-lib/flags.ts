import { PostHog } from "posthog-node";
import {
  FLAG_CONTENT_MODERATION,
  FLAG_UMAMIN_CHAT,
  FLAG_UMAMIN_DM,
} from "../lib/flags";
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
// A flag check sits on the request path; a slow /flags must cost at most this,
// once per isolate per minute (a missing answer is cached only briefly).
const FLAGS_REQUEST_TIMEOUT_MS = 1000;
// How long an answer PostHog failed to give is cached: long enough that an
// outage doesn't turn every request into a /flags call, short enough to recover
// quickly.
const MISSING_TTL_MS = 10_000;
// An isolate can live for hours and this is keyed per distinct id, so cap it.
const CACHE_MAX_ENTRIES = 500;

// Anonymous visitors share one bucket. They can see the offer but cannot buy
// (the checkout action is auth:"user"), so per-visitor bucketing would only
// make a partial rollout look inconsistent between page loads.
const ANONYMOUS_DISTINCT_ID = "anonymous";

type Entry = {
  flags: Record<string, boolean>;
  cachedAt: number;
  ttl: number;
};

// What a flag resolves to when PostHog gave no answer (outage, timeout,
// quota). Hiding an unlaunched surface is the safe default; for
// content-moderation the safe direction is ON, because off uncovers severe
// content in shared caches and the Hot ranking.
const FLAG_FALLBACK: Readonly<Record<string, boolean>> = {
  [FLAG_CONTENT_MODERATION]: true,
};
// Last answer PostHog actually gave, per distinct id and flag; preferred over
// FLAG_FALLBACK so an outage keeps the current state.
const lastKnown = new Map<string, boolean>();

const cache = new Map<string, Entry>();
// Concurrent resolvers for one distinct id share a single /flags request — the
// same collapsing validateSessionToken does for parallel loaders.
const inflight = new Map<string, Promise<Record<string, boolean>>>();

function prune(now: number): void {
  for (const [id, entry] of cache) {
    if (now - entry.cachedAt >= entry.ttl) cache.delete(id);
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

function rememberAnswer(distinctId: string, key: string, value: boolean): void {
  const id = `${distinctId}:${key}`;
  // Re-insert so the oldest entry is always the first key.
  lastKnown.delete(id);
  lastKnown.set(id, value);
  while (lastKnown.size > CACHE_MAX_ENTRIES) {
    const oldest = lastKnown.keys().next().value;
    if (oldest === undefined) break;
    lastKnown.delete(oldest);
  }
}

function fallbackFor(distinctId: string, key: string): boolean {
  return lastKnown.get(`${distinctId}:${key}`) ?? FLAG_FALLBACK[key] ?? false;
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

// Per-isolate, like the cache above: a client per evaluation was one more
// object to build (and never dispose) on every cache miss.
let flagsClient: { key: string; client: PostHog } | null = null;

function getFlagsClient(env: AppEnv): PostHog {
  const host = env.POSTHOG_HOST ?? "https://us.i.posthog.com";
  const key = `${env.POSTHOG_PROJECT_TOKEN}:${host}`;
  if (!flagsClient || flagsClient.key !== key) {
    flagsClient = {
      key,
      client: new PostHog(env.POSTHOG_PROJECT_TOKEN as string, {
        host,
        flushAt: 1,
        flushInterval: 0,
        featureFlagsRequestTimeoutMs: FLAGS_REQUEST_TIMEOUT_MS,
        featureFlagsRequestMaxRetries: 0,
      }),
    };
  }
  return flagsClient.client;
}

// posthog-node swallows a failed /flags fetch and returns a snapshot with no
// records, so "PostHog said off" and "PostHog said nothing" only differ in
// getFlag(): a real answer is a value, a missing one is undefined.
async function evaluate(
  env: AppEnv,
  distinctId: string,
  keys: readonly string[],
): Promise<{ answered: Record<string, boolean>; missing: string[] }> {
  const snapshot = await getFlagsClient(env).evaluateFlags(distinctId, {
    flagKeys: [...keys],
  });

  const answered: Record<string, boolean> = {};
  const missing: string[] = [];
  for (const key of keys) {
    if (snapshot.getFlag(key) === undefined) missing.push(key);
    else answered[key] = snapshot.isEnabled(key);
  }
  return { answered, missing };
}

/**
 * Resolves feature flags for one viewer.
 *
 * When PostHog gives no answer (an outage, a timeout, quota, or a deleted
 * flag), each flag falls back to its last known value in this isolate, else
 * `FLAG_FALLBACK`: `false` for every surface and unknown key, so an outage never
 * reveals an unlaunched product, and `true` for `content-moderation`, where off
 * is the unsafe direction. A missing answer is cached for 10 s and reported; a
 * thrown evaluation is reported and not cached. No project token resolves to
 * `false` (only `FLAGS_FORCE_ON` keys are on).
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
  if (hit && now - hit.cachedAt < hit.ttl) {
    return { ...hit.flags, ...pickForced(forced, keys) };
  }

  let pending = inflight.get(cacheKey);
  if (!pending) {
    pending = evaluate(env, distinctId, keys)
      .then(({ answered, missing }) => {
        const flags: Record<string, boolean> = { ...answered };
        for (const [key, value] of Object.entries(answered)) {
          rememberAnswer(distinctId, key, value);
        }
        for (const key of missing) flags[key] = fallbackFor(distinctId, key);

        if (missing.length > 0) {
          const list = [...missing].sort().join(",");
          console.warn("flag evaluation returned no answer:", list);
          captureServerException(
            env,
            undefined,
            new Error("flag evaluation returned no answer"),
            { distinctId, properties: { flags: list } },
          );
        }

        prune(Date.now());
        cache.set(cacheKey, {
          flags,
          cachedAt: Date.now(),
          ttl: missing.length > 0 ? MISSING_TTL_MS : CACHE_TTL_MS,
        });
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
    // Not cached: a transient failure must not pin a flag for the TTL.
    console.error("flag evaluation failed:", formatErrorChain(err));
    captureServerException(env, undefined, err, {
      distinctId,
      properties: { flags: [...keys].sort().join(",") },
    });
    const fallback = Object.fromEntries(
      keys.map((key) => [key, fallbackFor(distinctId, key)]),
    ) as Record<string, boolean>;
    return { ...fallback, ...pickForced(forced, keys) };
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

/** The global content-moderation switch (see lib/flags.ts). */
export function isModerationEnforced(env: AppEnv): Promise<boolean> {
  return isFlagEnabled(env, null, FLAG_CONTENT_MODERATION);
}

/** The global Umamin Chat switch (see lib/flags.ts). */
export function isUmaminChatEnabled(env: AppEnv): Promise<boolean> {
  return isFlagEnabled(env, null, FLAG_UMAMIN_CHAT);
}

/** The global direct-messages switch (see lib/flags.ts). */
export function isDmEnabled(env: AppEnv): Promise<boolean> {
  return isFlagEnabled(env, null, FLAG_UMAMIN_DM);
}

/** Test-only: drop the in-isolate cache between cases. */
export function __clearFlagCache(): void {
  cache.clear();
  inflight.clear();
  lastKnown.clear();
  flagsClient = null;
}
