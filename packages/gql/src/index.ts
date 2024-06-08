import builder from "./builder";

builder.queryType({});
builder.mutationType({});

import "./models/user";
import "./models/note";
import "./models/message";

export { initContextCache } from "@pothos/core";

export const gqlSchema = builder.toSchema();
