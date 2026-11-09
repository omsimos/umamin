import { describe, expect, it } from "vitest";
import {
  decodeBase64urlIgnorePadding,
  encodeBase32LowerCaseNoPadding,
  encodeBase64urlNoPadding,
  encodeHexLowerCase,
} from "./encoding";

const bytes = (s: string) => new TextEncoder().encode(s);

// RFC 4648 section 10 test vectors.
const RFC4648 = [
  ["", "", ""],
  ["f", "my", "Zg"],
  ["fo", "mzxq", "Zm8"],
  ["foo", "mzxw6", "Zm9v"],
  ["foob", "mzxw6yq", "Zm9vYg"],
  ["fooba", "mzxw6ytb", "Zm9vYmE"],
  ["foobar", "mzxw6ytboi", "Zm9vYmFy"],
] as const;

describe("encodeHexLowerCase", () => {
  it("writes two lowercase digits per byte, keeping leading zeros", () => {
    expect(encodeHexLowerCase(new Uint8Array([0, 1, 15, 16, 171, 255]))).toBe(
      "00010f10abff",
    );
  });
});

describe("encodeBase32LowerCaseNoPadding", () => {
  it.each(RFC4648)("encodes %j", (input, base32) => {
    expect(encodeBase32LowerCaseNoPadding(bytes(input))).toBe(base32);
  });

  it("stays correct past 32 bits of buffered input", () => {
    // 20 bytes is the session token length; all-ones exercises every bit.
    expect(encodeBase32LowerCaseNoPadding(new Uint8Array(20).fill(255))).toBe(
      "7".repeat(32),
    );
  });
});

describe("encodeBase64urlNoPadding", () => {
  it.each(RFC4648)("encodes %j", (input, _base32, base64url) => {
    expect(encodeBase64urlNoPadding(bytes(input))).toBe(base64url);
  });

  it("uses the URL-safe alphabet", () => {
    expect(encodeBase64urlNoPadding(new Uint8Array([0xfb, 0xff]))).toBe("-_8");
  });
});

describe("decodeBase64urlIgnorePadding", () => {
  it("round-trips with and without padding", () => {
    expect(decodeBase64urlIgnorePadding("-_8")).toEqual(
      new Uint8Array([0xfb, 0xff]),
    );
    expect(decodeBase64urlIgnorePadding("Zm9vYg==")).toEqual(bytes("foob"));
  });

  it("rejects standard base64 and impossible lengths", () => {
    expect(() => decodeBase64urlIgnorePadding("+/8")).toThrow();
    expect(() => decodeBase64urlIgnorePadding("Zm9vY")).toThrow();
  });
});
