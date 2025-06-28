import { sha256 } from "@oslojs/crypto/sha2";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";
import {
  InsertSession,
  SelectSession,
  SelectUser,
  sessionTable,
} from "@umamin/db/schema/user";
import { db } from "@umamin/db/index";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

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
  const result = await db.query.sessionTable.findFirst({
    where: eq(sessionTable.id, sessionId),
    with: {
      user: true,
    },
  });

  if (!result) {
    return { session: null, user: null };
  }

  const { user, ...session } = result;
  if (Date.now() >= session.expiresAt) {
    await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
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

  return { session, user };
}

export async function setSessionTokenCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSessionTokenCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}

export async function invalidateSession(sessionId: string) {
  await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
}

export type SessionValidationResult =
  | { session: SelectSession; user: SelectUser }
  | { session: null; user: null };
