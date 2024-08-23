import { Client, cacheExchange, fetchExchange } from "@urql/core";
import { persistedExchange } from "@urql/exchange-persisted";

const client = new Client({
  url: process.env.NEXT_PUBLIC_GQL_URL!,
  exchanges: [
    cacheExchange,
    persistedExchange({
      enforcePersistedQueries: true,
      enableForMutation: true,
      generateHash: (_, document: any) => document.documentId,
    }),
    fetchExchange,
  ],
});

export default client;
