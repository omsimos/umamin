import { AsyncLocalStorage } from "node:async_hooks";
import { PostHog } from "posthog-node";
import {
  FLAG_CONTENT_MODERATION,
  FLAG_UMAMIN_CHAT,
  FLAG_UMAMIN_DM,
  FLAG_UMAMIN_PRO,
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
//
// The flags every visitor shares (SNAPSHOT_FLAGS) are not evaluated on the
// request path at all: the five-minute cron evaluates them and stores the
// answer in KV (refreshFlagSnapshot), and requests read that. A cold isolate
// used to wait up to a second on /flags before the first query of a page.

// Long relative to a page load, short relative to a launch decision. A flip in
// PostHog reaches a per-user flag within a minute; a snapshot flag waits for
// the next cron run plus KV propagation on top, so up to about seven minutes.
const CACHE_TTL_MS = 60_000;
// A flag check sits on the request path; a slow /flags must cost at most this,
// once per isolate per minute (a failed request is cached only briefly).
const FLAGS_REQUEST_TIMEOUT_MS = 1000;
// The snapshot refresh runs in a cron with no viewer waiting on it, so it can
// wait out a slow /flags that the request path would have given up on.
const SNAPSHOT_REQUEST_TIMEOUT_MS = 5000;
// How long a failed /flags request is cached: long enough that an outage
// doesn't turn every request into a /flags call, short enough to recover
// quickly.
const MISSING_TTL_MS = 10_000;
// An isolate can live for hours and this is keyed per distinct id, so cap it.
const CACHE_MAX_ENTRIES = 500;

// Anonymous visitors share one bucket. They can see the offer but cannot buy
// (the checkout action is auth:"user"), so per-visitor bucketing would only
// make a partial rollout look inconsistent between page loads.
const ANONYMOUS_DISTINCT_ID = "anonymous";

// Everything resolved for the shared anonymous bucket: the global switches,
// and the Pro offer as signed-out visitors see it. Pro for a signed-in viewer
// is bucketed per user and stays a live evaluation.
export const SNAPSHOT_FLAGS: readonly string[] = [
  FLAG_CONTENT_MODERATION,
  FLAG_UMAMIN_CHAT,
  FLAG_UMAMIN_DM,
  FLAG_UMAMIN_PRO,
];
const SNAPSHOT_FLAG_SET = new Set(SNAPSHOT_FLAGS);

// One JSON value, despite the one-key-per-entry rule for KV: the cron is its
// only writer and always writes the whole set, so no read-modify-write races.
export const SNAPSHOT_KV_KEY = "flags:anonymous:v1";
// Outlives a long PostHog outage, so readers keep the last real answer, but a
// cron that stopped for good ages out to live evaluation instead of pinning
// the flags forever.
const SNAPSHOT_KV_TTL_SECONDS = 24 * 60 * 60;

type StoredSnapshot = { flags: Record<string, boolean>; refreshedAt: number };

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

// The KV snapshot as this isolate last read it; `flags: null` means there was
// none (a fresh deploy before the first cron run, or a failed read).
let snapshotEntry: {
  flags: Record<string, boolean> | null;
  cachedAt: number;
  ttl: number;
} | null = null;
let snapshotInflight: Promise<Record<string, boolean> | null> | null = null;

// Flag keys PostHog answered a request without, already reported from this
// isolate. Such a key stays missing on every evaluation, so reporting it each
// time only buried real failures.
const reportedMissing = new Set<string>();

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
// object to build (and never dispose) on every cache miss. One per timeout,
// because the request path and the cron want different ones.
const flagsClients = new Map<string, PostHog>();

// posthog-node swallows a failed /flags request into an empty snapshot, which
// looks the same as PostHog answering without the key. It does emit the
// failure on the client's "error" event, synchronously inside the evaluation,
// so the listener finds the evaluation it belongs to through this store.
const pendingRequest = new AsyncLocalStorage<{ failure?: string }>();

function describeRequestError(error: unknown): string {
  // PostHogFetchNetworkError wraps the fetch error as `.error`.
  const cause = (error as { error?: unknown } | null)?.error ?? error;
  if (
    cause instanceof Error &&
    (cause.name === "AbortError" || cause.name === "TimeoutError")
  ) {
    return "timeout";
  }
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === "number") return `HTTP ${status}`;
  return error instanceof Error ? error.message : String(error);
}

