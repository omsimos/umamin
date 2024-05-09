import { registerUrql } from "@urql/next/rsc";
import { cacheExchange } from "@urql/exchange-graphcache";
import { createClient, fetchExchange } from "@urql/core";

const makeClient = () => {
  return createClient({
    url:
      process.env.NODE_ENV === "production"
        ? "https://v2.umamin.link/api/graphql"
        : "http://localhost:3000/api/graphql",
    exchanges: [cacheExchange({}), fetchExchange],
  });
};

export const { getClient } = registerUrql(makeClient);
