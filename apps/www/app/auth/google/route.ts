import { generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import {
  GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
} from "@/lib/cookies";
import { google } from "@/lib/oauth";

export async function GET() {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const scopes = ["openid", "profile", "email"];
  const url = google.createAuthorizationURL(state, codeVerifier, scopes);

  const cookieStore = await cookies();

  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, state, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    sameSite: "lax",
  });

  cookieStore.set(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME, codeVerifier, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    sameSite: "lax",
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
    },
  });
}
