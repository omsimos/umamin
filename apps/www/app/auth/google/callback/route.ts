import { db } from "@umamin/db";
import { accountTable, userTable } from "@umamin/db/schema/user";
import { decodeIdToken, OAuth2RequestError, type OAuth2Tokens } from "arctic";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import * as z from "zod";
import { getSession } from "@/lib/auth";
import {
  GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
  GOOGLE_OAUTH_INTENT_COOKIE_NAME,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
} from "@/lib/cookies";
import { google } from "@/lib/oauth";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import {
  createSession,
  generateSessionToken,
  setSessionTokenCookie,
} from "@/lib/session";
import { generateUsernameId } from "@/lib/utils";

const claimsSchema = z.object({
  sub: z.string(),
  // Optional so a missing picture never breaks sign-in; validated as a URL so we
  // don't persist garbage. (Value is Google-sourced over the TLS code exchange.)
  picture: z.url().optional(),
  email: z.email(),
});

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();

  const storedState =
    cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)?.value ?? null;
  const codeVerifier =
    cookieStore.get(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME)?.value ?? null;
  const intent =
    cookieStore.get(GOOGLE_OAUTH_INTENT_COOKIE_NAME)?.value ?? null;

  const clearOauthCookies = () => {
    cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, "", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      sameSite: "lax",
    });
    cookieStore.set(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME, "", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      sameSite: "lax",
    });
    cookieStore.set(GOOGLE_OAUTH_INTENT_COOKIE_NAME, "", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      sameSite: "lax",
    });
  };

  if (
    code === null ||
    state === null ||
    storedState === null ||
    codeVerifier === null
  ) {
    return new Response(null, {
      status: 400,
    });
  }

  clearOauthCookies();

  if (state !== storedState) {
    return new Response(null, {
      status: 400,
    });
  }

  // Throttle the outbound Google token exchange + DB writes per IP. State/PKCE
  // already gate CSRF; this stops floods of forged callbacks burning egress and
  // invocations before the expensive validateAuthorizationCode call.
  const ip = await getClientIp();
  if (!(await checkRateLimit("auth", `oauth:google:${ip}`))) {
    return new Response(null, { status: 429 });
  }

  let tokens: OAuth2Tokens;

  try {
    tokens = await google.validateAuthorizationCode(code, codeVerifier);
  } catch {
    return new Response(null, {
      status: 400,
    });
  }

  try {
    const claims = claimsSchema.safeParse(decodeIdToken(tokens.idToken()));

    if (!claims.success) {
      console.log("Invalid ID token claims");
      return new Response(null, {
        status: 400,
      });
    }

    const googleUser = claims.data;
    const { user } = await getSession();

    const [existingUser] = await db
      .select()
      .from(accountTable)
      .where(
        and(
          eq(accountTable.providerId, "google"),
          eq(accountTable.providerUserId, googleUser.sub),
        ),
      )
      .limit(1);

    if (user && existingUser) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/settings?error=already_linked",
        },
      });
    } else if (user) {
      await db.transaction(async (tx) => {
        // Only set the avatar if the user hasn't already chosen one — don't
        // clobber an existing Gravatar/custom picture on link.
        if (!user.imageUrl && googleUser.picture) {
          await tx
            .update(userTable)
            .set({ imageUrl: googleUser.picture })
            .where(eq(userTable.id, user.id));
        }

        await tx.insert(accountTable).values({
          providerId: "google",
          providerUserId: googleUser.sub,
          userId: user.id,
          picture: googleUser.picture ?? "",
          email: googleUser.email,
        });
      });

      // imageUrl/accounts may have changed -> refresh cached profile payloads.
      updateTag(`user:${user.username}`);
      updateTag(`user:${user.id}`);
      updateTag(`user:${user.id}:accounts`);

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/settings",
        },
      });
    }

    if (existingUser) {
      const sessionToken = generateSessionToken();
      const session = await createSession(sessionToken, existingUser.userId);
      await setSessionTokenCookie(sessionToken, new Date(session.expiresAt));

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/inbox",
        },
      });
    }

    // No linked account and nobody signed in. Only the register flow may create
    // one — a login attempt for an unknown Google account is sent back with an
    // error instead of silently provisioning a profile.
    if (intent !== "register") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/login?error=no_account",
        },
      });
    }

    const usernameId = generateUsernameId();
    const userId = nanoid();

    await db.transaction(async (tx) => {
      await tx.insert(userTable).values({
        id: userId,
        imageUrl: googleUser.picture,
        username: `user_${usernameId}`,
      });

      await tx.insert(accountTable).values({
        providerId: "google",
        providerUserId: googleUser.sub,
        userId,
        picture: googleUser.picture ?? "",
        email: googleUser.email,
      });
    });

    const sessionToken = generateSessionToken();
    const session = await createSession(sessionToken, userId);
    await setSessionTokenCookie(sessionToken, new Date(session.expiresAt));

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/inbox",
      },
    });
  } catch (err) {
    console.error("oauth_callback_failed");
    if (err instanceof OAuth2RequestError) {
      return new Response(null, {
        status: 400,
      });
    }

    return new Response(null, {
      status: 500,
    });
  }
}
