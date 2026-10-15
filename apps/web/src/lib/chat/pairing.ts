/**
 * Matchmaking rules for the lobby, as pure functions over the waiting pool.
 * The ChatLobby Durable Object keeps each waiter in its socket attachment and
 * calls these on every join and alarm tick, so nobody can be stranded by a
 * single missed pairing attempt.
 */
import {
  FALLBACK_MS,
  MAX_ALIAS_LEN,
  MAX_AVATAR_SEED_LEN,
  MAX_INTEREST_LEN,
  MAX_INTERESTS,
  MAX_INVITE_CODE_LEN,
} from "./constants";
import type { Participant } from "./engine";

export interface Waiter {
  sessionId: string;
  /** SHA-256 of the session secret. A second socket for the same sessionId
   *  may replace this waiter only when its hash matches. */
  secretHash: string;
  interests: string[];
  /** Server-derived from the secret (invite.ts), never client-chosen. */
  inviteCode: string;
  enqueuedAt: number;
  fallbackAt: number;
}

export interface Joiner {
  sessionId: string;
  secretHash: string;
  interests: string[];
  joinCode: string | null;
}

export interface PairPick {
  partner: Waiter;
  viaInvite: boolean;
}

const byAge = (x: Waiter, y: Waiter) => x.enqueuedAt - y.enqueuedAt;

const shares = (a: string[], b: string[]) => a.some((i) => b.includes(i));

/** Finds a partner for a joiner, or null to queue them. An invite code wins
 *  over interests; otherwise the oldest waiter with a shared interest. The
 *  caller has already resolved a same-sessionId waiter (replaced it on a
 *  matching secret, rejected the joiner otherwise), so "others" is everyone
 *  else in the pool. */
export function pickPartner(pool: Waiter[], joiner: Joiner): PairPick | null {
  const others = pool
    .filter((w) => w.sessionId !== joiner.sessionId)
    .sort(byAge);
  if (joiner.joinCode) {
    const host = others.find((w) => w.inviteCode === joiner.joinCode);
    if (host) return { partner: host, viaInvite: true };
  }
  const partner = others.find((w) => shares(w.interests, joiner.interests));
  return partner ? { partner, viaInvite: false } : null;
}

/** Alarm pass: every waiter whose fallback time passed pairs with the oldest
 *  other waiter, interests ignored. Returns disjoint pairs. */
export function pickFallbackPairs(
  pool: Waiter[],
  now: number,
): [Waiter, Waiter][] {
  const free = [...pool].sort(byAge);
  const taken = new Set<string>();
  const pairs: [Waiter, Waiter][] = [];
  for (const waiter of free) {
    if (taken.has(waiter.sessionId) || waiter.fallbackAt > now) continue;
    const partner = free.find(
      (w) => w.sessionId !== waiter.sessionId && !taken.has(w.sessionId),
    );
    if (!partner) break;
    taken.add(waiter.sessionId);
    taken.add(partner.sessionId);
    pairs.push([waiter, partner]);
  }
  return pairs;
}

/** The next time the lobby needs to wake for a fallback, or null when no
 *  pairing is possible (fewer than two waiters). */
export function nextFallbackAt(pool: Waiter[]): number | null {
  if (pool.length < 2) return null;
  return Math.min(...pool.map((w) => w.fallbackAt));
}

export function newWaiter(
  joiner: Joiner,
  inviteCode: string,
  now: number,
): Waiter {
  return {
    sessionId: joiner.sessionId,
    secretHash: joiner.secretHash,
    interests: joiner.interests,
    inviteCode,
    enqueuedAt: now,
    fallbackAt: now + FALLBACK_MS,
  };
}

/** Trims and bounds client-supplied identity. Null means reject the join. */
export function normalizeIdentity(input: {
  alias: string;
  avatarSeed: string;
  interests: string[];
}): Participant | null {
  const alias = input.alias.trim() || "Anonymous";
  const avatarSeed = input.avatarSeed.trim();
  const interests = Array.from(
    new Set(input.interests.map((i) => i.trim()).filter(Boolean)),
  );
  if (
    alias.length > MAX_ALIAS_LEN ||
    avatarSeed.length === 0 ||
    avatarSeed.length > MAX_AVATAR_SEED_LEN ||
    interests.length > MAX_INTERESTS ||
    interests.some((i) => i.length > MAX_INTEREST_LEN)
  ) {
    return null;
  }
  return { alias, avatarSeed, interests };
}

/** Empty means absent. `undefined` means the code is over-long: reject. */
export function normalizeCode(
  code: string | undefined,
): string | null | undefined {
  const trimmed = code?.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_INVITE_CODE_LEN) return undefined;
  return trimmed;
}
