import { aesDecrypt, aesEncrypt } from "@umamin/encryption";
import { beforeAll, describe, expect, it } from "vitest";

// Spike C (plan): @umamin/encryption (AES-256-GCM at rest, DMs + group chat) is
// pure WebCrypto + Buffer. Confirm it round-trips inside workerd — Buffer is
// covered by nodejs_compat and crypto.subtle is Workers-native. Mirrors
// packages/encryption/src/index.test.ts.

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

describe("@umamin/encryption under workerd", () => {
  it("Buffer is available (nodejs_compat)", () => {
    expect(typeof Buffer).toBe("function");
    expect(Buffer.from("hi", "utf8").toString("base64")).toBe("aGk=");
  });

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
      expect(Buffer.from(part, "base64").toString("base64")).toBe(part);
    }
  });

  it("uses a fresh IV per call", async () => {
    const a = await aesEncrypt("same");
    const b = await aesEncrypt("same");
    expect(a).not.toBe(b);
    expect(await aesDecrypt(a)).toBe("same");
    expect(await aesDecrypt(b)).toBe("same");
  });

  it("rejects a tampered ciphertext (GCM auth tag mismatch)", async () => {
    const payload = await aesEncrypt("secret");
    const [ct = "", iv = ""] = payload.split(".");
    const flipped = `${ct[0] === "A" ? "B" : "A"}${ct.slice(1)}.${iv}`;
    await expect(aesDecrypt(flipped)).rejects.toThrow();
  });
});
