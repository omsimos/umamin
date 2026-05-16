<div align="center">
  <img src="https://github.com/omsimos/umamin/assets/69457996/5a7250dc-c65e-4251-8fa9-425006dccb02" width="150" />

  <h1>Umamin</h1>
</div>

<div align="center">
  <p>An open-source social platform for sending and receiving encrypted anonymous messages. 🔏</p>

  <img src="https://github.com/omsimos/umamin/actions/workflows/ci.yml/badge.svg" alt="actions">
  <img src="https://img.shields.io/github/v/release/omsimos/umamin.svg" alt="releases">
  <img src="https://img.shields.io/github/stars/omsimos/umamin" alt="stars">
</div>

<br/>

## Contributing

If you like this project, please consider giving it a star! ✨ If you wish to suggest or work on a new feature, please open an issue to discuss with the community and the project maintainers. We appreciate your interest and look forward to collaborating with you! Please review our [Code of Conduct](./CODE_OF_CONDUCT.md) before contributing.

### Architecture

Umamin is split into a Next.js frontend and a Hono backend, deployed independently:

```
Browser ──► apps/www (Next.js, Vercel) ──► apps/api (Hono, Railway) ──► Turso / libSQL
```

- The frontend never talks to the database directly. All reads and writes — including AES decryption of message content — happen server-side in the Hono API.
- Sessions are issued by the api as cookies; in production they're scoped to a shared parent domain via `SESSION_COOKIE_DOMAIN`.

### Monorepo Setup

| Package              | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| `apps/www`           | **Umamin Q&A** & landing page (Next.js, deploys to Vercel)       |
| `apps/api`           | Hono API server (deploys to Railway)                             |
| `@umamin/core`       | Shared data access, mutations, validation                        |
| `@umamin/db`         | Database schema & migrations using Drizzle ORM + Turso/libSQL    |
| `@umamin/encryption` | AES-GCM encryption/decryption utilities (uses `AES_256_GCM_KEY`) |
| `@umamin/ui`         | Shared UI components and styling                                 |

### Prerequisites

- [`Turso CLI`](https://docs.turso.tech/cli/installation) (for local libSQL server)
- `Node.js` >= 24 or [`nvm`](https://github.com/nvm-sh/nvm)
- `pnpm` >= 10

### Install Dependencies

If you're using `nvm`, you can easily switch to the required Node.js version.

```sh
$ nvm use 24 # ignore if you're already on Node.js >= 24
$ pnpm install
```

### Environment Variables

Each package has its own `.env.example`. Copy them to `.env` and fill in:

```sh
$ cp apps/api/.env.example apps/api/.env
$ cp apps/www/.env.example apps/www/.env
$ cp packages/db/.env.example packages/db/.env
```

| File                    | Purpose                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `apps/api/.env`         | Hono server: Turso, AES key, Google OAuth, CORS, session cookie domain                    |
| `apps/www/.env`         | Next.js frontend: `NEXT_PUBLIC_API_ORIGIN` and a few feature flags                        |
| `packages/db/.env`      | `pnpm db:seed` (needs `AES_256_GCM_KEY`); drizzle-kit also reads it for remote migrations |

Locally, `TURSO_CONNECTION_URL` defaults to `http://127.0.0.1:8080` and the auth token is unused, so you can leave those blank.

Generate an AES-256-GCM key with the helper script and copy the same value into **both** `apps/api/.env` and `packages/db/.env` — if they drift, seeded messages won't decrypt:

```sh
$ pnpm aes:generate
```

If you need Google OAuth, set up your own OAuth client and point the redirect URI at the api (`http://localhost:8787/auth/google/callback` in dev). [Setting up OAuth 2.0 →](https://support.google.com/cloud/answer/6158849)

### Development Server

Run all dev servers with Turborepo:

```sh
$ pnpm dev # starts www (3000), api (8787), and the local libSQL server (8080)
```

Run a specific app only:

```sh
$ pnpm dev --filter=www
$ pnpm dev --filter=api
```

### Setup Database

Start a local libSQL server and run migrations.

```sh
# start the local libSQL server (turso dev) — also started automatically by `pnpm dev`
$ pnpm --filter=@umamin/db dev

# generate migrations from schema changes
$ pnpm db:generate

# apply migrations
$ pnpm db:migrate

# open drizzle studio
$ pnpm db:studio

# reset & seed the database with demo data (requires AES_256_GCM_KEY in packages/db/.env)
$ pnpm db:seed

# seeded test account
# username: testuser
# password: 12345
```

### Deployment

- **`apps/www` → Vercel.** Set `NEXT_PUBLIC_API_ORIGIN` to your Railway API URL and `SESSION_COOKIE_DOMAIN` to a leading-dot parent domain shared with the api.
- **`apps/api` → Railway.** Service root stays at the repo root; `railway.json` at the root scopes builds via `watchPatterns` so pushes that only touch `apps/www` don't redeploy the api.

### Running Build

After making changes, build the project (runs lint and type checks via tasks).

```sh
$ pnpm build # build all
# or
$ pnpm build --filter=www
```

Once ready, you can submit a pull request for review.

### Contributor List

<a href="https://github.com/omsimos/umamin/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=omsimos/umamin" />
</a>

## Code of Conduct

We are committed to fostering a welcoming, respectful community. Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md) when participating in this project.

## Security

If you believe you have found a security vulnerability in Umamin, please do not open a public issue on this repository. Opening a public issue could expose sensitive information before it's addressed. Please read our [Security Policy](./SECURITY.md) for details on how to report a vulnerability.

## License

Umamin is licensed under [GPL-3.0](https://github.com/omsimos/umamin/blob/main/LICENSE).
