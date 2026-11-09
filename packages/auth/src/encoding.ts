// The three encodings the auth helpers need. They replace @oslojs/encoding and
// must keep producing its exact output: session ids are stored as the hex form
// of a hash, so a different hex encoding would sign everyone out.

const HEX = "0123456789abcdef";
const BASE32_LOWER = "abcdefghijklmnopqrstuvwxyz234567";

export function encodeHexLowerCase(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += HEX[byte >> 4];
    out += HEX[byte & 0x0f];
  }
  return out;
}

// RFC 4648 base32 with the lowercase alphabet and no "=" padding.
export function encodeBase32LowerCaseNoPadding(bytes: Uint8Array): string {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_LOWER[(buffer >> bits) & 0x1f];
    }
    // Only the low `bits` bits are still unread; dropping the rest keeps the
    // shifts inside 32-bit range for any input length.
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) {
    out += BASE32_LOWER[(buffer << (5 - bits)) & 0x1f];
  }
  return out;
}

// RFC 4648 base64url without padding. btoa works on a binary string, which is
// available on Workers and on every supported Node version, unlike
// Uint8Array#toBase64.
export function encodeBase64urlNoPadding(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

// Accepts base64url with or without padding, as JWT segments omit it. Throws on
// any character outside the base64url alphabet.
export function decodeBase64urlIgnorePadding(encoded: string): Uint8Array {
  const unpadded = encoded.replace(/=+$/, "");
  if (!/^[A-Za-z0-9_-]*$/.test(unpadded) || unpadded.length % 4 === 1) {
    throw new Error("Invalid base64url");
  }
  const base64 = unpadded.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
