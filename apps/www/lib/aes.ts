import * as crypto from "crypto";
const { subtle } = globalThis.crypto;

function toUint8Array(base64: string): Uint8Array {
  const buf = Buffer.from(base64, "base64");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function toBase64(u8: Uint8Array): string {
  return Buffer.from(u8).toString("base64");
}

function getAesKeyFromEnv(): string {
  const key = process.env.AES_256_GCM_KEY;
  if (!key) throw new Error("AES_256_GCM_KEY environment variable not set");
  return key;
}

async function importAesKey(base64Key: string): Promise<CryptoKey> {
  const rawGeneric = toUint8Array(base64Key);
  const rawClean = rawGeneric.buffer.slice(
    rawGeneric.byteOffset,
    rawGeneric.byteOffset + rawGeneric.byteLength,
  ) as ArrayBuffer;

  return await subtle.importKey(
    "raw",
    rawClean,
    { name: "AES-GCM" },
    /* extractable */ true,
    ["encrypt", "decrypt"],
  );
}

function splitPayload(payload: string): {
  cipherText: Uint8Array;
  iv: Uint8Array;
} {
  const [ctB64, ivB64] = payload.split(".");
  if (!ctB64 || !ivB64) throw new Error("Invalid payload format");
  return {
    cipherText: toUint8Array(ctB64),
    iv: toUint8Array(ivB64),
  };
}

export async function aesEncrypt(plainText: string): Promise<string> {
  try {
    const rawBase64 = getAesKeyFromEnv();
    const key = await importAesKey(rawBase64);

    const enc = new TextEncoder();

    const ivGen = crypto.getRandomValues(new Uint8Array(12));
    const iv = new Uint8Array(ivGen);

    const plainU8 = new Uint8Array(enc.encode(plainText));

    const cipherBuffer = await subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      plainU8,
    );

    const cipherU8 = new Uint8Array(cipherBuffer);

    return `${toBase64(cipherU8)}.${toBase64(iv)}`;
  } catch (err) {
    console.error("AES encryption error:", err);
    throw err;
  }
}

export async function aesDecrypt(payload: string): Promise<string> {
  try {
    const rawBase64 = getAesKeyFromEnv();
    const key = await importAesKey(rawBase64);

    const { cipherText: ctGen, iv: ivGen } = splitPayload(payload);

    const cipherText = new Uint8Array(ctGen);
    const iv = new Uint8Array(ivGen);

    const plainBuffer = await subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherText,
    );

    return new TextDecoder().decode(plainBuffer);
  } catch (err) {
    console.error("AES decryption error:", err);
    throw err;
  }
}
