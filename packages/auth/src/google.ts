import {
  decodeBase64urlIgnorePadding,
  encodeBase64urlNoPadding,
} from "./encoding";

// Google sign-in: the OAuth 2.0 authorization code flow with PKCE (S256).
// Replaces arctic's Google client and sends the same requests it did.

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleTokens = {
  idToken: string;
};

/**
 * The token endpoint answered with something other than tokens. `code` is
 * Google's OAuth error code (`invalid_grant` for a reused or expired code) when
 * the body had one.
 */
export class GoogleOAuthError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null, description?: string) {
    super(
      `Google token request failed (${status}${code ? ` ${code}` : ""})${
        description ? `: ${description}` : ""
      }`,
    );
    this.name = "GoogleOAuthError";
    this.status = status;
    this.code = code;
  }
}

function randomBase64url(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase64urlNoPadding(bytes);
}

export function generateState(): string {
  return randomBase64url();
}

export function generateCodeVerifier(): string {
  return randomBase64url();
}

async function createS256CodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return encodeBase64urlNoPadding(new Uint8Array(digest));
}

export async function createAuthorizationURL(
  config: GoogleOAuthConfig,
  options: { state: string; codeVerifier: string; scopes: string[] },
): Promise<URL> {
  const url = new URL(AUTHORIZATION_ENDPOINT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set(
    "code_challenge",
    await createS256CodeChallenge(options.codeVerifier),
  );
  if (options.scopes.length > 0) {
    url.searchParams.set("scope", options.scopes.join(" "));
  }
  return url;
}

/**
 * Trades the callback's `code` for tokens. Throws GoogleOAuthError when Google
 * rejects the request or the response has no ID token. A network failure
 * rejects with fetch's own error.
 */
export async function exchangeAuthorizationCode(
  config: GoogleOAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      // HTTP Basic client authentication, as arctic sent it. Google client ids
      // and secrets use only URL-safe characters, so no escaping is needed.
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
    },
    body,
  });

  const data: unknown = await response.json().catch(() => null);
  const record =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : null;

  if (!response.ok) {
    throw new GoogleOAuthError(
      response.status,
      typeof record?.error === "string" ? record.error : null,
      typeof record?.error_description === "string"
        ? record.error_description
        : undefined,
    );
  }
  if (typeof record?.id_token !== "string") {
    throw new GoogleOAuthError(response.status, null, "missing id_token");
  }
  return { idToken: record.id_token };
}

/**
 * Reads the ID token's payload without checking its signature. That is safe
 * only for a token taken straight from Google's token endpoint over TLS
 * (OpenID Connect Core 3.1.3.7), which is the only place callers get one.
 */
export function decodeIdTokenClaims(idToken: string): Record<string, unknown> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid ID token");
  let payload: unknown;
  try {
    const json = new TextDecoder().decode(
      decodeBase64urlIgnorePadding(parts[1] ?? ""),
    );
    payload = JSON.parse(json);
  } catch (cause) {
    throw new Error("Invalid ID token", { cause });
  }
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Invalid ID token");
  }
  return payload as Record<string, unknown>;
}
