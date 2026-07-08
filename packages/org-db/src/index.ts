import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export const db = drizzle({
  connection: {
    url: process.env.TURSO_CONNECTION_URL ?? "",
    authToken: process.env.TURSO_AUTH_TOKEN ?? "",
  },
  schema,
});
