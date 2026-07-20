import { sha256 } from "@oslojs/crypto/sha2";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";
import { db } from "@umamin/org-db";
import { orgTable, type SelectOrg } from "@umamin/org-db/schema/org";
import {
  type InsertOrgSession,
  orgSessionTable,
  type SelectOrgSession,
} from "@umamin/org-db/schema/session";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "./cookies";
import { redis } from "./redis";

// Short TTL — collapses bursts of authed requests; explicit DELs (logout /
// password change) handle real revocation, and expiry is always re-checked
// before serving. No-ops entirely without Redis (local dev).
const SESSION_CACHE_PREFIX = "sess:";
const SESSION_CACHE_TTL_SECONDS = 60;
const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;
const FIFTEEN_DAYS_MS = 1000 * 60 * 60 * 24 * 15;

// The session never needs the password hash — keep it out of the in-memory
// session object AND the Redis cache (so a KV compromise can't leak hashes).
export type SessionOrg = Omit<SelectOrg, "passwordHash">;

type CachedSession = { session: SelectOrgSession; user: SessionOrg };

function toSessionOrg(org: SelectOrg): SessionOrg {
  return {
    id: org.id,
    username: org.username,
    displayName: org.displayName,
    question: org.question,
    imageUrl: org.imageUrl,
    mustChangePassword: org.mustChangePassword,
    acceptingMessages: org.acceptingMessages,
    messageCharLimit: org.messageCharLimit,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

// Upstash serializes to JSON, so Date columns come back as strings — revive
// them so the SessionOrg contract (Date fields) holds for every consumer.
function reviveCachedOrg(org: SessionOrg): SessionOrg {
  return {
    ...org,
    createdAt: new Date(org.createdAt),
    updatedAt: org.updatedAt ? new Date(org.updatedAt) : null,
  };
}

export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

export async function createSession(
  token: string,
  orgId: string,
): Promise<SelectOrgSession> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session: InsertOrgSession = {
    id: sessionId,
    orgId,
    expiresAt: Date.now() + THIRTY_DAYS_MS,
  };

  await db.insert(orgSessionTable).values(session);
  return session;
}

export async function validateSessionToken(
  token: string,
): Promise<SessionValidationResult> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const cacheKey = `${SESSION_CACHE_PREFIX}${sessionId}`;

  if (redis) {
    const cached = await redis.get<CachedSession>(cacheKey);
    if (cached) {
      if (Date.now() < cached.session.expiresAt) {
        return { session: cached.session, user: reviveCachedOrg(cached.user) };
      }
      await redis.del(cacheKey);
    }
  }

  const [result] = await db
    .select({ session: orgSessionTable, user: orgTable })
    .from(orgSessionTable)
    .leftJoin(orgTable, eq(orgSessionTable.orgId, orgTable.id))
    .where(eq(orgSessionTable.id, sessionId))
    .limit(1);

  if (!result?.user) {
    return { session: null, user: null };
  }

  const { session, user } = result;
  if (Date.now() >= session.expiresAt) {
    await db.delete(orgSessionTable).where(eq(orgSessionTable.id, sessionId));
    return { session: null, user: null };
  }

  const sessionUser = toSessionOrg(user);

  if (Date.now() >= session.expiresAt - FIFTEEN_DAYS_MS) {
    session.expiresAt = Date.now() + THIRTY_DAYS_MS;
    await db
      .update(orgSessionTable)
      .set({ expiresAt: session.expiresAt })
      .where(eq(orgSessionTable.id, sessionId));
  }

  if (redis) {
    const ttl = Math.min(
      SESSION_CACHE_TTL_SECONDS,
      Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000)),
    );
    await redis.set(
      cacheKey,
      { session, user: sessionUser } satisfies CachedSession,
      { ex: ttl },
    );
  }

  return { session, user: sessionUser };
}

// Mint a fresh session row + set the cookie for the current request. Used by
// login and by the password change (after revoking all prior sessions).
export async function mintSessionCookie(orgId: string): Promise<void> {
  const token = generateSessionToken();
  const session = await createSession(token, orgId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(session.expiresAt),
    path: "/",
  });
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
}

// Drop only the cached copy (the session row stays valid) — call after
// mutating org fields baked into the session user, or the header/settings
// serve up-to-60s-stale data until the TTL lapses.
export async function invalidateSessionCache(sessionId: string) {
  if (redis) {
    await redis.del(`${SESSION_CACHE_PREFIX}${sessionId}`);
  }
}

export async function invalidateSession(sessionId: string) {
  await db.delete(orgSessionTable).where(eq(orgSessionTable.id, sessionId));
  await invalidateSessionCache(sessionId);
}

// Revoke ALL of an org's sessions (e.g. on password change) and drop their
// cached entries so a changed password can't be bypassed via a cache hit.
export async function invalidateOrgSessions(orgId: string) {
  const sessions = await db
    .select({ id: orgSessionTable.id })
    .from(orgSessionTable)
    .where(eq(orgSessionTable.orgId, orgId));

  await db.delete(orgSessionTable).where(eq(orgSessionTable.orgId, orgId));

  if (redis && sessions.length > 0) {
    const client = redis;
    await Promise.all(
      sessions.map((s) => client.del(`${SESSION_CACHE_PREFIX}${s.id}`)),
    );
  }
}

export type SessionValidationResult =
  | { session: SelectOrgSession; user: SessionOrg }
  | { session: null; user: null };
