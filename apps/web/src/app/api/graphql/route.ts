import { gqlSchema } from "@umamin/server";
import { createYoga } from "graphql-yoga";
import { useAPQ } from "@graphql-yoga/plugin-apq";
import { useCSRFPrevention } from "@graphql-yoga/plugin-csrf-prevention";

const origin = process.env.NEXT_PUBLIC_VERCEL_URL;

const { handleRequest } = createYoga({
  schema: gqlSchema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
  cors: {
    origin: origin ? `https://${origin}` : "http://localhost:3000",
    credentials: true,
    allowedHeaders: ["Content-Type, Authorization"],
    methods: ["POST"],
  },
  plugins: [
    useCSRFPrevention({
      requestHeaders: ["x-graphql-yoga-csrf"],
    }),
    useAPQ(),
  ],
});

export {
  handleRequest as GET,
  handleRequest as POST,
  handleRequest as OPTIONS,
};
