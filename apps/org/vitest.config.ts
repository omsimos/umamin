import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Matches tsconfig "@/*": ["./*"]. @umamin/* resolves via package exports.
      { find: /^@\//, replacement: root },
      // server-only throws outside an RSC graph; stub it so server-tagged
      // modules are unit-testable.
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
