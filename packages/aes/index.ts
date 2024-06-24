import * as crypto from "crypto";
const { subtle } = globalThis.crypto;

function toUint8Array(base64Text: string) {
  return new Uint8Array(Buffer.from(base64Text, "base64"));
}

function toBase64(uint8Array: Uint8Array) {
  return Buffer.from(uint8Array).toString("base64");
}

async function importAesKey(base64Key: string) {
  const rawKey = toUint8Array(base64Key);

  return await subtle.importKey("raw", rawKey, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function generateAesKey() {
  try {
    const key = await subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"],
    );

    const rawKey = await subtle.exportKey("raw", key);
    return toBase64(new Uint8Array(rawKey));
  } catch (err) {
    console.log(err);
    throw err;
  }
}

export async function aesEncrypt(plainText: string) {
  try {
    const rawKey = process.env.AES_KEY;
    if (!rawKey) throw new Error("AES_KEY environment variable not set");

    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await importAesKey(rawKey);

    const cipherText = await subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      enc.encode(plainText),
    );

    return `${toBase64(new Uint8Array(cipherText))}.${toBase64(iv)}`;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

export async function aesDecrypt(text: string) {
  try {
    const rawKey = process.env.AES_KEY;
    if (!rawKey) throw new Error("AES_KEY environment variable not set");

    const cipherTextBase64 = text.split(".")[0] ?? "";
    const ivBase64 = text.split(".")[1] ?? "";

    const dec = new TextDecoder();
    const iv = toUint8Array(ivBase64);
    const cipherText = toUint8Array(cipherTextBase64);
    const key = await importAesKey(rawKey);

    const plainText = await subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      cipherText,
    );

    return dec.decode(plainText);
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function aesEncryptDemo(plainText: string) {
  try {
    const demoKey = process.env.AES_DEMO_KEY;
    if (!demoKey) throw new Error("AES_DEMO_KEY environment variable not set");

    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await importAesKey(demoKey);

    const cipherText = await subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      enc.encode(plainText),
    );

    return `${toBase64(new Uint8Array(cipherText))}.${toBase64(iv)}`;
  } catch (err) {
    console.log(err);
    throw err;
  }
}
