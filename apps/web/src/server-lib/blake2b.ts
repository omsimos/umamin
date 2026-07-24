// Pure-JS BLAKE2b (RFC 7693), used only for argon2id's H0 / variable-length
// hashing (see argon2.ts). Inputs are tiny (≤1 KiB blocks, a handful of calls
// per hash), so a JS implementation is fast enough and removes the need to
// bundle a second CompiledWasm module just for BLAKE2b.
//
// Ported from the canonical `blakejs` implementation by Dmitry Chestnykh /
// Devi Mandiri et al., dedicated to the public domain (CC0). Only the unkeyed
// path is needed here. Verified against RFC 7693 test vectors (blake2b.test.ts).

// prettier-ignore
const BLAKE2B_IV32 = new Uint32Array([
  0xf3bcc908, 0x6a09e667, 0x84caa73b, 0xbb67ae85, 0xfe94f82b, 0x3c6ef372,
  0x5f1d36f1, 0xa54ff53a, 0xade682d1, 0x510e527f, 0x2b3e6c1f, 0x9b05688c,
  0xfb41bd6b, 0x1f83d9ab, 0x137e2179, 0x5be0cd19,
]);

// prettier-ignore
const SIGMA8 = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 14, 10, 4, 8, 9, 15, 13,
  6, 1, 12, 0, 2, 11, 7, 5, 3, 11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1,
  9, 4, 7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8, 9, 0, 5, 7, 2, 4,
  10, 15, 14, 1, 11, 12, 6, 8, 3, 13, 2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5,
  15, 14, 1, 9, 12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11, 13, 11, 7,
  14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10, 6, 15, 14, 9, 11, 3, 0, 8, 12, 2,
  13, 7, 1, 4, 10, 5, 10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0, 0,
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 14, 10, 4, 8, 9, 15, 13, 6,
  1, 12, 0, 2, 11, 7, 5, 3,
];

const SIGMA82 = new Uint8Array(SIGMA8.map((x) => x * 2));

// Reusable scratch — safe to share because compress is synchronous and never
// re-enters.
const v = new Uint32Array(32);
const m = new Uint32Array(32);

type Blake2bCtx = {
  b: Uint8Array;
  h: Uint32Array;
  t: number;
  c: number;
  outlen: number;
};

// v[a,a+1] += v[b,b+1]
function add64AA(vec: Uint32Array, a: number, b: number): void {
  const o0 = vec[a] + vec[b];
  let o1 = vec[a + 1] + vec[b + 1];
  if (o0 >= 0x100000000) o1++;
  vec[a] = o0;
  vec[a + 1] = o1;
}

// v[a,a+1] += (b1<<32 | b0)
function add64AC(vec: Uint32Array, a: number, b0: number, b1: number): void {
  let o0 = vec[a] + b0;
  if (b0 < 0) o0 += 0x100000000;
  let o1 = vec[a + 1] + b1;
  if (o0 >= 0x100000000) o1++;
  vec[a] = o0;
  vec[a + 1] = o1;
}

function b2bGet32(arr: Uint8Array, i: number): number {
  return arr[i] ^ (arr[i + 1] << 8) ^ (arr[i + 2] << 16) ^ (arr[i + 3] << 24);
}

function b2bG(
  a: number,
  b: number,
  c: number,
  d: number,
  ix: number,
  iy: number,
): void {
  const x0 = m[ix];
  const x1 = m[ix + 1];
  const y0 = m[iy];
  const y1 = m[iy + 1];

  add64AA(v, a, b);
  add64AC(v, a, x0, x1);

  let xor0 = v[d] ^ v[a];
  let xor1 = v[d + 1] ^ v[a + 1];
  v[d] = xor1;
  v[d + 1] = xor0;

  add64AA(v, c, d);

  xor0 = v[b] ^ v[c];
  xor1 = v[b + 1] ^ v[c + 1];
  v[b] = (xor0 >>> 24) ^ (xor1 << 8);
  v[b + 1] = (xor1 >>> 24) ^ (xor0 << 8);

  add64AA(v, a, b);
  add64AC(v, a, y0, y1);

  xor0 = v[d] ^ v[a];
  xor1 = v[d + 1] ^ v[a + 1];
  v[d] = (xor0 >>> 16) ^ (xor1 << 16);
  v[d + 1] = (xor1 >>> 16) ^ (xor0 << 16);

  add64AA(v, c, d);

  xor0 = v[b] ^ v[c];
  xor1 = v[b + 1] ^ v[c + 1];
  v[b] = (xor1 >>> 31) ^ (xor0 << 1);
  v[b + 1] = (xor0 >>> 31) ^ (xor1 << 1);
}

