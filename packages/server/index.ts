import "dotenv/config";
import builder from "./gql/builder";
import * as schema from "./db/schema";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client/web";

builder.queryType({});
builder.mutationType({});

import "./gql/models/user";

const client = createClient({
  url: process.env.TURSO_CONNECTION_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export const db = drizzle(client, { schema });

export * from "drizzle-orm";
export * as schema from "./db/schema";
export const gqlSchema = builder.toSchema();
