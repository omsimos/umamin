import { z } from "zod/v4";
import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { db } from "@umamin/db/index";
import { cookies } from "next/headers";
import { decodeIdToken, OAuth2RequestError, type OAuth2Tokens } from "arctic";
import { accountTable, userTable } from "@umamin/db/schema/user";

import {
  createSession,
  generateSessionToken,
  setSessionTokenCookie,
} from "@/lib/session";
import { google } from "@/lib/oauth";
import { getSession } from "@/lib/auth";
import { generateUsernameId } from "@/lib/utils";

const claimsSchema = z.object({
  sub: z.string(),
  picture: z.string(),
  email: z.email(),
});

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const storedState =
    (await cookies()).get("google_oauth_state")?.value ?? null;
  const codeVerifier =
    (await cookies()).get("google_code_verifier")?.value ?? null;

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

  if (state !== storedState) {
    return new Response(null, {
      status: 400,
    });
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

    const existingUser = await db.query.accountTable.findFirst({
      where: and(
        eq(accountTable.providerId, "google"),
        eq(accountTable.providerUserId, googleUser.sub),
      ),
    });

    if (user && existingUser) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/settings?error=already_linked",
        },
      });
    } else if (user) {
      await db
        .update(userTable)
        .set({
          imageUrl: googleUser.picture,
        })
        .where(eq(userTable.id, user.id));

      await db.insert(accountTable).values({
        providerId: "google",
        providerUserId: googleUser.sub,
        userId: user.id,
        picture: googleUser.picture,
        email: googleUser.email,
      });

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
      setSessionTokenCookie(sessionToken, new Date(session.expiresAt));

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/login",
        },
      });
    }

    const usernameId = generateUsernameId();
    const userId = nanoid();

    await db.batch([
      db.insert(userTable).values({
        id: userId,
        imageUrl: googleUser.picture,
        username: `user_${usernameId}`,
      }),
      db.insert(accountTable).values({
        providerId: "google",
        providerUserId: googleUser.sub,
        userId,
        picture: googleUser.picture,
        email: googleUser.email,
      }),
    ]);

    const sessionToken = generateSessionToken();
    const session = await createSession(sessionToken, userId);
    setSessionTokenCookie(sessionToken, new Date(session.expiresAt));

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/login",
      },
    });
  } catch (err) {
    console.log(err);
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
