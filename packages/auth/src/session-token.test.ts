import { describe, expect, it } from "vitest";
import { generateSessionToken, hashSessionToken } from "./session-token";

describe("hashSessionToken", () => {
  it("is the lowercase hex SHA-256 of the token", async () => {
    // FIPS 180-2 test vector. Stored session ids depend on this exact format.
    expect(await hashSessionToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("matches ids written by the previous @oslojs/crypto implementation", async () => {
    // Computed with @oslojs/crypto sha256 + @oslojs/encoding hex before the
    // switch, so sessions created before it still resolve.
    expect(await hashSessionToken("x4hz7mzqk2t5gyswbv6ujlpd3ifm2erc")).toBe(
      "a99e0e972aef06c25cb0f106212e986deb89d7f8cf50beb5ed8c18bb516233f5",
    );
  });
});

describe("generateSessionToken", () => {
  it("encodes 20 random bytes as 32 lowercase base32 characters", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[a-z2-7]{32}$/);
    expect(generateSessionToken()).not.toBe(token);
  });
});
