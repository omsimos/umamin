"use client";

import { useMemo } from "react";
import {
  UrqlProvider,
  ssrExchange,
  fetchExchange,
  createClient,
} from "@urql/next";
import { cacheExchange } from "@urql/exchange-graphcache";

export default function Layout({ children }: React.PropsWithChildren) {
  const [client, ssr] = useMemo(() => {
    const ssr = ssrExchange({
      isClient: typeof window !== "undefined",
    });
    const client = createClient({
      url:
        process.env.NODE_ENV === "production"
          ? "https://v2.umamin.link/api/graphql"
          : "http://localhost:3000/api/graphql",
      exchanges: [cacheExchange({}), ssr, fetchExchange],
      suspense: true,
    });

    return [client, ssr];
  }, []);

  return (
    <UrqlProvider client={client} ssr={ssr}>
      {children}
    </UrqlProvider>
  );
}
