import { drizzle } from "drizzle-orm/libsql/web";
import type { AppEnv } from "./env";

// Turso/libSQL client for the Worker, built PER REQUEST from the binding env
// (the Workers pattern) rather than from module-init `process.env` — @umamin/db
// and @umamin/db/web both read process.env at import, which isn't the right
// lifecycle here. Same schema, same DB, HTTP driver (fact #7). The session core
// and read/action handlers receive this instance so they stay pure + testable
// (a :memory: libSQL client is drop-in for tests).
export type Db = ReturnType<typeof drizzle>;

export function getDb(env: AppEnv): Db {
  return drizzle({
    connection: {
      url: env.TURSO_CONNECTION_URL ?? "",
      authToken: env.TURSO_AUTH_TOKEN ?? "",
    },
  });
}
