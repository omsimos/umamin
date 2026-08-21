import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function connect() {
  return drizzle({
    connection: {
      url: process.env.TURSO_CONNECTION_URL ?? "",
      authToken: process.env.TURSO_AUTH_TOKEN ?? "",
    },
    // cache:
    //   process.env.NODE_ENV === "production"
    //     ? upstashCache({
    //         url: process.env.UPSTASH_REDIS_REST_URL ?? "",
    //         token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
    //         global: true,
    //       })
    //     : undefined,
    schema,
  });
}

type Database = ReturnType<typeof connect>;

let client: Database | undefined;

// Constructed on first property access, not at import. libSQL validates the URL
// eagerly, so a module-scope client turns "TURSO_CONNECTION_URL is unset" into a
// crash at IMPORT time — and Next evaluates route modules while collecting page
// data, which made `next build` fail with URL_INVALID wherever the env is absent
// (a fork PR's CI run, where GitHub withholds repository secrets). Deferring it
// means only code that actually queries needs the credentials.
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    client ??= connect();
    const value = Reflect.get(client, prop);
    // Bind to the real client: with the proxy as `this`, drizzle's internal
    // private-field access throws.
    return typeof value === "function" ? value.bind(client) : value;
  },
});
