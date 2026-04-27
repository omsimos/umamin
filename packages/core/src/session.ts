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
import {
  LEGACY_SESSION_COOKIE_NAME,
  readCookieValue,
  SESSION_COOKIE_NAME,
} from "./cookies";

export type CookieReader = {
  get(name: string): string | undefined;
};

export type CookieWriter = {
  set(name: string, value: string, options: SessionCookieOptions): void;
};

export type SessionCookieOptions = {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  expires?: Date;
  maxAge?: number;
  path: string;
  domain?: string;
};

export type SessionValidationResult =
  | { session: SelectSession; user: SelectUser }
  | { session: null; user: null };

export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
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

  if (Date.now() >= session.expiresAt - 1000 * 60 * 60 * 24 * 15) {
    session.expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;

    await db
      .update(sessionTable)
      .set({ expiresAt: session.expiresAt })
      .where(eq(sessionTable.id, sessionId));
  }

  return { session, user };
}

export async function validateSessionFromCookies(
  cookies: CookieReader,
): Promise<SessionValidationResult> {
  const token = readCookieValue(
    {
      get: (name) =>
        cookies.get(name) ? { value: cookies.get(name) ?? "" } : undefined,
    },
    SESSION_COOKIE_NAME,
    LEGACY_SESSION_COOKIE_NAME,
  );

  if (!token) {
    return { session: null, user: null };
  }

  return validateSessionToken(token);
}

export function setSessionTokenCookie(
  cookies: CookieWriter,
  token: string,
  expiresAt: Date,
) {
  const domain =
    process.env.NODE_ENV === "production"
      ? process.env.SESSION_COOKIE_DOMAIN
      : undefined;

  cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
    domain,
  });

  clearLegacySessionCookie(cookies);
}

export function deleteSessionTokenCookie(cookies: CookieWriter) {
  const domain =
    process.env.NODE_ENV === "production"
      ? process.env.SESSION_COOKIE_DOMAIN
      : undefined;

  cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
    domain,
  });

  clearLegacySessionCookie(cookies);
}

function clearLegacySessionCookie(cookies: CookieWriter) {
  if (LEGACY_SESSION_COOKIE_NAME === SESSION_COOKIE_NAME) {
    return;
  }

  cookies.set(LEGACY_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
    domain:
      process.env.NODE_ENV === "production"
        ? process.env.SESSION_COOKIE_DOMAIN
        : undefined,
  });
}

export async function invalidateSession(sessionId: string) {
  await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
}
