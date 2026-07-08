import {
  hashPassword,
  normalizeUsername,
  USERNAME_REGEX,
  verifyPassword,
} from "@umamin/org-db/auth";
import { describe, expect, it } from "vitest";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const secret = "correct horse battery staple";
    const hash = await hashPassword(secret);
    expect(hash).not.toContain(secret);
    expect(await verifyPassword(hash, secret)).toBe(true);
    expect(await verifyPassword(hash, "not the password")).toBe(false);
  });
});

describe("username rules", () => {
  it("normalizes case and surrounding whitespace", () => {
    expect(normalizeUsername("  AcMe ")).toBe("acme");
  });

  it("accepts valid usernames", () => {
    expect(USERNAME_REGEX.test("acme")).toBe(true);
    expect(USERNAME_REGEX.test("acme_org_123")).toBe(true);
  });

  it("rejects invalid usernames", () => {
    expect(USERNAME_REGEX.test("ab")).toBe(false); // too short
    expect(USERNAME_REGEX.test("Acme")).toBe(false); // uppercase
    expect(USERNAME_REGEX.test("has space")).toBe(false);
    expect(USERNAME_REGEX.test("hyphen-no")).toBe(false);
  });
});
