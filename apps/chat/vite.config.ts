import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // tanstackRouter must precede react()
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      // Colocated route tests aren't routes.
      routeFileIgnorePattern: "\\.test\\.tsx?$",
    }),
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  server: {
    // Native FS watching doesn't reliably deliver change events on this setup,
    // so HMR (and even hard reloads) serve stale modules until a dev restart.
    // Polling detects edits deterministically.
    watch: { usePolling: true },
  },
});
