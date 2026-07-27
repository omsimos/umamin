import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // Mirrors apps/www lib/get-query-client.ts: per-query staleTime is set at the
  // call site (query.ts tiers), so the client default is 0; dehydration also
  // ships still-pending queries so a streamed SSR load hydrates on the client.
  // (The apps/www `shouldRedactErrors:false` note was Next-specific and drops.)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 0 },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });

  return routerWithQueryClient(
    createTanStackRouter({
      routeTree,
      context: { queryClient },
      defaultPreload: "intent",
      // React Query owns data caching; the router shouldn't also GC loader data.
      defaultPreloadStaleTime: 0,
      scrollRestoration: true,
    }),
    queryClient,
  );
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
