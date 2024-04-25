import builder from "./builder";

builder.queryType({});
builder.mutationType({});

import "./models/user";

export * from "drizzle-orm";
export * from "drizzle-orm/libsql";
export * as schema from "./schema";

export default builder;
