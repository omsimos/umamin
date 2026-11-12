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

CI enforces this on pull requests
(`.github/scripts/check-additive-migrations.sh`). A new migration that contains
`DROP TABLE`, `DROP COLUMN`, `RENAME` or a table rebuild (`__new_`) fails unless
the file has a `-- destructive-ok: <reason>` line. Add that line only for the
contract half of an expand and contract, after the release that stopped using
the old name is live. `DROP INDEX` needs no marker.

Additive is only safe when the migration lands first. If the Worker deploys
before it, any query that selects a whole table names the new column and fails
with "no such column". The session lookup in
`apps/web/src/server-lib/session.ts` selects named columns for this reason, so
that window cannot fail sign-in. Keep it that way, and prefer named columns in
any query every request depends on. If the migrate job fails on `main`, rerun
it from the Actions tab before anything else.

A backfill can run while the old Worker still serves, and writes made by the
old code in that gap aren't in it. For Hot's people counts on `postTable`, run
the "Reconcile Hot counts" workflow (`pnpm --filter=@umamin/db reconcile:hot`)
once the deploy is live. It rewrites only the rows that are wrong.

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
