import { describe, expect, it } from "vitest";
import {
  buildGravatarUrl,
  getGravatarFinalUrl,
  getGravatarPreviewUrl,
  hashEmailForGravatar,
  normaliseEmailForGravatar,
} from "./avatar";

// Pinned md5("test@example.com"); confirmed via node:crypto.
const TEST_EMAIL_MD5 = "55502f40dc8b7c769880b10874abc9d0";

describe("normaliseEmailForGravatar", () => {
  it("trims surrounding whitespace", () => {
    expect(normaliseEmailForGravatar("  user@example.com  ")).toBe(
      "user@example.com",
    );
  });

  it("lowercases the email", () => {
    expect(normaliseEmailForGravatar("User@Example.COM")).toBe(
      "user@example.com",
    );
  });

  it("trims and lowercases together", () => {
    expect(normaliseEmailForGravatar("  Test@Example.com ")).toBe(
      "test@example.com",
    );
  });
});

describe("hashEmailForGravatar", () => {
  it("returns a 32-char lowercase hex md5", () => {
    const hash = hashEmailForGravatar("user@example.com");
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is deterministic for the same input", () => {
    expect(hashEmailForGravatar("user@example.com")).toBe(
      hashEmailForGravatar("user@example.com"),
    );
  });

  it("differs for different inputs", () => {
    expect(hashEmailForGravatar("a@example.com")).not.toBe(
      hashEmailForGravatar("b@example.com"),
    );
  });

  it("matches the known md5 of test@example.com", () => {
    expect(hashEmailForGravatar("test@example.com")).toBe(TEST_EMAIL_MD5);
  });

  it("normalise + hash of '  Test@Example.com ' equals md5 of test@example.com", () => {
    const hash = hashEmailForGravatar(
      normaliseEmailForGravatar("  Test@Example.com "),
    );
    expect(hash).toBe(TEST_EMAIL_MD5);
  });
});

describe("buildGravatarUrl", () => {
  it("targets the gravatar avatar base url with the given hash", () => {
    const url = new URL(buildGravatarUrl(TEST_EMAIL_MD5));
    expect(url.origin).toBe("https://www.gravatar.com");
    expect(url.pathname).toBe(`/avatar/${TEST_EMAIL_MD5}`);
  });

  it("includes s=256, r=pg, and d=mp by default", () => {
    const { searchParams } = new URL(buildGravatarUrl(TEST_EMAIL_MD5));
    expect(searchParams.get("s")).toBe("256");
    expect(searchParams.get("r")).toBe("pg");
    expect(searchParams.get("d")).toBe("mp");
  });

  it("uses d=404 when fallback is '404'", () => {
    const { searchParams } = new URL(buildGravatarUrl(TEST_EMAIL_MD5, "404"));
    expect(searchParams.get("d")).toBe("404");
    expect(searchParams.get("s")).toBe("256");
    expect(searchParams.get("r")).toBe("pg");
  });
});

describe("preview vs final url defaults", () => {
  it("getGravatarPreviewUrl uses d=404", () => {
    const { searchParams } = new URL(getGravatarPreviewUrl(TEST_EMAIL_MD5));
    expect(searchParams.get("d")).toBe("404");
  });

  it("getGravatarFinalUrl uses d=mp", () => {
    const { searchParams } = new URL(getGravatarFinalUrl(TEST_EMAIL_MD5));
    expect(searchParams.get("d")).toBe("mp");
  });

  it("preview and final differ only in the d param", () => {
    const preview = new URL(getGravatarPreviewUrl(TEST_EMAIL_MD5));
    const final = new URL(getGravatarFinalUrl(TEST_EMAIL_MD5));
    expect(preview.pathname).toBe(final.pathname);
    expect(preview.searchParams.get("s")).toBe(final.searchParams.get("s"));
    expect(preview.searchParams.get("r")).toBe(final.searchParams.get("r"));
    expect(preview.searchParams.get("d")).not.toBe(final.searchParams.get("d"));
  });
});
