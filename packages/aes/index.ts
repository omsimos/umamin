const { subtle } = globalThis.crypto;

function toUint8Array(base64Text: string) {
  return new Uint8Array(
    atob(base64Text)
      .split("")
      .map((char) => char.charCodeAt(0)),
  );
}

function toBase64(uint8Array: Uint8Array) {
  return btoa(String.fromCharCode(...uint8Array));
}

export async function generateAesKey() {
  const key = await subtle.generateKey(
    {
      name: "AES-CBC",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  );

  const rawKey = await subtle.exportKey("raw", key);
  const keyBase64 = toBase64(new Uint8Array(rawKey));

  return {
    key,
    keyBase64,
  };
}

export async function aesEncrypt(plainText: string) {
  const te = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const rawKey = toUint8Array(process.env.AES_KEY ?? "").buffer;

  const key = await subtle.importKey(
    "raw",
    rawKey,
    {
      name: "AES-CBC",
    },
    true,
    ["encrypt", "decrypt"],
  );

  const cipherText = await subtle.encrypt(
    {
      name: "AES-CBC",
      iv,
    },
    key,
    te.encode(plainText),
  );

  const ivBase64 = toBase64(iv);
  const cipherTextBase64 = toBase64(new Uint8Array(cipherText));

  const encryptedText = `${cipherTextBase64}.${ivBase64}`;

  return {
    iv,
    cipherText,
    cipherTextBase64,
    ivBase64,
    encryptedText,
  };
}

export async function aesDecrypt(text: string) {
  try {
    const cipherTextBase64 = text.split(".")[0] ?? "";
    const ivBase64 = text.split(".")[1] ?? "";

    const cipherText = toUint8Array(cipherTextBase64).buffer;
    const iv = toUint8Array(ivBase64);
    const rawKey = toUint8Array(process.env.AES_KEY ?? "").buffer;

    const td = new TextDecoder();

    const key = await subtle.importKey(
      "raw",
      rawKey,
      {
        name: "AES-CBC",
      },
      true,
      ["encrypt", "decrypt"],
    );

    const plainText = await subtle.decrypt(
      {
        name: "AES-CBC",
        iv,
      },
      key,
      cipherText,
    );

    return td.decode(plainText);
  } catch (err) {
    return null;
  }
}
