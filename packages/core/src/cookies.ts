const isProduction = process.env.NODE_ENV === "production";
const usesSharedCookieDomain =
  isProduction && !!process.env.SESSION_COOKIE_DOMAIN;

export const SESSION_COOKIE_NAME = isProduction
  ? usesSharedCookieDomain
    ? "__Secure-session"
    : "__Host-session"
  : "session";
export const LEGACY_SESSION_COOKIE_NAME = "session";

export const GOOGLE_OAUTH_STATE_COOKIE_NAME = isProduction
  ? usesSharedCookieDomain
    ? "__Secure-google_oauth_state"
    : "__Host-google_oauth_state"
  : "google_oauth_state";
export const GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME = isProduction
  ? usesSharedCookieDomain
    ? "__Secure-google_code_verifier"
    : "__Host-google_code_verifier"
  : "google_code_verifier";

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
