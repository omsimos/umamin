# Environment variables — `apps/web`

One rule: **public config is committed, one file per environment. Secrets never
live in a `.env.*` file.**

```
.env.development     local dev            committed   public VITE_*
.env.staging         dev.umamin.link      committed   public VITE_*
.env.production      www.umamin.link      committed   public VITE_*

.dev.vars.example    template for all three files below   committed
.dev.vars            local dev            gitignored  Worker secrets
.secrets.staging     dev.umamin.link      gitignored  Worker secrets → pushed
.secrets.production  www.umamin.link      gitignored  Worker secrets → pushed
```

Plus `wrangler.jsonc` (committed): non-secret Worker vars and the KV /
rate-limit / cron / assets bindings, per environment.

## Why the public files are in git

Vite embeds every `VITE_*` value in the browser bundle, so none of them is a
secret — they are already published to every visitor. Committing them means:

- Workers Builds builds from a clean clone, so **the file is what the deploy
  ships**. No dashboard build variable to keep in sync, and no way for an
  environment to silently lack a value another one has.
- A fresh clone runs with no setup.
- Changing one is a reviewable diff instead of an untracked dashboard edit. No
  flexibility is lost: a build variable is a *build-time* value, so changing it
  already required a rebuild and redeploy.

A Workers Builds **build variable of the same name still overrides the file** —
vite's `loadEnv` applies `process.env` after file values. So leftover dashboard
variables keep winning until you clear them, which makes the migration safe but
means git is not the source of truth until they are gone.

## Loading order

vite 8 (`getEnvFilesForMode`) and wrangler 4 (`getDefaultEnvFiles`) use the same
order, last wins:

```
.env → .env.local → .env.<mode> → .env.<mode>.local
```

- This app keeps **one file per mode and nothing else** — no `.env`, no
  `.env.local`. A `.env.local` outranks `.env` in *every* mode, which makes it an
  excellent way to poison a production build with a localhost value.
  `test/env-templates.test.ts` fails if one appears.
- **`.dev.vars` short-circuits the `.env` chain.** Wrangler only falls back to
  `.env` files when no `.dev.vars` was loaded (`getVarsForDev`), which is what
  keeps the public and secret layers separate locally. Delete `.dev.vars` and the
  Worker starts reading `.env.*` as its secrets.
- Never create `.dev.vars.staging`. Wrangler *does* read it when
  `CLOUDFLARE_ENV=staging` — which local dev sets — and it **replaces**
  `.dev.vars` rather than merging. That is why the push files are `.secrets.<env>`.

## Public variables

Full per-variable notes live in the three committed files. Values by environment:

| Variable | dev | staging | production |
| -------- | --- | ------- | ---------- |
| `VITE_SITE_URL` | `localhost:5173` | `dev.umamin.link` | `www.umamin.link` |
| `VITE_VERIFIED_USERS` | `joshxfi` | `joshxfi` | `josh,umamin,hyamero` |
| `VITE_R2_PUBLIC_URL` | dev CDN | dev CDN | prod CDN |
| `VITE_VAPID_PUBLIC_KEY` | dev pair | dev pair | own pair |
| `VITE_SOCIAL_UNDER_MAINTENANCE` | `false` | `false` | `false` |
| `VITE_ADS_ENABLED` | `true` | `false` | `true` |
| `VITE_GTM_ID` | — | — | `GTM-WLRTRLC7` |
| `VITE_POSTHOG_PROJECT_TOKEN` | — | set | set |
| `VITE_POSTHOG_HOST` | set | set | set |

All three files must carry the same key set — the test enforces it, because a key
present in one environment and missing from another is exactly how a feature ends
up silently off in one of them.

`VITE_APP_VERSION` is not an env variable: `vite.config.ts` derives it from the
top `CHANGELOG.md` heading and `define`s it at build time.

## Secrets

`Secrets` in `src/server-lib/env.ts` is the source of truth for the list;
`.dev.vars.example` is the template. Every consumer fails closed or no-ops when
its secret is absent, so a partial file still boots — the feature is just off.

To change what a deployed environment holds, edit `.secrets.<env>` and push:

```bash
pnpm --filter=web secrets:staging --dry-run   # print the plan, send nothing
pnpm --filter=web secrets:staging
pnpm --filter=web secrets:production
```

The script (`scripts/push-secrets.mjs`) **skips blank values**. Plain
`wrangler secret bulk` does not: it stores a blank as an empty string, so a
half-filled file overwrites live secrets with nothing. Deleting stays deliberate:

```bash
wrangler secret delete <NAME> --name <worker>
```

It also targets workers by **name**, not `--env`, because `wrangler.jsonc`'s
staging block is named `umamin-web` while the worker actually serving
dev.umamin.link is the top-level `umamin-web-dev` (`umamin-web` is an abandoned
stub from a single `--env staging` deploy). Reconciling that is worth doing.

To read what Cloudflare currently holds:

```bash
wrangler secret list --name umamin-web-dev
wrangler secret list --name umamin-web-production
```

### Current state

| Variable | staging | production |
| -------- | ------- | ---------- |
| `TURSO_CONNECTION_URL`, `TURSO_AUTH_TOKEN` | set | set |
| `AES_256_GCM_KEY` | set | set |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | set | set |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | set | set |
| `VAPID_SUBJECT` | **not set** | **not set** |
| `R2_*` (5) | set | set |
| `MODERATOR_USERS` | set | set |
| `LEMONSQUEEZY_*` (4) | set | **not set** |

## Build-only secrets

`POSTHOG_CLI_API_KEY` and `POSTHOG_CLI_PROJECT_ID`, read by
`scripts/posthog-sourcemaps.mjs` from the process environment after vite exits.

They are neither public (so not `VITE_*`) nor Worker secrets (the Worker never
reads them), so they are the one thing that still belongs in the Workers Builds
dashboard, per environment. Nothing loads them from a file — a local source-map
upload needs them exported in your shell. Unset ⇒ the upload no-ops **and** vite
emits no maps.

## Known gaps

- `VAPID_SUBJECT` is typed in `Secrets` and documented, but set nowhere.
- `LEMONSQUEEZY_*` is unset in production, so Pro checkout there cannot work.
  Consistent with `umamin-pro` sitting at 0% rollout.
