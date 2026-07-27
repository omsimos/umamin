import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/web.ts"],
  dts: true,
});
