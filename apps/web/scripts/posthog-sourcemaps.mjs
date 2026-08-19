import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Uploads the client bundle's source maps to PostHog error tracking, so a
// minified browser stack trace resolves back to real files and lines.
//
// Runs AFTER `vite build`, on the finished files, because rolldown minifies the
// client bundle after plugin hooks — @posthog/rollup-plugin injects its chunk-id
// marker in renderChunk and the minifier strips it back out, which silently left
// the browser assets unsymbolicated while the un-minified SSR output looked fine.
// `sourcemap process` does inject + upload against what actually shipped.
//
// CREDENTIALS are BUILD variables, set per environment in the Workers Builds
// dashboard — not VITE_* values (they are secret) and not Worker secrets (the
// Worker never uses them):
//   POSTHOG_CLI_API_KEY     personal API key; scopes `error tracking write` and
//                           `organization read`
//   POSTHOG_CLI_PROJECT_ID  270786 (project "Umamin")
//   POSTHOG_CLI_HOST        optional; defaults to https://us.posthog.com
//
// With both unset (local builds, the CI `build` job) this no-ops — and
// vite.config.ts then emits no source maps at all, so nothing is left behind for
// dist/client to serve publicly.

const { POSTHOG_CLI_API_KEY, POSTHOG_CLI_PROJECT_ID } = process.env;

if (!POSTHOG_CLI_API_KEY || !POSTHOG_CLI_PROJECT_ID) {
  console.log(
    "[posthog] POSTHOG_CLI_API_KEY / POSTHOG_CLI_PROJECT_ID unset — skipping source map upload",
  );
  process.exit(0);
}

const root = fileURLToPath(new URL("..", import.meta.url));
const directory = `${root}dist/client/assets`;

if (!existsSync(directory)) {
  console.error(`[posthog] ${directory} does not exist — did the build run?`);
  process.exit(1);
}

// Release name is fixed so every deploy accumulates under one project; the
// version is the commit, because dev/main deploy continuously and the CHANGELOG
// version covers many builds. Passed explicitly rather than letting the CLI
// derive it from git, which is not guaranteed to be readable in a build clone.
const releaseVersion =
  process.env.WORKERS_CI_COMMIT_SHA ??
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout?.trim();

const args = [
  "sourcemap",
  "process",
  "--directory",
  directory,
  "--release-name",
  "umamin-web",
  // Strips the sourceMappingURL comments and deletes the .map files once they
  // are uploaded. Without it the maps ship, and dist/client is public.
  "--delete-after",
];

if (releaseVersion) args.push("--release-version", releaseVersion);

const result = spawnSync(`${root}node_modules/.bin/posthog-cli`, args, {
  stdio: "inherit",
  env: process.env,
});

// Failing the build is deliberate: the maps are still on disk at this point, and
// a "successful" build would deploy them.
if (result.status !== 0) {
  console.error("[posthog] source map upload failed");
  process.exit(result.status ?? 1);
}
