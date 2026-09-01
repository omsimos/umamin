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
import { getCookie, setCookie } from "hono/cookie";
import { nanoid } from "nanoid";
import * as z from "zod";
import { generateUsernameId } from "../../server-lib/content";
import type { AppBindings } from "../../server-lib/context";
import {
  GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
  GOOGLE_OAUTH_INTENT_COOKIE_NAME,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
} from "../../server-lib/cookies";
import { getDb } from "../../server-lib/db";
import { formatErrorChain } from "../../server-lib/errors";
import { extractClientIp } from "../../server-lib/ip";
import { isIpDenied } from "../../server-lib/ip-denylist";
import { buildGoogle } from "../../server-lib/oauth";
import { captureRequestException } from "../../server-lib/posthog";
import { checkRateLimit } from "../../server-lib/ratelimit";
import {
  createSession,
  generateSessionToken,
  resolveSession,
} from "../../server-lib/session";
import { setSessionCookie } from "../../server-lib/session-cookie";

// Google OAuth initiator + callback ported as Hono GET routes at the SAME PATHS
// as apps/www (/auth/google, /auth/google/callback — redirects, not /api). arctic
// is fetch-based (Workers-safe). State/PKCE cookies, picture-host pinning,
// denylist + rate-limit checks, upsert, and session mint are all preserved;
// revalidateTag is dropped. The orchestrator mounts this at /auth/google.

const OAUTH_COOKIE_MAX_AGE = 60 * 10;

function setOauthCookie(
  c: Parameters<typeof getCookie>[0],
  name: string,
  value: string,
  maxAge: number,
) {
  setCookie(c, name, value, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge,
    sameSite: "Lax",
  });
}

const claimsSchema = z.object({
  sub: z.string(),
  // Pinned to Google's own CDN — imageUrl renders as a raw <img src>.
  picture: z
    .url()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      try {
        const url = new URL(value);
        return url.protocol === "https:" &&
          url.hostname === "lh3.googleusercontent.com"
          ? value
          : undefined;
      } catch {
        return undefined;
      }
    }),
  email: z.email(),
});

export const googleAuthApp = new Hono<AppBindings>()
  .get("/", (c) => {
    // Only "register" may create a new account in the callback.
    const intent = c.req.query("intent") === "register" ? "register" : "login";

    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = buildGoogle(c.env).createAuthorizationURL(state, codeVerifier, [
      "openid",
      "profile",
      "email",
    ]);

    setOauthCookie(
      c,
      GOOGLE_OAUTH_INTENT_COOKIE_NAME,
      intent,
      OAUTH_COOKIE_MAX_AGE,
    );
    setOauthCookie(
      c,
      GOOGLE_OAUTH_STATE_COOKIE_NAME,
      state,
      OAUTH_COOKIE_MAX_AGE,
    );
    setOauthCookie(
      c,
      GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
      codeVerifier,
      OAUTH_COOKIE_MAX_AGE,
    );

    return c.redirect(url.toString(), 302);
  })
  .get("/callback", async (c) => {
    const code = c.req.query("code") ?? null;
    const state = c.req.query("state") ?? null;

    const storedState = getCookie(c, GOOGLE_OAUTH_STATE_COOKIE_NAME) ?? null;
    const codeVerifier =
      getCookie(c, GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME) ?? null;
    const intent = getCookie(c, GOOGLE_OAUTH_INTENT_COOKIE_NAME) ?? null;

    const clearOauthCookies = () => {
      setOauthCookie(c, GOOGLE_OAUTH_STATE_COOKIE_NAME, "", 0);
      setOauthCookie(c, GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME, "", 0);
      setOauthCookie(c, GOOGLE_OAUTH_INTENT_COOKIE_NAME, "", 0);
    };

    if (
      code === null ||
      state === null ||
      storedState === null ||
      codeVerifier === null
    ) {
      return c.body(null, 400);
    }

    clearOauthCookies();

    if (state !== storedState) {
      return c.body(null, 400);
    }

    const ip = extractClientIp((n) => c.req.header(n));
    if (await isIpDenied(c.env.KV, ip)) {
      return c.body(null, 403);
    }
    if (!(await checkRateLimit(c.env, "auth", `oauth:google:${ip}`))) {
      return c.body(null, 429);
    }

    const db = getDb(c.env);
    const google = buildGoogle(c.env);

    let tokens: OAuth2Tokens;
    try {
      tokens = await google.validateAuthorizationCode(code, codeVerifier);
    } catch {
      return c.body(null, 400);
    }

    try {
      const claims = claimsSchema.safeParse(decodeIdToken(tokens.idToken()));
      if (!claims.success) {
        console.log("Invalid ID token claims");
        return c.body(null, 400);
      }

      const googleUser = claims.data;
      const { user } = await resolveSession(c, db);

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
        return c.redirect("/settings?error=already_linked", 302);
      } else if (user) {
        await db.transaction(async (tx) => {
          // Linking never touches imageUrl: the default profile picture is the
          // account's own blobatar, and adopting a Google photo would silently
          // change how someone looks to everyone else. `picture` is stored for
          // the linked-account card only.
          await tx.insert(accountTable).values({
            providerId: "google",
            providerUserId: googleUser.sub,
            userId: user.id,
            picture: googleUser.picture ?? "",
            email: googleUser.email,
          });
        });

        return c.redirect("/settings", 302);
      }

      if (existingUser) {
        // Google proved this identity, so a banned account can be told why.
        const [targetUser] = await db
          .select({ bannedAt: userTable.bannedAt })
          .from(userTable)
          .where(eq(userTable.id, existingUser.userId))
          .limit(1);

        if (targetUser?.bannedAt) {
          return c.redirect("/banned", 302);
        }

        const sessionToken = generateSessionToken();
        const session = await createSession(
          db,
          sessionToken,
          existingUser.userId,
        );
        setSessionCookie(c, sessionToken, new Date(session.expiresAt));

        return c.redirect("/inbox", 302);
      }

      // No linked account, nobody signed in — only "register" may provision one.
      if (intent !== "register") {
        return c.redirect("/login?error=no_account", 302);
      }

      const usernameId = generateUsernameId();
      const userId = nanoid();

      await db.transaction(async (tx) => {
        await tx.insert(userTable).values({
          id: userId,
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
      const session = await createSession(db, sessionToken, userId);
      setSessionCookie(c, sessionToken, new Date(session.expiresAt));

      return c.redirect("/inbox", 302);
    } catch (err) {
      console.error("oauth_callback_failed", formatErrorChain(err));
      // A provider-side OAuth rejection is a user/provider outcome, not a bug.
      if (err instanceof OAuth2RequestError) {
        return c.body(null, 400);
      }
      captureRequestException(c, err, {
        properties: { oauth: "google", intent },
      });
      return c.body(null, 500);
    }
  });

export type GoogleAuthType = typeof googleAuthApp;
