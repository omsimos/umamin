import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";

// MDX powers the /privacy, /terms, /child-safety docs (markdown/*.mdx). The
// plugin must sit AHEAD of viteReact so React refresh sees the compiled JSX
// (mdx emits an ESM React component); `enforce: "pre"` is what @mdx-js/rollup
// recommends for the Vite pipeline.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    { enforce: "pre", ...mdx({ remarkPlugins: [remarkGfm] }) },
    tanstackStart({ server: { entry: "./server.ts" } }),
    viteReact(),
    tailwindcss(),
  ],
});
