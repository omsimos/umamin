import { describe, expect, it } from "vitest";
import { hash, verify } from "../src/server-lib/argon2";

// ── argon2id driver on the Workers runtime (plan R2 / fact #4) ──────────────────
//
// Workerd forbids runtime WebAssembly.compile, so the argon2 core wasm ships as a
// CompiledWasm module (see vitest.workers.config.ts modulesRules + wrangler's
// default rule) and src/server-lib/argon2.ts drives it, with a pure-JS BLAKE2b
// for H0. This suite proves byte-for-byte parity with @node-rs/argon2 (the format
// prod stores) plus round-trip + a CPU budget assertion inside workerd.

// Real production-format PHC from @node-rs/argon2 hash("correct horse battery
// staple 42", { memoryCost:19456, timeCost:2, outputLen:32, parallelism:1 }).
const NODE_RS_PHC =
  "$argon2id$v=19$m=19456,t=2,p=1$NzTGCfS3EJ2bxnH5jevkJA$Ecue/d/cfsKzTSz3FD8+p8FVbnGJipit7rqExV0beXY";
const NODE_RS_PASSWORD = "correct horse battery staple 42";

describe("argon2id driver (workers runtime)", () => {
  it("verifies a real @node-rs/argon2 PHC hash (format + algorithm parity)", async () => {
    expect(await verify(NODE_RS_PHC, NODE_RS_PASSWORD)).toBe(true);
  });

  it("rejects a wrong password against the same hash", async () => {
    expect(await verify(NODE_RS_PHC, "wrong password")).toBe(false);
  });

  it("hash() emits the exact prod PHC shape and self-verifies", async () => {
    const phc = await hash("hunter2hunter2");
    expect(phc).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$[^$]+\$[^$]+$/);
    expect(await verify(phc, "hunter2hunter2")).toBe(true);
    expect(await verify(phc, "hunter2hunter3")).toBe(false);
  });

  it("uses a fresh random salt per hash", async () => {
    const a = await hash("same-password-here");
    const b = await hash("same-password-here");
    expect(a).not.toBe(b);
    expect(await verify(a, "same-password-here")).toBe(true);
    expect(await verify(b, "same-password-here")).toBe(true);
  });

  it("rejects a malformed / non-argon2id hash string", async () => {
    expect(await verify("not-a-hash", "x")).toBe(false);
    expect(await verify("$argon2i$v=19$m=19456,t=2,p=1$YWJj$YWJj", "x")).toBe(
      false,
    );
  });

  it("verifies within the workerd CPU budget (< 500ms)", async () => {
    const start = Date.now();
    await verify(NODE_RS_PHC, NODE_RS_PASSWORD);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
