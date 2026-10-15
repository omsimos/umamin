# @umamin/org-db

Drizzle schema and migrations for `apps/org`. It is a separate Turso database
from `@umamin/db`; nothing joins across the two.

```sh
pnpm --filter=@umamin/org-db generate
pnpm org:create-org            # from the root: provision an organization
pnpm --filter=@umamin/org-db reset-password
```

- Organizations are created only through the `create-org` CLI. There is no
  self-serve signup.
- `.github/workflows/migrate-org.yml` applies migrations on push to `dev` and
  `main`, like `@umamin/db`. The same migration rules apply: additive only,
  amend a migration that hasn't reached a database instead of stacking a new
  one, and re-run `generate` until it reports no changes. See
  `packages/db/AGENTS.md` for the full procedure and the SQLite foreign-key
  caveat.
