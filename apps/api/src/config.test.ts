import { afterEach, describe, expect, it } from "vitest";
import { getAllowedOrigins, validateRuntimeConfig } from "./config";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("API runtime config", () => {
  it("includes local web origins outside production", () => {
    process.env.NODE_ENV = "test";
    process.env.WEB_ORIGIN = "";
    process.env.CORS_ORIGINS = "";

    expect(getAllowedOrigins()).toEqual(
      expect.arrayContaining([
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ]),
    );
  });

  it("fails fast when required production env is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.WEB_ORIGIN;
    delete process.env.SESSION_COOKIE_DOMAIN;
    process.env.TURSO_CONNECTION_URL = "libsql://example.turso.io";
    process.env.AES_256_GCM_KEY =
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

    expect(() => validateRuntimeConfig()).toThrow(
      "Missing required production API environment variables: WEB_ORIGIN, SESSION_COOKIE_DOMAIN",
    );
  });

  it("accepts complete production runtime config", () => {
    process.env.NODE_ENV = "production";
    process.env.WEB_ORIGIN = "https://umamin.com";
    process.env.SESSION_COOKIE_DOMAIN = ".umamin.com";
    process.env.TURSO_CONNECTION_URL = "libsql://example.turso.io";
    process.env.AES_256_GCM_KEY =
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

    expect(() => validateRuntimeConfig()).not.toThrow();
  });
});
