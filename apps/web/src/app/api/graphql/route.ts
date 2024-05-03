import { getSession } from "@/lib/auth";
import { createYoga } from "graphql-yoga";
import { gqlSchema } from "@umamin/server";
import { useAPQ } from "@graphql-yoga/plugin-apq";
import { useCSRFPrevention } from "@graphql-yoga/plugin-csrf-prevention";
import { useDisableIntrospection } from "@graphql-yoga/plugin-disable-introspection";

const origin = process.env.NEXT_PUBLIC_VERCEL_URL;

const { handleRequest } = createYoga({
  schema: gqlSchema,
  context: async () => {
    const { user } = await getSession();

    return {
      currentUser: user,
    };
  },
  graphqlEndpoint: "/api/graphql",
  graphiql: process.env.NODE_ENV === "development",
  fetchAPI: { Response },
  cors: {
    origin: origin ? `https://${origin}` : "http://localhost:3000",
    credentials: true,
    allowedHeaders: ["Content-Type, Authorization"],
    methods: ["POST, GET"],
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
