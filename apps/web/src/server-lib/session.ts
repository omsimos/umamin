import { sha256 } from "@oslojs/crypto/sha2";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";
import type {
  InsertSession,
  SelectSession,
  SelectUser,
} from "@umamin/db/schema/user";
import { sessionTable, userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { LEGACY_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "./cookies";
import type { Db } from "./db";

// Session TTL + sliding-renewal window, unchanged from apps/www/lib/session.ts.
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const SESSION_RENEW_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15;

export type SessionValidationResult =
  | { session: SelectSession; user: SelectUser }
  | { session: null; user: null };

// In-isolate micro-cache (replaces the Redis 60s session cache — plan: KV's
// eventual deletes would SLOW force-logout, so sessions deliberately stay off
// KV). Collapses a burst of authed requests within one isolate; expiry + ban are
// always re-checked before serving, and every invalidate* clears the cache so a
// logout / password-change / ban can't be bypassed by a lingering entry. Worst-
// case staleness is MICRO_CACHE_TTL_MS (~12s) vs today's ≤60s — strictly better.
const MICRO_CACHE_TTL_MS = 12_000;

type CacheEntry = { result: SessionValidationResult; cachedAt: number };
const microCache = new Map<string, CacheEntry>();

function clearMicroCache(): void {
  microCache.clear();
}

export function sessionIdFromToken(token: string): string {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

export async function createSession(
  db: Db,
  token: string,
  userId: string,
): Promise<SelectSession> {
  const session: InsertSession = {
    id: sessionIdFromToken(token),
    userId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  await db.insert(sessionTable).values(session);
  return session as SelectSession;
}

/**
 * Pure session-token validation core (no cookies, no KV). Token → SHA-256 id →
 * Turso join; expiry re-checked (expired rows deleted), banned accounts resolve
 * to no session (full lockout), and a session inside the 15-day renewal window
 * slides its expiry forward. Mirrors apps/www exactly, minus the Redis fast path.
 */
export async function validateSessionToken(
  db: Db,
  token: string,
): Promise<SessionValidationResult> {
  const sessionId = sessionIdFromToken(token);

  const now = Date.now();
  const cached = microCache.get(sessionId);
  if (cached && now - cached.cachedAt < MICRO_CACHE_TTL_MS) {
    const { result } = cached;
    if (result.session === null) return result;
    if (now < result.session.expiresAt && !result.user.bannedAt) {
      return result;
    }
    // Stale/expired/banned — fall through to a fresh DB check.
    microCache.delete(sessionId);
  }

  const [row] = await db
    .select({ session: sessionTable, user: userTable })
    .from(sessionTable)
    .leftJoin(userTable, eq(sessionTable.userId, userTable.id))
    .where(eq(sessionTable.id, sessionId))
    .limit(1);

  if (!row?.user) {
    return { session: null, user: null };
  }

  const { session, user } = row;

  if (Date.now() >= session.expiresAt) {
    await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
    return { session: null, user: null };
  }

  // Full lockout — never serve (or cache) a banned account's session.
  if (user.bannedAt) {
    return { session: null, user: null };
  }

  if (Date.now() >= session.expiresAt - SESSION_RENEW_THRESHOLD_MS) {
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    await db
      .update(sessionTable)
      .set({ expiresAt: session.expiresAt })
      .where(eq(sessionTable.id, sessionId));
  }

  const result: SessionValidationResult = { session, user };
  microCache.set(sessionId, { result, cachedAt: Date.now() });
  return result;
}

export async function invalidateSession(
  db: Db,
  sessionId: string,
): Promise<void> {
  await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
  clearMicroCache();
}

// Revoke ALL of a user's sessions (password change / ban) for immediate force-
// logout. The in-isolate cache is cleared wholesale — cheap and guarantees no
// revoked session survives on this isolate.
export async function invalidateUserSessions(
  db: Db,
  userId: string,
): Promise<void> {
  await db.delete(sessionTable).where(eq(sessionTable.userId, userId));
  clearMicroCache();
}

export type SessionSource = "cookie" | "bearer";
export type ResolvedSession = SessionValidationResult & {
  source: SessionSource | null;
};

const NO_SESSION: ResolvedSession = {
  session: null,
  user: null,
  source: null,
};

// Dual-auth resolution (mobile-ready, plan "Mobile-ready adjustments"): a
// bearer token (native app) or the httpOnly session cookie (web). The source is
// returned so CSRF can be skipped for bearer-authed requests (they carry no
// Origin). Bearer wins when both are present (explicit API intent).
export async function resolveSession(
  c: Context,
  db: Db,
): Promise<ResolvedSession> {
  const authHeader = c.req.header("authorization");
  const bearer =
    authHeader && /^bearer\s+/i.test(authHeader)
      ? authHeader.replace(/^bearer\s+/i, "").trim()
      : null;

  if (bearer) {
    const result = await validateSessionToken(db, bearer);
    return { ...result, source: "bearer" };
  }

  const token =
    getCookie(c, SESSION_COOKIE_NAME) ??
    (LEGACY_SESSION_COOKIE_NAME !== SESSION_COOKIE_NAME
      ? getCookie(c, LEGACY_SESSION_COOKIE_NAME)
      : undefined) ??
    null;

  if (token === null) return NO_SESSION;

  const result = await validateSessionToken(db, token);
  return { ...result, source: "cookie" };
}

// Test-only: reset the in-isolate cache between cases.
export function __clearSessionCache(): void {
  clearMicroCache();
}
