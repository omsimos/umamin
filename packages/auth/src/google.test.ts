import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAuthorizationURL,
  decodeIdTokenClaims,
  exchangeAuthorizationCode,
  GoogleOAuthError,
  generateCodeVerifier,
  generateState,
} from "./google";

const config = {
  clientId: "client-id.apps.googleusercontent.com",
  clientSecret: "secret_123",
  redirectUri: "https://umamin.test/auth/google/callback",
};

// RFC 7636 appendix B.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateState / generateCodeVerifier", () => {
  it("returns 43-character base64url strings, fresh each call", () => {
    for (const make of [generateState, generateCodeVerifier]) {
      const value = make();
      expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(make()).not.toBe(value);
    }
  });
});

describe("createAuthorizationURL", () => {
  it("builds Google's PKCE authorization URL", async () => {
    const url = await createAuthorizationURL(config, {
      state: "state-1",
      codeVerifier: VERIFIER,
      scopes: ["openid", "profile", "email"],
    });
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state: "state-1",
      code_challenge_method: "S256",
      code_challenge: CHALLENGE,
      scope: "openid profile email",
    });
  });
});

describe("exchangeAuthorizationCode", () => {
  it("posts the code and verifier with Basic client auth", async () => {
    const fetchMock = stubFetch(200, { id_token: "a.b.c", access_token: "x" });
    await expect(
      exchangeAuthorizationCode(config, "auth-code", VERIFIER),
    ).resolves.toEqual({ idToken: "a.b.c" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    );
    expect(headers.get("content-type")).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(Object.fromEntries(init?.body as URLSearchParams)).toEqual({
      grant_type: "authorization_code",
      code: "auth-code",
      redirect_uri: config.redirectUri,
      code_verifier: VERIFIER,
    });
  });

  it("surfaces Google's error code when the code is rejected", async () => {
    stubFetch(400, {
      error: "invalid_grant",
      error_description: "Bad Request",
    });
    const err = await exchangeAuthorizationCode(config, "used", VERIFIER).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(GoogleOAuthError);
    expect(err).toMatchObject({ status: 400, code: "invalid_grant" });
  });

  it("rejects a non-JSON error page and a success without an ID token", async () => {
    stubFetch(502, "<html>bad gateway</html>");
    await expect(
      exchangeAuthorizationCode(config, "c", VERIFIER),
    ).rejects.toMatchObject({ status: 502, code: null });

    stubFetch(200, { access_token: "x" });
    await expect(
      exchangeAuthorizationCode(config, "c", VERIFIER),
    ).rejects.toBeInstanceOf(GoogleOAuthError);
  });
});

describe("decodeIdTokenClaims", () => {
  it("returns the payload of a three-part token", () => {
    const claims = { sub: "123", email: "a@b.c", name: "Ñoño ✓" };
    const token = `${b64url({ alg: "RS256" })}.${b64url(claims)}.sig`;
    expect(decodeIdTokenClaims(token)).toEqual(claims);
  });

  it("throws on malformed tokens", () => {
    expect(() => decodeIdTokenClaims("only.two")).toThrow("Invalid ID token");
    expect(() => decodeIdTokenClaims("a.!!!.c")).toThrow("Invalid ID token");
    expect(() => decodeIdTokenClaims(`a.${b64url("text")}.c`)).toThrow(
      "Invalid ID token",
    );
  });
});
