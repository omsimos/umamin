import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { Menubar } from "@/components/menu-bar";
import { Navbar } from "@/components/navbar";
import { loaderFetchOptional } from "@/lib/loader-fetch";
import { queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import type { CurrentUserResponse } from "@/lib/types";

// Pathless private layout. Ports apps/www's (private)/layout.tsx (Navbar +
// Menubar + Footer + the shared pt-24 offset) AND the session gate that lived
// in every private page.tsx: ensure the current-user query (SSR forwards the
// cookie via the loader-fetch helper), then redirect unauthenticated visitors
// to /login. Because the query is seeded here, the descendant components that
// read queryKeys.currentUser() hydrate without a client round-trip.
export const Route = createFileRoute("/_private")({
  beforeLoad: async ({ context }) => {
    const data = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.currentUser(),
      queryFn: () =>
        loaderFetchOptional<CurrentUserResponse>(
          "/api/me",
          fetchCurrentUserOptional,
          {} as CurrentUserResponse,
        ),
    });

    if (!data?.user) {
      throw redirect({ to: "/login" });
    }

    return { currentUser: data };
  },
  component: PrivateLayout,
});

function PrivateLayout() {
  return (
    <>
      <Suspense>
        <Navbar />
        <Menubar />
      </Suspense>
      <div className="pt-24">
        <Outlet />
      </div>
      <Footer />
    </>
  );
}