function getFlagsClient(env: AppEnv, timeoutMs: number): PostHog {
  const host = env.POSTHOG_HOST ?? "https://us.i.posthog.com";
  const key = `${env.POSTHOG_PROJECT_TOKEN}:${host}:${timeoutMs}`;
  let client = flagsClients.get(key);
  if (!client) {
    client = new PostHog(env.POSTHOG_PROJECT_TOKEN as string, {
      host,
      flushAt: 1,
      flushInterval: 0,
      featureFlagsRequestTimeoutMs: timeoutMs,
      featureFlagsRequestMaxRetries: 0,
    });
    client.on("error", (error: unknown) => {
      const request = pendingRequest.getStore();
      if (request && !request.failure) {
        request.failure = describeRequestError(error);
      }
    });
    flagsClients.set(key, client);
  }
  return client;
}

// A real answer from getFlag() is a value, a missing one is undefined.
// `failure` is set when the /flags request itself failed (timeout, network,
// HTTP error). Without it, a missing key is one PostHog chose not to return:
// deleted, or switched off rather than rolled out to 0%.
async function evaluate(
  env: AppEnv,
  distinctId: string,
  keys: readonly string[],
  timeoutMs = FLAGS_REQUEST_TIMEOUT_MS,
): Promise<{
  answered: Record<string, boolean>;
  missing: string[];
  failure?: string;
}> {
  const request: { failure?: string } = {};
  const snapshot = await pendingRequest.run(request, () =>
    getFlagsClient(env, timeoutMs).evaluateFlags(distinctId, {
      flagKeys: [...keys],
    }),
  );

  const answered: Record<string, boolean> = {};
  const missing: string[] = [];
  for (const key of keys) {
    if (snapshot.getFlag(key) === undefined) missing.push(key);
    else answered[key] = snapshot.isEnabled(key);
  }
  return { answered, missing, failure: request.failure };
}

function reportMissing(
  env: AppEnv,
  distinctId: string,
  missing: readonly string[],
  defer?: (promise: Promise<unknown>) => void,
): void {
  const fresh = missing.filter((key) => !reportedMissing.has(key));
  if (fresh.length === 0) return;
  for (const key of fresh) reportedMissing.add(key);
  const list = [...fresh].sort().join(",");
  console.warn("flag not returned by PostHog:", list);
  captureServerException(
    env,
    defer,
    new Error("flag not returned by PostHog"),
    { distinctId, properties: { flags: list } },
  );
}

function parseSnapshot(stored: unknown): Record<string, boolean> | null {
  const flags = (stored as Partial<StoredSnapshot> | null)?.flags;
  if (!flags || typeof flags !== "object") return null;
  const parsed: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(flags)) {
    if (typeof value === "boolean") parsed[key] = value;
  }
  return parsed;
}

// One in-isolate entry for the whole snapshot, so any mix of global flags
// costs one KV read per isolate per minute rather than one per request.
function readSnapshot(env: AppEnv): Promise<Record<string, boolean> | null> {
  if (!env.KV) return Promise.resolve(null);
  const now = Date.now();
  if (snapshotEntry && now - snapshotEntry.cachedAt < snapshotEntry.ttl) {
    return Promise.resolve(snapshotEntry.flags);
  }

  if (!snapshotInflight) {
    snapshotInflight = env.KV.get<StoredSnapshot>(SNAPSHOT_KV_KEY, "json")
      .then((stored) => {
        const flags = parseSnapshot(stored);
        if (flags) {
          for (const [key, value] of Object.entries(flags)) {
            rememberAnswer(ANONYMOUS_DISTINCT_ID, key, value);
          }
        }
        snapshotEntry = { flags, cachedAt: Date.now(), ttl: CACHE_TTL_MS };
        return flags;
      })
      .catch((err: unknown) => {
        console.warn("flag snapshot read failed:", formatErrorChain(err));
        snapshotEntry = {
          flags: null,
          cachedAt: Date.now(),
          ttl: MISSING_TTL_MS,
        };
        return null;
      })
      .finally(() => {
        snapshotInflight = null;
      });
  }
  return snapshotInflight;
}

/**
 * Re-evaluates the anonymous-bucket flags against PostHog and stores them as
 * the KV snapshot every isolate reads. Runs from the five-minute cron.
 *
 * Writes only when PostHog answered: a failed request throws for the cron to
 * report and leaves the previous snapshot in place. A key PostHog left out
 * keeps its previous snapshot value, else its `FLAG_FALLBACK`, the same
 * last-known rule the live path follows. No-ops without a KV binding or a
 * project token.
 */
