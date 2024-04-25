import { createYoga } from "graphql-yoga";
import builder from "@umamin/db";

const { handleRequest } = createYoga({
  schema: builder.toSchema(),

  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
});

export {
  handleRequest as GET,
  handleRequest as POST,
  handleRequest as OPTIONS,
};
