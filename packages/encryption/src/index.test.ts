import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { aesDecrypt, aesEncrypt } from "./index";

async function generateBase64Key(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const raw = await crypto.subtle.exportKey("raw", key);
  return Buffer.from(new Uint8Array(raw)).toString("base64");
}

beforeAll(async () => {
  process.env.AES_256_GCM_KEY = await generateBase64Key();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("aesEncrypt / aesDecrypt", () => {
  it("round-trips plaintext through encrypt then decrypt", async () => {
    const messages = [
      "hello world",
      "",
      "emoji 🐈 and únïcödé",
      "x".repeat(5_000),
      JSON.stringify({ a: 1, nested: { b: [1, 2, 3] } }),
    ];

    for (const plain of messages) {
      const payload = await aesEncrypt(plain);
      expect(await aesDecrypt(payload)).toBe(plain);
    }
  });

  it("emits a `cipher.iv` base64 payload shape", async () => {
    const payload = await aesEncrypt("shape");
    const parts = payload.split(".");
    expect(parts).toHaveLength(2);
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0);
      // Decodes cleanly as base64 (re-encoding is stable).
      expect(Buffer.from(part, "base64").toString("base64")).toBe(part);
    }
  });

  it("uses a fresh IV per call, so identical plaintext yields different ciphertext", async () => {
    const a = await aesEncrypt("same");
    const b = await aesEncrypt("same");
    expect(a).not.toBe(b);
    // ...yet both decrypt back to the same plaintext.
    expect(await aesDecrypt(a)).toBe("same");
    expect(await aesDecrypt(b)).toBe("same");
  });

  it("rejects a tampered ciphertext (GCM auth tag mismatch)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const payload = await aesEncrypt("secret");
    const [ct = "", iv = ""] = payload.split(".");
    // Flip the first base64 char to a different valid char.
    const flipped = `${ct[0] === "A" ? "B" : "A"}${ct.slice(1)}.${iv}`;
    await expect(aesDecrypt(flipped)).rejects.toThrow();
  });

  it("rejects a malformed payload missing the iv segment", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(aesDecrypt("no-dot-here")).rejects.toThrow(
      "Invalid payload format",
    );
  });

  it("throws when the AES key env var is absent", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const original = process.env.AES_256_GCM_KEY;
    // `process.env.X = undefined` stores the string "undefined" (truthy), so the
    // guard only trips when the key is genuinely absent.
    delete process.env.AES_256_GCM_KEY;
    try {
      await expect(aesEncrypt("x")).rejects.toThrow(
        "AES_256_GCM_KEY environment variable not set",
      );
    } finally {
      process.env.AES_256_GCM_KEY = original;
    }
  });
});
