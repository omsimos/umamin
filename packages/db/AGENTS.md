# @umamin/db

Drizzle schema and migrations for `apps/web`, on Turso (libSQL). Schema files
are in `src/schema/`, generated SQL in `migrations/`.

## Exports

- `.` builds a Node libSQL client at module init. Tests that import code using
  it must `vi.mock("@umamin/db")`.
- `./web` is the HTTP-only client for Workers. It is lazy, with the same
  `TURSO_CONNECTION_URL` / `TURSO_AUTH_TOKEN` contract.
- `./schema/*` points at the TypeScript sources.

`.` and `./web` resolve to the built `dist/`, so run `pnpm --filter=@umamin/db
build` (or any root turbo task, which builds dependencies first) after a fresh
checkout or a schema change.

## Commands

```sh
pnpm --filter=@umamin/db dev        # tsdown --watch + `turso dev` on 127.0.0.1:8080 (local.db)
pnpm --filter=@umamin/db generate   # drizzle-kit generate after a schema edit
pnpm --filter=@umamin/db studio
```

## How migrations ship

`.github/workflows/migrate.yml` applies migrations on push to `dev` (staging
database) and `main` (production database) when `migrations/**` changes. The
GitHub environment supplies the `TURSO_*` secrets. The app deploys from the same
push, and the two are not ordered.

So every migration must be additive. For anything destructive, expand and
contract over separate releases: add the new column, deploy code that uses it,
then drop the old column in a later release.

## Writing a migration

- Edit `src/schema/`, then run `generate`. Commit the `.sql` file, its
  `meta/NNNN_snapshot.json`, and the `_journal.json` entry together.
- If a migration hasn't reached any database yet (not on `dev` or `main`),
  amend it instead of stacking a new one. Edit the schema, run `generate`, fold
  the new SQL and snapshot changes into the existing `NNNN_*` pair, delete the
  temporary pair and its `_journal.json` entry. Then run `generate` again; it
  must print "No schema changes", or the snapshot doesn't match and a phantom
  migration will appear.
- SQLite `ALTER TABLE ADD COLUMN` can't carry a foreign-key action. Drizzle
  emits a bare `REFERENCES`, so a cascade added to an existing table silently
  becomes `NO ACTION`. Put foreign-key-action columns in the original
  `CREATE TABLE`, or use a soft reference (no FK) that the read path resolves to
  null. Self-references need `(): AnySQLiteColumn => table.id` typing.
- A bulk update keyed on a nullable soft-reference column needs a partial index
  (`WHERE col IS NOT NULL`), or Turso scans and bills every row.
- libSQL runs `PRAGMA foreign_keys=ON` by default, so `onDelete: "cascade"` on a
  `CREATE TABLE` column is reliable.

## Validating locally

`drizzle-kit migrate` with the turso dialect rejects an empty `authToken`, even
for a `file:` URL. Instead:

- To check SQL, apply the `.sql` files through `@libsql/client` against a
  temporary `file:` database, splitting on `--> statement-breakpoint`. Use
  `EXPLAIN QUERY PLAN` to confirm an index seek instead of `SCAN`.
- To bring the running local server up to date, call `migrate()` from
  `drizzle-orm/libsql/migrator` against `http://127.0.0.1:8080`. Over HTTP,
  `PRAGMA foreign_keys=OFF` only holds inside one `executeMultiple` call.

If local signup fails with a missing or unknown column, `local.db` has drifted
behind the migrations. Back it up, then rebuild it or migrate it as above.
