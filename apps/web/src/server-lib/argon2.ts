import argon2Module from "./argon2.wasm";
import { createBlake2b } from "./blake2b";

// argon2id driver for the Workers runtime (plan fact #4 / R2). Workerd forbids
// runtime WebAssembly.compile, and @node-rs/argon2 is native — so the argon2
// core wasm ships as a CompiledWasm module (bundled + compiled at deploy) and is
// driven here. The BLAKE2b that argon2 needs for H0 / variable-length hashing is
// pure JS (blake2b.ts) rather than a second wasm module.
//
// The algorithm + PHC encoding are a minimal port of hash-wasm's argon2 driver
// (lib/argon2.ts + lib/WASMInterface.ts, MIT © Dani Biró) reduced to the
// argon2id encode/verify paths and rewired onto a precompiled module. Output is
// byte-compatible with @node-rs/argon2 (proven by the fixture-parity test):
//   $argon2id$v=19$m=19456,t=2,p=1$<salt-b64>$<hash-b64>
// The wasm exports memory / Hash_SetMemorySize / Hash_GetBuffer / Hash_Calculate.

export type Argon2Options = {
  memoryCost?: number;
  timeCost?: number;
  outputLen?: number;
  parallelism?: number;
};

// Prod params (apps/www/lib/auth.ts): argon2id, 19 MiB, 2 passes, 32-byte tag.
const DEFAULTS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

const SALT_BYTES = 16;

// ── base64 (standard alphabet, unpadded on encode) — from hash-wasm util.ts ──
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64.length; i++) B64_LOOKUP[B64.charCodeAt(i)] = i;

function encodeBase64(data: Uint8Array): string {
  const len = data.length;
  const extra = len % 3;
  const parts: string[] = [];
  const main = len - extra;
  for (let i = 0; i < main; i += 3) {
    const t =
      ((data[i] << 16) & 0xff0000) +
      ((data[i + 1] << 8) & 0xff00) +
      (data[i + 2] & 0xff);
    parts.push(
      B64.charAt((t >> 18) & 0x3f) +
        B64.charAt((t >> 12) & 0x3f) +
        B64.charAt((t >> 6) & 0x3f) +
        B64.charAt(t & 0x3f),
    );
  }
  if (extra === 1) {
    const t = data[len - 1];
    parts.push(B64.charAt(t >> 2) + B64.charAt((t << 4) & 0x3f));
  } else if (extra === 2) {
    const t = (data[len - 2] << 8) + data[len - 1];
    parts.push(
      B64.charAt(t >> 10) +
        B64.charAt((t >> 4) & 0x3f) +
        B64.charAt((t << 2) & 0x3f),
    );
  }
  return parts.join("");
}

function decodeBase64(data: string): Uint8Array {
  let outLen = Math.floor(data.length * 0.75);
  const len = data.length;
  if (data[len - 1] === "=") {
    outLen -= 1;
    if (data[len - 2] === "=") outLen -= 1;
  }
  const bytes = new Uint8Array(outLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = B64_LOOKUP[data.charCodeAt(i)];
    const e2 = B64_LOOKUP[data.charCodeAt(i + 1)];
    const e3 = B64_LOOKUP[data.charCodeAt(i + 2)];
    const e4 = B64_LOOKUP[data.charCodeAt(i + 3)];
    if (p < outLen) bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < outLen) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < outLen) bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }
  return bytes;
}

// ── argon2 core ──────────────────────────────────────────────────────────────

function int32LE(x: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setInt32(0, x, true);
  return b;
}

type Blake = ReturnType<typeof createBlake2b>;

// Variable-length hash H' (argon2 spec): BLAKE2b for ≤64 bytes, else a chained
// expansion. Mirrors hash-wasm's hashFunc.
function hashFunc(blake512: Blake, buf: Uint8Array, len: number): Uint8Array {
  if (len <= 64) {
    const blake = createBlake2b(len);
    blake.update(int32LE(len));
    blake.update(buf);
    return blake.digest();
  }

  const r = Math.ceil(len / 32) - 2;
  const ret = new Uint8Array(len);

  blake512.init();
  blake512.update(int32LE(len));
  blake512.update(buf);
  let vp = blake512.digest();
  ret.set(vp.subarray(0, 32), 0);

  for (let i = 1; i < r; i++) {
    blake512.init();
    blake512.update(vp);
    vp = blake512.digest();
    ret.set(vp.subarray(0, 32), i * 32);
  }

  const partial = len - 32 * r;
  let small: Blake;
  if (partial === 64) {
    small = blake512;
    small.init();
  } else {
    small = createBlake2b(partial);
  }
  small.update(vp);
  vp = small.digest();
  ret.set(vp.subarray(0, partial), r * 32);
  return ret;
}

type WasmExports = {
  memory: WebAssembly.Memory;
  Hash_SetMemorySize: (n: number) => void;
  Hash_GetBuffer: () => number;
  Hash_Calculate: (len: number, initParam: number, digestParam: number) => void;
};

type ComputeParams = {
  password: Uint8Array;
  salt: Uint8Array;
  parallelism: number;
  iterations: number;
  memorySize: number; // KiB
  hashLength: number;
};

