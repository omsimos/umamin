import { drizzle } from "drizzle-orm/libsql/web";
import * as schema from "./schema";

// HTTP-only libSQL driver for edge/Workers runtimes; same env-var contract as `.`,
// and lazy for the same reason — see the note in ./index.ts.
function connect() {
  return drizzle({
    connection: {
      url: process.env.TURSO_CONNECTION_URL ?? "",
      authToken: process.env.TURSO_AUTH_TOKEN ?? "",
    },
    schema,
  });
}

type Database = ReturnType<typeof connect>;

let client: Database | undefined;

export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    client ??= connect();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
