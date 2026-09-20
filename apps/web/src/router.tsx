import {
  defaultShouldDehydrateQuery,
  MutationCache,
  QueryClient,
} from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
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

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    // React Query owns data caching; the router shouldn't also GC loader data.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    // Cross-fade route changes through the View Transitions API (a no-op
    // where unsupported). Duration and the reduced-motion opt-out live in
    // styles.css. Applied only once loaders resolve, so data fetching is
    // never behind a frozen frame.
    defaultViewTransition: true,
  });

  // Mutates the router in place (it does not return one) and owns the
  // QueryClientProvider wrap — see providers.tsx.
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
