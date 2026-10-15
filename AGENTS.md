<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Umamin monorepo

pnpm + Turborepo. This file covers the whole repo. Each workspace has its own
`AGENTS.md` with the rules for that code; read it before editing there.

| Workspace | What it is | Notes |
| --- | --- | --- |
| `apps/web` | Umamin, `www.umamin.link`. Also Umamin Chat at `/chat`. | Production. TanStack Start + Hono on one Cloudflare Worker. See `apps/web/AGENTS.md`. |
| `apps/org` | Umamin for Organizations, invite-only anonymous messaging | Next.js on Vercel, low activity. See `apps/org/AGENTS.md`. |
| `packages/db` | `@umamin/db`, Drizzle schema and migrations for `apps/web` | See `packages/db/AGENTS.md`. |
| `packages/org-db` | `@umamin/org-db`, the separate database for `apps/org` | See `packages/org-db/AGENTS.md`. |
| `packages/ui` | `@umamin/ui`, the shared design system (shadcn + Radix) | Used by both apps. See `packages/ui/AGENTS.md`. |
| `packages/encryption` | `@umamin/encryption`, AES-256-GCM helpers | See `packages/encryption/AGENTS.md`. |

New product work goes in `apps/web`. Two apps were folded into it and deleted.
Their final source lives in tags, not branches: `legacy/www-final` (the Next.js
build) and `legacy/chat-final` (the Vite + Convex chat). Don't recreate them.

## Commands

Node 24 and the pnpm version pinned in `package.json`. Run everything from the
repo root.

```sh
pnpm install
pnpm dev:web               # apps/web
pnpm dev:org               # apps/org on :3001
pnpm build                 # turbo build, all workspaces
pnpm check-types           # turbo check-types
pnpm test                  # every workspace's `test` script
pnpm --filter=web test:workers   # apps/web workerd suites, NOT covered by `pnpm test`
pnpm biome ci .            # what CI runs for formatting and lint
```

Scope a task to one workspace with `pnpm --filter=<name> <script>`. Package
names are `web`, `org`, `@umamin/db`, `@umamin/org-db`, `@umamin/ui`,
`@umamin/encryption`.

Turbo caches `check-types` and `test`. After a dependency change, pass
`--force` or you can get a stale pass.

## Before you call something done

Run the same four checks CI runs:

1. `pnpm check-types`
2. `pnpm test`
3. `pnpm --filter=web test:workers` (if you touched `apps/web`)
4. `pnpm biome ci .`

Lefthook runs `biome check --write` on staged files at commit time and may
rewrite import order or wrapping inside your commit. Its glob skips CSS, so run
`pnpm biome ci .` yourself after editing a stylesheet.

## Commits and pull requests

- Conventional Commits, subject line only, no body: `feat(scope): ...`,
  `fix(scope): ...`, `chore: ...`, `docs: ...`, `perf: ...`. Lowercase,
  imperative, no trailing period.
- Scopes in use: `web`, `social`, `ui`, `auth`, `security`, `a11y`, `seo`,
  `perf`, `ci`.
- PR titles follow the same format.
- Never name competitor products (for example Twitter/X) in commits, code
  comments, UI copy or the changelog.
- `dev` is the integration branch. `main` is production. Don't push to either
  without the maintainer's go-ahead.

## Changelog

`CHANGELOG.md` at the root tracks `apps/web`. `apps/org` keeps its own.

- Keep a Changelog + SemVer, newest first: `## [x.y.z] - YYYY-MM-DD`.
- Section order, omitting empty ones: Added, Changed, Fixed, Performance &
  Cost, Security & Privacy, Accessibility, SEO, Deprecated, Removed. No emojis.
- Write what a user notices, not the implementation. Tooling-only changes (a
  TypeScript bump, a lint rule) get no entry.
- Add the compare link at the bottom:
  `[x.y.z]: https://github.com/omsimos/umamin/compare/vPrev...vx.y.z`.
- The top `## [x.y.z]` heading drives releases. `ci.yml` publishes it as a
  GitHub release on push to `main`, and `apps/web/vite.config.ts` reads it at
  build time for the navbar version and the `/sw.js?v=` cache key. A wrong top
  heading ships a wrong version and stale PWA caches.

