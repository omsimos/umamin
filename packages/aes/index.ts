import * as crypto from "crypto";
const { subtle } = globalThis.crypto;

function toUint8Array(base64Text: string) {
  return new Uint8Array(Buffer.from(base64Text, "base64"));
}

function toBase64(uint8Array: Uint8Array) {
  return Buffer.from(uint8Array).toString("base64");
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
    const keyBase64 = toBase64(new Uint8Array(rawKey));
    return keyBase64;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

export async function aesEncrypt(plainText: string) {
  try {
    const te = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const rawKey = toUint8Array(process.env.AES_KEY ?? "");

    const key = await subtle.importKey(
      "raw",
      rawKey,
      {
        name: "AES-GCM",
      },
      true,
      ["encrypt", "decrypt"],
    );

    const cipherText = await subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: 96,
      },
      key,
      te.encode(plainText),
    );

    const ivBase64 = toBase64(iv);
    const cipherTextBase64 = toBase64(new Uint8Array(cipherText));

    return `${cipherTextBase64}.${ivBase64}`;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

export async function aesDecrypt(text: string) {
  try {
    const cipherTextBase64 = text.split(".")[0] ?? "";
    const ivBase64 = text.split(".")[1] ?? "";

    const cipherText = toUint8Array(cipherTextBase64);
    const iv = toUint8Array(ivBase64);
    const rawKey = toUint8Array(process.env.AES_KEY ?? "");

    const td = new TextDecoder();

    const key = await subtle.importKey(
      "raw",
      rawKey,
      {
        name: "AES-GCM",
      },
      true,
      ["encrypt", "decrypt"],
    );

    const plainText = await subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: 96,
      },
      key,
      cipherText,
    );

    return td.decode(plainText);
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function aesEncryptDemo(plainText: string) {
  try {
    const te = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(16));

    // For demo purposes only
    const demoKey = toUint8Array(
      "62C+HNDSb5tfQXliHQ3YIeI2ix/nFQSQuuyD/aBBukY=",
    );

    const key = await subtle.importKey(
      "raw",
      demoKey,
      {
        name: "AES-GCM",
      },
      true,
      ["encrypt", "decrypt"],
    );

    const cipherText = await subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      te.encode(plainText),
    );

    const ivBase64 = toBase64(iv);
    const cipherTextBase64 = toBase64(new Uint8Array(cipherText));

    return `${cipherTextBase64}.${ivBase64}`;
  } catch (err) {
    console.log(err);
    throw err;
  }
}
