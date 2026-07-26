import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { PublicMenubar } from "@/components/public-menu-bar";

// Public app chrome, ported from apps/www app/(public)/layout.tsx. The Navbar /
// PublicMenubar / Footer are all route-aware (they self-hide on /post, in
// standalone PWA, etc.), so this layout wraps every public page uniformly.
// Shared structure per the migration plan (routes/_public/) — the feed/notes
// route group nests under the same pathless layout.
export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});

function PublicLayout() {
  return (
    <>
      <Suspense fallback={null}>
        <Navbar />
      </Suspense>
      <Suspense fallback={null}>
        <PublicMenubar />
      </Suspense>
      <div className="pt-24">
        <Outlet />
      </div>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}
