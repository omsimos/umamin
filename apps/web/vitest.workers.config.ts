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
      // The chat Durable Objects must be exported by `main` for
      // runInDurableObject / runDurableObjectAlarm to reach them.
      main: "./test/chat-entry.ts",
      miniflare: {
        compatibilityDate: "2026-07-01",
        compatibilityFlags: ["nodejs_compat"],
        // Miniflare simulates KV (denylist tests). It does NOT simulate the
        // Workers Rate Limiting binding, so ratelimit tests drive checkRateLimit
        // with a binding stub (the plan's documented fallback).
        kvNamespaces: ["KV"],
        durableObjects: {
          CHAT_LOBBY: { className: "ChatLobby", useSQLite: true },
          CHAT_ROOM: { className: "ChatRoom", useSQLite: true },
          DM_ROOM: { className: "DmRoom", useSQLite: true },
        },
        // RL_CHAT_CONNECT is left unset: checkRateLimit fails open.
        bindings: {
          FLAGS_FORCE_ON: "umamin-chat,umamin-dm",
          APP_URL: "https://chat.test",
          // Never queried: the session resolver only builds the client, and
          // the DM socket tests stop at a missing cookie.
          TURSO_CONNECTION_URL: "http://turso.invalid",
        },
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
