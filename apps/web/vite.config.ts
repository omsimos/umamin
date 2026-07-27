import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";

// Displayed app version comes from the top CHANGELOG entry — the same source
// the release pipeline tags from (mirrors apps/www next.config.ts). It also
// versions the service-worker registration (/sw.js?v=…), which is what rotates
// PWA cache names on each release — without it installed users keep stale
// caches after a deploy.
function getAppVersion(): string {
  for (const path of [
    join(process.cwd(), "../../CHANGELOG.md"),
    join(process.cwd(), "CHANGELOG.md"),
  ]) {
    try {
      const match = readFileSync(path, "utf8").match(/^## \[([^\]]+)\]/m);
      if (match) return `v${match[1]}`;
    } catch {
      // try the next candidate path
    }
  }
  return "v0.0.0";
}

// MDX powers the /privacy, /terms, /child-safety docs (markdown/*.mdx). The
// plugin must sit AHEAD of viteReact so React refresh sees the compiled JSX
// (mdx emits an ESM React component); `enforce: "pre"` is what @mdx-js/rollup
// recommends for the Vite pipeline.
export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(getAppVersion()),
  },
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
