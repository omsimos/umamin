import * as schema from "./schema";
import { drizzle } from "drizzle-orm/libsql";
import { upstashCache } from "drizzle-orm/cache/upstash";

export const db = drizzle({
  connection: {
    url: process.env.TURSO_CONNECTION_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
  cache:
    process.env.NODE_ENV === "production"
      ? upstashCache({
          url: process.env.UPSTASH_REDIS_REST_URL ?? "",
          token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
          global: true,
        })
      : undefined,
  schema,
});
