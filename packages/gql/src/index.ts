import builder from "./builder";
import { rateLimitDirective } from "graphql-rate-limit-directive";

builder.queryType({
  subGraphs: ["www", "social", "partners"],
});

builder.mutationType({
  subGraphs: ["www", "social", "partners"],
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
export const partners_schema = rateLimitDirectiveTransformer(
  builder.toSchema({ subGraph: "partners" })
);
