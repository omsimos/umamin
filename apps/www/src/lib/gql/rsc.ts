import { cache } from "react";
import { lucia } from "../auth";
import { registerUrql } from "@urql/next/rsc";
import { cacheExchange, createClient, fetchExchange } from "@urql/core";

const getClient = cache((sessionId?: string) => {
  const makeClient = () => {
    return createClient({
      url: process.env.NEXT_PUBLIC_GQL_URL!,
      exchanges: [cacheExchange, fetchExchange],
      fetchOptions: () => ({
        headers: {
          cookie: `${lucia.sessionCookieName}=${sessionId}`,
        },
      }),
    });
  };

  const { getClient: _getClient } = registerUrql(makeClient);

  return _getClient();
});

export default getClient;
