import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Spike config (Phase 0): runs server-side tests inside workerd via miniflare.
// The v4 pool ships as a Vite plugin (`cloudflareTest`) — the old
// `defineWorkersConfig` / `./config` export was removed. Kept separate from
// vitest.config.ts so the default `test` script stays on the node/jsdom runner.
export default defineConfig({
  test: {
    include: ["**/*.worker.test.ts"],
  },
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: "2026-07-01",
        compatibilityFlags: ["nodejs_compat"],
        // Miniflare simulates KV (denylist tests). It does NOT simulate the
        // Workers Rate Limiting binding, so ratelimit tests drive checkRateLimit
        // with a binding stub (the plan's documented fallback).
        kvNamespaces: ["KV"],
        // Workers forbids runtime Wasm compilation (WebAssembly.compile(bytes)).
        // The only supported path is a precompiled module: this rule makes a
        // `.wasm` import resolve to a CompiledWasm binding (bundled + compiled at
        // deploy), matching wrangler's default `**/*.wasm` rule. Argon2 depends on
        // this — see argon2.worker.test.ts (spike A).
        modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
      },
    }),
  ],
});
