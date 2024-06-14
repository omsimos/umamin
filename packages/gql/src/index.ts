import builder from "./builder";
import { rateLimitDirective } from "graphql-rate-limit-directive";

builder.queryType({});
builder.mutationType({});

import "./models/user";
import "./models/note";
import "./models/message";

export { initContextCache } from "@pothos/core";

const { rateLimitDirectiveTransformer } = rateLimitDirective();
export const gqlSchema = rateLimitDirectiveTransformer(builder.toSchema());
