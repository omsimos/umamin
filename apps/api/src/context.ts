import {
  createSession,
  generateSessionToken,
  setSessionTokenCookie,
} from "@umamin/core/session";
import { ApiError, parseJson } from "./http";
import { cookieWriter, getSession } from "./session";
import type { AppContext } from "./types";

export const jsonBody = parseJson;

export async function requireSession(c: AppContext) {
  const session = await getSession(c);
  if (!session.session) {
    throw new ApiError(401, "UNAUTHORIZED", "Unauthorized");
  }
  return session;
}

export async function setNewSession(c: AppContext, userId: string) {
  const sessionToken = generateSessionToken();
  const session = await createSession(sessionToken, userId);
  setSessionTokenCookie(
    cookieWriter(c),
    sessionToken,
    new Date(session.expiresAt),
  );
}
