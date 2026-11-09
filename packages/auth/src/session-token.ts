import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "./encoding";

// A session token lives only in the user's cookie. The database stores its
// SHA-256 hash as the session id, so a leaked sessions table can't be replayed
// as cookies.

// 20 random bytes (160 bits), base32 so the cookie value is URL-safe.
export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

// Lowercase hex SHA-256 of the token. Every stored session id is this exact
// string: changing the hash or its encoding signs out every user in both apps.
export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return encodeHexLowerCase(new Uint8Array(digest));
}
