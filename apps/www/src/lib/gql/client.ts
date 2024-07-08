import { Client, cacheExchange, fetchExchange } from "@urql/core";

const client = new Client({
  url: process.env.NEXT_PUBLIC_GQL_URL!,
  exchanges: [cacheExchange, fetchExchange],
});

export default client
