import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Tests don't run through Next/Turbopack, so resolve the two path aliases the
// app relies on (`@/*` from tsconfig and the `server-only` marker) here.
const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Matches tsconfig "@/*": ["./*"]. `@umamin/*` is left alone (resolved via
      // the workspace package's own `exports`).
      { find: /^@\//, replacement: root },
      // `server-only` throws when imported outside an RSC graph; stub it so
      // server-tagged modules (lib/*-json, server/feed-rank) are unit-testable.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(
          new URL("./test/stubs/server-only.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: false,
    globals: false,
  },
});
