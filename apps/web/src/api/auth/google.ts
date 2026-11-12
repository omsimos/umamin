import {
  createAuthorizationURL,
  decodeIdTokenClaims,
  exchangeAuthorizationCode,
  generateCodeVerifier,
  generateState,
} from "@umamin/auth/google";
import { accountTable, userTable } from "@umamin/db/schema/user";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { nanoid } from "nanoid";
import * as z from "zod";
import type { GoogleAuthErrorCode } from "../../lib/google-auth-errors";
import { generateUsernameId } from "../../server-lib/content";
import type { AppBindings } from "../../server-lib/context";
import {
  GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
  GOOGLE_OAUTH_INTENT_COOKIE_NAME,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
} from "../../server-lib/cookies";
import { getDb } from "../../server-lib/db";
import { formatErrorChain } from "../../server-lib/errors";
import { extractClientIp, rateLimitKeyForIp } from "../../server-lib/ip";
import { isIpDenied } from "../../server-lib/ip-denylist";
import { googleOAuthConfig } from "../../server-lib/oauth";
import { captureRequestException } from "../../server-lib/posthog";
import { checkRateLimit } from "../../server-lib/ratelimit";
import {
  createSession,
  generateSessionToken,
  hasSessionCredential,
  resolveSession,
} from "../../server-lib/session";
import { setSessionCookie } from "../../server-lib/session-cookie";

// Google OAuth initiator + callback ported as Hono GET routes at the SAME PATHS
// as apps/www (/auth/google, /auth/google/callback — redirects, not /api). The
// OAuth client in @umamin/auth/google is fetch-based (Workers-safe). State/PKCE cookies, picture-host pinning,
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
  .get("/", async (c) => {
    // Only "register" may create a new account in the callback, and only
    // "link" may attach a Google identity to the signed-in profile.
    const requested = c.req.query("intent");
    const intent =
      requested === "register" || requested === "link" ? requested : "login";

    if (intent === "link" && !hasSessionCredential(c)) {
      return c.redirect("/login", 302);
    }

    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = await createAuthorizationURL(googleOAuthConfig(c.env), {
      state,
      codeVerifier,
      scopes: ["openid", "profile", "email"],
    });

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
    clearOauthCookies();

    // A signed-in visitor is bounced off /login, so they see errors on
    // /settings. Cookie presence only: no database read on a failure path.
    const fail = (code: GoogleAuthErrorCode) =>
      c.redirect(
        `${hasSessionCredential(c) ? "/settings" : "/login"}?error=${code}`,
        302,
      );

    if (c.req.query("error") !== undefined) return fail("cancelled");

    if (
      code === null ||
      state === null ||
      storedState === null ||
      codeVerifier === null
    ) {
      return fail("expired");
    }

    if (state !== storedState) {
      return fail("expired");
    }

    const ip = extractClientIp((n) => c.req.header(n));
    if (await isIpDenied(c.env.KV, ip)) {
      return fail("blocked");
    }
    if (
      !(await checkRateLimit(
        c.env,
        "auth",
        `oauth:google:${rateLimitKeyForIp(ip)}`,
      ))
    ) {
      return fail("rate_limited");
    }

    const db = getDb(c.env);

    // A rejected or replayed code is a user/provider outcome, not a bug.
    let idToken: string;
    try {
      ({ idToken } = await exchangeAuthorizationCode(
        googleOAuthConfig(c.env),
        code,
        codeVerifier,
      ));
    } catch {
      return fail("failed");
    }

    try {
      const claims = claimsSchema.safeParse(decodeIdTokenClaims(idToken));
      if (!claims.success) {
        console.log("Invalid ID token claims");
        return fail("failed");
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

      if (intent === "link") {
        // The session ended between Settings and Google.
        if (!user) return fail("expired");

        if (existingUser) {
          return existingUser.userId === user.id
            ? c.redirect("/settings?tab=account", 302)
            : fail("already_linked");
        }

        // Linking never touches imageUrl: the default profile picture is the
        // account's own blobatar, and adopting a Google photo would silently
        // change how someone looks to everyone else. `picture` is stored for
        // the linked-account card only.
        //
        // One statement, so two callbacks racing for the same profile can't
        // both link.
        const linked = await db.run(sql`
          INSERT INTO oauth_account (provider_user_id, email, picture, user_id, provider_id)
          SELECT ${googleUser.sub}, ${googleUser.email}, ${googleUser.picture ?? ""}, ${user.id}, 'google'
          WHERE NOT EXISTS (
            SELECT 1 FROM oauth_account
            WHERE user_id = ${user.id} AND provider_id = 'google'
          )
        `);
        if (linked.rowsAffected === 0) return fail("has_google");

        return c.redirect("/settings?tab=account", 302);
      }

      // Signed in, but this flow started on /login or /register. Sign-in
      // never changes which identities a profile has.
      if (user) return c.redirect("/inbox", 302);

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
      captureRequestException(c, err, {
        properties: { oauth: "google", intent },
      });
      return fail("failed");
    }
  });

export type GoogleAuthType = typeof googleAuthApp;
