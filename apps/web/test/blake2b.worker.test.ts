import { describe, expect, it } from "vitest";
import { blake2b, createBlake2b } from "../src/server-lib/blake2b";

// Pure-JS BLAKE2b backs the argon2id driver's H0 hashing (blake2b.ts). Verify
// against RFC 7693 / official test vectors so a regression can't silently break
// argon2 output parity.

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("BLAKE2b (pure JS)", () => {
  it("matches the RFC vector for the empty input (512-bit)", () => {
    expect(hex(blake2b(new Uint8Array(0), 64))).toBe(
      "786a02f742015903c6c6fd852552d272912f4740e15847618a86e217f71f5419" +
        "d25e1031afee585313896444934eb04b903a685b1448b755d56f701afe9be2ce",
    );
  });

  it('matches the RFC vector for "abc" (512-bit)', () => {
    expect(hex(blake2b(new TextEncoder().encode("abc"), 64))).toBe(
      "ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d1" +
        "7d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923",
    );
  });

  it("supports variable output length (256-bit)", () => {
    expect(hex(blake2b(new TextEncoder().encode("abc"), 32))).toBe(
      "bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319",
    );
  });

  it("streams updates identically to a single-shot digest across the block boundary", () => {
    const data = new Uint8Array(300).map((_, i) => i & 0xff);
    const oneShot = hex(blake2b(data, 64));

    const streamed = createBlake2b(64);
    streamed.update(data.subarray(0, 100));
    streamed.update(data.subarray(100, 250));
    streamed.update(data.subarray(250));
    expect(hex(streamed.digest())).toBe(oneShot);
  });

  it("reuses an instance after init()", () => {
    const h = createBlake2b(64);
    const first = hex(h.update(new TextEncoder().encode("abc")).digest());
    const second = hex(
      h.init().update(new TextEncoder().encode("abc")).digest(),
    );
    expect(second).toBe(first);
  });
});
