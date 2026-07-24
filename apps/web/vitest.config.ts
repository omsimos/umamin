import { fileURLToPath } from "node:url";
import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vitest/config";

// Plain node/jsdom runner. The @cloudflare/vitest-pool-workers integration is
// reserved for server-lib/API suites (see vitest.workers.config.ts); the Hono
// app and its handlers run fine under node for contract-level tests, and the
// ported component suites need jsdom + the React plugin + the `@/` alias.
const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  // mdx (ahead of react) lets the /privacy, /terms, /child-safety doc-route
  // smoke test import and render markdown/*.mdx under jsdom.
  plugins: [
    { enforce: "pre", ...mdx({ remarkPlugins: [remarkGfm] }) },
    react(),
  ],
  resolve: {
    // Matches tsconfig "@/*": ["./src/*"]. `@umamin/*` is left alone (resolved
    // via the workspace package's own `exports`).
    alias: [{ find: /^@\//, replacement: `${src}/` }],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: false,
    globals: false,
    // *.worker.test.ts run under vitest.workers.config.ts (workerd/miniflare).
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.worker.test.ts"],
  },
});
