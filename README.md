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

If you like this project, please consider giving it a star! ✨ If you wish to suggest or work on a new feature, please open an issue to discuss with the community and the project maintainers. We appreciate your interest and look forward to collaborating with you!

### Monorepo Setup
The `apps/` directory contains the Next.js projects. Packages with the `@umamin` prefix can be located at the `packages/` directory.
| Core Packages  | Description |
| ------------- | ------------- |
| `www` | **Umamin Q&A** & landing page  |
| `social` | **Umamin Social** *(coming soon)*  |
| `@umamin/db` | Database schema & migrations using Drizzle ORM  |
| `@umamin/gql` | GraphQL schema models and resolvers using Pothos  |
| `@umamin/aes` | Encryption algorithm using AES in Galois/Counter Mode (AES-GCM)  |

> [!NOTE]
> 


### Prerequisites
- [`Turso CLI`](https://docs.turso.tech/cli/installation) (for local libSQL server)
- `Node.js` >= 20 or [`nvm`](https://github.com/nvm-sh/nvm)
- `pnpm` >= 9

### Install Dependencies
If you're using `nvm`, you can easily switch to the required Node.js version.
```sh
$ nvm use 20 # ignore if you're already on Node.js >= 20
$ pnpm install
```

### Environment Variables
```env
# apps/web/.env
NEXT_PUBLIC_GQL_URL=http://localhost:3000/api/graphql
TURSO_CONNECTION_URL=http://127.0.0.1:8080
AES_KEY=7ruID/GBuS2PGiysV9KXMZ6CkC1xuUKJFWEPLYgPPo0= # must be a valid AES-GCM key

# packages/db/.env
TURSO_CONNECTION_URL=http://127.0.0.1:8080
```

To generate your own `AES_KEY`, you can use the `generateAesKey()` function.
```ts
import { generateAesKey } from "@umamin/aes";

const key = await generateAesKey();
```

If you need to use Google OAuth, you must setup your own OAuth client. [Setting up OAuth 2.0 &rarr;](https://support.google.com/cloud/answer/6158849)
```env
# apps/web/.env
GOOGLE_CLIENT_ID=CLIENT_ID
GOOGLE_CLIENT_SECRET=CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://localhost:3000/login/google/callback
```

### Development Server
You can specify which app to run a development server by including a scope (`www` or `social`).
```sh
$ pnpm dev:[scope] # dev:www
```

### Setup Database
Running a development server automatically creates a libSQL database. Run the migration command below to apply the schema.
```sh
$ pnpm db:migrate # or db:push
```

### Running Build
After making changes, you can run a build which will check for lint and type errors.
```sh
$ pnpm build:[scope] 
```

Once ready, you can submit a pull request for review.

### Contributor List
<a href="https://github.com/joshxfi/umamin/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=joshxfi/umamin" />
</a>

## Security
If you believe you have found a security vulnerability in Umamin, please do not open an issue on this repository. Opening an issue could expose sensitive information before it's addressed. Please read our [Security Policy](https://github.com/omsimos/umamin/blob/main/SECURITY.md) for details on how to report a vulnerability.

## License

Umamin is licensed under [GPL-3.0](https://github.com/joshxfi/umamin/blob/main/LICENSE)
