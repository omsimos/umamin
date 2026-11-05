import { drizzle } from "drizzle-orm/libsql/web";
import type { AppEnv } from "./env";

// Turso/libSQL client for the Worker, built PER REQUEST from the binding env
// (the Workers pattern) rather than from module-init `process.env` — @umamin/db
// and @umamin/db/web both read process.env at import, which isn't the right
// lifecycle here. Same schema, same DB, HTTP driver (fact #7). The session core
// and read/action handlers receive this instance so they stay pure + testable
// (a :memory: libSQL client is drop-in for tests).
export type Db = ReturnType<typeof drizzle>;

// Without a deadline a stalled Turso request holds the Worker (or a Durable
// Object) until the platform kills it, and the user waits the whole time. A
// healthy query from Southeast Asia takes well under a second.
export const DB_REQUEST_TIMEOUT_MS = 8_000;

function timeoutFetch(request: Request): Promise<Response> {
  return fetch(request, { signal: AbortSignal.timeout(DB_REQUEST_TIMEOUT_MS) });
}

export function getDb(env: AppEnv): Db {
  return drizzle({
    connection: {
      url: env.TURSO_CONNECTION_URL ?? "",
      authToken: env.TURSO_AUTH_TOKEN ?? "",
      fetch: timeoutFetch,
    },
  });
}
