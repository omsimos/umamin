import { Suspense } from "react";
import { SiteFooter } from "@/components/landing/site-footer";
import { Navbar } from "@/components/navbar";
import { PublicMenubar } from "@/components/public-menu-bar";

// Same shell as (public) but without its pt-24 wrapper, so the landing's
// backgrounds can run underneath the fixed navbar.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <Navbar />
      </Suspense>
      <Suspense fallback={null}>
        <PublicMenubar />
      </Suspense>
      {children}
      <SiteFooter />
    </>
  );
}
