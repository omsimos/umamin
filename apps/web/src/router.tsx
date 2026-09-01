import {
  defaultShouldDehydrateQuery,
  MutationCache,
  QueryClient,
} from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { captureException } from "@/lib/posthog";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // Mirrors apps/www lib/get-query-client.ts: per-query staleTime is set at the
  // call site (query.ts tiers), so the client default is 0; dehydration also
  // ships still-pending queries so a streamed SSR load hydrates on the client.
  // (The apps/www `shouldRedactErrors:false` note was Next-specific and drops.)
  const queryClient = new QueryClient({
    // Net for the mutationFns that actually throw. Most action call sites
    // resolve with `{ error }` instead (covered by callAction's own capture),
    // so this only fires for re-throwing and non-action mutations.
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        captureException(error, {
          source: "mutation",
          mutationKey: mutation.options.mutationKey
            ? JSON.stringify(mutation.options.mutationKey)
            : undefined,
        });
      },
    }),
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
