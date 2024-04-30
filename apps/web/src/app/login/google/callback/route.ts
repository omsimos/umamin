import { generateId } from "lucia";
import { cookies } from "next/headers";
import { OAuth2RequestError } from "arctic";

import { google, lucia } from "@/lib/auth";
import { db, eq, schema } from "@umamin/server";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const storedState = cookies().get("google_oauth_state")?.value ?? null;
  const storedCodeVerifier = cookies().get("code_verifier")?.value ?? null;

  if (
    !code ||
    !state ||
    !storedState ||
    !storedCodeVerifier ||
    state !== storedState
  ) {
    return new Response(null, {
      status: 400,
    });
  }

  try {
    const tokens = await google.validateAuthorizationCode(
      code,
      storedCodeVerifier,
    );

    const googleUserResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      },
    );

    const googleUser: GoogleUser = await googleUserResponse.json();

    const existingUser = await db.query.user.findFirst({
      where: eq(schema.user.googleId, googleUser.sub),
    });

    if (existingUser) {
      const session = await lucia.createSession(existingUser.id, {});
      const sessionCookie = lucia.createSessionCookie(session.id);

      cookies().set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/login",
        },
      });
    }

    const usernameId = generateId(5);

    const user = await db
      .insert(schema.user)
      .values({
        googleId: googleUser.sub,
        username: `${googleUser.given_name.split(" ").join("").toLowerCase()}_${usernameId}`,
        imageUrl: googleUser.picture,
        email: googleUser.email,
      })
      .returning({ userId: schema.user.id });

    const session = await lucia.createSession(user[0].userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/login",
      },
    });
  } catch (err: any) {
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

interface GoogleUser {
  sub: string;
  given_name: string;
  picture: string;
  email: string;
}
