import { getSession } from "@/lib/auth";
import { createYoga } from "graphql-yoga";
import { useAPQ } from "@graphql-yoga/plugin-apq";
import { gqlSchema, initContextCache } from "@umamin/gql";
import { useCSRFPrevention } from "@graphql-yoga/plugin-csrf-prevention";
import { useDisableIntrospection } from "@graphql-yoga/plugin-disable-introspection";

const { handleRequest } = createYoga({
  schema: gqlSchema,
  context: async () => {
    const { session } = await getSession();

    return {
      ...initContextCache(),
      userId: session?.userId,
    };
  },
  graphqlEndpoint: "/api/graphql",
  graphiql: process.env.NODE_ENV === "development",
  fetchAPI: { Response },
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? "https://v2.umamin.link"
        : "http://localhost:3000",
    credentials: true,
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  plugins: [
    useCSRFPrevention({
      requestHeaders: ["x-graphql-yoga-csrf"],
    }),
    useDisableIntrospection({
      isDisabled: () => process.env.NODE_ENV === "production",
    }),
    useAPQ(),
  ],
});

export {
  handleRequest as GET,
  handleRequest as POST,
  handleRequest as OPTIONS,
};
