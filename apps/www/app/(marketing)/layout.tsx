import { Suspense } from "react";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { SiteFooter } from "@/components/landing/site-footer";

// Marketing shell: its own navbar + footer, no in-app chrome (no bottom
// menubar). Backgrounds run underneath the fixed navbar (no pt-24 wrapper).
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <LandingNavbar />
      </Suspense>
      {children}
      <SiteFooter />
    </>
  );
}
