import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
  GOOGLE_OAUTH_INTENT_COOKIE_NAME,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
  readCookieValue,
  SESSION_COOKIE_NAME,
} from "./cookies";

type CookieEntry = { value: string };

// Minimal CookieReader fake: a Map-backed get(name) matching the source's
// `{ value: string } | undefined` shape.
function makeReader(entries: Record<string, string>) {
  const map = new Map<string, CookieEntry>(
    Object.entries(entries).map(([name, value]) => [name, { value }]),
  );
  return {
    get(name: string): CookieEntry | undefined {
      return map.get(name);
    },
  };
}

describe("readCookieValue", () => {
  it("returns the primary value when present", () => {
    const reader = makeReader({ session: "primary-token" });
    expect(readCookieValue(reader, "session", "legacy")).toBe("primary-token");
  });

  it("prefers the primary value even when a differing legacy value also exists", () => {
    const reader = makeReader({
      session: "primary-token",
      legacy: "old-token",
    });
    expect(readCookieValue(reader, "session", "legacy")).toBe("primary-token");
  });

  it("falls back to the legacy value when primary is absent and legacy differs", () => {
    const reader = makeReader({ legacy: "old-token" });
    expect(readCookieValue(reader, "session", "legacy")).toBe("old-token");
  });

  it("does not double-read when legacyName === primaryName (returns null when absent)", () => {
    const get = vi.fn<(name: string) => CookieEntry | undefined>(
      () => undefined,
    );
    const reader = { get };

    expect(readCookieValue(reader, "session", "session")).toBeNull();
    // The legacy branch is short-circuited when names match, so only the
    // primary lookup runs.
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("session");
  });

  it("returns null when neither primary nor legacy is present", () => {
    const reader = makeReader({});
    expect(readCookieValue(reader, "session", "legacy")).toBeNull();
  });

  it("returns null when only primary is named (no legacy) and it is absent", () => {
    const reader = makeReader({});
    expect(readCookieValue(reader, "session")).toBeNull();
  });

  it("returns the primary value when no legacy name is provided", () => {
    const reader = makeReader({ session: "primary-token" });
    expect(readCookieValue(reader, "session")).toBe("primary-token");
  });
});

describe("cookie names under the test env (NODE_ENV !== 'production')", () => {
  it("uses the non-__Host- variants", () => {
    expect(SESSION_COOKIE_NAME).toBe("session");
    expect(LEGACY_SESSION_COOKIE_NAME).toBe("session");
    expect(GOOGLE_OAUTH_STATE_COOKIE_NAME).toBe("google_oauth_state");
    expect(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME).toBe("google_code_verifier");
    expect(GOOGLE_OAUTH_INTENT_COOKIE_NAME).toBe("google_oauth_intent");
  });
});

describe("cookie names in production", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the __Host- prefixed variants", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");

    const prod = await import("./cookies");

    expect(prod.SESSION_COOKIE_NAME).toBe("__Host-session");
    // Legacy stays unprefixed by design so a pre-migration "session" cookie is
    // still readable as a fallback.
    expect(prod.LEGACY_SESSION_COOKIE_NAME).toBe("session");
    expect(prod.GOOGLE_OAUTH_STATE_COOKIE_NAME).toBe(
      "__Host-google_oauth_state",
    );
    expect(prod.GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME).toBe(
      "__Host-google_code_verifier",
    );
    expect(prod.GOOGLE_OAUTH_INTENT_COOKIE_NAME).toBe(
      "__Host-google_oauth_intent",
    );
  });
});