## CI and deploys

- `.github/workflows/ci.yml` validates and never deploys. Jobs: `build`,
  `verify` (typecheck plus both `apps/web` test runners), `quality` (Biome),
  `release`. It runs on PRs and on pushes to `main`. A push to `dev` alone runs
  nothing; the PR is the gate.
- Cloudflare Workers Builds deploys `apps/web` from GitHub: `dev` to staging
  (`dev.umamin.link`), `main` to production. It builds from a clean clone, so
  anything gitignored never reaches a deploy.
- Vercel deploys `apps/org`.
- `migrate.yml` and `migrate-org.yml` apply Drizzle migrations on push to
  `dev`/`main` when the migrations folder changes. See `packages/db/AGENTS.md`
  before writing a migration: code and migrations deploy on the same push in
  no guaranteed order.
- Keep `TURBO_TOKEN` scoped to the jobs that need it. A workflow-level secret
  reaches every third-party action, including `release`, which holds
  `contents: write`.

## Testing conventions

- Vitest 4 everywhere, `globals: false`. Import `describe`, `it`, `expect` and
  `vi` from `vitest` explicitly.
- The turbo `test` task depends on `^build`. `@umamin/db` resolves to its built
  `dist/`, and Vitest must resolve it even when the test mocks it, so a fresh
  checkout fails with "Failed to resolve import" until dependencies build.
  `pnpm test` from the root handles this.
- Write tests that can fail for a real reason. No literal-vs-literal
  assertions, no "this option is a function", no re-asserting static copy. Before
  calling a new test useful, check that it fails against the old behavior.

## TypeScript

- TypeScript 7 (the native Go compiler) everywhere except `apps/org`, which
  stays on 6 because Next.js doesn't support 7 yet. The split is deliberate; don't
  align them. Check with `pnpm exec tsc --version` inside a workspace.
- TypeScript only type-checks. tsdown builds the packages and Vite/Next build
  the apps.
- tsdown embeds the TypeScript API for `.d.ts` output. It must stay at
  `^0.22.14` or newer while on TS 7; older `rolldown-plugin-dts` reads `ts.sys`,
  which the Go port doesn't ship.
- `types` defaults to `[]`. Each tsconfig lists its ambient types; add a new
  `@types/*` package there.
- No `baseUrl` (removed in 7). `paths` entries are relative to the tsconfig.
- `noUncheckedSideEffectImports` is on, so import CSS through an explicit
  `*.css` subpath.

## Dependencies that must move together

Some packages are shared through peer resolution, so bumping them in one
workspace breaks another with errors that never name the cause. Update them in
every workspace in the same change, then run `pnpm check-types --force`,
`pnpm test --force` and `pnpm --filter=web test:workers`.

- `@types/react` and `@types/react-dom`: pinned exact (no `^` or `~`) at
  `19.2.x`. 19.3 breaks `next-themes` children typing and TanStack's inline
  `errorComponent` props in every app. pnpm rewrites `~` to `^`, which lets
  19.3 back in.
- `react` and `react-dom`: one version workspace-wide. `@umamin/ui` owns Radix,
  so a split gives two React copies and `Cannot read properties of null
  (reading 'useState')` in component tests.
- `vitest`: one version, and it stays on 4.x while
  `@cloudflare/vitest-pool-workers` peers on it. A patch-level split detaches
  `@testing-library/jest-dom` matchers (TS2339 on `toBeInTheDocument`).

## Code style

- Biome formats and lints. Don't hand-format.
- Comments explain a non-obvious why. Don't restate the code.
- UI copy and user-facing docs: plain sentences, sentence-case headings, no em
  dashes.
- `apps/web` carries many "ported from apps/www" comments. They record why the
  code has its shape; keep them.

## Local-only folders

`docs/superpowers/`, `plans/` and `apps/web/store-assets/` are excluded through
`.git/info/exclude` on the maintainer's machine. They may hold plans and design
notes locally, but they are not in the repo, so don't rely on them existing.
