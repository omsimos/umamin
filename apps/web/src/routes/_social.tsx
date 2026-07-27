import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { PublicMenubar } from "@/components/public-menu-bar";

// Pathless layout for the core social pages (feed / notes / post / user / to),
// mirroring apps/www's `(public)` route-group layout: the desktop Navbar +
// PublicMenubar, a pt-24 content offset, and the site Footer. Named `_social`
// (not `_public`) to avoid colliding with the marketing group's own layout —
// kept self-contained so the parallel route groups don't depend on it. Under
// cacheComponents the www version wrapped each chrome piece in Suspense to
// isolate its cookie read; loaders resolve session data here, so no Suspense
// boundary is needed for the chrome.
export const Route = createFileRoute("/_social")({
  component: SocialLayout,
});

function SocialLayout() {
  return (
    <>
      <Navbar />
      <PublicMenubar />
      <div className="pt-24">
        <Outlet />
      </div>
      <Footer />
    </>
  );
}
