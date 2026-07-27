import { canonicalizeIp } from "./ip";

// Self-controlled, revocable IP denylist (a moderator lever), DISTINCT from the
// CF WAF: the WAF blocks at the edge before the Worker runs (right tool for
// volumetric/DDoS); this runs INSIDE the Worker as the fine-grained, no-deploy
// lever for a confirmed single-source abuser. CAVEAT unchanged: per-IP, so it
// blocks every user behind a shared egress IP (CGNAT). No-ops without a KV
// binding and FAILS OPEN on a KV error — never brick the app over the denylist.
//
// Redis SET → ONE KV KEY PER ENTRY, not a single JSON array. KV has no set
// primitive, so an array means get→mutate→put; because KV reads are eventually
// consistent, two blocks landing close together (two moderators, or two colos)
// can each read the pre-write array and the second put silently drops the first
// IP — an unblock nobody asked for, with no error. Disjoint keys can't clobber.
const DENYLIST_PREFIX = "ip:denylist:";
// The pre-per-key JSON array, still unioned on read so anything written before
// this change keeps blocking; allowIp prunes it. Remove once it stays empty.
const LEGACY_DENYLIST_KEY = "ip:denylist";

// In-process cache so a guarded request doesn't pay a KV read every time; the
// whole (tiny) set refreshes at most once per TTL per isolate. A newly denied/
// allowed IP propagates within CACHE_TTL_MS (+ KV's own ~60s), and the mutating
// isolate busts its own cache immediately.
const CACHE_TTL_MS = 30_000;

let cache: { ips: Set<string>; fetchedAt: number } | null = null;
let inflight: Promise<Set<string>> | null = null;

async function loadLegacyDenylist(kv: KVNamespace): Promise<string[]> {
  return (await kv.get<string[]>(LEGACY_DENYLIST_KEY, "json")) ?? [];
}

async function loadDenylist(kv: KVNamespace | undefined): Promise<Set<string>> {
  if (!kv) return new Set();

  const ips = new Set(await loadLegacyDenylist(kv));
  // A moderator lever holding a handful of entries, so one page is the expected
  // case; the loop only guards against an unbounded growth spurt.
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: DENYLIST_PREFIX, cursor });
    for (const key of page.keys) {
      ips.add(key.name.slice(DENYLIST_PREFIX.length));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return ips;
}

async function getDenylist(
  kv: KVNamespace | undefined,
  now: number,
): Promise<Set<string>> {
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.ips;
  }
  // Collapse a burst of concurrent refreshes into a single KV read.
  if (!inflight) {
    inflight = loadDenylist(kv)
      .then((ips) => {
        cache = { ips, fetchedAt: now };
        return ips;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export async function isIpDenied(
  kv: KVNamespace | undefined,
  ip: string,
): Promise<boolean> {
  if (!kv || !ip) return false;
  try {
    const set = await getDenylist(kv, Date.now());
    // Entries are canonicalized on write, so canonicalize the runtime IP before
    // comparing (else equivalent IPv6 forms never match).
    return set.has(canonicalizeIp(ip));
  } catch {
    return false;
  }
}

export async function denyIp(
  kv: KVNamespace | undefined,
  ip: string,
): Promise<void> {
  if (!kv) return;
  await kv.put(`${DENYLIST_PREFIX}${canonicalizeIp(ip)}`, "1");
  cache = null; // reflect immediately here; other isolates refresh by TTL
}

export async function allowIp(
  kv: KVNamespace | undefined,
  ip: string,
): Promise<void> {
  if (!kv) return;
  const canonical = canonicalizeIp(ip);
  await kv.delete(`${DENYLIST_PREFIX}${canonical}`);

  // An entry written before the per-key layout still lives in the array, and
  // leaving it there would make "unblock" look like it did nothing.
  const legacy = await loadLegacyDenylist(kv);
  if (legacy.includes(canonical)) {
    await kv.put(
      LEGACY_DENYLIST_KEY,
      JSON.stringify(legacy.filter((entry) => entry !== canonical)),
    );
  }

  cache = null;
}

export async function listDeniedIps(
  kv: KVNamespace | undefined,
): Promise<string[]> {
  if (!kv) return [];
  return [...(await loadDenylist(kv))];
}

// Test-only: reset the in-process cache between cases.
export function __clearDenylistCache(): void {
  cache = null;
  inflight = null;
}
