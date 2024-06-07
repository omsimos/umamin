import "dotenv/config";
import builder from "./src/gql/builder";

builder.queryType({});
builder.mutationType({});

import "./src/gql/models/user";
import "./src/gql/models/note";
import "./src/gql/models/message";

export * from "./src/db";
export * from "drizzle-orm";
export * as schema from "./src/db/schema";
export { initContextCache } from "@pothos/core";

export const gqlSchema = builder.toSchema();
