import { lucia } from "../auth";
import { registerUrql } from "@urql/next/rsc";
import { persistedExchange } from "@urql/exchange-persisted";
import { cacheExchange, createClient, fetchExchange } from "@urql/core";

const getClient = (sessionId?: string) => {
  const makeClient = () => {
    return createClient({
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
      fetchOptions: () => ({
        headers: {
          cookie: `${lucia.sessionCookieName}=${sessionId}`,
        },
      }),
    });
  };

  const { getClient: _getClient } = registerUrql(makeClient);

  return _getClient();
};

export default getClient;
