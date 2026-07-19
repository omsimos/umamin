"use server";

import { db } from "@umamin/org-db";
import {
  hashPassword,
  normalizeUsername,
  USERNAME_REGEX,
  verifyPassword,
} from "@umamin/org-db/auth";
import { orgTable } from "@umamin/org-db/schema/org";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE_NAME } from "./cookies";
import { checkRateLimit, getClientIp, RATE_LIMIT_ERROR } from "./ratelimit";
import {
  deleteSessionTokenCookie,
  invalidateSession,
  mintSessionCookie,
  type SessionValidationResult,
  validateSessionToken,
} from "./session";

const INVALID_CREDENTIALS = "Incorrect username or password";

export const getSession = cache(async (): Promise<SessionValidationResult> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  if (!token) {
    return { session: null, user: null };
  }
  return validateSessionToken(token);
});

// Never throws on a missing/expired session — "Sign out" with a dead cookie
// should land on the login page, not the error boundary.
export async function logout() {
  const { session } = await getSession();
  if (session) {
    await invalidateSession(session.id);
  }
  await deleteSessionTokenCookie();
  redirect("/login");
}

export async function login(_initialState: unknown, formData: FormData) {
  const rawUsername = formData.get("username");
  const username =
    typeof rawUsername === "string" ? normalizeUsername(rawUsername) : "";

  if (!USERNAME_REGEX.test(username)) {
    return { error: INVALID_CREDENTIALS };
  }

  const password = formData.get("password");
  if (
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 255
  ) {
    return { error: INVALID_CREDENTIALS };
  }

  // Throttle before the DB lookup + Argon2 verify so brute force can't burn CPU.
  // No-ops until Redis is configured (e.g. local dev).
  const ip = await getClientIp();
  if (!(await checkRateLimit("auth", `login:${ip}`))) {
    return { error: RATE_LIMIT_ERROR };
  }

  try {
    const [org] = await db
      .select()
      .from(orgTable)
      .where(eq(orgTable.username, username))
      .limit(1);

    if (!org) {
      // Spend comparable Argon2 CPU on the not-found path so login response
      // time doesn't reveal which usernames exist (enumeration oracle).
      await hashPassword(password).catch(() => undefined);
      return { error: INVALID_CREDENTIALS };
    }

    const validPassword = await verifyPassword(org.passwordHash, password);
    if (!validPassword) {
      return { error: INVALID_CREDENTIALS };
    }

    await mintSessionCookie(org.id);
  } catch (err) {
    console.error("Login error:", err);
    return { error: "An unexpected error occurred" };
  }

  redirect("/dashboard");
}
