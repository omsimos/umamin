import { gqlSchema } from "@umamin/server";
import { createYoga } from "graphql-yoga";

const { handleRequest } = createYoga({
  schema: gqlSchema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
});

export {
  handleRequest as GET,
  handleRequest as POST,
  handleRequest as OPTIONS,
};
