import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Db } from "../../src/server-lib/db";

// Real libSQL + the actual Drizzle migrations, so SQL is exercised against the
// true schema (not a mock). libSQL can't run inside workerd (the pool has no
// native/HTTP libSQL), so these suites run in the node/jsdom pool — pure
// sha256 + drizzle, no Workers API, real read-your-writes coverage.
//
// A temp FILE (not `:memory:`): libSQL's in-memory db is CONNECTION-scoped, and
// `db.transaction()` opens its own connection that would see an empty schema —
// so any action wrapped in a transaction fails with "no such table". A file url
// is shared across connections; each call gets a fresh, isolated db.
const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/db/migrations",
);

export async function makeTestDb(): Promise<Db> {
  const client = createClient({
    url: `file:${join(tmpdir(), `umamin-test-${randomUUID()}.db`)}`,
  });

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }

  // The node libSQL driver is structurally the same LibSQLDatabase the Worker's
  // /web driver produces; the session core only uses the core query builder.
  return drizzle({ client }) as unknown as Db;
}
