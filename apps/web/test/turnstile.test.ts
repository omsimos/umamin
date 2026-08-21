import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../src/server-lib/env";
import {
  isTurnstileEnabled,
  verifyTurnstile,
} from "../src/server-lib/turnstile";

const REQUEST = { host: "www.umamin.link", ip: "203.0.113.7" };

const envWith = (secret?: string) => ({ TURNSTILE_SECRET: secret }) as AppEnv;

// siteverify's shape, not a stand-in for our logic: every assertion below is
// about what we do with a given response.
function mockSiteverify(body: unknown, init: { ok?: boolean } = {}) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: init.ok ?? true,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const PASS = {
  success: true,
  action: "login",
  hostname: "www.umamin.link",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verifyTurnstile", () => {
  it("accepts a token siteverify approves for the right action and host", async () => {
    const fetchMock = mockSiteverify(PASS);

    await expect(
      verifyTurnstile(envWith("secret"), "token", "login", REQUEST),
    ).resolves.toBe(true);

    // The client IP rides along so Cloudflare can score the solve.
    const body = String(fetchMock.mock.calls[0]?.[1]?.body);
    expect(body).toContain(`remoteip=${encodeURIComponent(REQUEST.ip)}`);
    expect(body).toContain("secret=secret");
  });

  it("rejects a token minted for the other form", async () => {
    mockSiteverify({ ...PASS, action: "login" });

    // Same valid token, replayed against signup: siteverify says success, the
    // action check is the only thing standing between the two endpoints.
    await expect(
      verifyTurnstile(envWith("secret"), "token", "signup", REQUEST),
    ).resolves.toBe(false);
  });

  it("rejects a token solved on another origin", async () => {
    mockSiteverify({ ...PASS, hostname: "phish.example" });

    await expect(
      verifyTurnstile(envWith("secret"), "token", "login", REQUEST),
    ).resolves.toBe(false);
  });

  it("rejects when siteverify declines", async () => {
    mockSiteverify({
      success: false,
      "error-codes": ["invalid-input-response"],
    });

    await expect(
      verifyTurnstile(envWith("secret"), "token", "login", REQUEST),
    ).resolves.toBe(false);
  });

  // Fails CLOSED, unlike the rate limiter: an unverifiable token is no evidence.
  it.each([
    ["a non-2xx from siteverify", () => mockSiteverify(PASS, { ok: false })],
    [
      "a network throw",
      () =>
        vi.stubGlobal(
          "fetch",
          vi.fn(async () => {
            throw new Error("boom");
          }),
        ),
    ],
  ])("rejects on %s", async (_label, stub) => {
    stub();

    await expect(
      verifyTurnstile(envWith("secret"), "token", "login", REQUEST),
    ).resolves.toBe(false);
  });

  it.each([
    [""],
    [undefined],
    [null],
    [{}],
    [12],
  ])("rejects a missing or non-string token (%s) without calling siteverify", async (token) => {
    const fetchMock = mockSiteverify(PASS);

    await expect(
      verifyTurnstile(envWith("secret"), token, "login", REQUEST),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Configured-means-on. Both halves have to agree, or local dev and the test
  // suites could never sign in — the client renders no widget without a site
  // key, so there is no token to send.
  it("skips verification entirely when no secret is configured", async () => {
    const fetchMock = mockSiteverify(PASS);

    await expect(
      verifyTurnstile(envWith(undefined), undefined, "login", REQUEST),
    ).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isTurnstileEnabled(envWith(undefined))).toBe(false);
    expect(isTurnstileEnabled(envWith("secret"))).toBe(true);
  });
});
