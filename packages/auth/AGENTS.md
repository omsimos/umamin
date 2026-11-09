# @umamin/auth

Auth helpers shared by both apps: session tokens and the Google OAuth client.
They replace `arctic` and `@oslojs/*`, which their author deprecated in July
2026. The code uses only Web Crypto and `fetch`, so it runs on Workers and on
Node. Consumers import the TypeScript sources directly; there is no build step.

```sh
pnpm --filter=@umamin/auth test
pnpm --filter=@umamin/auth check-types
```

## Exports

- `./session-token`: `generateSessionToken` and `hashSessionToken`. Both apps
  store the hash as the session id.
- `./google`: the authorization code flow with PKCE for Google sign-in, used by
  `apps/web/src/api/auth/google.ts`.

## Rules

- Never change `hashSessionToken`'s output. Every stored session id in both
  databases is the lowercase hex SHA-256 of a token, so a different hash or
  encoding signs out every user. `session-token.test.ts` pins a value computed
  with the old `@oslojs` code; it must keep passing.
- `decodeIdTokenClaims` doesn't check the token's signature. That is safe only
  for a token taken straight from Google's token endpoint over TLS. Don't use it
  on an ID token from any other source.
- Keep this package free of cookies, databases and framework code. Those stay in
  the apps.
- `apps/org` lists this package in `transpilePackages` in `next.config.ts`,
  like the other source-only packages.
