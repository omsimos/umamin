const isProduction = process.env.NODE_ENV === "production";

export const SESSION_COOKIE_NAME = isProduction ? "__Host-session" : "session";
export const LEGACY_SESSION_COOKIE_NAME = "session";

// Renewal marker: a non-secret timestamp (ms) of when the proxy last slid the
// session cookie's browser lifetime forward. Lets the proxy skip the Set-Cookie
// on the vast majority of authed GETs and only re-slide periodically. Carries
// no auth value — the session token cookie is the credential — so a missing or
// forged marker can at worst trigger (or skip) a harmless maxAge refresh.
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
