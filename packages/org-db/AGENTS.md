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
- `reset-password` issues a new default password and deletes the
  organization's sessions. The app's Redis session cache can keep a recently
  used session alive for up to 60 seconds after that.
- `.github/workflows/migrate-org.yml` applies migrations on push to `dev` and
  `main`, like `@umamin/db`. The same migration rules apply: additive only,
  amend a migration that hasn't reached a database instead of stacking a new
  one, and re-run `generate` until it reports no changes. CI fails a new
  migration that drops or renames without a `-- destructive-ok: <reason>`
  line. See `packages/db/AGENTS.md` for the full procedure and the SQLite
  foreign-key caveat.
