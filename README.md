<div align="center">
  <img src="https://github.com/omsimos/umamin/assets/69457996/5a7250dc-c65e-4251-8fa9-425006dccb02" width="150" />

  <h1>Umamin</h1>
</div>

<div align="center">
  <p>An open-source platform for anonymous communication. 🔏</p>

  <img src="https://github.com/omsimos/umamin/actions/workflows/ci.yml/badge.svg" alt="actions">
  <img src="https://img.shields.io/github/v/release/omsimos/umamin.svg" alt="releases">
  <img src="https://img.shields.io/github/stars/omsimos/umamin" alt="stars">
</div>

<br/>

## Overview

This monorepo hosts two open-source apps for anonymous communication:

- **Umamin** — [www.umamin.link](https://www.umamin.link) — the main social platform: a profile-based inbox for sending and receiving **encrypted anonymous messages**. Built with TanStack Start and Hono on Cloudflare Workers, with Drizzle ORM and Turso/libSQL.
- **Umamin Chat** — [chat.umamin.link](https://chat.umamin.link) — **ephemeral, anonymous 1:1 chat**: get matched with a stranger who shares your interests. No sign-up, no history, nothing saved. Built with Vite, React, and Convex.

## Contributing

If you like this project, please consider giving it a star! ✨ If you wish to suggest or work on a new feature, please open an issue to discuss with the community and the project maintainers. We appreciate your interest and look forward to collaborating with you! Please review our [Code of Conduct](./CODE_OF_CONDUCT.md) before contributing.

### Monorepo Structure

**Apps**

| App         | Description                                                                          |
| ----------- | ------------------------------------------------------------------------------------ |
| `apps/web`  | **Umamin** — anonymous messaging platform & landing page (TanStack Start + Hono, Cloudflare Workers) |
| `apps/chat` | **Umamin Chat** — ephemeral, anonymous stranger chat (Vite + React + Convex)         |

> `apps/web` is the app that serves [www.umamin.link](https://www.umamin.link). It replaced the original Next.js build in v7.0.0, which has since been removed — see the `legacy/www-final` tag for its final state.

**Packages**

| Package              | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `@umamin/db`         | Database schema & migrations using Drizzle ORM + Turso/libSQL            |
| `@umamin/encryption` | AES-GCM encryption/decryption utilities (uses `AES_256_GCM_KEY`)         |
| `@umamin/ui`         | Shared UI components and styling (used by every app)                     |

### Prerequisites

- [`Turso CLI`](https://docs.turso.tech/cli/installation) — local libSQL server for **web**
- `Node.js` >= 24 or [`nvm`](https://github.com/nvm-sh/nvm)
- `pnpm` >= 10

> **Umamin (web)** runs on Cloudflare Workers via `wrangler`, which is already a dev dependency — no global install and no Cloudflare account are needed for local development. Workers KV and the rate-limit bindings are emulated locally by Miniflare.

> **Umamin Chat** uses [Convex](https://www.convex.dev) as its backend. `pnpm dev:chat` starts a local Convex deployment automatically (no account or extra install needed), and the chat falls back to an in-memory mock when `VITE_CONVEX_URL` is unset — so you can work on its UI without a backend.

### Install Dependencies

If you're using `nvm`, you can easily switch to the required Node.js version.

```sh
$ nvm use 24 # ignore if you're already on Node.js >= 24
$ pnpm install
```

### Environment Variables

`apps/web` splits configuration on one axis: **public config is committed, one
file per environment; secrets are never in a `.env.*` file.**

- **`apps/web/.env.development` / `.env.staging` / `.env.production`** — public
  `VITE_*` values, **in git**. Vite embeds them in the browser bundle, so none is
  a secret, and Workers Builds builds from a clean clone — the committed file is
  what the deploy ships.
- **`apps/web/.dev.vars`** — Worker secrets for local dev, gitignored. Copy
  `.dev.vars.example`.
- **`apps/web/.secrets.staging` / `.secrets.production`** — gitignored mirrors of
  what Cloudflare should hold. Push with `pnpm --filter=web secrets:<env>`.

```env
# apps/web/.dev.vars — Worker-side (secret)
TURSO_CONNECTION_URL=http://127.0.0.1:8080
TURSO_AUTH_TOKEN= # can be empty for local
AES_256_GCM_KEY=REPLACE_WITH_BASE64_KEY

# Google OAuth (optional)
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
```

```env
# packages/db/.env (for the drizzle-kit CLI)
TURSO_CONNECTION_URL=http://127.0.0.1:8080
TURSO_AUTH_TOKEN= # can be empty for local
```

Non-secret Worker vars and the KV / rate-limit / cron bindings live in
`apps/web/wrangler.jsonc`, split per environment. Full map, including the
build-only source-map credentials and how to audit what a deploy holds:
[`apps/web/ENVIRONMENT.md`](apps/web/ENVIRONMENT.md).

## Code of Conduct

We are committed to fostering a welcoming, respectful community. Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md) when participating in this project.

## Security

If you believe you have found a security vulnerability in Umamin, please do not open a public issue on this repository. Opening a public issue could expose sensitive information before it's addressed. Please read our [Security Policy](./SECURITY.md) for details on how to report a vulnerability.

## License

Umamin is licensed under [GPL-3.0](https://github.com/omsimos/umamin/blob/main/LICENSE).
