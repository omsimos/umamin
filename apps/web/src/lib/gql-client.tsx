import { registerUrql } from "@urql/next/rsc";
import { cacheExchange, createClient, fetchExchange } from "urql/core";

const makeClient = () => {
  return createClient({
    url: process.env.NEXT_PUBLIC_GQL_URL!,
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: { cache: "no-store" },
  });
};

export const { getClient } = registerUrql(makeClient);
