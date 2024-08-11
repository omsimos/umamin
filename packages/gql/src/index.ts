import builder from "./builder";
import { rateLimitDirective } from "graphql-rate-limit-directive";

builder.queryType({
  subGraphs: ["www", "social"],
});

builder.mutationType({
  subGraphs: ["www", "social"],
});

import "./models/user";
import "./models/note";
import "./models/message";

export { initContextCache } from "@pothos/core";

const { rateLimitDirectiveTransformer } = rateLimitDirective();

export const www_schema = rateLimitDirectiveTransformer(
  builder.toSchema({ subGraph: "www" })
);
export const social_schema = rateLimitDirectiveTransformer(
  builder.toSchema({ subGraph: "social" })
);
