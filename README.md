<div align="center">
  <img src="https://github.com/omsimos/umamin/assets/69457996/5a7250dc-c65e-4251-8fa9-425006dccb02" width="150" />

  <h1>Umamin</h1>
</div>

<div align="center">
  <p>An open-source social platform for sending and receiving encrypted anonymous messages. 🔏</p>

  <img src="https://github.com/joshxfi/umamin/actions/workflows/ci.yml/badge.svg" alt="actions">
  <img src="https://img.shields.io/github/v/release/joshxfi/umamin.svg" alt="releases">
  <img src="https://img.shields.io/github/stars/joshxfi/umamin" alt="stars">
</div>

<br/>

## Contributing

If you like this project, please consider giving it a star! ✨ If you wish to suggest or work on a new feature, please open an issue to discuss with the community and the project maintainers. We appreciate your interest and look forward to collaborating with you!

### Monorepo Setup
| Core Packages  | Description |
| ------------- | ------------- |
| `www` | **Umamin Q&A** & landing page  |
| `@umamin/ui` | Shared UI components |
| `@umamin/db` | Database schema & migrations using Drizzle ORM (libSQL/Turso) |
| `@umamin/encryption` | Encryption algorithm using AES in Galois/Counter Mode (AES-GCM)  |

### Prerequisites
- [`Turso CLI`](https://docs.turso.tech/cli/installation) (for local libSQL server)
- `Node.js` >= 20 or [`nvm`](https://github.com/nvm-sh/nvm)
- `pnpm` 10.x

### Install Dependencies
If you're using `nvm`, you can easily switch to the required Node.js version.
```sh
nvm use 20  # ignore if you're already on Node.js >= 20
pnpm install
```

### Environment Variables
```env
# apps/www/.env
TURSO_CONNECTION_URL=http://127.0.0.1:8080
# Optional if your database requires an auth token
TURSO_AUTH_TOKEN=

# AES‑GCM 256-bit key in base64 for encrypting messages
AES_256_GCM_KEY=7ruID/GBuS2PGiysV9KXMZ6CkC1xuUKJFWEPLYgPPo0=

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

Generate an AES‑GCM key in base64 (Node 20+):
```ts
// Run in a Node REPL or small script
async function generateAes256GcmKeyBase64() {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  return Buffer.from(new Uint8Array(raw)).toString('base64');
}
generateAes256GcmKeyBase64().then(console.log);
```

If you need to use Google OAuth, set up your own OAuth client: [Setting up OAuth 2.0 →](https://support.google.com/cloud/answer/6158849)

### Development Server
Run all apps in dev mode:
```sh
pnpm dev
```

Or run a specific app:
```sh
pnpm --filter=www dev
```

### Setup Database
With Turso CLI running (or a local libSQL server), apply migrations:
```sh
pnpm db:migrate
```
Other useful database commands:
```sh
pnpm db:generate   # generate SQL from schema
pnpm db:studio     # open Drizzle Studio
```

### Running Build
Build everything:
```sh
pnpm build
```
Build a specific app or package:
```sh
pnpm --filter=www build
```

Once ready, you can submit a pull request for review.

### Contributor List
<a href="https://github.com/joshxfi/umamin/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=joshxfi/umamin" />
</a>

## Security
If you believe you have found a security vulnerability in Umamin, please do not open a public issue. Instead, open a private security advisory on GitHub or contact the maintainers directly.

## License

Umamin is licensed under [GPL-3.0](https://github.com/joshxfi/umamin/blob/main/LICENSE)