function compress(ctx: Blake2bCtx, last: boolean): void {
  for (let i = 0; i < 16; i++) {
    v[i] = ctx.h[i];
    v[i + 16] = BLAKE2B_IV32[i];
  }

  v[24] = v[24] ^ ctx.t;
  v[25] = v[25] ^ (ctx.t / 0x100000000);

  if (last) {
    v[28] = ~v[28];
    v[29] = ~v[29];
  }

  for (let i = 0; i < 32; i++) {
    m[i] = b2bGet32(ctx.b, 4 * i);
  }

  for (let i = 0; i < 12; i++) {
    b2bG(0, 8, 16, 24, SIGMA82[i * 16 + 0], SIGMA82[i * 16 + 1]);
    b2bG(2, 10, 18, 26, SIGMA82[i * 16 + 2], SIGMA82[i * 16 + 3]);
    b2bG(4, 12, 20, 28, SIGMA82[i * 16 + 4], SIGMA82[i * 16 + 5]);
    b2bG(6, 14, 22, 30, SIGMA82[i * 16 + 6], SIGMA82[i * 16 + 7]);
    b2bG(0, 10, 20, 30, SIGMA82[i * 16 + 8], SIGMA82[i * 16 + 9]);
    b2bG(2, 12, 22, 24, SIGMA82[i * 16 + 10], SIGMA82[i * 16 + 11]);
    b2bG(4, 14, 16, 26, SIGMA82[i * 16 + 12], SIGMA82[i * 16 + 13]);
    b2bG(6, 8, 18, 28, SIGMA82[i * 16 + 14], SIGMA82[i * 16 + 15]);
  }

  for (let i = 0; i < 16; i++) {
    ctx.h[i] = ctx.h[i] ^ v[i] ^ v[i + 16];
  }
}

function init(outlen: number): Blake2bCtx {
  if (outlen <= 0 || outlen > 64) {
    throw new Error("Illegal output length, expected 0 < length <= 64");
  }
  const ctx: Blake2bCtx = {
    b: new Uint8Array(128),
    h: new Uint32Array(16),
    t: 0,
    c: 0,
    outlen,
  };
  for (let i = 0; i < 16; i++) ctx.h[i] = BLAKE2B_IV32[i];
  ctx.h[0] ^= 0x01010000 ^ outlen;
  return ctx;
}

function update(ctx: Blake2bCtx, input: Uint8Array): void {
  for (let i = 0; i < input.length; i++) {
    if (ctx.c === 128) {
      ctx.t += ctx.c;
      compress(ctx, false);
      ctx.c = 0;
    }
    ctx.b[ctx.c++] = input[i];
  }
}

function final(ctx: Blake2bCtx): Uint8Array {
  ctx.t += ctx.c;
  while (ctx.c < 128) ctx.b[ctx.c++] = 0;
  compress(ctx, true);

  const out = new Uint8Array(ctx.outlen);
  for (let i = 0; i < ctx.outlen; i++) {
    out[i] = (ctx.h[i >> 2] >> (8 * (i & 3))) & 0xff;
  }
  return out;
}

// Streaming hasher matching how argon2.ts drives BLAKE2b: init() resets so a
// single instance can be reused across hashFunc's re-hash loop.
export type Blake2bHasher = {
  init: () => Blake2bHasher;
  update: (data: Uint8Array) => Blake2bHasher;
  digest: () => Uint8Array;
};

export function createBlake2b(outlenBytes: number): Blake2bHasher {
  let ctx = init(outlenBytes);
  const hasher: Blake2bHasher = {
    init() {
      ctx = init(outlenBytes);
      return hasher;
    },
    update(data) {
      update(ctx, data);
      return hasher;
    },
    digest() {
      return final(ctx);
    },
  };
  return hasher;
}

// One-shot convenience (used by tests / small inputs).
export function blake2b(data: Uint8Array, outlenBytes = 64): Uint8Array {
  const ctx = init(outlenBytes);
  update(ctx, data);
  return final(ctx);
}
