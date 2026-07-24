import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { LEGACY_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "./cookies";

// Session cookie writer — the hono/cookie equivalent of apps/www's
// cookies().set in lib/session.ts. Same attributes (httpOnly, sameSite=lax,
// secure in prod, path=/) and the SAME NAMES from cookies.ts, which is what lets
// live sessions survive the DNS cutover. When the primary name differs from the
// legacy one (production `__Host-session`), the legacy cookie is blanked so a
// stale `session` value can't shadow the new token.
export function setSessionCookie(
  c: Context,
  token: string,
  expiresAt: Date,
): void {
  const secure = process.env.NODE_ENV === "production";
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure,
    expires: expiresAt,
    path: "/",
  });

  if (LEGACY_SESSION_COOKIE_NAME !== SESSION_COOKIE_NAME) {
    setCookie(c, LEGACY_SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "Lax",
      secure,
      maxAge: 0,
      path: "/",
    });
  }
}

export function deleteSessionCookie(c: Context): void {
  // hono/cookie rejects a __Host- name without Secure, so the deletion must
  // carry the same secure flag the cookie was set with.
  const secure = process.env.NODE_ENV === "production";
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/", secure });
  if (LEGACY_SESSION_COOKIE_NAME !== SESSION_COOKIE_NAME) {
    deleteCookie(c, LEGACY_SESSION_COOKIE_NAME, { path: "/", secure });
  }
}
