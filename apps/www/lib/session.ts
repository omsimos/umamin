import { sha256 } from "@oslojs/crypto/sha2";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";
import { db } from "@umamin/db";
import {
  type InsertSession,
  type SelectSession,
  type SelectUser,
  sessionTable,
  userTable,
} from "@umamin/db/schema/user";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { LEGACY_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "./cookies";
import { redis } from "./redis";

// Short TTL — the cache only collapses bursts of authed requests within a session
// window; explicit DELs (logout / password change) handle real revocation, so a
// stale entry can live at most this long, and expiry is always re-checked in code
// before serving. No-ops entirely when Redis isn't configured (local dev).
const SESSION_CACHE_PREFIX = "sess:";
const SESSION_CACHE_TTL_SECONDS = 60;

type CachedSession = { session: SelectSession; user: SelectUser };

// Upstash serializes values to JSON, so Date columns come back as strings —
// revive them so the SelectUser contract (Date fields) holds for every consumer.
function reviveCachedUser(user: SelectUser): SelectUser {
  return {
    ...user,
    createdAt: new Date(user.createdAt),
    updatedAt: user.updatedAt ? new Date(user.updatedAt) : null,
    bannedAt: user.bannedAt ? new Date(user.bannedAt) : null,
  };
}

export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const token = encodeBase32LowerCaseNoPadding(bytes);
  return token;
}

export async function createSession(
  token: string,
  userId: string,
): Promise<SelectSession> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session: InsertSession = {
    id: sessionId,
    userId,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
  };

  await db.insert(sessionTable).values(session);
  return session;
}

export async function validateSessionToken(
  token: string,
): Promise<SessionValidationResult> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const cacheKey = `${SESSION_CACHE_PREFIX}${sessionId}`;

  // Redis fast path: collapse a burst of authed requests (feed scroll, comments,
  // every mutation) into a single Turso JOIN read. Expiry is re-checked here —
  // an expired/revoked session is NEVER served from cache.
  if (redis) {
    const cached = await redis.get<CachedSession>(cacheKey);
    if (cached) {
      if (Date.now() < cached.session.expiresAt) {
        const user = reviveCachedUser(cached.user);
        // Banned accounts resolve to no session everywhere (full lockout). A
        // ban force-deletes session rows AND busts this cache, so a stale
        // pre-ban blob shouldn't reach here — this is the backstop if it does.
        if (user.bannedAt) {
          return { session: null, user: null };
        }
        return { session: cached.session, user };
      }
      await redis.del(cacheKey);
    }
  }

  const [result] = await db
    .select({
      session: sessionTable,
      user: userTable,
    })
    .from(sessionTable)
    .leftJoin(userTable, eq(sessionTable.userId, userTable.id))
    .where(eq(sessionTable.id, sessionId))
    .limit(1);

  if (!result?.user) {
    return { session: null, user: null };
  }

  const { session, user } = result;
  if (Date.now() >= session.expiresAt) {
    await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
    return { session: null, user: null };
  }
  // Full lockout — never serve (or cache below) a banned account's session. The
  // ban action force-deletes their session rows; this also catches any linger.
  if (user.bannedAt) {
    return { session: null, user: null };
  }
  if (Date.now() >= session.expiresAt - 1000 * 60 * 60 * 24 * 15) {
    session.expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;

    await db
      .update(sessionTable)
      .set({
        expiresAt: session.expiresAt,
      })
      .where(eq(sessionTable.id, sessionId));
  }

  if (redis) {
    const ttl = Math.min(
      SESSION_CACHE_TTL_SECONDS,
      Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000)),
    );
    await redis.set(cacheKey, { session, user } satisfies CachedSession, {
      ex: ttl,
    });
  }

  return { session, user };
}

export async function setSessionTokenCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });

  if (LEGACY_SESSION_COOKIE_NAME !== SESSION_COOKIE_NAME) {
    cookieStore.set(LEGACY_SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
    });
  }
}

export async function deleteSessionTokenCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });

  if (LEGACY_SESSION_COOKIE_NAME !== SESSION_COOKIE_NAME) {
    cookieStore.set(LEGACY_SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
    });
  }
}

export async function invalidateSession(sessionId: string) {
  await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
  if (redis) {
    await redis.del(`${SESSION_CACHE_PREFIX}${sessionId}`);
  }
}

// Revoke ALL of a user's sessions (e.g. on password change) and immediately
// drop their cached entries so a changed password can't be bypassed via a
// lingering cache hit. Enumerates ids first (uses session_user_idx).
export async function invalidateUserSessions(userId: string) {
  const sessions = await db
    .select({ id: sessionTable.id })
    .from(sessionTable)
    .where(eq(sessionTable.userId, userId));

  await db.delete(sessionTable).where(eq(sessionTable.userId, userId));

  if (redis && sessions.length > 0) {
    const client = redis;
    await Promise.all(
      sessions.map((s) => client.del(`${SESSION_CACHE_PREFIX}${s.id}`)),
    );
  }
}

// Account-deletion split of invalidateUserSessions: the user-row FK cascade
// removes the session rows inside the delete transaction, so ids must be
// snapshotted BEFORE it and only the cache entries cleared AFTER it commits —
// revoking up front locked users out of an intact account whenever the
// transaction failed.
export async function getUserSessionIds(userId: string): Promise<string[]> {
  const sessions = await db
    .select({ id: sessionTable.id })
    .from(sessionTable)
    .where(eq(sessionTable.userId, userId));

  return sessions.map((s) => s.id);
}

export async function clearSessionCache(sessionIds: string[]) {
  if (!redis || sessionIds.length === 0) return;
  const client = redis;
  await Promise.all(
    sessionIds.map((id) => client.del(`${SESSION_CACHE_PREFIX}${id}`)),
  );
}

export type SessionValidationResult =
  | { session: SelectSession; user: SelectUser }
  | { session: null; user: null };
