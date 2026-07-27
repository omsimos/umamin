import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Suspense } from "react";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { SiteFooter } from "@/components/landing/site-footer";

// Marketing shell (ported from apps/www app/(marketing)/layout.tsx): its own
// navbar + footer, no in-app chrome. Backgrounds run underneath the fixed
// navbar (no pt-24 wrapper).
export const Route = createFileRoute("/_marketing")({
  component: MarketingLayout,
});

function MarketingLayout() {
  return (
    <>
      <Suspense fallback={null}>
        <LandingNavbar />
      </Suspense>
      <Outlet />
      <SiteFooter />
    </>
  );
}
