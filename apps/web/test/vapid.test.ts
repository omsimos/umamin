import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidVapidPublicKey } from "@/lib/vapid";

async function generatePublicKey(): Promise<string> {
  const pair = await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const raw = await webcrypto.subtle.exportKey("raw", pair.publicKey);
  return Buffer.from(raw).toString("base64url");
}

describe("isValidVapidPublicKey", () => {
  it("accepts a real P-256 public key", async () => {
    expect(isValidVapidPublicKey(await generatePublicKey())).toBe(true);
  });

  // The production build variable once held the key pasted twice, which broke
  // subscribe() for every visitor while the build stayed green.
  it("rejects a key pasted twice", async () => {
    const key = await generatePublicKey();
    expect(isValidVapidPublicKey(key + key)).toBe(false);
  });

  it("rejects 87 characters that don't decode to an uncompressed point", async () => {
    const key = await generatePublicKey();
    // "A" decodes to leading zero bits, so the first byte is no longer 0x04.
    expect(isValidVapidPublicKey(`A${key.slice(1)}`)).toBe(false);
  });

  it("rejects padded standard base64", async () => {
    const key = await generatePublicKey();
    expect(isValidVapidPublicKey(`${key.slice(0, 86)}=`)).toBe(false);
  });
});
