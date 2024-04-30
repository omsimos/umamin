import "dotenv/config";
import builder from "./gql/builder";

builder.queryType({});
builder.mutationType({});

import "./gql/models/user";
import "./gql/models/message";

export * from "./db";
export * from "drizzle-orm";
export * as schema from "./db/schema";
export const gqlSchema = builder.toSchema();