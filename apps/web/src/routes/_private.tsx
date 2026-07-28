import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { Menubar } from "@/components/menu-bar";
import { Navbar } from "@/components/navbar";
import { loadViewer } from "@/lib/loader-viewer";

// Pathless private layout. Ports apps/www's (private)/layout.tsx (Navbar +
// Menubar + Footer + the shared pt-24 offset) AND the session gate that lived
// in every private page.tsx: resolve the viewer, then redirect unauthenticated
// visitors to /login. Because loadViewer seeds queryKeys.currentUser(), the
// descendant components that read it hydrate without a client round-trip.
export const Route = createFileRoute("/_private")({
  beforeLoad: async ({ context }) => {
    const data = await loadViewer(context.queryClient);

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
