import "dotenv/config";
import builder from "./gql/builder";

builder.queryType({});
builder.mutationType({});

import "./gql/models/user";

export * from "./db";
export * from "drizzle-orm";
export * as schema from "./db/schema";
export const gqlSchema = builder.toSchema();