async function computeRaw(params: ComputeParams): Promise<Uint8Array> {
  const { password, salt, parallelism, iterations, memorySize, hashLength } =
    params;
  const version = 0x13;
  const hashType = 2; // argon2id

  // A fresh instance per call — argon2 owns its whole memory and must start
  // clean. instantiate() on an already-compiled module is codegen-free.
  const instance = await WebAssembly.instantiate(argon2Module, {});
  const exports = instance.exports as unknown as WasmExports;

  // Warm the allocator: this first Hash_GetBuffer triggers the wasm's initial
  // buffer allocation, which Hash_SetMemorySize then RESIZES. Skipping it makes
  // SetMemorySize hand back an offset the wasm's own addressing disagrees with
  // (offset 0 while the fill still targets the warmed base) → OOB inside
  // Hash_Calculate. hash-wasm's WASMInterface does the same warmup in setup.
  exports.Hash_GetBuffer();

  const totalSize = memorySize * 1024 + 1024; // +1 block for the init vector
  exports.Hash_SetMemorySize(totalSize);
  const arrayOffset = exports.Hash_GetBuffer();
  // Hash_SetMemorySize places the working buffer at an allocator-chosen offset
  // and does not always grow linear memory enough to cover [offset, offset+size)
  // — so guarantee the range fits before viewing it (the wasm fills within it).
  const need = arrayOffset + totalSize;
  if (exports.memory.buffer.byteLength < need) {
    const deficit = need - exports.memory.buffer.byteLength;
    exports.memory.grow(Math.ceil(deficit / 65536));
  }
  const memoryView = () =>
    new Uint8Array(exports.memory.buffer, arrayOffset, totalSize);
  const writeMemory = (data: Uint8Array, offset = 0) =>
    memoryView().set(data, offset);

  const initVector = new Uint8Array(24);
  const iv = new DataView(initVector.buffer);
  iv.setInt32(0, parallelism, true);
  iv.setInt32(4, hashLength, true);
  iv.setInt32(8, memorySize, true);
  iv.setInt32(12, iterations, true);
  iv.setInt32(16, version, true);
  iv.setInt32(20, hashType, true);
  writeMemory(initVector, memorySize * 1024);

  const blake512 = createBlake2b(64);
  blake512.update(initVector);
  blake512.update(int32LE(password.length));
  blake512.update(password);
  blake512.update(int32LE(salt.length));
  blake512.update(salt);
  blake512.update(int32LE(0)); // secret length + secret (none)
  blake512.update(int32LE(0)); // associated data length + data (none)

  const segments = Math.floor(memorySize / (parallelism * 4));
  const lanes = segments * 4;

  const param = new Uint8Array(72);
  param.set(blake512.digest()); // H0

  for (let lane = 0; lane < parallelism; lane++) {
    param.set(int32LE(0), 64);
    param.set(int32LE(lane), 68);

    let position = lane * lanes;
    writeMemory(hashFunc(blake512, param, 1024), position * 1024);

    position += 1;
    param.set(int32LE(1), 64);
    writeMemory(hashFunc(blake512, param, 1024), position * 1024);
  }

  exports.Hash_Calculate(0, memorySize, 0);

  // The final 1024-byte block C lands at the buffer start; re-read the view in
  // case the memory grew (detaching the old ArrayBuffer).
  const C = memoryView().slice(0, 1024);
  return hashFunc(blake512, C, hashLength);
}

function encodePhc(
  salt: Uint8Array,
  opts: ComputeParams,
  raw: Uint8Array,
): string {
  const parameters = `m=${opts.memorySize},t=${opts.iterations},p=${opts.parallelism}`;
  return `$argon2id$v=19$${parameters}$${encodeBase64(salt)}$${encodeBase64(raw)}`;
}

/**
 * Hash `password` with argon2id, returning a PHC string byte-compatible with
 * @node-rs/argon2's default output for the same params.
 */
export async function hash(
  password: string,
  options: Argon2Options = {},
): Promise<string> {
  const memorySize = options.memoryCost ?? DEFAULTS.memoryCost;
  const iterations = options.timeCost ?? DEFAULTS.timeCost;
  const hashLength = options.outputLen ?? DEFAULTS.outputLen;
  const parallelism = options.parallelism ?? DEFAULTS.parallelism;

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const pw = new TextEncoder().encode(password);
  const params: ComputeParams = {
    password: pw,
    salt,
    parallelism,
    iterations,
    memorySize,
    hashLength,
  };
  const raw = await computeRaw(params);
  return encodePhc(salt, params, raw);
}

const PHC_RE =
  /^\$argon2(id|i|d)\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2})$/;

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Verify `password` against a stored argon2 PHC string (the format
 * @node-rs/argon2 emits). Only argon2id v=19 is accepted — the sole variant the
 * app has ever written.
 */
export async function verify(phc: string, password: string): Promise<boolean> {
  const match = PHC_RE.exec(phc);
  if (!match) return false;

  const [, variant, version, m, t, p, saltB64, hashB64] = match;
  if (variant !== "id" || version !== "19") return false;

  const salt = decodeBase64(saltB64);
  const expected = decodeBase64(hashB64);

  const raw = await computeRaw({
    password: new TextEncoder().encode(password),
    salt,
    parallelism: Number(p),
    iterations: Number(t),
    memorySize: Number(m),
    hashLength: expected.length,
  });

  return constantTimeEqual(raw, expected);
}
