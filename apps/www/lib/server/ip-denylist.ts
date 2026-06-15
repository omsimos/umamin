import "server-only";

import { canonicalizeIp } from "@/lib/ip";
import { redis } from "@/lib/redis";

// Self-controlled, instantly-revocable IP denylist (a moderator lever). This is
// DISTINCT from the Vercel WAF: the WAF blocks at the edge BEFORE the function
// runs (cheaper, and the right tool for volumetric/DDoS abuse) — reach for it
// (`vercel firewall ip-blocks block <ip>`) for a persistent attacker. This
// denylist runs INSIDE the function and is the fine-grained, no-deploy lever
// for blocking a specific abusive IP identified from logs/abuse reports.
//
// CAVEAT: keyed per IP, so it blocks EVERY user behind a shared egress IP
// (CGNAT / mobile carrier / school / office NAT). Use it for a confirmed
// single-source abuser, not a casual nuisance. No-ops entirely without Redis
// (local dev) and FAILS OPEN on a transient Redis error — never brick the whole
// app over the denylist; the WAF is the independent edge-level backstop.
const DENYLIST_KEY = "ip:denylist";

// In-process cache so a guarded request doesn't pay a Redis round-trip every
// time. The whole (tiny) set is refreshed at most once per TTL per server
// instance. Trade-off: a newly denied/allowed IP propagates within CACHE_TTL_MS
// (same order as the 60s session cache) — fine for a manual moderation lever,
// and the mutating instance busts its own cache immediately.
const CACHE_TTL_MS = 30_000;

let cache: { ips: Set<string>; fetchedAt: number } | null = null;
let inflight: Promise<Set<string>> | null = null;

async function loadDenylist(): Promise<Set<string>> {
  if (!redis) return new Set();
  const members = await redis.smembers<string[]>(DENYLIST_KEY);
  return new Set(members);
}

async function getDenylist(now: number): Promise<Set<string>> {
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.ips;
  }
  // Collapse a burst of concurrent refreshes into a single round-trip.
  if (!inflight) {
    inflight = loadDenylist()
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

export async function isIpDenied(ip: string): Promise<boolean> {
  if (!redis || !ip) return false;
  try {
    const set = await getDenylist(Date.now());
    // Stored entries are canonicalized on write, so canonicalize the runtime IP
    // before comparing (else equivalent IPv6 forms never match).
    return set.has(canonicalizeIp(ip));
  } catch {
    return false;
  }
}

export async function denyIp(ip: string): Promise<void> {
  if (!redis) return;
  await redis.sadd(DENYLIST_KEY, canonicalizeIp(ip));
  cache = null; // reflect immediately here; other instances refresh by TTL
}

export async function allowIp(ip: string): Promise<void> {
  if (!redis) return;
  await redis.srem(DENYLIST_KEY, canonicalizeIp(ip));
  cache = null;
}

export async function listDeniedIps(): Promise<string[]> {
  if (!redis) return [];
  return redis.smembers<string[]>(DENYLIST_KEY);
}
