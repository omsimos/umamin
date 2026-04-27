import {
  GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  google,
  loginWithPassword,
  registerSchema,
  signupWithPassword,
} from "@umamin/core";
import {
  deleteSessionTokenCookie,
  invalidateSession,
} from "@umamin/core/session";
import { db } from "@umamin/db";
import { accountTable, userTable } from "@umamin/db/schema/user";
import {
  decodeIdToken,
  generateCodeVerifier,
  generateState,
  OAuth2RequestError,
  type OAuth2Tokens,
} from "arctic";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import * as z from "zod";
import { cookieDomain, webOrigin } from "../config";
import { jsonBody, requireSession, setNewSession } from "../context";
import { ApiError, privateNoStore, resultJson } from "../http";
import { cookieReader, cookieWriter, getSession } from "../session";
import type { AppContext, AppEnv } from "../types";

export const authRoutes = new Hono<AppEnv>();

function oauthCookieOptions(maxAge: number) {
  return {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge,
    sameSite: "lax" as const,
    domain: cookieDomain(),
  };
}

function redirectToWeb(c: AppContext, path: string) {
  return c.redirect(new URL(path, webOrigin()).toString(), 302);
}

authRoutes.get("/api/auth/session", async (c) => {
  privateNoStore(c);
  const result = await getSession(c);
  if (!result.user) return c.json({ session: null, user: null });
  const { passwordHash: _passwordHash, ...user } = result.user;
  return c.json({ session: result.session, user });
});

authRoutes.post("/api/auth/login", async (c) => {
  privateNoStore(c);
  const body = await c.req.parseBody();
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  const result = await loginWithPassword(username, password);
  if (!result.success) return resultJson(c, result);
  await setNewSession(c, result.userId);
  return c.json({ success: true });
});

authRoutes.post("/api/auth/signup", async (c) => {
  privateNoStore(c);
  const body = registerSchema.parse(await jsonBody(c));
  const result = await signupWithPassword(body);
  if (!result.success) return resultJson(c, result);
  await setNewSession(c, result.userId);
  return c.json({ success: true });
});

authRoutes.post("/api/auth/logout", async (c) => {
  privateNoStore(c);
  const result = await requireSession(c);
  await invalidateSession(result.session.id);
  deleteSessionTokenCookie(cookieWriter(c));
  return c.json({ success: true });
});

authRoutes.get("/auth/google", (c) => {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = google.createAuthorizationURL(state, codeVerifier, [
    "openid",
    "profile",
    "email",
  ]);
  const cookies = cookieWriter(c);
  cookies.set(
    GOOGLE_OAUTH_STATE_COOKIE_NAME,
    state,
    oauthCookieOptions(60 * 10),
  );
  cookies.set(
    GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
    codeVerifier,
    oauthCookieOptions(60 * 10),
  );
  return c.redirect(url.toString(), 302);
});

const claimsSchema = z.object({
  sub: z.string(),
  picture: z.string(),
  email: z.email(),
});

authRoutes.get("/auth/google/callback", async (c) => {
  const code = c.req.query("code") ?? null;
  const state = c.req.query("state") ?? null;
  const cookies = cookieReader(c);
  const storedState = cookies.get(GOOGLE_OAUTH_STATE_COOKIE_NAME) ?? null;
  const codeVerifier =
    cookies.get(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME) ?? null;
  const writer = cookieWriter(c);

  writer.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, "", oauthCookieOptions(0));
  writer.set(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME, "", oauthCookieOptions(0));

  if (
    !code ||
    !state ||
    !storedState ||
    !codeVerifier ||
    state !== storedState
  ) {
    throw new ApiError(400, "BAD_REQUEST", "Invalid OAuth callback");
  }

  let tokens: OAuth2Tokens;
  try {
    tokens = await google.validateAuthorizationCode(code, codeVerifier);
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Invalid OAuth code");
  }

  try {
    const claims = claimsSchema.parse(decodeIdToken(tokens.idToken()));
    const { user } = await getSession(c);
    const [existingUser] = await db
      .select()
      .from(accountTable)
      .where(
        and(
          eq(accountTable.providerId, "google"),
          eq(accountTable.providerUserId, claims.sub),
        ),
      )
      .limit(1);

    if (user && existingUser) {
      return redirectToWeb(c, "/settings?error=already_linked");
    }

    if (user) {
      await db
        .update(userTable)
        .set({ imageUrl: claims.picture })
        .where(eq(userTable.id, user.id));
      await db.insert(accountTable).values({
        providerId: "google",
        providerUserId: claims.sub,
        userId: user.id,
        picture: claims.picture,
        email: claims.email,
      });
      return redirectToWeb(c, "/settings");
    }

    if (existingUser) {
      await setNewSession(c, existingUser.userId);
      return redirectToWeb(c, "/inbox");
    }

    const userId = nanoid();
    await db.insert(userTable).values({
      id: userId,
      imageUrl: claims.picture,
      username: `user_${nanoid(12)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "0")}`,
    });
    await db.insert(accountTable).values({
      providerId: "google",
      providerUserId: claims.sub,
      userId,
      picture: claims.picture,
      email: claims.email,
    });
    await setNewSession(c, userId);
    return redirectToWeb(c, "/inbox");
  } catch (err) {
    if (err instanceof OAuth2RequestError) {
      throw new ApiError(400, "BAD_REQUEST", "OAuth request failed");
    }
    throw err;
  }
});
