// Cookie name contract — ported verbatim from apps/www/lib/cookies.ts. Keeping
// the exact names is what lets live sessions survive the DNS cutover (the plan's
// "cookie names unchanged" invariant): in production the token cookie is
// `__Host-session`, the legacy fallback is `session`.
//
// NOTE (Phase 2/3): `process.env.NODE_ENV` must resolve to "production" in the
// deployed Worker for `__Host-*` names to be chosen. Vite stamps NODE_ENV at
// build; if a deploy ever reads it as undefined the dev names would be used and
// sessions would NOT carry over — verify at cutover.
const isProduction = process.env.NODE_ENV === "production";

export const SESSION_COOKIE_NAME = isProduction ? "__Host-session" : "session";
export const LEGACY_SESSION_COOKIE_NAME = "session";

// Renewal marker: a non-secret timestamp (ms) of when the middleware last slid
// the session cookie's browser lifetime forward. Carries no auth value.
export const SESSION_RENEWED_COOKIE_NAME = isProduction
  ? "__Host-session_r"
  : "session_r";

export const GOOGLE_OAUTH_STATE_COOKIE_NAME = isProduction
  ? "__Host-google_oauth_state"
  : "google_oauth_state";
export const GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME = isProduction
  ? "__Host-google_code_verifier"
  : "google_code_verifier";
export const GOOGLE_OAUTH_INTENT_COOKIE_NAME = isProduction
  ? "__Host-google_oauth_intent"
  : "google_oauth_intent";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export function readCookieValue(
  cookieStore: CookieReader,
  primaryName: string,
  legacyName?: string,
) {
  return (
    cookieStore.get(primaryName)?.value ??
    (legacyName && legacyName !== primaryName
      ? cookieStore.get(legacyName)?.value
      : null) ??
    null
  );
}
