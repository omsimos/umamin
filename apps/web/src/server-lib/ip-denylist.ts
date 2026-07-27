import { canonicalizeIp } from "./ip";

// Self-controlled, revocable IP denylist (a moderator lever), DISTINCT from the
// CF WAF: the WAF blocks at the edge before the Worker runs (right tool for
// volumetric/DDoS); this runs INSIDE the Worker as the fine-grained, no-deploy
// lever for a confirmed single-source abuser. Redis SET → a single KV JSON-array
// key. CAVEAT unchanged: per-IP, so it blocks every user behind a shared egress
// IP (CGNAT). No-ops without a KV binding and FAILS OPEN on a KV error — never
// brick the app over the denylist.
const DENYLIST_KEY = "ip:denylist";

// In-process cache so a guarded request doesn't pay a KV read every time; the
// whole (tiny) set refreshes at most once per TTL per isolate. A newly denied/
// allowed IP propagates within CACHE_TTL_MS (+ KV's own ~60s), and the mutating
// isolate busts its own cache immediately.
const CACHE_TTL_MS = 30_000;

let cache: { ips: Set<string>; fetchedAt: number } | null = null;
let inflight: Promise<Set<string>> | null = null;

async function loadDenylist(kv: KVNamespace | undefined): Promise<Set<string>> {
  if (!kv) return new Set();
  const members = await kv.get<string[]>(DENYLIST_KEY, "json");
  return new Set(members ?? []);
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

async function writeDenylist(kv: KVNamespace, set: Set<string>): Promise<void> {
  await kv.put(DENYLIST_KEY, JSON.stringify([...set]));
  cache = null; // reflect immediately here; other isolates refresh by TTL
}

export async function denyIp(
  kv: KVNamespace | undefined,
  ip: string,
): Promise<void> {
  if (!kv) return;
  const set = await loadDenylist(kv);
  set.add(canonicalizeIp(ip));
  await writeDenylist(kv, set);
}

export async function allowIp(
  kv: KVNamespace | undefined,
  ip: string,
): Promise<void> {
  if (!kv) return;
  const set = await loadDenylist(kv);
  set.delete(canonicalizeIp(ip));
  await writeDenylist(kv, set);
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