export async function refreshFlagSnapshot(
  env: AppEnv,
  defer?: (promise: Promise<unknown>) => void,
): Promise<void> {
  if (!env.KV || !env.POSTHOG_PROJECT_TOKEN) return;

  const { answered, missing, failure } = await evaluate(
    env,
    ANONYMOUS_DISTINCT_ID,
    SNAPSHOT_FLAGS,
    SNAPSHOT_REQUEST_TIMEOUT_MS,
  );
  if (failure) throw new Error(`flag snapshot refresh failed: ${failure}`);
  if (missing.length > 0) {
    reportMissing(env, ANONYMOUS_DISTINCT_ID, missing, defer);
  }
  // Nothing answered is a hollow response (quota limiting returns one), not a
  // decision about any flag.
  if (Object.keys(answered).length === 0) return;

  const previous =
    missing.length > 0
      ? parseSnapshot(await env.KV.get<StoredSnapshot>(SNAPSHOT_KV_KEY, "json"))
      : null;
  const flags: Record<string, boolean> = { ...answered };
  for (const key of missing) {
    flags[key] = previous?.[key] ?? FLAG_FALLBACK[key] ?? false;
  }

  const stored: StoredSnapshot = { flags, refreshedAt: Date.now() };
  await env.KV.put(SNAPSHOT_KV_KEY, JSON.stringify(stored), {
    expirationTtl: SNAPSHOT_KV_TTL_SECONDS,
  });
}

/**
 * Resolves feature flags for one viewer.
 *
 * `SNAPSHOT_FLAGS` asked for with no viewer come from the KV snapshot the cron
 * refreshes, cached in the isolate for a minute. Without a snapshot, and for
 * every per-user lookup, the flags are evaluated live against PostHog.
 *
 * When a live evaluation gets no answer (an outage, a timeout, quota, or a
 * deleted flag), each flag falls back to its last known value in this isolate,
 * else `FLAG_FALLBACK`: `false` for every surface and unknown key, so an outage
 * never reveals an unlaunched product, and `true` for `content-moderation`,
 * where off is the unsafe direction. A failed request is cached for 10 s and
 * reported; a key PostHog left out is reported once per isolate; a thrown
 * evaluation is reported and not cached. No project token resolves to `false`
 * (only `FLAGS_FORCE_ON` keys are on).
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

  if (
    distinctId === ANONYMOUS_DISTINCT_ID &&
    keys.every((key) => SNAPSHOT_FLAG_SET.has(key))
  ) {
    const snapshot = await readSnapshot(env);
    if (snapshot && keys.every((key) => key in snapshot)) {
      const flags = Object.fromEntries(
        keys.map((key) => [key, snapshot[key]]),
      ) as Record<string, boolean>;
      return { ...flags, ...pickForced(forced, keys) };
    }
  }

  const cacheKey = `${distinctId}:${[...keys].sort().join(",")}`;
  const now = Date.now();

  const hit = cache.get(cacheKey);
  if (hit && now - hit.cachedAt < hit.ttl) {
    return { ...hit.flags, ...pickForced(forced, keys) };
  }

  let pending = inflight.get(cacheKey);
  if (!pending) {
    pending = evaluate(env, distinctId, keys)
      .then(({ answered, missing, failure }) => {
        const flags: Record<string, boolean> = { ...answered };
        for (const [key, value] of Object.entries(answered)) {
          rememberAnswer(distinctId, key, value);
        }
        for (const key of missing) flags[key] = fallbackFor(distinctId, key);

        if (failure) {
          const list = [...keys].sort().join(",");
          console.warn(`flag evaluation request failed (${failure}):`, list);
          captureServerException(
            env,
            undefined,
            new Error("flag evaluation request failed"),
            { distinctId, properties: { flags: list, reason: failure } },
          );
        } else if (missing.length > 0) {
          reportMissing(env, distinctId, missing);
        }

        prune(Date.now());
        cache.set(cacheKey, {
          flags,
          cachedAt: Date.now(),
          // PostHog leaving a key out is an answer; a failed request is not.
          ttl: failure ? MISSING_TTL_MS : CACHE_TTL_MS,
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

/** Test-only: drop the in-isolate caches between cases. */
export function __clearFlagCache(): void {
  cache.clear();
  inflight.clear();
  lastKnown.clear();
  flagsClients.clear();
  reportedMissing.clear();
  snapshotEntry = null;
  snapshotInflight = null;
}
