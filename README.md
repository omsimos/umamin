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

### Monorepo Setup

| Core Packages        | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| `www`                | **Umamin Q&A** & landing page (Next.js)                          |
| `@umamin/db`         | Database schema & migrations using Drizzle ORM + Turso/libSQL    |
| `@umamin/encryption` | AES-GCM encryption/decryption utilities (uses `AES_256_GCM_KEY`) |
| `@umamin/ui`         | Shared UI components and styling                                 |

### Prerequisites

- [`Turso CLI`](https://docs.turso.tech/cli/installation) (for local libSQL server)
- `Node.js` >= 20.19 or [`nvm`](https://github.com/nvm-sh/nvm)
- `pnpm` >= 10

### Install Dependencies

If you're using `nvm`, you can easily switch to the required Node.js version.

```sh
$ nvm use 20 # ignore if you're already on Node.js >= 20
$ pnpm install
```

### Environment Variables

```env
# apps/www/.env
# Database (used via @umamin/db)
TURSO_CONNECTION_URL=http://127.0.0.1:8080
TURSO_AUTH_TOKEN= # can be empty for local

# Encryption
AES_256_GCM_KEY=REPLACE_WITH_BASE64_KEY

# Google OAuth (optional)
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# packages/db/.env (for drizzle-kit CLI)
TURSO_CONNECTION_URL=http://127.0.0.1:8080
TURSO_AUTH_TOKEN= # can be empty for local
```

Generate an AES-256-GCM key using the helper script:

```sh
$ pnpm aes:generate
# copy the printed key into AES_256_GCM_KEY
```

If you need to use Google OAuth, you must set up your own OAuth client. [Setting up OAuth 2.0 →](https://support.google.com/cloud/answer/6158849)

### Development Server

Run the development servers with Turborepo:

```sh
$ pnpm dev # runs app(s) and local db dev (if configured)
```

Run a specific app only:

```sh
$ pnpm dev --filter=www
```

### Setup Database

Start a local libSQL server and run migrations.

```sh
# optional: start local libSQL (turso dev) alongside type-checker
$ pnpm --filter=@umamin/db dev

# generate migrations from schema changes
$ pnpm db:generate

# apply migrations
$ pnpm db:migrate

# open drizzle studio
$ pnpm db:studio
```

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
