import { drizzle } from "drizzle-orm/libsql/web";
import * as schema from "./schema";

// HTTP-only libSQL driver for edge/Workers runtimes; same env-var contract as `.`.
export const db = drizzle({
  connection: {
    url: process.env.TURSO_CONNECTION_URL ?? "",
    authToken: process.env.TURSO_AUTH_TOKEN ?? "",
  },
  schema,
});
