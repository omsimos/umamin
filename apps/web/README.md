# web

**Umamin** — the anonymous messaging platform behind [www.umamin.link](https://www.umamin.link). Runs as a single Cloudflare Worker: [TanStack Start](https://tanstack.com/start) renders the pages, [Hono](https://hono.dev) owns `/api/*`, the global middleware, and the cron handlers. Shares the design system from `@umamin/ui` and the schema from `@umamin/db`.

Replaced `apps/www` (Next.js on Vercel) in v7.0.0.

## Develop

```bash
pnpm dev:web   # from the repo root — http://localhost:5173
```

Needs a local libSQL server (`pnpm --filter=@umamin/db dev`) plus `.dev.vars` and
`.env.development`. See the root README for both files.

```bash
pnpm --filter=web check-types
pnpm --filter=web test          # jsdom + node suites
pnpm --filter=web test:workers  # workerd suites — KV, Cache API, argon2 wasm
pnpm --filter=web run build     # staging build; build:production for prod
```

## Layout

| Path              | What lives there                                                        |
| ----------------- | ------------------------------------------------------------------------ |
| `src/server.ts`   | Worker entry — the Hono app, middleware chain, and `scheduled()` crons  |
| `src/api/`        | `routes/` (cached GETs) and `actions/` (mutations), typed for `hc` client |
| `src/server-lib/` | Platform layer: session, rate limits, caching, KV, R2, push, data access  |
| `src/routes/`     | File-based TanStack Router pages                                          |
| `wrangler.jsonc`  | Bindings, vars, and cron triggers, split per environment                  |

## Notes

- **Two environments**, defined in `wrangler.jsonc` and never shared: `staging`
  (`next.umamin.link`, dev database) and `production`. Always deploy with `--env`.
- **Caching.** A Worker is the origin, so CDN `s-maxage` does not apply — public
  reads are cached in-Worker through the Cache API (`server-lib/read-route.ts`,
  the only place `caches.default` is allowed). It has no purge, so invalidation
  is TTL-only. Private reads are never cached; they go straight to Turso and are
  sent `no-store` + `Vary: Cookie`.
- **Turso bills per row scanned** — bound every list query, and never add an
  unindexed `ORDER BY` to a polled endpoint.
- **KV has no set type and is eventually consistent.** Model collections as one
  key per entry, not one JSON blob: a read-modify-write on a shared key silently
  drops concurrent writes.
- Mutations go through `action()` and read routes through
  `withPrivateRead`/`withPublicRead` — these carry the auth, rate-limit, and
  cache-header contracts, so new endpoints should use them rather than raw
  handlers.
- Deploys are run by Cloudflare Workers Builds from GitHub; CI only validates.
